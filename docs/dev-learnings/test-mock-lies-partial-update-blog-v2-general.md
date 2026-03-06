# 테스트 다 통과했는데 버그가 4번 살아남은 이유 🧟

> **실화입니다.** 실제 오픈소스 라이브러리를 연동하다 겪은 일입니다.
> 4회 재시도, 테스트 전부 통과, 그러나 프로덕션은 계속 실패.
> 그리고 2개 필드 중 1개만 반영되는 부분 성공 버그까지.

---

## TL;DR

**Mock이 현실을 정확히 반영하지 않으면, 테스트는 거짓말을 한다 (Mock fidelity 문제).**
그리고 부분 업데이트(Partial Update)는 조용히 데이터를 망가뜨린다.

---

## 문제 상황: 고칠 때마다 살아나는 버그

외부 API를 연동하는 코드에서 이런 에러가 났다고 가정해봅시다:

```text
[ERROR] VALIDATION_ERROR: Status 'In Progress' is not valid.
Available: Start Progress, Done
```

"아, 매칭 로직이 잘못됐구나. 고치면 되겠네."

고쳤습니다. 다시 실행했습니다. 에러가 났습니다:

```text
[ERROR] VALIDATION_ERROR: Status 'In Progress' is not valid.
Available: Done, Start Progress
```

...순서가 바뀌었습니다.

"뭔가 바뀌긴 했는데... 왜 아직도 안 되지?"

이걸 **4번** 반복했습니다. 🫠

### 증상 변화 ≠ 원인 해결

에러 메시지가 조금씩 달라졌기 때문에 "뭔가 고쳐지고 있다"고 착각했습니다.
하지만 그건 착각입니다. **증상이 바뀌었다고 원인이 해결된 게 아닙니다.**
원인은 처음부터 끝까지 같은 한 곳에 있었습니다.

---

## 진짜 원인: 라이브러리가 몰래 타입을 바꿨다

### 친절한 금자씨 같은 라이브러리의 배신

REST API를 직접 호출하면 이런 응답이 옵니다:

```json
{
    "transitions": [
        {
            "id": "21",
            "name": "Start Progress",
            "to": {
                "name": "In Progress",
                "id": "3"
            }
        }
    ]
}
```

`to`가 **dict**입니다. 당연히 코드도 그렇게 짰죠:

```python
def _get_target_name(t: dict) -> str:
    to = t.get("to")
    if isinstance(to, dict):     # dict 체크
        return to.get("name", "")
    return ""
```

그런데 많은 라이브러리 래퍼들은 "편의를 위해" 데이터를 가공합니다.
실제 어느 라이브러리의 내부 코드를 열어보면:

```python
# 라이브러리 내부
return [
    {
        "name": transition["name"],
        "id": int(transition["id"]),
        "to": transition["to"]["name"],  # ← 친절하게 꺼내줌: dict → str 변환
    }
    for transition in raw_data.get("transitions")
]
```

라이브러리가 친절하게 `to` 필드를 **dict에서 str로 변환**해서 반환합니다.
문서에는 이런 내용이 없습니다. 소스를 열어야만 알 수 있는 사실입니다.

즉 실제로 받는 데이터는:

```python
{"id": 21, "name": "Start Progress", "to": "In Progress"}  # to = str!
```

그러니 `isinstance(to, dict)` 체크는 **항상 False**, `_get_target_name()`은 **항상 `""`** 반환, 매칭은 **항상 실패**.

### 에러 메시지가 살짝 바뀐 이유

| 커밋    | 로직 변경                                            | 결과                            |
| ------- | ---------------------------------------------------- | ------------------------------- |
| 수정 전 | `[t.get("name") for t in transitions]`               | `Start Progress, Done`          |
| 수정 후 | `sorted({_get_target_name(t) or t.get("name") ...})` | `Done, Start Progress` (정렬됨) |

`_get_target_name(t)`이 여전히 `""`를 반환하니까 `or` 뒤로 계속 폴백 중.
순서만 바뀐 거지 근본은 그대로였습니다.

