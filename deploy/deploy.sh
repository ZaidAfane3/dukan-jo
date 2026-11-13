#!/usr/bin/env bash
# Deploy one commit: pull the image the GitHub Action built for it, restart the app, verify, roll back on failure.
#
# Run by the pipeline over Tailscale SSH (see .github/workflows/docker-publish.yml):
#   ./deploy/deploy.sh <full commit sha>
#
# Deliberately no `set -e`: every step is checked explicitly so a failure is logged and handled, and the app is
# never left down because the script died half way. Exits non-zero on failure so the pipeline job turns red.
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/deploy.log"

SHA="${1:-}"
if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: $0 <full 40-character commit sha>" >&2
  exit 2
fi

IMAGE="ghcr.io/zaidafane3/dukan-jo"   # must match `image:` in docker-compose.yml (the registry name is lowercase)
TAG="sha-${SHA:0:7}"                  # the tag docker/metadata-action (type=sha) gives the image of this commit
ROLLBACK_TAG="rollback"               # copy of the image that was running before this deploy
CONTAINER="dukkan-jo"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"   # seconds to wait for the app to answer
PULL_ATTEMPTS="${PULL_ATTEMPTS:-10}"     # the image may still be being pushed when the pipeline reaches us

# Everything goes to the log file and to stdout, so it also shows in the pipeline's output.
log() { echo "[$(date -Is)] $*" | tee -a "$LOG_FILE"; }
run() { "$@" 2>&1 | tee -a "$LOG_FILE"; return "${PIPESTATUS[0]}"; }

# Polls the app until it answers with a non-error HTTP status (anything below 500) or the timeout passes.
healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) code=""
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

# Starts the app from the image tagged $1 (docker-compose.yml reads it through IMAGE_TAG).
start() { IMAGE_TAG="$1" run docker compose up -d --no-build; }

rollback() {
  log "ROLLBACK: $1"
  if ! docker image inspect "$IMAGE:$ROLLBACK_TAG" >/dev/null 2>&1; then
    log "ROLLBACK impossible: no previous image saved (first deploy?). Leaving whatever is running as it is."
    return 1
  fi
  if start "$ROLLBACK_TAG" && healthy; then
    log "ROLLBACK OK: the previous version is running again"
    return 0
  fi
  log "ROLLBACK FAILED: the previous image did not come up healthy either, needs manual attention"
  return 1
}

cd "$REPO_DIR" || { echo "cannot cd to $REPO_DIR" >&2; exit 1; }

# One deploy at a time; the pipeline queues deploys too, this protects against a manual run in parallel.
exec 9>"$REPO_DIR/deploy/deploy.lock"
flock -w 600 9 || { log "could not get the deploy lock within 10 minutes"; exit 1; }

log "DEPLOY START: $SHA ($IMAGE:$TAG)"

# Check out the commit so docker-compose.yml matches the image being deployed. Detached on purpose.
if ! run git fetch origin main || ! run git checkout --detach "$SHA"; then
  log "DEPLOY FAILED: could not check out $SHA (nothing changed)"
  exit 1
fi

# Fetch the image. The deploy job runs after the push job, but retry briefly in case the registry is slow.
pulled=""
for ((i = 1; i <= PULL_ATTEMPTS; i++)); do
  if IMAGE_TAG="$TAG" run docker compose pull app; then pulled=1; break; fi
  log "image $IMAGE:$TAG not available yet (attempt $i/$PULL_ATTEMPTS)"
  sleep 10
done
if [ -z "$pulled" ]; then
  log "DEPLOY FAILED: could not pull $IMAGE:$TAG (nothing changed, the old version is still running)"
  exit 1
fi

# Keep the image that is running now so it can be restored.
running_image="$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
if [ -n "$running_image" ]; then
  run docker tag "$running_image" "$IMAGE:$ROLLBACK_TAG" || log "warning: could not save the current image for rollback"
else
  log "no running $CONTAINER container, so there is nothing to roll back to"
fi

FAILURE=""
if ! start "$TAG"; then
  FAILURE="docker compose up failed"
elif ! healthy; then
  FAILURE="new version started but failed the health check"
fi

if [ -n "$FAILURE" ]; then
  log "DEPLOY FAILED for $SHA: $FAILURE"
  rollback "$FAILURE"
  exit 1
fi

# Tidy up: old per-commit tags (the running image and the rollback copy keep their own tags), then dangling layers.
docker image ls "$IMAGE" --format '{{.Tag}}' | grep '^sha-' | grep -vx "$TAG" | while read -r old; do
  run docker rmi "$IMAGE:$old" >/dev/null || true
done
run docker image prune -f >/dev/null || log "warning: docker image prune failed (harmless)"

log "DEPLOY OK: $SHA is live"
exit 0
