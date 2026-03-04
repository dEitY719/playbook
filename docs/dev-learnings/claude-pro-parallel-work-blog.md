# 돈 없는 사람은 Claude 병렬작업 하지마!! 🚀
## (feat. Pro 이용자도 최대 5개 병렬작업 가능 with telemetry=false)

---

## TL;DR

**Pro 이용자라도 telemetry 설정을 `false`로 변경하면 최대 5개까지 병렬작업이 가능합니다.**
더 이상 기다릴 필요가 없다! 🎉

---

## 문제 상황: 내가 겪은 악몽 같은 아침

### 🔥 나의 현상: "왜 자꾸 죽어?"

어제는 아침부터 Claude Code를 5개 병렬로 돌려보기로 했습니다. 멀티태스킹이면 뭐든 될 줄 알았죠.

아침 8시 15분, 따뜻한 커피를 한 모금 마시며 5번째 Claude를 실행했을 때... 그 순간이 악몽의 시작이었습니다. 화면에 빨간 에러 메시지가 쏟아져 내렸죠.

**결과?**

```
[ERROR] Claude instance crashed after 3rd parallel session
[ERROR] Connection timeout on 4th session
[ERROR] Rate limit exceeded (429 Too Many Requests)
[ERROR] 5번째 프로세스: 🪦 Rest in Peace
```

"어? 나 Pro 이용자인데 왜 이래?" 하면서 한 시간을 디버깅했습니다. 회사에 가기 전에 말이죠.

### 📊 충격의 진실: 요금제별 제한 비교

| 항목 | Free | Pro | Max |
|------|------|-----|-----|
| **병렬작업 제한** | 1개 | 5개\* | 10개 |
| **API 요청 (RPM)** | 3 | 90 | 90+ |
| **시간당 요청 (RPH)** | 200 | 6,000 | 6,000+ |
| **Telemetry 기본값** | ❌ | ✅ (default) | ✅ (default) |

> \* **Telemetry=false일 때만 가능합니다** 😱

### ⚠️ 에러 로그: 429 에러의 정체

```
[2026-03-04 08:15:23] ERROR: Rate limit exceeded
Code: 429 Too Many Requests
Status: Telemetry data collection consuming event quota
Events per minute: 2,847 (Limit: 300)

[2026-03-04 08:15:24] WARNING: Cascade failure detected
- Session 3: Terminated
- Session 4: Timeout (30s)
- Session 5: Out of quota
```

**원인?** Claude Code의 기본 설정에서 **telemetry가 활성화되어 있었습니다.**

이게 뭐 하는 일이냐면, 사용자의 편의성 개선을 위해 이벤트 데이터를 수집하는 건데... 동시에 여러 세션이 떠 있으면 그 수집 이벤트 자체가 quota를 먹어버리는 겁니다.

**결과:** Pro 이용자인데도 불구하고 병렬작업은 1~2개 정도만 안정적으로 동작했습니다. 말이 안 되죠.

---

## 해결 방법: 희망의 메시지 🌟

### ✅ Telemetry Disable 설정

**Step 1:** Claude Code 설정 파일 열기

```bash
# macOS/Linux
nano ~/.claude/settings.json

# 또는 VSCode에서
# Command Palette (Cmd+Shift+P) → "Claude Code Settings" 검색
```

**Step 2:** 다음 설정 추가

```json
{
  "telemetry": false,
  "parallelSessionLimit": 5
}
```

**Step 3:** 저장하고 Claude Code 재시작

```bash
# Claude Code 프로세스 종료 후 다시 실행
```

### 🎯 결과 확인

```bash
# 5개 병렬 작업 동시 실행
claude-code task1.ts &
claude-code task2.py &
claude-code task3.js &
claude-code task4.go &
claude-code task5.rs &

# 모두 정상 작동! ✨
```

---

## 알아야 할 점들

### 1️⃣ Telemetry를 끄면 뭐가 손실되나?

- Anthropic의 사용성 분석 데이터 수집 불가 (당신에게는 상관없음)
- Claude Code 개선에 기여하지 못함 (미안해요, Anthropic 팀 😔)
- **당신의 개발 생산성:** 📈 **대폭 상승!**

### 2️⃣ 5개 초과는 왜 안 되나?

Free 이용자도 있고, 서버 자원도 한정되어 있기 때문입니다. 공평한 리소스 배분이죠.

### 3️⃣ Max 이용자는?

10개까지 병렬작업이 가능합니다. 하지만 그것도 telemetry=false 상태에서요. 더 부자들도 설정이 필요합니다! 💸

---

## 결론: Pro 이용자도 빛날 수 있다 ✨

<div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc;">

**당신은 Pro를 구매했습니다.**
**당신은 그 대가를 받을 권리가 있습니다.**
**`telemetry: false`로 설정하세요.**
**그리고 당신의 5개 병렬작업을 자유롭게 즐기세요.** 🚀

</div>

더 이상 기다릴 필요가 없습니다.
더 이상 병목이 생길 필요가 없습니다.
더 이상 한 번에 하나씩 끙끙대며 작업할 필요가 없습니다.

금방이라도 Max 이용자로 업그레이드할 수 있는 그날까지,
Pro의 진정한 가치를 누려보세요! 💪

---

**P.S.** 이 글을 읽은 Free 이용자 여러분, 위로합니다. 언젠가 당신도 Pro가 될 날이 오길 기원합니다. 그때까지 1개 병렬작업과 함께! 🫂

**P.P.S.** Anthropic 팀에게: 기본값을 `telemetry: false`로 바꿀 생각은 없으신가요? 😭