---

## 테스트는 왜 통과했나: Mock fidelity 문제

**Mock fidelity**란 Mock 데이터가 실제 시스템의 반환값을 얼마나 정확히 재현하는가를 뜻합니다.
이 fidelity가 낮으면 테스트는 통과해도 프로덕션은 터집니다.

```python
# 테스트에서 이렇게 Mock을 설정했음 (Mock fidelity 낮음)
mock_client.get_transitions.return_value = [
    {"id": "21", "name": "Start Progress", "to": {"name": "In Progress"}},
#                                            ↑ dict — 실제와 다른 형태
]
```

실제 라이브러리는 `"to": "In Progress"` (str)를 반환하는데,
테스트 Mock은 `"to": {"name": "In Progress"}` (dict)를 반환했습니다.

결과:

- 테스트에서는 `isinstance(to, dict) = True` → 함수 정상 작동 → 통과 ✅
- 실제로는 `isinstance(to, dict) = False` → 빈 문자열 반환 → 매칭 실패 ❌

**테스트 통과 = 코드 정상 동작이 아닙니다.**
**테스트 통과 = Mock fidelity가 높을 때만 코드 정상 동작입니다.**

---

## 보너스 버그: 조용한 부분 업데이트

### 에러 나기 직전에 다른 필드가 이미 저장됨

```python
# 원래 코드의 실행 순서

# 1단계: 다른 필드 먼저 업데이트 (실제 API 호출 → 이미 반영됨!)
client.update_resource(id=resource_id, fields=fields)

# 2단계: status 검증
if status:
    transitions = client.get_transitions(resource_id)
    matched = ...  # ← 여기서 매칭 실패

    if not matched:
        raise ValidationError(...)  # ← 에러 발생, 하지만 이미 늦음
```

`--status "In Progress" --title "새 제목"` 명령을 쳤을 때:

- **title**: 이미 저장됨 ✅
- **status**: 변경 실패 ❌

사용자는 에러 메시지를 보고 "아 실패했구나" 하는데, 실제로는 title은 바뀐 상태입니다.
조용하고, 재현하기 어렵고, 디버깅하기 끔찍한 버그입니다.

---

## 해결: 검증 먼저, 실행 나중에

### 원자성 확보 (Validate First, Execute Later)

```python
def _get_target_name(t: dict) -> str:
    to = t.get("to")
    if isinstance(to, str):    # 실제 라이브러리 반환 형식
        return to
    if isinstance(to, dict):   # 구버전/직접 API 호출 호환
        return to.get("name", "")
    return ""

# 1단계: 유효성 먼저 검증 (아직 아무것도 바꾸지 않음)
matched_transition = None
if status:
    transitions = client.get_transitions(resource_id)
    matched_transition = next(
        (t for t in transitions if _get_target_name(t).lower() == status.lower()),
        None,
    )
    if not matched_transition:
        raise ValidationError(...)  # 여기서 종료 → 아직 아무것도 안 바뀜

# 2단계: 검증 통과 후에만 실제 업데이트
client.update_resource(...)
if matched_transition:
    client.apply_transition(...)
```

### Mock fidelity도 높이기

```python
# 수정 전 (Mock fidelity 낮음 — 현실과 다른 형태)
{"id": "21", "name": "Start Progress", "to": {"name": "In Progress"}}

# 수정 후 (Mock fidelity 높음 — 실제 라이브러리 반환 형식 반영)
{"id": "21", "name": "Start Progress", "to": "In Progress"}
```

실행 순서 원칙:

```text
❌ 나쁜 패턴: 실행 → 실행 → 검증 → 실패  (일부는 이미 반영됨)
✅ 좋은 패턴: 검증 → 검증 → 통과 → 실행 → 실행
```

---

## 교훈 3가지

### 1. 라이브러리 소스를 한 번은 직접 봐라

문서는 종종 불완전하고, 라이브러리는 조용히 타입을 바꿉니다.
디버깅이 막히면 추상화 한 겹 아래를 봐야 합니다.

