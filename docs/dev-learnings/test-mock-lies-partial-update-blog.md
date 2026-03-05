# 테스트 다 통과했는데 버그가 4번 살아남은 이유 🧟
## (feat. 라이브러리가 몰래 타입을 바꿨다)

---

## TL;DR

**라이브러리가 반환하는 실제 타입을 직접 확인하지 않으면, 테스트는 거짓말을 한다.**
그리고 부분 업데이트(Partial Update)는 조용히 데이터를 망가뜨린다.

---

## 문제 상황: 고칠 때마다 살아나는 버그

### 🔥 나의 현상: "분명히 고쳤는데?"

Jira CLI에서 `--status "In Progress"` 옵션을 넣었더니 이런 에러가 났습니다:

```
[ERROR] JIRA_VALIDATION_ERROR: Status 'In Progress' is not available for JIRAVIS-2.
Available: Start Progress, Done
```

"아, `to.name`으로 매칭 안 하고 transition 이름으로 매칭하고 있구나. 고치면 되겠네."

고쳤습니다. 다시 실행했습니다. 에러가 났습니다:

```
[ERROR] JIRA_VALIDATION_ERROR: Status 'In Progress' is not available for JIRAVIS-2.
Available: Done, Start Progress
```

...순서가 바뀌었습니다.

"뭔가 바뀌긴 했는데... 왜 아직도 안 되지?"

이걸 **4번** 반복했습니다. 🫠

---

## 진짜 원인: 라이브러리가 몰래 타입을 바꿨다

### 📦 atlassian-python-api의 배신

Jira REST API를 직접 호출하면 이런 응답이 옵니다:

```json
{
  "transitions": [
    {
      "id": "21",
      "name": "Start Progress",
      "to": {
        "name": "In Progress",
        "id": "3",
        "statusCategory": {...}
      }
    }
  ]
}
```

`to`가 **dict**입니다. 당연히 코드도 그렇게 짰죠:

```python
def _to_name(t: dict) -> str:
    to = t.get("to")
    if isinstance(to, dict):          # dict 체크
        return to.get("name", "")
    return ""
```

그런데 `atlassian-python-api` 라이브러리의 `get_issue_transitions()` 소스를 열어보면:

```python
# atlassian/jira.py
return [
    {
        "name": transition["name"],
        "id": int(transition["id"]),
        "to": transition["to"]["name"],  # ← 여기!!!
    }
    for transition in d.get("transitions")
]
```

라이브러리가 친절하게(?) `to` 필드를 **dict에서 str로 변환**해서 반환합니다.

즉 실제로 받는 데이터는:

```python
{"id": 21, "name": "Start Progress", "to": "In Progress"}  # to = str!
```

그러니 `isinstance(to, dict)` 체크는 **항상 False**, `_to_name()`은 **항상 `""`** 반환, 매칭은 **항상 실패**.

### 📊 에러 메시지가 살짝 바뀐 이유

| 커밋 | available 목록 생성 로직 | 출력 |
|------|--------------------------|------|
| 수정 전 | `[t.get("name") for t in transitions]` | `Start Progress, Done` (transition 이름) |
| 수정 후 | `sorted({_to_name(t) or t.get("name") ...})` | `Done, Start Progress` (정렬된 transition 이름) |

`_to_name(t)`이 여전히 `""`를 반환하니까 `or` 뒤의 `t.get("name")`(transition 이름)으로 계속 폴백 중.
순서만 바뀐 거지 근본은 그대로였습니다.

---

## 테스트는 왜 통과했나: Mock의 거짓말

### 🎭 Mock이 현실을 배신한 방법

```python
# 테스트에서 이렇게 Mock을 설정했음
mock_client.get_transitions.return_value = [
    {"id": "21", "name": "Start Progress", "to": {"name": "In Progress"}},
#                                            ↑ dict 형태로 Mock!
]
```

실제 라이브러리는 `"to": "In Progress"` (str)를 반환하는데,
테스트 Mock은 `"to": {"name": "In Progress"}` (dict)를 반환했습니다.

그래서 테스트에서는 `isinstance(to, dict) = True` → `_to_name()` 정상 작동 → 통과 ✅
실제로는 `isinstance(to, dict) = False` → `_to_name()` 빈 문자열 → 매칭 실패 ❌

**테스트 통과 = 코드 정상 동작**이 아닙니다.
**테스트 통과 = Mock이 현실을 정확히 반영했을 때만 코드 정상 동작**입니다.

---

## 보너스 버그: 조용한 부분 업데이트

### 💣 에러 나기 직전에 다른 필드가 이미 저장됨

