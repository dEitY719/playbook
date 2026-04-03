# git worktree로 AI 에이전트 5개 동시에 굴렸더니 — 삭제가 더 어려웠다 🌳
## (feat. git worktree, git-crypt sparse-checkout, 셸 함수 에이전트명 충돌)

---

## TL;DR

**git worktree는 하나의 레포에서 여러 브랜치를 동시에 열 수 있는 기능이다. AI 에이전트별로 격리된 작업 공간을 만들기에 최적이지만, 생성보다 삭제/정리가 훨씬 까다롭다.**
자동화 셸 함수를 만들면서 겪은 2가지 함정을 공유합니다.

---

## git worktree란? — "복사가 아니라 창문이다"

### 🪟 처음에 나는 이렇게 이해했다

```
git worktree add ../dotfiles-claude-1
```

이 명령어를 처음 봤을 때, 나는 "아, 레포를 통째로 복사하는 거구나"라고 생각했습니다. `cp -r` 같은 거라고요.

**완전히 틀렸습니다.**

### 📐 실제 구조: 하나의 .git, 여러 개의 창문

```
/home/bwyoon/
├── dotfiles/              ← 메인 레포 (main 브랜치)
│   └── .git/              ← 유일한 .git 디렉토리
│       ├── objects/       ← 모든 커밋, 블롭, 트리 (공유!)
│       └── worktrees/     ← 워크트리 등록 정보
│           ├── dotfiles-claude-1/
│           └── dotfiles-codex-1/
├── dotfiles-claude-1/     ← 워크트리 (wt/claude/1 브랜치)
│   └── .git (파일!)       ← "../dotfiles/.git/worktrees/..." 를 가리키는 포인터
└── dotfiles-codex-1/      ← 워크트리 (wt/codex/1 브랜치)
    └── .git (파일!)       ← 마찬가지로 포인터
```

핵심은:

| 비유 | 설명 |
|------|------|
| **`.git/objects/`** | 도서관의 서고 (책 원본은 하나) |
| **워크트리** | 열람실의 책상 (같은 책을 다른 페이지에서 읽는 중) |
| **브랜치** | 각 책상에 펼쳐놓은 페이지 (동시에 다른 챕터 작업) |

복사가 아니라 **같은 저장소를 다른 브랜치로 동시에 여는 것**입니다. 디스크 공간도 거의 안 먹고, `git fetch`를 한 번 하면 모든 워크트리가 업데이트됩니다.

### 🤖 왜 AI 에이전트에 딱인가?

AI 코딩 에이전트(Claude, Codex, Gemini 등)를 동시에 돌리면, 같은 레포에서 같은 파일을 동시에 수정하려다 충돌이 납니다.

```
# 문제: 하나의 디렉토리에서 에이전트 2개가 동시에 main의 같은 파일 수정
Agent A: shell-common/functions/git.sh 수정 중...
Agent B: shell-common/functions/git.sh 수정 중...  ← 💥 충돌!
```

워크트리를 쓰면:

```
# 해결: 에이전트마다 격리된 워크트리
Agent Claude:  ~/dotfiles-claude-1/  (wt/claude/1 브랜치)
Agent Codex:   ~/dotfiles-codex-1/   (wt/codex/1 브랜치)
Agent Gemini:  ~/dotfiles-gemini-1/  (wt/gemini/1 브랜치)
```

각자 독립된 브랜치에서 작업하니까 충돌이 원천 차단됩니다. 나중에 PR로 merge하면 끝.

### ⚡ 실제 명령어 vs 자동화 셸 함수

기본 git 명령어로 워크트리를 다루려면 이 정도가 필요합니다:

```bash
# 생성 (4줄)
git worktree add --no-checkout -b wt/claude/1 ../dotfiles-claude-1 origin/main
git -C ../dotfiles-claude-1 sparse-checkout init --no-cone
printf '/*\n!/.env\n!/.secrets\n' | git -C ../dotfiles-claude-1 sparse-checkout set --stdin
git -C ../dotfiles-claude-1 checkout

# 삭제 (3줄)
git worktree remove ../dotfiles-claude-1
git worktree prune
git branch -d wt/claude/1
```

7줄... 매번 치기엔 너무 길죠. 그래서 `gwt` 셸 함수를 만들었습니다:

```bash
gwt spawn claude           # 위 생성 4줄을 한 방에
gwt rm claude              # 위 삭제 3줄을 한 방에
gwt list                   # 현재 워크트리 목록
```

