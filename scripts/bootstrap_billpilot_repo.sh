#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-../BillPilot}"
REMOTE_URL="${2:-https://github.com/KingGingerX/BillPilot.git}"

mkdir -p "${TARGET_DIR}"

rsync -av \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude 'data' \
  ./ "${TARGET_DIR}/"

cd "${TARGET_DIR}"

git init
git add .

if ! git diff --cached --quiet; then
  git commit -m "Initialize BillPilot"
fi

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "${REMOTE_URL}"

echo "BillPilot files are ready in ${TARGET_DIR}"
echo "Remote origin set to ${REMOTE_URL}"
echo "Next step (with network + auth): git push -u origin main"
