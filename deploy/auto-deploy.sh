#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/auto-deploy.log"
# The commit the running app was last built from. Rebuilding is decided by this, not by whether this run's pull
# brought something new: a `git pull` done by hand would otherwise leave the app on old code forever.
DEPLOYED_FILE="$REPO_DIR/deploy/deployed-commit"

cd "$REPO_DIR"

exec 9>"$REPO_DIR/deploy/auto-deploy.lock"
flock -n 9 || exit 0

# every failure from here on is written to the log, including git: a hand-edited file on the server stops the merge, and
# before this the run then ended without a word, so nothing was ever built
HEAD_NOW="(not pulled yet)"
trap 'echo "[$(date -Is)] deploy of $HEAD_NOW FAILED at line $LINENO (will retry on the next run)" >>"$LOG_FILE"' ERR

if ! git fetch origin main >>"$LOG_FILE" 2>&1; then
  echo "[$(date -Is)] git fetch failed (network or GitHub access)" >>"$LOG_FILE"
  exit 1
fi
if ! git merge --ff-only origin/main >>"$LOG_FILE" 2>&1; then
  echo "[$(date -Is)] can't move to origin/main: files changed on the server or a local commit (see git status). Nothing was built." >>"$LOG_FILE"
  exit 1
fi
HEAD_NOW="$(git rev-parse HEAD)"
DEPLOYED="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"

if [ "$HEAD_NOW" = "$DEPLOYED" ]; then
  exit 0
fi

# a failed build or start is logged (the trap above) and leaves the saved commit as it was, so the next run tries again
{
  echo "[$(date -Is)] ${DEPLOYED:-nothing recorded} -> $HEAD_NOW, rebuilding"
  docker compose build
  docker compose up -d
  docker image prune -f
  echo "[$(date -Is)] deploy done"
} >>"$LOG_FILE" 2>&1

echo "$HEAD_NOW" >"$DEPLOYED_FILE"