여기까지는 순조로웠습니다. 문제는 이 자동화를 만드는 과정에서 터졌습니다.

---

## 삽질 1: git-crypt가 worktree를 거부하다 🔐

### 🔥 현상: "checkout이 왜 실패하지?"

`gwt spawn claude`를 실행했더니 이런 에러가 뜹니다:

```
Preparing worktree (new branch 'wt/claude/1')
error: external filter 'git-crypt' smudge failed
fatal: opencode/opencode.json.internal: smudge filter git-crypt failed
```

git-crypt로 암호화된 파일이 checkout 시 smudge 필터를 거치는데, 워크트리에서는 git-crypt unlock이 안 된 상태이므로 복호화에 실패한 겁니다.

### 🔍 원인: 하드코딩의 저주

처음 sparse-checkout 패턴을 이렇게 작성했습니다:

```bash
# ❌ 하드코딩 (이전 코드)
printf '/*\n!/.env\n!/.secrets\n' | git -C "$wt_path" sparse-checkout set --stdin
```

`.env`와 `.secrets`만 제외했습니다. 그런데 `.gitattributes`를 열어보니:

```gitattributes
.env                                    filter=git-crypt diff=git-crypt
.secrets/**                             filter=git-crypt diff=git-crypt
opencode/opencode.json.internal         filter=git-crypt diff=git-crypt  ← 😱 이것도!
opencode/opencode.json.internal-a2g     filter=git-crypt diff=git-crypt  ← 😱 이것도!
```

**4개 패턴 중 2개만 제외**하고 있었으니 당연히 터지죠.

### ✅ 해결: .gitattributes에서 동적 파싱

```bash
# ✅ 동적 파싱 (수정 후 코드)
local excludes=""
if [ -f "$repo_root/.gitattributes" ]; then
    while IFS= read -r line; do
        case "$line" in
            *filter=git-crypt*)
                pattern="$(printf '%s' "$line" | awk '{print $1}')"
                excludes="${excludes}!/${pattern}\n"
                ;;
        esac
    done < "$repo_root/.gitattributes"
fi
printf "/*\n${excludes}" | git -C "$wt_path" sparse-checkout set --stdin
```

`.gitattributes`가 git-crypt의 **single source of truth**입니다. 여기서 `filter=git-crypt` 패턴을 읽으면 암호화 파일이 추가되어도 코드를 수정할 필요가 없습니다.

### 📊 교훈

| 접근 | 장점 | 단점 |
|------|------|------|
| 하드코딩 `!/.env !/.secrets` | 단순, 빠름 | 파일 추가 시 코드 수정 필요, 누락 시 장애 |
| `.gitattributes` 동적 파싱 | 자동 대응, 유지보수 불필요 | 약간 복잡 |
| `git-crypt status -e` 사용 | 정확 | unlock된 환경에서만 동작 |

---

## 삽질 2: "gwt rm gemini" — 레포 안의 gemini/ 폴더를 삭제하려 들다 🤦

### 🔥 현상: codex는 되는데 gemini만 안 된다

```bash
$ gwt rm codex
✅ Worktree removed: /home/bwyoon/dotfiles-codex-1
✅ Branch deleted: wt/codex/1
✅ Worktree removed: /home/bwyoon/dotfiles-codex-2
✅ Branch deleted: wt/codex/2

$ gwt rm gemini
❌ Cannot remove: gemini
```

codex는 2개가 한 번에 깔끔하게 삭제되는데, gemini는 에러. `--force`를 줘도 마찬가지:

```bash
$ gwt rm gemini --force
fatal: 'gemini' is not a working tree
❌ Failed to remove: gemini
```

"gemini is not a working tree"? 분명 `gwt list`에 보이는데?

### 🔍 원인: 이름이 같은 디렉토리가 레포 안에 있었다

에이전트명을 워크트리 경로로 resolve하는 로직은 이랬습니다:

```bash
# 첫 번째 분기: target이 디렉토리가 아니면 → 에이전트명으로 resolve
if [ ! -d "$target" ]; then
    # dotfiles-gemini-* 패턴으로 검색해서 전체 경로 획득
    ...
fi
# 두 번째 분기: 디렉토리면 → 그대로 git worktree remove에 전달
_gwt_remove_one "$target" "$force"
```

문제는:

```
dotfiles/
├── gemini/           ← Gemini CLI 설정 파일 (GEMINI.md, setup.sh)
├── codex/            ← (이 디렉토리는 없음!)
└── opencode/
```

