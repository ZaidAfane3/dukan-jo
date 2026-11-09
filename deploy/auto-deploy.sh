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

git fetch origin main >>"$LOG_FILE" 2>&1
git merge --ff-only origin/main >>"$LOG_FILE" 2>&1
HEAD_NOW="$(git rev-parse HEAD)"
DEPLOYED="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"

if [ "$HEAD_NOW" = "$DEPLOYED" ]; then
  exit 0
fi

# a failed build or start is logged and leaves the saved commit as it was, so the next run tries again
trap 'echo "[$(date -Is)] deploy of $HEAD_NOW FAILED (will retry on the next run)" >>"$LOG_FILE"' ERR

{
  echo "[$(date -Is)] ${DEPLOYED:-nothing recorded} -> $HEAD_NOW, rebuilding"
  docker compose build
  docker compose up -d
  docker image prune -f
  echo "[$(date -Is)] deploy done"
} >>"$LOG_FILE" 2>&1

echo "$HEAD_NOW" >"$DEPLOYED_FILE"
