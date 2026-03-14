# Mock IDP에서는 멀쩡했는데, 사내 SSO는 왜 배포하자마자 3번 터졌을까
## (feat. Docker Compose `--env-file`, nginx 포트 매핑, ADFS issuer 함정)

---

## TL;DR

**이번 삽질의 진짜 원인은 SSO 구현 자체보다 "환경변수 레이어를 잘못 이해한 것"이었다.**
`.env.corp`가 `.env`를 보충하는 줄 알았는데 실제로는 대체했고, 그 한 번의 오해가 HTTPS 포트 불일치, `redirect_uri` 오류, `Invalid issuer`로 연쇄 폭발했다.

**그리고 더 중요한 교훈은 이것이다.**
SSO 디버깅은 에러 메시지를 따라다니는 일이 아니라, "지금 파이프라인 몇 단계에서 죽는가"를 먼저 고정하는 일이다.

---

## 문제 상황: dev에서는 되는데 prod에서만 계속 죽는다

최근 Jiravis에 OIDC 기반 SSO를 붙였다. 사외 개발 환경에서는 Mock IDP로 로그인까지 정상 동작했다. 그래서 솔직히 말하면, 사내 prod 배포도 금방 끝날 줄 알았다.

그런데 배포하자마자 현실은 정반대였다.

- 첫 번째는 브라우저에서 `ERR_SSL_PROTOCOL_ERROR`
- 두 번째는 IDP에서 `MSIS9224: redirect_uri mismatch`
- 세 번째는 backend에서 `Invalid issuer`

겉으로 보면 완전히 다른 세 문제처럼 보인다. 당시에도 그렇게 느꼈다.
하지만 나중에 돌아보니, 이건 서로 무관한 세 문제가 아니라 **같은 SSO 파이프라인을 한 단계씩 통과하면서 다음 실패가 드러난 것**이었다.

| Phase | 겉으로 보인 증상 | 진짜 원인 |
|------|----------------|----------|
| 1 | `ERR_SSL_PROTOCOL_ERROR` | `https://...:9988`이 nginx 443이 아니라 컨테이너 80(HTTP)로 연결됨 |
| 2 | `MSIS9224`, `MSIS9221` | `redirect_uri` 포트 불일치 + Docker Compose 중첩 변수 미확장 |
| 3 | `Invalid issuer` | issuer를 authorize endpoint에서 추론한 잘못된 가정 |

이 과정을 다 뚫는 데 약 2.5일이 걸렸다.

---

## 1. 제일 먼저 맞은 벽: `--env-file`은 추가가 아니라 교체다

이번 장애에서 가장 뼈아픈 오해는 이것이었다.

```bash
if [ -f .env.corp ]; then
    ENV_FILE_ARGS=(--env-file .env.corp)
fi
```

처음에는 `.env.corp`가 `.env` 위에 일부 값만 덧씌우는 줄 알았다. 그런데 Docker Compose에서 `--env-file`은 보충이 아니라 **대체**다. 즉, `.env`는 아예 읽히지 않는다.

문제는 포트 설정이 `.env`에만 있었고 `.env.corp`에는 없었다는 점이다.

```env
# .env
NGINX_PORT=9987
NGINX_HTTPS_PORT=9988
```

`.env`가 무시되자 compose 기본값이 발동했다.

```yaml
ports:
  - "${NGINX_PORT:-9988}:80"
  - "${NGINX_HTTPS_PORT:-9443}:443"
```

결과는 이랬다.

- 호스트 `9988` → 컨테이너 `80`
- 호스트 `9443` → 컨테이너 `443`

즉, 우리가 IDP에 등록한 `https://...:9988`은 HTTPS 포트라고 믿고 있었지만, 실제로는 HTTP로 열려 있었다.

이 사실을 모르면 포트 숫자만 계속 바꾸게 된다. 실제로 나도 한동안 그렇게 했다.

여기서 하나는 운영 원칙으로 굳혔다. **`.env.corp`는 `.env`의 부분집합이 아니라 완전체로 관리해야 한다.**
사내 전용 값만 덧붙이는 파일로 보면 언젠가 또 기본값 폴백에 당한다.

---

## 2. 포트 번호가 아니라, 컨테이너 내부 포트가 프로토콜을 결정한다

