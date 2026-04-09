# Playbook

RCA Knowledge Repository + Developer Blog — 11ty + GitHub Pages로 웹 공유.

## Quick Start

```bash
# 의존성 설치 (최초 1회)
cd site && npm install && cd ..

# 로컬 개발 서버
./site/node_modules/.bin/eleventy --config=site/.eleventy.js --serve

# 빌드만 실행
./site/node_modules/.bin/eleventy --config=site/.eleventy.js
```

로컬 서버 실행 후 `http://localhost:8080/` 에서 확인.

## 구조

```
playbook/
├── docs/                          # 콘텐츠 소스
│   ├── dev-learnings/             # 개발 블로그 (MD + HTML)
│   │   ├── litellm-timeout-sdk-retry-blog.md
│   │   ├── litellm-timeout-sdk-retry-blog.html
│   │   └── ...
│   ├── analysis/                  # RCA 문서
│   ├── index.njk                  # 홈페이지 템플릿
│   └── docs.11tydata.js           # 디렉토리 데이터 (제목 추출, 레이아웃)
│
├── site/                          # 11ty 설정 및 테마
│   ├── .eleventy.js               # 빌드 설정
│   ├── package.json               # Node.js 의존성
│   ├── _includes/layouts/         # Nunjucks 레이아웃 (base, post)
│   ├── _data/htmlPairs.js         # MD-HTML 페어링 데이터
│   └── css/style.css              # 사이트 테마
│
├── _output/                       # 빌드 결과 (.gitignore)
├── .github/workflows/pages.yml    # GitHub Actions 배포
└── .nojekyll                      # Jekyll 비활성화
```

## 듀얼 포맷 뷰

각 글은 **MD 뷰**와 **HTML 뷰** 두 가지 형태로 제공됩니다.

| 뷰 | URL | 설명 |
|----|-----|------|
| MD | `/dev-learnings/litellm-blog/` | 11ty가 렌더링한 깔끔한 텍스트 버전 |
| HTML | `/dev-learnings/litellm-blog/interactive/` | 직접 제작한 인터랙티브 버전 (Chart.js 등) |

- MD 페이지 상단에 **"HTML 버전 보기"** 링크 (대응 HTML이 있을 때만 표시)
- HTML 페이지 우하단에 **"MD 버전 보기"** 플로팅 버튼 (빌드 시 자동 주입)

## 새 글 추가

### MD만 추가

```bash
# docs/{카테고리}/slug.md 파일 생성
docs/dev-learnings/my-new-post-blog.md
```

- YAML frontmatter 없어도 됨 (첫 `#` 제목에서 자동 추출)
- push하면 자동 배포

### MD + HTML 쌍으로 추가

```bash
docs/dev-learnings/my-new-post-blog.md     # 텍스트 버전
docs/dev-learnings/my-new-post-blog.html   # 인터랙티브 버전
```

- 동일 슬러그의 `.md`와 `.html`이 있으면 자동으로 토글 활성화
- HTML은 standalone 문서 (`<!DOCTYPE html>` 포함)

## 새 카테고리 추가

`docs/` 아래 새 폴더를 만들면 홈페이지 탭에 자동 표시.

```bash
mkdir docs/tech
# docs/tech/some-topic.md 추가
```

비-블로그 폴더를 추가하는 경우 `site/.eleventy.js`의 `ignoreDirs`에 등록.

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 + GitHub Pages 배포.

- **사전 설정**: 레포 Settings > Pages > Source를 **"GitHub Actions"**로 선택
- **배포 URL**: `https://dEitY719.github.io/playbook/`

## 기술 스택

| 항목 | 선택 |
|------|------|
| SSG | Eleventy 3.x |
| 템플릿 | Nunjucks |
| 스타일 | 순수 CSS (카드 UI) |
| 호스팅 | GitHub Pages |
| CI/CD | GitHub Actions |
