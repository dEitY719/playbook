# "로컬에선 됐는데요?" 사내망 SSO 배포 지옥에서 살아남기 (feat. Docker의 배신) 🛡️

> **"로컬에선 완벽했는데, 왜 운영 서버에만 올리면 안 될까?"**
> 삼성 DS 사내망(ADFS)에 SSO를 배포하며 겪은 2.5일간의 피 말리는 사투 기록입니다.
> Docker Compose, Nginx, OIDC, ADFS... 각 층위에서 쏟아지는 빌런들을 어떻게 때려잡았는지 공유합니다.

---

## TL;DR: 3줄 요약

1. **Docker Compose의 `--env-file`은 `.env`를 보충하는 게 아니라 '완전히 대체'한다.** (이걸 모르면 포트가 꼬인다.)
2. **HTTPS 프로토콜은 포트 번호가 아니라 '컨테이너 내부 포트'가 결정한다.**
3. **OIDC Issuer는 URL이 아니라 식별자다.** (맘대로 추론하다간 `Invalid issuer`의 늪에 빠진다.)

---

## 1단계 빌런: `ERR_SSL_PROTOCOL_ERROR` (범인은 내부 포트)

배포 직후 마주한 첫 번째 에러. HTTPS로 접속했는데 SSL 프로콜 에러가 뜹니다.

### 원인: "내 포트가 네 포트가 아니야"
Docker Compose로 배포할 때 사내망 전용 설정인 `.env.corp`를 사용했습니다. 그런데 여기서 대형 사고가 터집니다.

```bash
# 우리의 착각: .env를 읽고 .env.corp로 덮어쓰겠지?
docker compose --env-file .env.corp up -d 
```

**현실은 냉혹했습니다.** `--env-file`을 명시하는 순간, 프로젝트 루트의 `.env`는 **완전히 무시**됩니다. 결과적으로 `.env`에 정의된 포트 변수가 증발했고, Nginx는 기본값인 80번(HTTP) 포트를 물고 올라갔습니다.

- **브라우저**: "야, 9988번 포트(HTTPS)로 핸드셰이크 하자!"
- **Nginx(80)**: "난 80번인데? 평문(HTTP)으로 말해!"
- **결과**: `ERR_SSL_PROTOCOL_ERROR` 🧟

### 💡 Lesson Learned
- **Docker `--env-file` 완전체 원칙**: 별도의 환경변수 파일을 쓸 거면, 기존 `.env` 내용을 100% 복사해서 '완전체'로 관리하세요. 부분집합으로 관리하다간 기본값 폴백(Fallback)의 지옥을 맛보게 됩니다.
- **포트 매핑의 진실**: 호스트 포트 번호(9988)는 장식일 뿐입니다. 컨테이너 내부의 **80(HTTP)**에 꽂히느냐, **443(HTTPS)**에 꽂히느냐가 프로토콜을 결정합니다.

---

## 2단계 빌런: `redirect_uri_mismatch` (Docker의 한계)

포트를 고치니 이번엔 IDP(삼성 ADFS)가 화를 냅니다. "네가 준 `redirect_uri`가 내가 아는 거랑 달라!"

### 원인: 중첩 변수의 배신
설정을 유연하게 하겠답시고 Docker Compose 파일에 이렇게 적었습니다.

```yaml
# ❌ 동작하지 않는 코드
APP_BACKEND_URL: "${APP_BACKEND_URL:-https://localhost:${NGINX_HTTPS_PORT:-9988}}"
```

**Docker Compose는 중첩 변수(`${VAR:-${OTHER}}`)를 확장하지 못합니다.** 결과적으로 `APP_BACKEND_URL`은 빈 값이 되었고, IDP에는 빈 주소가 전달되었습니다.

### 💡 Lesson Learned
- Docker Compose 환경변수 치환은 **단일 레벨**만 믿으세요. 복잡한 계산이 필요하면 실행 스크립트에서 미리 계산해서 넣어주는 게 정신 건강에 좋습니다.

---

## 3단계 빌런: `Invalid issuer` (ADFS의 통수)

드디어 로그인 창이 뜨고 인증까지 성공! 그런데 마지막 단계에서 백엔드가 소리를 지릅니다. `Invalid issuer`.

### 원인: "Issuer는 URL이 아니다"
우리는 보통 Issuer를 '로그인 URL의 앞부분'이라고 생각합니다. 
- 로그인 URL: `https://.../adfs/oauth2/authorize`
- 추론한 Issuer: `https://.../adfs/oauth2`

하지만 ADFS의 실제 Issuer(Discovery Endpoint 기준)는 **`https://.../adfs`** 였습니다. 뒤에 붙은 `/oauth2` 하나 때문에 문자열 비교 검증(`jwt.decode`)이 실패한 것이죠.

### 💡 Lesson Learned
- **Issuer는 식별자(Identifier)다**: URL처럼 생겼지만 그냥 고유한 문자열일 뿐입니다. 절대로 코드에서 잘라내거나 붙여서 추론하지 마세요. 반드시 환경변수로 명시해야 합니다.
- **ADFS 주의사항**: ADFS는 인증 엔드포인트 경로와 Issuer 경로가 따로 노는 경우가 많습니다. 반드시 `.well-known/openid-configuration`을 직접 찔러보고 확인하세요.

---

## 마무리하며: SSO는 '파이프라인'이다

이번 2.5일간의 삽질을 통해 얻은 가장 큰 깨달음은 **"SSO는 단계별 파이프라인"**이라는 점입니다.

1. **포트/프로토콜** (Nginx/Docker)
2. **Redirect URI** (IDP 등록 정보)
3. **Issuer/Audience** (JWT 클레임 검증)

앞 단계가 터지면 뒷 단계의 문제는 보이지도 않습니다. **"에러 메시지가 바뀌었다"는 것은 실패한 게 아니라 "다음 단계로 진출했다"는 승리의 신호**로 받아들여야 합니다.

오늘도 운영 배포를 앞두고 "로컬에선 됐는데..."를 읊조리고 있을 동료 개발자들에게 이 글을 바칩니다. 

---

### ✅ 배포 전 체크리스트 (이것만 봐도 1박 2일 아낍니다)

- [ ] `docker compose config` 명령어로 최종 적용된 환경변수를 확인했는가?
- [ ] `--env-file` 사용 시 `.env` 내용이 누락되지는 않았는가?
- [ ] HTTPS 호스트 포트가 컨테이너의 443번 포트에 매핑되었는가?
- [ ] `IDP_ISSUER`를 추론하지 않고 명시적으로 설정했는가?
- [ ] IDP의 Discovery Endpoint 결과값과 내 설정값이 글자 하나 안 틀리고 일치하는가?

---
**P.S.** 3명이 동시에 분석하며 커밋을 날리니 나중엔 누가 뭘 고쳤는지도 모르게 되더군요. 급할수록 침착하게 계층별로(네트워크 -> 도커 -> 앱) 쪼개서 보는 습관이 절실했습니다. 😅
