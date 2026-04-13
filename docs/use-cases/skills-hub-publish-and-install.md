# Use Case: Skills Hub — Publish & Install

## 개요

Claude Code 사용자가 직접 만든 스킬을 `skills-hub`에 등록하고, 동료가 이를 손쉽게 검색·설치할 수 있도록 한다. 또한 웹 사이트에서 각 스킬의 설명을 가독성 좋게 제공한다.

## Actors

- **Skill Author (게시자)**: 스킬을 만들어 공유하려는 Claude Code 사용자
- **Skill Consumer (사용자)**: 공유된 스킬을 자신의 환경에 설치해 사용하려는 동료
- **Skills Hub (시스템)**: 스킬 메타데이터·콘텐츠를 보관·배포하는 레지스트리 + 웹 사이트

## Preconditions

- Skill Author가 로컬에서 동작하는 Claude Code 스킬을 보유하고 있다.
- Skills Hub가 운영 중이며 게시자/사용자 모두 접근 가능하다.

## 주요 시나리오 (Happy Path)

### S1. 스킬 제작

1. Author가 Claude Code에서 사용할 스킬 `/visualize`를 작성한다.
2. 이 스킬은 임의의 콘텐츠(Markdown 파일, 대화 내용, URL, CSV/JSON 데이터, 코드 등)를 입력받아 **하나의 자기완결형(single-file) HTML 파일**로 변환한다. CSS·JS가 인라인되어 외부 의존 없이 어디서든 열리고 오프라인에서도 동작한다.
3. 출력 형식은 슬라이드 덱, 인포그래픽, 대시보드, 차트, 플로우차트, 타임라인, 비교 테이블, 원페이저 등 다양하며, 라이트/다크 테마 토글·반응형 레이아웃·접근성(시맨틱 HTML, aria-label, prefers-reduced-motion)·인쇄/PNG 다운로드 메뉴를 기본으로 갖춘다.

### S2. 공유 요청 발생

1. 동료(Consumer)가 Author에게 `/visualize` 스킬을 공유해 달라고 요청한다.

### S3. 스킬 등록 (Publish)

1. Author는 Skills Hub에 `/visualize` 스킬을 등록한다.
   - 스킬 메타데이터(이름, 설명, 버전, 작성자, 태그)를 함께 제출한다.
   - 스킬 본문(파일/매니페스트)을 업로드한다.

### S4. 스킬 탐색 및 설치 (Install)

1. Consumer는 Skills Hub에서 `/visualize` 스킬을 검색하거나 공유 링크로 접근한다.
2. Consumer는 한두 번의 명령/클릭으로 스킬을 자신의 Claude Code 환경에 다운로드·설치한다.

### S5. 스킬 설명 페이지 제공

1. Skills Hub 웹 사이트는 각 스킬마다 가독성 좋은 상세 페이지를 제공한다.
   - 스킬 이름, 한 줄 설명, 사용 예시, 입력/출력, 설치 방법, 작성자, 버전 이력 등을 포함한다.

## Postconditions

- Consumer의 Claude Code 환경에 `/visualize` 스킬이 정상 설치되어 호출 가능하다.
- Skills Hub에 해당 스킬이 검색 가능한 상태로 노출된다.

## 핵심 요구사항 (도출)

- **등록(Publish)**: CLI 또는 웹을 통해 스킬을 업로드할 수 있어야 한다.
- **메타데이터**: 이름, 설명, 버전, 작성자, 태그, 사용 예시.
- **배포(Install)**: 사용자가 단순한 명령(예: `skills-hub install visualize`)으로 설치할 수 있어야 한다.
- **검색/탐색**: 이름, 태그, 키워드로 검색 가능해야 한다.
- **설명 페이지**: 스킬별 상세 페이지(README 렌더링, 사용 예시, 설치 가이드).
- **버전 관리**: 동일 스킬의 여러 버전을 관리하고 특정 버전 설치를 지원해야 한다.

## Out of Scope (이번 시나리오에서는 다루지 않음)

- 인증/권한 모델 상세
- 스킬 심사/모더레이션 정책
- 비공개(Private) 스킬 공유
- 결제/라이선스