이 부분도 생각보다 자주 헷갈린다.

많은 사람이 `9988` 같은 숫자에 의미를 부여한다. 하지만 nginx 앞단에서는 **호스트 포트 번호 자체가 중요한 게 아니라, 그 포트가 컨테이너 80에 붙었는지 443에 붙었는지**가 더 중요하다.

```yaml
ports:
  - "9988:80"
  - "9443:443"
```

이 상태에서 브라우저가 `https://도메인:9988`로 접속하면 무슨 일이 벌어질까.

- 브라우저는 TLS 핸드셰이크를 시도한다
- 하지만 실제로 연결된 곳은 nginx의 HTTP 포트 80이다
- 서버는 평문 HTTP로 응답한다
- 브라우저는 `ERR_SSL_PROTOCOL_ERROR`를 낸다

즉, "9988은 HTTPS 포트처럼 보이는데 왜 SSL 에러가 나지?"가 아니라, "9988이 지금 443에 물려 있나?"를 먼저 봐야 했다.

이 사건 이후로 포트 문제를 볼 때는 숫자보다 먼저 `host:container` 매핑을 본다.

---

## 3. 두 번째 삽질: Docker Compose는 중첩 변수를 예쁘게 풀어주지 않는다

Phase 1을 지나고 나서 다음에는 `redirect_uri`를 동적으로 맞춰보려 했다.
의도는 좋았다. 결과는 더 나빴다.

```yaml
APP_BACKEND_URL: "${APP_BACKEND_URL:-https://localhost:${NGINX_HTTPS_PORT:-9988}}"
```

이렇게 쓰면 그럴듯해 보인다. 하지만 Docker Compose의 환경변수 치환은 이런 식의 **중첩 참조를 기대한 만큼 똑똑하게 처리하지 않는다.**

실제 결과는 `APP_BACKEND_URL`이 비거나 의도와 다르게 평가되면서, IDP 쪽에는 빈 `redirect_uri`가 넘어갔다. 그때 튀어나온 에러가 `MSIS9221`이었다.

여기서 배운 건 단순하다.

- Compose 변수는 단일 레벨로 생각하는 편이 안전하다
- 계산이 필요한 값은 쉘에서 미리 만들고 넘기는 편이 낫다
- "예쁘게 추상화한 env"가 운영에서는 가장 추적하기 어려운 버그를 만든다

---

## 4. 마지막 함정: ADFS에서는 authorize URL을 잘라도 issuer가 안 나온다

앞 단계를 해결하고 나니, 이제 토큰 검증에서 죽었다.

에러는 간단했다.

```text
Token validation failed: id_token validation failed: Invalid issuer
```

처음엔 이렇게 추론했다.

```python
issuer = config.sso.idp_login_url.split("/authorize")[0]
```

겉보기엔 꽤 합리적이다. `IDP_LOGIN_URL`이 아래처럼 생겼으니:

```text
https://stsds.secsso.net/adfs/oauth2/authorize
```

자르고 나면 issuer도 대충 비슷할 것 같았다.

하지만 ADFS discovery를 확인해보니 실제 값은 달랐다.

```json
{
  "issuer": "https://stsds.secsso.net/adfs",
  "authorization_endpoint": "https://stsds.secsso.net/adfs/oauth2/authorize/"
}
```

즉,

- 내가 추론한 issuer: `https://stsds.secsso.net/adfs/oauth2`
- 실제 issuer: `https://stsds.secsso.net/adfs`

`python-jose`는 이런 값을 느낌적으로 비교하지 않는다. 문자열 완전 일치만 본다. 그래서 한 글자, 한 경로 차이도 그대로 실패다.

이 문제를 해결한 뒤에는 `IDP_ISSUER`를 별도 환경변수로 분리했다.

그때 확실히 배웠다.

**OIDC issuer는 URL처럼 보여도, "대충 이렇게 생겼겠지" 하고 추론하면 안 된다.**
특히 ADFS처럼 authorize endpoint와 issuer 경로가 다를 수 있는 제품에서는 더 그렇다.

---

## 왜 이렇게 오래 걸렸나: 증상이 바뀌는 걸 새 문제로 착각했다

이번 삽질이 길어진 이유는 단순히 기술이 어려워서만은 아니었다.

