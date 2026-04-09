# Playbook 웹 공유 사이트 설계 — 11ty + GitHub Pages

**Date**: 2026-04-09
**Status**: Approved
**Author**: bwyoon

---

## 목적

playbook 저장소의 콘텐츠를 웹(URL)으로 팀 내부 동료에게 공유한다. 각 글은 MD 뷰(11ty 렌더링)와 HTML 뷰(직접 제작한 인터랙티브 버전) 두 가지 형태로 제공하며, 사용자가 자유롭게 전환할 수 있다.

---

## 요구사항

1. **듀얼 포맷 뷰**: 하나의 글에 대해 MD 뷰 / HTML 뷰 전환 (언어 선택 UX와 유사)
2. **최소 설정**: 파일 추가 시 자동 반영, 복잡한 설정 불필요
3. **기존 구조 유지**: `docs/` 하위 폴더 구조 변경 없음
4. **MD/HTML 모두 서빙**: 마크다운은 테마 적용 렌더링, HTML은 원본 그대로
5. **GitHub Pages 호스팅**: public repo, URL 링크로 공유
6. **카테고리 지원**: `docs/` 하위 폴더별 자동 분류 (`dev-learnings`, `tech`, `blog` 등)

---

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| SSG | **11ty (Eleventy)** | MD/HTML 모두 유연하게 처리, 빠른 빌드, 학습 비용 낮음 |
| 호스팅 | **GitHub Pages** | public repo, 무료, URL 공유에 최적 |
| CI/CD | **GitHub Actions** | push 시 자동 빌드 + 배포 |
| 템플릿 | **Nunjucks (.njk)** | 11ty 기본 지원, 로직 표현력 충분 |
| 스타일 | **순수 CSS** | 프레임워크 의존 없이 카드 UI 구현 |

---

## 디렉토리 구조

```
playbook/
├── site/                              # 11ty 설정 및 레이아웃
│   ├── .eleventy.js                   # 11ty 설정 파일
│   ├── package.json                   # Node.js 의존성
│   ├── _includes/
│   │   └── layouts/
│   │       ├── base.njk               # 공통 셸 (헤더, 푸터)
│   │       └── post.njk               # MD 렌더링용 레이아웃
│   ├── css/
│   │   └── style.css                  # 사이트 테마
│   └── index.njk                      # 홈페이지 (글 목록)
│
├── docs/                              # 콘텐츠 소스 (기존 구조 유지)
│   ├── dev-learnings/
│   │   ├── litellm-timeout-sdk-retry-blog.md
│   │   ├── litellm-timeout-sdk-retry-blog.html
│   │   ├── knox-portal-esb-html-sanitizer-blog.md
│   │   └── ...
│   ├── tech/                          # 새 카테고리 (필요 시 추가)
│   ├── blog/                          # 새 카테고리 (필요 시 추가)
│   └── analysis/                      # 기존 RCA 문서
│
├── _output/                           # 11ty 빌드 결과 (.gitignore)
├── .github/workflows/pages.yml        # GitHub Actions 배포
└── .nojekyll                          # Jekyll 비활성화
```

---

## URL 구조와 파일 매핑

```
소스 파일                                    →  URL
───────────────────────────────────────────────────────────────
docs/dev-learnings/litellm-blog.md           →  /dev-learnings/litellm-blog/
docs/dev-learnings/litellm-blog.html         →  /dev-learnings/litellm-blog/interactive/
docs/tech/some-topic.md                      →  /tech/some-topic/
docs/tech/some-topic.html                    →  /tech/some-topic/interactive/
```

### MD/HTML 매칭 규칙

- 동일 디렉토리에 동일 슬러그의 `.md`와 `.html`이 존재하면 듀얼 포맷으로 처리
- MD만 있는 경우: MD 페이지만 서빙, 토글 버튼 미표시
- HTML만 있는 경우: HTML 페이지만 서빙, 글 목록에 정상 노출

---

## MD/HTML 토글 메커니즘 (Option B: 별도 페이지 + 링크)

### MD 뷰 페이지 (`/slug/`)

- 11ty가 마크다운을 `post.njk` 레이아웃으로 렌더링
- 상단에 `[HTML 버전 보기]` 링크 → `/slug/interactive/` 로 이동
- 대응하는 HTML 파일이 없으면 링크 미표시

### HTML 뷰 페이지 (`/slug/interactive/`)

