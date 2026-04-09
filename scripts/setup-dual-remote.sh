#!/usr/bin/env bash
# setup-dual-remote.sh
# playbook 저장소 dual-remote 구성 스크립트
#
# upstream: https://github.com/dEitY719/playbook.git (원본)
# origin:   https://github.samsungds.net/byoungwoo-yoon/playbook.git (사내)
#
# 사용법: bash setup-dual-remote.sh [clone-directory]

set -euo pipefail

UPSTREAM="https://github.com/dEitY719/playbook.git"
ORIGIN="https://github.samsungds.net/byoungwoo-yoon/playbook.git"
DIR="${1:-playbook}"

echo "=== playbook dual-remote setup ==="
echo "upstream: $UPSTREAM"
echo "origin:   $ORIGIN"
echo ""

# 1. upstream에서 clone
if [ -d "$DIR" ]; then
  echo "[skip] $DIR already exists"
  cd "$DIR"
else
  echo "[1/4] Cloning from upstream..."
  git clone "$UPSTREAM" "$DIR"
  cd "$DIR"
fi

# 2. remote 재구성: origin → upstream, 사내 → origin
echo "[2/4] Configuring remotes..."
git remote rename origin upstream 2>/dev/null || true
git remote add origin "$ORIGIN" 2>/dev/null || true

# 3. 확인
echo "[3/4] Remote configuration:"
git remote -v

# 4. 사내 origin에 push
echo ""
echo "[4/4] Pushing to origin (사내)..."
git push -u origin main

echo ""
echo "=== Done ==="
echo "  git pull upstream main   # 원본에서 최신 가져오기"
echo "  git push origin main     # 사내에 반영"
