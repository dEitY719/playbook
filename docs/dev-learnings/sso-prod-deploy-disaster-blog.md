# SSO 배포하자마자 즉사했습니다 — `.env` 믿다가 당한 Docker의 배신 🔥
## (feat. --env-file은 '추가'가 아니라 '대체', ADFS issuer는 URL이 아니다, SSO는 파이프라인이다)

---

## TL;DR

**`docker compose --env-file .env.corp`를 쓰는 순간, `.env`는 완전히 무시된다.**
보충이 아니라 대체다. 이것 하나 몰라서 2.5일을 날렸다.

---

## 문제 상황: 완벽하게 작동하던 SSO가 prod에서 즉사

### 🔥 나의 현상: "개발에서 됐는데 왜 prod에서 죽어?"

2주 동안 준비했습니다.

Mock IDP 세팅하고, 로컬에서 OIDC 플로우 전부 테스트하고, 팀원 3명이 함께 코드리뷰까지 마쳤습니다. 완벽했습니다.

드디어 사내 prod 서버에 배포한 날, 브라우저를 열고 SSO 로그인 버튼을 클릭했습니다.

```
ERR_SSL_PROTOCOL_ERROR
```

"...뭐?"

고쳤습니다. 다시 배포했습니다.

```
MSIS9224: The 'redirect_uri' parameter is invalid.
Received: https://ssai.company.net:9988/api/v1/auth/callback
```

"포트 문제구나." 고쳤습니다.

```
MSIS9221: The 'redirect_uri' parameter is empty.
```

"아까는 잘못됐다더니 이제는 비어있다고?"

고치고, 고치고, 고치고...

```
Token validation failed: id_token validation failed: Invalid issuer
```

**2.5일 후**, 드디어 로그인에 성공했습니다. 😩

---

## 왜 이렇게 됐나: 에러가 3번 바뀐 이유

### 📊 타임라인으로 보는 연쇄 장애

이게 "3개의 다른 버그"가 아니었습니다.
SSO는 파이프라인입니다. 한 단계가 해결되면 **다음 단계의 문제가 비로소 보입니다.**

```
Phase 1: ERR_SSL_PROTOCOL_ERROR
  ↓ 해결
Phase 2: MSIS9224 / MSIS9221 (redirect_uri 불일치)
  ↓ 해결
Phase 3: Invalid issuer (id_token 검증 실패)
  ↓ 해결
✅ 로그인 성공
```

증상이 바뀔 때마다 "또 새로운 버그가 생겼다"고 생각했습니다.
틀렸습니다. SSO 파이프라인의 **다음 관문으로 진입한 것**이었습니다.

---

## 진짜 원인 1: `--env-file`은 `.env`를 무시한다

### 💣 Docker Compose의 충격적인 동작 방식

이번 장애의 **핵심 원인**입니다.

우리 프로젝트는 사내망 전용 설정을 `.env.corp`에 관리하고 있었고, 배포 스크립트가 이렇게 생겼습니다:

```bash
# start_all_docker.sh
ENV_FILE_ARGS=()
if [ -f .env.corp ]; then
    ENV_FILE_ARGS=(--env-file .env.corp)  # ← 여기가 폭탄
fi

docker compose -f docker-compose.prod.yml "${ENV_FILE_ARGS[@]}" up -d
```

**우리가 알고 있던 세계:**

```
.env         → 기본 설정 (포트, 버전 등)
.env.corp    → 사내망 추가 설정 (프록시, 공개 URL 등)
→ 두 파일이 합쳐져서 적용된다
```

**실제 세계:**

```
--env-file .env.corp 지정 순간
→ .env 완전 무시
→ .env.corp에 없는 변수는 docker-compose.yml 기본값 사용
```

`.env`에 이렇게 써있었습니다:

```env
# .env
NGINX_PORT=9987
NGINX_HTTPS_PORT=9988
```

`.env.corp`에는 이게 없었습니다. 그래서 `docker-compose.prod.yml`의 기본값이 적용됐습니다:

```yaml
# docker-compose.prod.yml
ports:
  - "${NGINX_PORT:-9988}:80"        # 기본값: 9988→80 (HTTP!)
  - "${NGINX_HTTPS_PORT:-9443}:443" # 기본값: 9443→443 (HTTPS)
```

### 📊 포트 매핑의 결과

| 의도한 매핑 | 실제 적용된 매핑 |
|------------|----------------|
| 9987 → 80 (HTTP) | 9988 → 80 (HTTP) ← 💥 |
| 9988 → 443 (HTTPS) | 9443 → 443 (HTTPS) |

IDP는 `https://ssai.company.net:9988`으로 콜백합니다.
그런데 9988은 HTTP(80) 포트에 매핑되어 있습니다.
브라우저가 HTTPS 핸드셰이크를 시도하는데 HTTP로 응답이 오니:

```
ERR_SSL_PROTOCOL_ERROR
```