**레포 안에 `gemini/` 디렉토리가 존재했습니다.** `[ ! -d "gemini" ]`가 FALSE를 반환해서, 에이전트명 resolve를 건너뛰고 `"gemini"` 문자열 그대로 `git worktree remove`에 전달한 거였습니다.

`codex/` 디렉토리는 레포에 없으니까 `[ ! -d "codex" ]`가 TRUE → resolve 로직을 타서 정상 동작.

**같은 코드인데 입력값에 따라 다른 경로를 탄 전형적인 edge case.**

### ✅ 해결: 에이전트명은 case문으로 먼저 잡기

```bash
# ✅ 알려진 에이전트명은 디렉토리 존재 여부와 무관하게 항상 resolve
case "$target" in
    claude|codex|gemini|opencode|cursor|copilot|agent)
        ;;  # → 에이전트 resolve 로직으로
    *)
        # 에이전트명이 아닌 경우에만 직접 경로로 처리
        if [ -d "$target" ]; then
            _gwt_remove_one "$target" "$force"
            return $?
        fi
        ;;
esac
```

에이전트명을 `case`문으로 **먼저** 감지하면, 동명 디렉토리가 있어도 무시하고 올바른 경로로 resolve합니다.

---

## 최종 정리: gwt 명령어 체계

```bash
# 생성
gwt spawn claude                   # → ../dotfiles-claude-1 (wt/claude/1)
gwt spawn codex --task login-fix   # → ../dotfiles-codex-1  (wt/codex/1-login-fix)

# 조회
gwt list
# [path]                          [commit]  [branch]
# /home/bwyoon/dotfiles           cb17fce   [main]
# /home/bwyoon/dotfiles-claude-1  cb17fce   [wt/claude/1]

# 삭제 (워크트리 + 브랜치 동시 정리)
gwt rm claude                      # 에이전트명으로 일괄 삭제
gwt rm ../dotfiles-claude-1        # 경로로 개별 삭제

# 워크트리 안에서 self-cleanup
cd ../dotfiles-claude-1
gwt teardown                       # 자기 자신을 정리하고 main으로 복귀
```

---

## 교훈 💡

1. **git worktree는 "복사"가 아니라 "창문"이다.** 같은 `.git/objects/`를 공유하므로 디스크도 절약되고, fetch도 한 번이면 모든 워크트리에 반영된다.

2. **자동화는 "생성"보다 "삭제"가 어렵다.** 워크트리 생성은 단순하지만, 삭제 시에는 워크트리 디렉토리 + 브랜치 + git 등록정보를 모두 정리해야 하고, 하나라도 빠지면 고아 상태가 된다.

3. **하드코딩된 제외 패턴은 시한폭탄이다.** `.gitattributes`처럼 이미 존재하는 single source of truth에서 동적으로 읽어야 한다. "지금은 2개뿐이니까"라는 판단이 3개월 후의 나를 고생시킨다.

4. **`[ -d "$var" ]`는 위험할 수 있다.** 상대 경로 기준으로 cwd에 동명 디렉토리가 있으면 전혀 다른 분기를 탄다. 특히 셸 함수에서 "이름 → 경로" 변환 로직은 이름 목록을 먼저 화이트리스트로 잡아야 안전하다.

---

## 결론

git worktree는 AI 멀티 에이전트 시대에 딱 맞는 도구입니다. 하나의 레포에서 Claude, Codex, Gemini가 각자의 브랜치에서 독립적으로 작업하고, 끝나면 PR로 merge — 이 워크플로우가 worktree 없이는 불가능합니다.

다만, 자동화 셸 함수를 만들면서 느낀 건: **git이 제공하는 "생성"은 친절한데, "삭제"는 직접 챙겨야 할 것들이 많다**는 겁니다. 워크트리 디렉토리, 브랜치, worktree 등록정보, sparse-checkout 설정 — 이 중 하나라도 정리가 안 되면 다음 spawn에서 `fatal: a branch named 'wt/codex/1' already exists` 같은 에러를 만나게 됩니다.

그래서 `gwt rm`이 워크트리와 브랜치를 한 번에 정리하도록 만들었고, 고아 상태(디렉토리는 삭제됐는데 브랜치가 남은 경우)도 fallback으로 처리합니다.

생성은 쉽고, 삭제는 어렵다. 인생도 코드도.

P.S. `gwt rm gemini` 버그를 찾을 때, Claude가 디버깅한다고 `git worktree remove`를 직접 실행해서 gemini 워크트리를 날려버렸습니다. 디버깅하다가 증거 인멸... 🕵️