```bash
# Python 라이브러리 소스 확인 예시
cat .venv/lib/python3.11/site-packages/<library>/<module>.py | grep -A10 "def 함수명"
```

### 2. Mock fidelity를 확보해라

Mock을 만들기 전에 실제 라이브러리가 무엇을 반환하는지 확인하세요.
Mock fidelity가 낮으면 테스트는 거짓 안전감을 줍니다.

```python
# 실제 반환값을 한 번은 출력해보기
import json
result = real_client.get_something(id)
print(json.dumps(result, indent=2, default=str))
```

### 3. 검증과 실행은 분리해라

API 콜처럼 되돌릴 수 없는 작업은 반드시 검증을 먼저 끝내고 실행해야 합니다.
DB 트랜잭션이나 분산 시스템에서는 이게 기본 상식인데, 단순한 로직에서는 가끔 잊어버립니다.

---

## 바로 적용할 수 있는 체크리스트

PR을 올리기 전, 혹은 외부 라이브러리를 처음 연동할 때 확인하세요.

- [ ] **실제 반환 payload 확인**: 라이브러리가 반환하는 실제 데이터를 출력해서 타입과 구조를 직접 확인했는가?
- [ ] **Mock fidelity 점검**: Mock 데이터의 타입·구조가 실제 반환값과 일치하는가?
- [ ] **검증 선행 여부**: 되돌릴 수 없는 실행(API 호출, DB 쓰기) 이전에 모든 유효성 검증을 끝냈는가?
- [ ] **부분 실패 시나리오**: 작업 중간에 실패하면 이미 반영된 내용이 있는가? 있다면 롤백 전략이 있는가?
- [ ] **증상이 아닌 원인 확인**: 에러 메시지가 바뀌었을 때 "증상 변화"인지 "원인 해결"인지 구분했는가?

---

## 결론

테스트가 통과한다는 건 **Mock fidelity가 충분히 높다**는 조건이 전제됩니다.
라이브러리가 반환하는 실제 타입을 확인하지 않으면, 테스트는 거짓말을 합니다.

4번의 시도 끝에 잡은 버그의 본질은 단 두 글자 차이였습니다:

```python
"to": {"name": "In Progress"}   # Mock이 가정한 세계
"to": "In Progress"             # 실제 세계
```

이 한 줄 차이가 에러를 4번 살아남게 했습니다. 🧟

---

**P.S.** AI 3명이 달라붙어서 잡은 버그입니다. 원인을 찾고 나니 허무했지만, 그래서 더 오래 기억에 남습니다.

**P.P.S.** 라이브러리 개발자들에게: `to`를 왜 str로 변환하셨나요? dict 그대로 주시면 안 됐나요? 🥲

---

## 부록: "AI가 쓴 글이잖아" 라는 무시에 대한 항변

이 글의 초안 작성, 피드백, 수정까지 AI와 함께 진행했습니다.
"AI가 쓴 글은 읽을 가치가 없다"고 생각한다면, 아래 수치를 먼저 보세요.

이 글의 피드백을 두 채널에서 받았습니다.
한 채널은 AI(비용: **약 130원 ($0.10)**), 다른 채널은 숙련된 개발자(시급: **약 35,000원 ($24)**).
두 피드백의 구조, 구체성, 실행 가능성은 거의 동등했습니다. 비용 차이는 **약 270배**입니다.

"AI가 썼다"는 사실은 글의 내용과 무관합니다.
독자가 판단할 것은 **작성자의 정체가 아니라 글이 주는 인사이트**입니다.
망치가 인간이 만들었든 기계가 만들었든, 못을 잘 박으면 좋은 망치입니다.

AI를 도구로 쓰는 개발자는 쓰지 않는 개발자보다 같은 시간에 더 많이, 더 빠르게 생산합니다.
"AI가 썼다"는 이유로 읽기를 거부하는 동안, 다른 누군가는 그 시간에 다음 글을 발행하고 있습니다.