**교훈:** `--env-file`은 `.env`의 "보충"이 아니라 "대체"다.
`.env.corp`를 쓴다면, `.env`의 **모든 변수**를 `.env.corp`에도 복사해야 한다.

---

## 진짜 원인 2: Docker Compose는 중첩 변수를 모른다

### 🤯 "동적으로 처리하면 되겠지" → 안 됩니다

Phase 1 해결 과정에서 이런 시도를 했습니다:

```yaml
# 시도한 코드 (동작하지 않음)
APP_BACKEND_URL: "${APP_BACKEND_URL:-https://localhost:${NGINX_HTTPS_PORT:-9988}}"
```

"포트 변수를 참조해서 URL을 자동으로 만들면 완벽하겠는데?"

실제 결과:

```
APP_BACKEND_URL = ""  (빈 문자열)
```

IDP에 빈 `redirect_uri`가 전달됩니다 → `MSIS9221: empty redirect_uri`

Docker Compose는 `${VAR:-default}` 안의 `${다른변수}`를 **확장하지 않습니다.**
중첩 변수 참조가 필요하면 쉘 스크립트에서 미리 계산해야 합니다.

**교훈:** Docker Compose 환경변수 치환은 단일 레벨만 지원한다. 중첩은 없다.

---

## 진짜 원인 3: ADFS issuer는 authorize URL이 아니다

### 🎯 "URL에서 추론하면 되겠지" → ADFS는 다릅니다

Phase 1, 2가 해결된 후 드디어 콜백까지 왔습니다. 그런데:

```
Token validation failed: id_token validation failed: Invalid issuer
```

코드를 보니 issuer를 이렇게 추론하고 있었습니다:

```python
# backend/auth/security.py
issuer = config.sso.idp_login_url.split('/authorize')[0]
# IDP_LOGIN_URL = https://stsds.company.net/adfs/oauth2/authorize
# → 계산된 issuer = https://stsds.company.net/adfs/oauth2
```

그럴듯해 보입니다. "authorize 앞까지가 base URL이겠지."

ADFS discovery endpoint를 직접 확인해보니:

```json
{
  "issuer": "https://stsds.company.net/adfs",
  "authorization_endpoint": "https://stsds.company.net/adfs/oauth2/authorize/"
}
```

| | backend 기대값 | ADFS 실제값 |
|--|---------------|------------|
| issuer | `https://.../adfs/oauth2` | `https://.../adfs` |

`/oauth2` 한 조각 차이가 `Invalid issuer`를 만들었습니다.

`python-jose`의 `jwt.decode(issuer=...)`는 **문자열 완전 일치**를 요구합니다.

**OIDC에서 issuer는 URL이 아닙니다. 식별자(Identifier)입니다.**
URL처럼 생겼을 뿐, IDP마다 제각각입니다. 추론하면 안 됩니다.

해결책은 간단했습니다:

```env
# backend/.env
IDP_ISSUER=https://stsds.company.net/adfs  # discovery에서 직접 복사
```

**교훈:** OIDC issuer는 discovery endpoint에서 **직접 복사**해서 환경변수로 명시하라.
authorize URL에서 추론하지 마라. ADFS는 경로 구조 자체가 다르다.

---

## 왜 이렇게 오래 걸렸나: 패착 분석

### 🪦 커밋 히스토리로 보는 삽질의 기록

| # | 변경 | 결과 |
|---|------|------|
| 1 | HTTPS 기본 포트 9443→9988 변경 | `.env.corp` 문제 미인지 상태에서 기본값 바꾸기 |
| 2 | HTTPS 포트 9988→9443 원복 | **잘못된 방향** → MSIS9224 |
| 3 | 중첩 변수 `${NGINX_HTTPS_PORT}` 시도 | 빈 문자열 → MSIS9221 |
| 4 | 하드코딩 9443 원복 | 또 MSIS9224 |
| 5 | 올바른 방향으로 수정 | Phase 1 해결 (근본 원인은 별도) |
| 6 | `.env.corp`에 포트 변수 추가 | Phase 1 **완전 해결** |
| 7 | `IDP_ISSUER` 환경변수 신설 | Phase 3 해결 |

### 🧠 왜 틀린 방향으로 계속 갔나?

**"보이는 파일 기준으로 판단했기 때문입니다."**

`.env`를 열면 포트가 올바르게 적혀있습니다.
`docker-compose.prod.yml`을 열면 올바른 변수 참조가 보입니다.
언뜻 보면 설정이 완벽합니다.

하지만 실제 실행 경로는:

```
start_all_docker.sh
  → --env-file .env.corp (.env 무시!)
  → compose interpolation (기본값 적용)
  → environment: 섹션 override
```

**"어떤 파일에 적혀있느냐"보다 "어느 레이어가 누구를 override하느냐"가 더 중요합니다.**

---

## 해결 체크리스트: SSO prod 배포 전에 이것만 확인해라

### ✅ 배포 전 필수 확인

