#!/usr/bin/env bash
# setup-pre-commit.sh
# 저장소 pre-commit 훅 설치 스크립트

set -euo pipefail

if ! command -v pre-commit >/dev/null 2>&1; then
  echo "pre-commit not found. Install first: pipx install pre-commit"
  exit 1
fi

pre-commit install
echo "pre-commit hook installed."
echo "Run once for baseline cleanup (optional): pre-commit run --all-files"