- 원본 HTML을 passthrough copy로 그대로 서빙
- 빌드 시 11ty transform이 `</body>` 앞에 플로팅 버튼 자동 주입:

```html
<a href="../"
   style="position:fixed; bottom:20px; right:20px;
          background:#333; color:#fff; padding:8px 16px;
          border-radius:8px; text-decoration:none;
          font-size:14px; z-index:9999; opacity:0.8;">
  MD 버전 보기
</a>
```

- 기존 HTML 파일 자체는 수정하지 않음 — 빌드 타임에만 주입

---

## 홈페이지 디자인

### 레이아웃

- 상단: 사이트 제목 ("Playbook")
- 카테고리 탭: `[All] [dev-learnings] [tech] [blog] ...` — `docs/` 하위 폴더에서 자동 생성
- 글 목록: 카드 형태, 날짜 역순 정렬

### 카드 UI

```
┌──────────────────────────────────────────┐
│                                          │
│  SDK가 몰래 시시포스를 시키고 있었다        │
│  2026-03-20 · dev-learnings              │
│                                          │
│  📝 MD  ✨ HTML                          │
│                                          │
└──────────────────────────────────────────┘
```

- 카드에 약간의 그림자(box-shadow)와 hover 효과
- MD/HTML 존재 여부에 따라 링크 동적 표시
- frontmatter의 `title`, `date`, `tags`, `summary` 활용

---

## 빌드 & 배포 파이프라인

### GitHub Actions 워크플로우

```
git push main
    │
    ▼
GitHub Actions (.github/workflows/pages.yml)
    │
    ├── 1. actions/checkout
    ├── 2. actions/setup-node
    ├── 3. npm ci (site/ 디렉토리)
    ├── 4. npx eleventy (빌드 → _output/)
    ├── 5. actions/upload-pages-artifact
    └── 6. actions/deploy-pages
    │
    ▼
https://deity719.github.io/playbook/
```

- **트리거**: `main` 브랜치 push
- **로컬 개발**: `cd site && npx eleventy --serve`
- `_output/`은 `.gitignore`에 추가

---

## 기존 HTML 파일 처리 전략

1. **passthrough copy**: 11ty가 `.html` 파일을 렌더링하지 않고 그대로 복사
2. **경로 재매핑**: `docs/{category}/{slug}.html` → `_output/{category}/{slug}/interactive/index.html`
3. **플로팅 버튼 주입**: 11ty transform으로 빌드 시 `</body>` 앞에 MD 링크 버튼 자동 삽입
4. **원본 무수정**: `docs/` 내 HTML 파일은 절대 수정하지 않음

---

## 11ty 설정 핵심 사항

### .eleventy.js 주요 설정

- **11ty 실행 위치**: repo root (`playbook/`)에서 `npx eleventy --config=site/.eleventy.js` 실행
- **입력 디렉토리**: `docs/` (콘텐츠 소스)
- **출력 디렉토리**: `_output/`
- **레이아웃/includes**: `site/_includes/`
- **MD 파일**: markdown-it으로 렌더링, `post.njk` 레이아웃 적용
- **HTML 파일**: passthrough copy + transform (플로팅 버튼 주입)
- **정적 자산**: `site/css/` → `_output/css/`

### Collections

- `docs/` 하위 폴더별로 collection 자동 생성
- frontmatter의 `date` 기준 역순 정렬
- 글 목록 페이지에서 카테고리 필터링에 활용

### MD-HTML 페어링 로직

- 빌드 시 동일 슬러그의 `.md`와 `.html` 존재 여부를 확인
- MD 렌더링 시 대응하는 HTML이 있으면 토글 링크 활성화
- 11ty의 computed data 또는 global data로 페어링 정보 제공

---

## 범위 외 (이번 설계에 포함하지 않음)

- 검색 기능
- 다크모드/라이트모드 토글 (사이트 레벨)
- 댓글 시스템
- RSS 피드
- `docs/analysis/`, `docs/jira-records/` 등 기존 비-블로그 콘텐츠의 웹 노출

---

## 성공 기준

1. `main`에 push하면 자동으로 GitHub Pages에 배포된다
2. `docs/` 하위에 `.md` 파일을 추가하면 사이트에 자동 노출된다
3. `.md`와 `.html`이 쌍으로 존재하면 토글 버튼이 자동 활성화된다
4. 기존 `docs/` 구조와 파일은 변경 없이 동작한다
5. 동료에게 URL 하나로 글을 공유할 수 있다
