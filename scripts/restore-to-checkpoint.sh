#!/usr/bin/env bash
# Roll the working tree back to the 2026-05-13 post-audit restore point.
#
# Code-only rollback (default): resets master to the tag, rebuilds, restarts.
# Full rollback (--with-data): also unpacks the filesystem zip, restoring
#   cms-data/, .env.local, and other config files. USE WITH CARE — this wipes
#   any CMS edits or password rotations made after the checkpoint.
#
# Usage:
#   scripts/restore-to-checkpoint.sh              # code only
#   scripts/restore-to-checkpoint.sh --with-data  # code + data + .env.local

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$PWD"

TAG="restore-point-2026-05-13-post-audit"
ZIP="cms-data/backups/backup-2026-05-13T21-43-20.zip"

WITH_DATA=0
if [[ "${1:-}" == "--with-data" ]]; then
  WITH_DATA=1
fi

echo "==> Repo: $REPO_ROOT"
echo "==> Tag:  $TAG"
git rev-parse --verify "refs/tags/$TAG" >/dev/null

echo
if [[ -n "$(git status --porcelain)" ]]; then
  echo "!! Working tree has uncommitted changes. Aborting."
  echo "   Commit or stash first, or run 'git status' to inspect."
  exit 1
fi

read -r -p "Reset master to $TAG (irreversible without re-tagging)? [y/N] " ans
[[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "Aborted."; exit 1; }

echo "==> git reset --hard $TAG"
git reset --hard "$TAG"

if [[ "$WITH_DATA" == "1" ]]; then
  [[ -f "$ZIP" ]] || { echo "!! Missing $ZIP"; exit 1; }
  read -r -p "Overwrite cms-data/ and .env.local from $ZIP? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "Skipping data restore."; WITH_DATA=0; }
fi

if [[ "$WITH_DATA" == "1" ]]; then
  echo "==> unzipping $ZIP into repo root"
  unzip -oq "$ZIP" -d "$REPO_ROOT"
  echo "==> data restored"
fi

echo "==> npm run build"
npm run build

echo "==> pm2 restart"
pm2 restart ecosystem.config.js

echo
echo "Done. Site at https://rhcsolutions.com"