**환경변수 최종 적용값 확인:**

```bash
# .env가 무시되고 있는지 확인
docker compose -f docker-compose.prod.yml --env-file .env.corp config | grep -E "NGINX_PORT|NGINX_HTTPS"
```

**포트 매핑 확인 (HTTPS 포트가 443에 매핑되는지):**

```bash
docker compose -f docker-compose.prod.yml config | grep -A2 ports
```

**OIDC discovery에서 issuer 직접 확인:**

```bash
curl -sk https://<IDP>/.well-known/openid-configuration | python3 -m json.tool | grep issuer
```

**id_token 검증 실패 시 실제 iss 확인:**

```bash
python3 -c "
import base64, json, sys
payload = sys.argv[1].split('.')[1]
payload += '=' * (4 - len(payload) % 4)
print(json.dumps(json.loads(base64.urlsafe_b64decode(payload)), indent=2))
" "<여기에_id_token>"
```

### 📋 에러 메시지별 원인 대응표

| 에러 | 원인 | 확인 방법 |
|------|------|----------|
| `ERR_SSL_PROTOCOL_ERROR` | HTTPS 포트가 nginx HTTP(80)에 매핑됨 | `docker compose config`로 포트 확인 |
| `MSIS9224` (redirect_uri mismatch) | `redirect_uri`가 IDP 등록값과 다름 | `/api/v1/auth/login` 응답 확인 |
| `MSIS9221` (empty redirect_uri) | `APP_BACKEND_URL`이 빈 문자열 | 컨테이너 내 `echo $APP_BACKEND_URL` |
| `Invalid issuer` | `IDP_ISSUER`와 실제 id_token `iss` 불일치 | discovery의 `issuer` 값 vs 설정값 |
| `Invalid audience` | `IDP_CLIENT_ID`와 id_token `aud` 불일치 | id_token 디코딩하여 `aud` 확인 |

---

## 교훈 3가지

### 1️⃣ `--env-file`은 `.env`를 무시한다, 항상

Docker Compose 공식 문서에 적혀있습니다. 우리가 안 읽었을 뿐입니다.

> "If `--env-file` is set, the project-level `.env` file is not loaded."

`.env.corp` 같은 환경별 파일이 있다면, 반드시 `.env`의 **모든 compose 변수**를 포함시켜야 합니다. "추가"가 아니라 "완전 대체"이기 때문입니다.

### 2️⃣ OIDC issuer는 추론하지 말고 discovery에서 직접 가져와라

ADFS, Keycloak, Auth0, Okta — 모두 issuer 경로 구조가 다릅니다.
"authorize URL에서 잘라내면 되겠지"는 ADFS에서 작동하지 않습니다.
discovery endpoint를 치고, `issuer` 필드를 복사해서, 환경변수에 박는 것이 정답입니다.

### 3️⃣ SSO는 파이프라인이다, 증상이 바뀌면 다음 단계로 진입한 것이다

```
1. 로그인 버튼 클릭
2. IDP redirect (redirect_uri 유효성)
3. IDP 인증
4. callback URL 도달 (포트/프로토콜 일치)  ← Phase 1
5. id_token signature 검증
6. audience 검증
7. issuer 검증                              ← Phase 3
8. nonce 검증
9. 사용자 정보 추출 → 완료
```

에러 메시지가 바뀌었다면 "새 버그"가 아닙니다. **다음 관문에 도달한 것**입니다.
이걸 알았다면 "또 다른 문제가 생겼다"는 공황 없이 차분하게 다음 단계를 봤을 겁니다.

---

## 결론

<div style="background: #fff3f3; padding: 20px; border-radius: 8px; border-left: 4px solid #cc0000;">

**`.env`에 올바르게 적혀있어도, `--env-file`을 쓰면 읽지 않습니다.**
**issuer는 URL처럼 생겼어도, URL 조작으로 추론하면 안 됩니다.**
**에러 메시지가 바뀌어도 당황하지 마세요. 한 단계 통과한 겁니다.**

</div>

2.5일을 날린 핵심은 이것 하나였습니다:

```bash
# .env.corp에 이 두 줄이 없었다
NGINX_PORT=9987
NGINX_HTTPS_PORT=9988
```

설정 파일 두 줄. 2.5일. 팀원 3명.

prod 배포 전에 `docker compose config`로 **실제 적용값을 반드시 확인하세요.** 🙏

---

**P.S.** "사외 개발 환경에서 2주 검증"이 아무 의미 없었던 이유는, 사외 환경은 `--env-file .env.corp`를 쓰지 않아서 `.env`가 정상 로드됐기 때문입니다. 환경을 가릴 때는 실행 스크립트도 함께 가려야 합니다.

**P.P.S.** Docker 팀에게: `--env-file` 지정 시 `.env`도 같이 읽는 옵션이 있으면 안 됐나요? 직관적으로 "추가"처럼 느껴지거든요. 🥲