```python
# 원래 코드의 실행 순서

# 1단계: 다른 필드 먼저 업데이트 (실제 API 호출)
client.update_issue(issue_key=ticket_id, fields=fields)  # ← summary, priority 이미 반영됨!

# 2단계: status 검증
if status:
    raw_transitions = client.get_transitions(ticket_id)
    matched = ...  # ← 여기서 매칭 실패

    if not matched:
        render_error(...)  # ← 에러 출력
        raise Exit(...)    # ← 종료되지만 이미 늦음
```

`--status "In Progress" --summary "새 제목"` 명령을 쳤을 때:
- **summary**: Jira에 이미 저장됨 ✅
- **status**: 변경 실패 ❌

사용자는 에러 메시지를 보고 "아 실패했구나" 하는데, 실제로는 summary는 바뀐 상태입니다.
조용하고, 재현하기 어렵고, 디버깅하기 끔찍한 버그입니다.

---

## 해결: 검증 먼저, 실행 나중에

### ✅ 원자성 확보 (Validate First, Execute Later)

```python
# 수정 후: status 검증을 맨 앞으로

def _to_name(t: dict) -> str:
    to = t.get("to")
    if isinstance(to, str):    # atlassian-python-api 실제 포맷
        return to
    if isinstance(to, dict):   # 구버전/테스트 호환
        return to.get("name", "")
    return ""

# 1단계: status 유효성 먼저 검증 (아직 아무것도 바꾸지 않음)
matched_transition = None
if status:
    raw_transitions = client.get_transitions(ticket_id)
    matched_transition = next(
        (t for t in raw_transitions if _to_name(t).lower() == status.lower()),
        None,
    )
    if not matched_transition:
        render_error(...)
        raise Exit(...)  # 여기서 종료 → 아직 아무것도 안 바뀜

# 2단계: 검증 통과 후에만 실제 업데이트
client.update_issue(...)
if matched_transition:
    client.transition_issue(...)
```

### ✅ Mock도 현실에 맞게

```python
# 수정 전 (현실과 다른 Mock)
{"id": "21", "name": "Start Progress", "to": {"name": "In Progress"}}

# 수정 후 (atlassian-python-api 실제 반환 형식)
{"id": "21", "name": "Start Progress", "to": "In Progress"}
```

---

## 교훈 3가지

### 1️⃣ 라이브러리 소스를 한 번은 직접 봐라

문서는 종종 거짓말을 하고, 라이브러리는 조용히 타입을 바꿉니다.
`get_issue_transitions()` 문서에는 "returns list of transitions" 정도만 나오고,
`to`가 str인지 dict인지는 **소스를 열어야** 알 수 있습니다.

```bash
# 실제 라이브러리 소스 확인 방법
cat .venv/lib/python3.11/site-packages/atlassian/jira.py | grep -A10 "def get_issue_transitions"
```

디버깅이 막히면 추상화 한 겹 아래를 봐야 합니다.

### 2️⃣ Mock은 현실의 사본이어야 한다

Mock이 편하다고 아무 형태로나 만들면 테스트가 거짓 안전감을 줍니다.
**Mock을 만들기 전에 실제 라이브러리가 무엇을 반환하는지 확인하세요.**

인테그레이션 테스트가 없다면, 최소한 이렇게라도:

```python
# 실제 라이브러리 반환값을 한 번은 출력해보기
import json
from tools.cli.jira.core.client import get_jira_client
c = get_jira_client("backend/.env")
print(json.dumps(c.get_transitions("JIRAVIS-2"), indent=2, default=str))
```

### 3️⃣ 검증과 실행은 분리해라

API 콜처럼 **되돌릴 수 없는 작업**은 반드시 검증을 먼저 끝내고 실행해야 합니다.

```
❌ 나쁜 패턴: 실행 → 실행 → 검증 → 실패 (일부는 이미 반영됨)
✅ 좋은 패턴: 검증 → 검증 → 통과 → 실행 → 실행
```

DB 트랜잭션이나 분산 시스템에서는 이게 기본 상식인데,
CLI 명령어에서는 가끔 잊어버립니다. 잊지 마세요.

---

## 결론

<div style="background: #fff3f3; padding: 20px; border-radius: 8px; border-left: 4px solid #cc0000;">

**에러 메시지가 조금 바뀌었다고 고친 게 아닙니다.**
**테스트가 통과한다고 버그가 없는 게 아닙니다.**
**라이브러리를 믿지 말고, 소스를 읽으세요.**

</div>

4번의 시도 끝에 잡은 버그의 본질은 단 두 글자 차이였습니다:

```python
"to": {"name": "In Progress"}   # Mock이 가정한 세계
"to": "In Progress"             # 실제 세계
```

이 한 줄 차이가 에러를 4번 살아남게 했습니다. 🧟

---

**P.S.** 동료 AI 3명이 달라붙어서 잡은 버그입니다. 사람이었으면 몇 시간이 걸렸을까요?

**P.P.S.** atlassian-python-api 팀에게: `to`를 왜 str로 변환하셨나요? dict 그대로 주시면 안 됐나요? 🥲
