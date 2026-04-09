#!/usr/bin/env bash
# deploy-internal.sh
# 사내 GitHub Enterprise Pages 배포 스크립트
#
# 로컬에서 11ty 빌드 후 gh-pages 브랜치에 push하여 배포.
# Actions 불필요 — Settings → Pages → Source: "Deploy from a branch" → gh-pages / root
#
# 사용법: bash scripts/deploy-internal.sh

set -euo pipefail

REMOTE="origin"  # 사내 GitHub remote
BRANCH="gh-pages"
OUTPUT="_output"
CONFIG="site/.eleventy.js"
ELEVENTY="./site/node_modules/.bin/eleventy"
PREFIX="/pages/byoungwoo-yoon/playbook/"

echo "=== Internal Pages Deploy ==="

# 1. 빌드
echo "[1/4] Building site..."
ELEVENTY_PATH_PREFIX="$PREFIX" "$ELEVENTY" --config="$CONFIG"

# 2. gh-pages 브랜치 준비
echo "[2/4] Preparing $BRANCH branch..."
TMPDIR=$(mktemp -d)
cp -r "$OUTPUT"/. "$TMPDIR"/
touch "$TMPDIR/.nojekyll"

cd "$TMPDIR"
git init
git checkout -b "$BRANCH"
git add -A
git commit -m "deploy: $(date +%Y-%m-%d\ %H:%M:%S)"

# 3. push (force — gh-pages는 배포 전용 브랜치)
echo "[3/4] Pushing to $REMOTE/$BRANCH..."
git remote add "$REMOTE" "$(cd - > /dev/null && git remote get-url $REMOTE)"
git push -f "$REMOTE" "$BRANCH"

# 4. 정리
echo "[4/4] Cleanup..."
rm -rf "$TMPDIR"

echo ""
echo "=== Done ==="
echo "Settings → Pages → Source: Deploy from a branch → gh-pages / (root)"
