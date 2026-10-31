#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/auto-deploy.log"

cd "$REPO_DIR"

exec 9>"$REPO_DIR/deploy/auto-deploy.lock"
flock -n 9 || exit 0

BEFORE="$(git rev-parse HEAD)"
git fetch origin main >>"$LOG_FILE" 2>&1
git merge --ff-only origin/main >>"$LOG_FILE" 2>&1
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  exit 0
fi

{
  echo "[$(date -Is)] $BEFORE -> $AFTER, rebuilding"
  docker compose build
  docker compose up -d
  docker image prune -f
  echo "[$(date -Is)] deploy done"
} >>"$LOG_FILE" 2>&1
