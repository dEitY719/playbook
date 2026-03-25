# 3번 연속 timeout인데 LLM이 느린 게 아니었다 — SDK가 몰래 재시작하고 있었음 🔄
## (feat. litellm timeout, OpenAI SDK max_retries, asyncio.wait_for)

---

## TL;DR

**litellm에 `timeout`을 넘기면 OpenAI SDK의 httpx request timeout이 되고, timeout 시 SDK가 자동 retry(기본 2회)를 시도한다. LLM은 거의 다 만들었는데 매번 처음부터 다시 시작하느라 시간만 낭비하고 있었다.**
`timeout` 제거 + `num_retries=0` 명시 후 4차 테스트에서 79초 만에 성공.

---

## 문제 상황: timeout을 아무리 늘려도 계속 실패한다

### 🔥 나의 현상: "150초를 줬는데도 timeout이라고?"

[JIRAvis](https://github.com/dev-team-404/JIRAvis.git)의 이메일 시각화 기능은 LLM에게 마크다운 브리핑을 보내면, Jiravis 브랜딩이 적용된 예쁜 HTML 이메일로 변환해주는 기능입니다. 새벽 배치로 돌리면 잘 되는데, 사내 테스트 중 "테스트 발송" 버튼을 누르면 `HTTP 504 Gateway Timeout`이 뜨는 문제가 보고됐습니다.

"아, nginx timeout 문제겠지." 동료 3명이 문서를 쓰고, 원인을 분석하고, 해결 계획을 세웠습니다. nginx에 전용 location을 추가하고, visualize timeout을 조정하고, fallback HTML도 개선했습니다. 자신감에 차서 사내 테스트를 돌렸습니다.

**1차 테스트** (timeout=45초):

```
[visualize] LLM visualization timed out after 45s (attempt 1/1)
[visualize] result=timeout_fallback elapsed_ms=75020.5 error=timeout after 45s
```

"45초가 짧았나 보다. 실제로는 90초 정도 걸린다고 했으니까 100초로 늘리자."

**2차 테스트** (timeout=100초):

```
[visualize] LLM visualization timed out after 100s (attempt 1/1)
[visualize] result=timeout_fallback elapsed_ms=105014.6 error=timeout after 100s
```

"...100초도 안 되네? 150초로."

**3차 테스트** (timeout=150초):

```
[visualize] LLM visualization timed out after 150s (attempt 1/1)
[visualize] result=timeout_fallback elapsed_ms=157028.5 error=timeout after 150s
```

3번 연속 실패. timeout을 3배로 늘렸는데도 매번 정확히 timeout 직전에 실패합니다.

| 테스트 | timeout 설정 | 실제 대기 시간 | 결과 |
|--------|------------|-------------|------|
| 1차 | 45초 | 75초 | timeout_fallback |
| 2차 | 100초 | 105초 | timeout_fallback |
| 3차 | 150초 | 157초 | timeout_fallback |

그리고 매번 로그에 이 한 줄이 찍혔습니다:

```
openai._base_client - INFO - Retrying request to /chat/completions in 0.490475 seconds
```

"Retrying"? 뭘 retry 한다는 거지?

---

## 삽질 과정: timeout을 늘리면 해결될 줄 알았다

### 🔧 시도 1: timeout 45 → 100 → 150

처음에는 단순히 "LLM이 느리니까 timeout을 늘리면 되겠지"라고 생각했습니다. 동료도 "실제 테스트하면 90초 전후로 동작합니다"라고 했으니까요.

### 🔧 시도 2: asyncio.wait_for 버퍼 조정

기존 코드에 `timeout + 30`이라는 하드코딩된 버퍼가 있었습니다. 45초 timeout에 30초 buffer면 75초나 기다리는 셈이라, 비례 buffer(5%, min 5초, max 30초)로 바꿨습니다.

```python
# 변경 전
response = await asyncio.wait_for(..., timeout=timeout_s + 30)

# 변경 후
buffer_s = max(5, min(30, int(timeout_s * 0.05)))
response = await asyncio.wait_for(..., timeout=timeout_s + buffer_s)
```

이건 맞는 개선이었지만, **근본 원인이 아니었습니다.**

### 🤔 단서: "Retrying request" 로그

3회 테스트 모두에서 **정확히 같은 패턴**이 반복됐습니다:

1. LLM 호출 시작
2. `timeout_s` 경과 시점에 `Retrying request to /chat/completions` 로그
3. retry 시작 직후 `asyncio.wait_for`의 outer timeout에 걸려서 전체 취소

"잠깐. LLM이 느린 게 아니라, **뭔가가 중간에 끊고 다시 시작하는 건 아닌가?**"

---

## 진짜 원인: SDK의 이중 timeout + 자동 retry

### 📦 코드를 따라가 보자

문제의 코드는 이렇게 생겼습니다:

```python
kwargs = {
    "model": config.llm.model,
    "messages": [...],
    "timeout": timeout_s,  # ← 이게 문제
}
response = await asyncio.wait_for(
    litellm.acompletion(**kwargs),
    timeout=timeout_s + buffer_s,   # ← 바깥 timeout
)
```

`timeout`이 **두 군데**에 걸려 있었습니다. 하나는 litellm에 전달하는 값, 하나는 asyncio.wait_for.

### 🔍 litellm → OpenAI SDK → httpx 전달 경로

litellm 소스를 추적해 봤습니다:

```python
# litellm/llms/openai/handler.py
client = AsyncOpenAI(timeout=timeout, max_retries=max_retries)
```

litellm의 `timeout` 파라미터는 **OpenAI SDK의 httpx request timeout**으로 그대로 전달됩니다. 그리고 OpenAI SDK의 기본값을 확인하면:

```python
# openai/_constants.py
DEFAULT_TIMEOUT = httpx.Timeout(timeout=600, connect=5.0)  # 600초
DEFAULT_MAX_RETRIES = 2  # retry 2회!
```

**핵심**: 우리가 `timeout=100`을 넘기면, httpx가 100초 후에 요청을 강제 종료합니다. 그러면 OpenAI SDK는 "아, 에러났네. 재시도하자"라며 **처음부터 다시 요청**합니다.

### 💀 악순환의 메커니즘

이걸 시간순으로 그려보면:

```
[0초]   LLM 호출 시작 (timeout=100s 설정)
        LLM: "긴 HTML 생성 중..."
[100초] httpx: "100초 지났다! 연결 끊어!" → SDK TimeoutError
        SDK: "에러네? max_retries=2니까 재시도!" → Retrying request 로그
[100.5초] LLM 재호출 시작 (처음부터 다시!)
        LLM: "또 처음부터? OK, 긴 HTML 생성 중..."
[105초] asyncio.wait_for: "100 + 5초 buffer 끝! 전체 취소!"
        → asyncio.TimeoutError → fallback HTML 전송
```

LLM은 100초 동안 열심히 HTML을 만들고 있었는데, **완성 직전에 SDK가 연결을 끊어버리고 처음부터 다시 시작시켰던 겁니다.** 그리고 재시도한 지 5초 만에 바깥 timeout이 전체를 종료시켰습니다.

**LLM이 느린 게 아니었습니다. LLM은 매번 거의 다 만들었는데, SDK가 몰래 시지프스를 시키고 있었습니다.** 🪨

---

## 해결 방법: timeout 제거 + retry 비활성화

### ✅ Step 1: litellm에 timeout 전달 중단

```python
# 변경 전
kwargs = {
    "model": config.llm.model,
    "messages": [...],
    "timeout": timeout_s,       # SDK httpx timeout → retry 유발
}

# 변경 후
kwargs = {
    "model": config.llm.model,
    "messages": [...],
    "num_retries": 0,           # SDK retry 명시적 비활성화
    # timeout 미전달 → SDK 기본 600초 사용
}
```

### ✅ Step 2: asyncio.wait_for만으로 deadline 제어

```python
response = await asyncio.wait_for(
    litellm.acompletion(**kwargs),
    timeout=timeout_s,          # 우리의 유일한 deadline
)
```

이렇게 하면:

- SDK의 httpx는 600초(기본값)까지 느긋하게 기다림 → **중간에 끊지 않음**
- SDK retry도 0 → **재시작 없음**
- asyncio.wait_for가 150초에 전체를 깔끔하게 취소 → **안전장치 유지**

### 🎉 4차 테스트 결과

```
[visualize] LLM HTML generation completed (79.2s, 12237 chars)
[visualize] result=llm elapsed_ms=79192.8 html_length=12237 retries=0
```

**79초 만에 12,237자 HTML 생성 성공.** `Retrying request` 로그도 없습니다.

| 테스트 | timeout | SDK retry | 결과 | 소요 |
|--------|---------|-----------|------|------|
| 1차 | 45s (litellm) | 발생 | timeout_fallback | 75s |
| 2차 | 100s (litellm) | 발생 | timeout_fallback | 105s |
| 3차 | 150s (litellm) | 발생 | timeout_fallback | 157s |
| **4차** | **150s (wait_for only)** | **없음** | **llm 성공** | **79s** |

3번 연속 실패에서 1줄 수정으로 성공. 그리고 79초면 150초 timeout의 절반밖에 안 됩니다. LLM은 처음부터 충분히 빨랐습니다.

---

## 교훈

### 1. timeout은 한 레이어에서만 제어하라

```
asyncio.wait_for (150s)  ← 우리의 deadline
  └→ litellm.acompletion
       └→ OpenAI SDK (timeout=???)
            └→ httpx (timeout=???)
```

이 체인에서 **여러 레이어가 각자 timeout을 가지면**, 안쪽 timeout이 먼저 발동해서 바깥 의도와 다른 동작(retry, 재시작)을 유발합니다. timeout은 가장 바깥 레이어에서 한 번만 거는 것이 원칙입니다.

### 2. SDK의 기본 retry 정책을 반드시 확인하라

OpenAI SDK의 `DEFAULT_MAX_RETRIES = 2`는 일반 API 호출에서는 합리적인 기본값입니다. 하지만 **수십 초~수분 걸리는 긴 생성 작업**에서는 재앙입니다. "거의 다 만든 결과를 버리고 처음부터 다시"를 2번 반복하니까요.

라이브러리의 기본값을 맹신하지 마세요. 특히 timeout과 retry는 **내 워크로드에 맞는지** 반드시 확인해야 합니다.

### 3. "timeout을 늘리면 해결되겠지"는 위험한 가정이다

timeout을 45 → 100 → 150으로 3번 올렸는데 매번 실패했습니다. "더 늘리면 되겠지"가 아니라 **"왜 매번 정확히 timeout 시점에 실패하지?"** 라는 질문을 더 일찍 했어야 합니다.

로그에 `Retrying request`가 찍히고 있었는데, 처음엔 "LLM 서버가 불안정한가 보다"로 넘겼습니다. 그 한 줄이 근본 원인의 직접적 증거였습니다.

### 4. 동료 코드 리뷰의 위력

이 문제를 발견한 과정:
1. 내가 분석하고 수정안을 제시
2. 동료 G가 "timeout 제거" 방향에 동의
3. 동료 CX가 **"timeout 빼도 SDK retry는 남는다. num_retries도 명시적으로 꺼야 한다"** 라고 보정

CX의 한 줄 피드백이 없었으면 `num_retries=0`을 빠뜨릴 뻔했습니다. 혼자 디버깅하면 80점, 동료 리뷰까지 하면 100점입니다.

---

## 결론

LLM이 느린 줄 알았는데, SDK가 자기 할 일을 너무 열심히 한 거였습니다. 자동 retry는 대부분의 상황에서 좋은 기본값이지만, "90초짜리 HTML 생성"처럼 긴 작업에서는 **"거의 완성된 작업을 버리고 처음부터 다시 시작"** 이라는 최악의 패턴이 됩니다.

다음에 "timeout을 아무리 늘려도 안 돼"라는 상황을 만나면, **timeout 설정 자체가 아니라 그 timeout이 트리거하는 부수 효과**를 먼저 확인하세요. 진짜 원인은 timeout 값이 아니라 timeout 이후에 무슨 일이 일어나는지에 있을 수 있습니다.

P.S. 이 버그 덕분에 litellm → OpenAI SDK → httpx의 timeout/retry 전달 체인을 소스 레벨까지 추적하게 됐습니다. 삽질의 부산물로 얻은 지식은 항상 오래갑니다. 😎