### 1) 증상이 바뀌니까 문제도 새로 생긴 줄 알았다

`ERR_SSL_PROTOCOL_ERROR`가 사라지고 `MSIS9224`가 나오면, 사람은 쉽게 "또 다른 문제가 생겼네"라고 생각한다.
하지만 실제로는 그렇지 않았다. 이전 단계가 뚫렸기 때문에 **그다음 단계의 실패가 보이기 시작한 것**뿐이었다.

에러 메시지가 바뀌었다는 건 꼭 실패의 증거가 아니다. 오히려 **다음 단계로 들어갔다는 신호**일 때가 있다.

### 2) "파일에 뭐가 적혀 있느냐"만 보고 판단했다

`.env`, `.env.corp`, `docker-compose.prod.yml`, `backend/.env`를 각각 보면 얼핏 다 맞아 보였다.
문제는 파일 내용이 아니라 **최종적으로 어느 레이어가 누구를 덮어쓰느냐**였다.

실행 흐름은 대충 이렇게 봐야 했다.

```text
start_all_docker.sh
→ --env-file .env.corp
→ compose interpolation
→ docker-compose environment override
→ backend 앱 로딩
```

이 순서를 놓치면 "설정은 맞는데 왜 안 되지?"라는 함정에 빠진다.

### 3) dev와 prod의 차이가 너무 늦게 보였다

사외 개발 환경에서는 `.env`와 Mock IDP만 썼다.
문제는 사내 prod에서만 등장하는 `.env.corp`와 ADFS였다.

즉, "dev에서 되니까 prod도 된다"가 아니라,
"prod는 아예 다른 env 레이어와 다른 IDP 메타데이터를 가진다"가 맞는 설명이었다.

---

## 이때부터 시야가 바뀌었다: SSO는 기능이 아니라 파이프라인이다

이번 일 이후 SSO를 보는 방식 자체가 바뀌었다.

예전에는 SSO를 "로그인 기능"처럼 봤다. 이제는 아래 같은 파이프라인으로 본다.

1. 로그인 버튼 클릭
2. IDP redirect 생성
3. `redirect_uri` 유효성 확인
4. callback URL 도달
5. `id_token` 수신
6. signature, audience 검증
7. issuer 검증
8. 앱 세션 발급
9. 로그인 완료

이 관점으로 보면 증상이 바뀌는 게 덜 무섭다.

- SSL 에러가 나면 4단계 전
- `redirect_uri mismatch`면 3단계
- `Invalid issuer`면 7단계

즉, 지금 실패는 "또 다른 재앙"이 아니라 **파이프라인 어디까지 왔는지 알려주는 위치 정보**다.

이렇게 보기 시작하니 디버깅이 훨씬 차분해졌다.

---

## 다음에 같은 일을 막기 위한 체크리스트

- `--env-file`을 쓰면 `.env`가 대체되는지 먼저 확인할 것
- HTTPS 포트는 반드시 nginx 컨테이너 `443`에 매핑되어 있는지 볼 것
- `redirect_uri`는 scheme, host, port, path까지 IDP 등록값과 완전히 일치시키기
- Compose에서 중첩 변수 확장을 기대하지 말 것
- issuer는 authorize URL에서 추론하지 말고 discovery의 `issuer`를 그대로 쓸 것
- SSO 에러는 "무슨 문제가 생겼나"보다 "지금 몇 단계에서 멈췄나"로 해석할 것

---

## 결론

이번 장애는 "SSO가 어렵다"로만 요약하면 너무 아쉽다.
정확히는 **환경변수 우선순위를 잘못 이해했고, 프록시 포트와 프로토콜의 관계를 대충 봤고, IDP 메타데이터를 추론으로 처리한 대가**였다.

그리고 가장 크게 남은 교훈은 이것이다.

**SSO는 한 번에 되는지 안 되는지를 보는 기능이 아니라, 단계별로 어디까지 통과했는지를 추적해야 하는 파이프라인이다.**

다음에 또 비슷한 장애를 만나면, 나는 아마 에러 메시지보다 먼저 이 질문부터 할 것 같다.

**"지금 이 로그인은, 정확히 몇 번째 단계에서 죽고 있지?"**
