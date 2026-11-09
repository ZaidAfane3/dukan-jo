#!/usr/bin/env bash
# Auto-deploy: pull origin/main, rebuild, restart, verify, and roll back if the new version doesn't come up.
#
# Deliberately no `set -e`: every step is checked explicitly so a failure is logged and handled, and the app is
# never left down because the script died half way.
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/auto-deploy.log"
# The commit the running app was last built from. Rebuilding is decided by this, not by whether this run's pull
# brought something new: a `git pull` done by hand would otherwise leave the app on old code forever.
DEPLOYED_FILE="$REPO_DIR/deploy/deployed-commit"

IMAGE="dukkan-jo"                # `image:` of the app service in docker-compose.yml
ROLLBACK_TAG="$IMAGE:rollback"   # copy of the image that was running before this deploy
HEALTH_URL="${HEALTH_URL:-http://localhost:3000}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"   # seconds to wait for the app to answer

log() { echo "[$(date -Is)] $*" >>"$LOG_FILE"; }

# Run a command with its output going to the log; returns the command's status.
run() { "$@" >>"$LOG_FILE" 2>&1; }

# Polls the app until it answers with a non-error HTTP status (anything below 500) or the timeout passes.
healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) code
  while [ "$SECONDS" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)"
    if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
      log "health check passed ($HEALTH_URL answered HTTP $code)"
      return 0
    fi
    sleep 3
  done
  log "health check FAILED ($HEALTH_URL gave no healthy answer within ${HEALTH_TIMEOUT}s, last status: ${code:-none})"
  return 1
}

# Puts the saved previous image back and starts it. Returns 0 only if the old version answers.
rollback() {
  local reason="$1"
  log "ROLLBACK: $reason"
  if ! docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
    log "ROLLBACK impossible: no previous image saved (first deploy?). Leaving whatever is running as it is."
    return 1
  fi
  run docker tag "$ROLLBACK_TAG" "$IMAGE:latest" || { log "ROLLBACK FAILED: could not re-tag the previous image"; return 1; }
  # --no-build: start the restored image as it is instead of building the broken code again
  if run docker compose up -d --no-build && healthy; then
    log "ROLLBACK OK: previous version is running again (deployed commit stays ${DEPLOYED:-unknown})"
    return 0
  fi
  log "ROLLBACK FAILED: the previous image did not come up healthy either, needs manual attention"
  return 1
}

# Last line of defence: whatever happened, try to make sure the app container is running.
ensure_up() {
  if [ "$(docker inspect -f '{{.State.Running}}' dukkan-jo 2>/dev/null)" != "true" ]; then
    log "app container is not running, starting it"
    run docker compose up -d --no-build || log "could not start the app container, needs manual attention"
  fi
}

cd "$REPO_DIR" || { echo "cannot cd to $REPO_DIR" >&2; exit 1; }

exec 9>"$REPO_DIR/deploy/auto-deploy.lock"
flock -n 9 || exit 0

if ! run git fetch origin main; then
  log "SKIPPED: git fetch failed (network or auth problem), nothing changed"
  ensure_up
  exit 0
fi
if ! run git merge --ff-only origin/main; then
  log "SKIPPED: local branch cannot fast-forward to origin/main (local commits or changes?), nothing changed"
  ensure_up
  exit 0
fi

HEAD_NOW="$(git rev-parse HEAD)"
DEPLOYED="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"

if [ "$HEAD_NOW" = "$DEPLOYED" ]; then
  ensure_up
  exit 0
fi

log "DEPLOY START: ${DEPLOYED:-nothing recorded} -> $HEAD_NOW"

# Keep the image that is running now so it can be restored. A build re-points the `dukkan-jo` tag at the new image.
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  run docker tag "$IMAGE" "$ROLLBACK_TAG" || log "warning: could not save the current image for rollback"
else
  log "no existing $IMAGE image, so there is nothing to roll back to"
fi

FAILURE=""
if ! run docker compose build; then
  FAILURE="build failed"
elif ! run docker compose up -d; then
  FAILURE="docker compose up failed"
elif ! healthy; then
  FAILURE="new version started but failed the health check"
fi

if [ -n "$FAILURE" ]; then
  log "DEPLOY FAILED for $HEAD_NOW: $FAILURE (will retry on the next run)"
  if [ "$FAILURE" = "build failed" ]; then
    # Nothing was replaced, the old container should still be running; just make sure of it.
    log "old version was not touched"
    ensure_up
  else
    rollback "$FAILURE" || ensure_up
  fi
  exit 1
fi

echo "$HEAD_NOW" >"$DEPLOYED_FILE"
run docker image prune -f || log "warning: docker image prune failed (harmless)"
log "DEPLOY OK: $HEAD_NOW is live"
exit 0
