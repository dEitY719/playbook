# 11ty + GitHub Pages 웹 공유 사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** playbook 저장소의 MD/HTML 콘텐츠를 듀얼 포맷 뷰(MD 렌더링 + 인터랙티브 HTML)로 GitHub Pages에 배포한다.

**Architecture:** 11ty(Eleventy)가 `docs/` 하위의 마크다운을 테마 적용하여 렌더링하고, 직접 만든 HTML 파일은 post-build 스크립트로 복사+플로팅 버튼 주입한다. GitHub Actions로 자동 빌드/배포.

**Tech Stack:** Eleventy 3.x, Nunjucks, 순수 CSS, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-04-09-eleventy-github-pages-design.md`

---

## File Structure

### 새로 생성할 파일

| 파일 | 역할 |
|------|------|
| `site/.eleventy.js` | 11ty 설정 (입력/출력, 컬렉션, HTML 복사+주입) |
| `site/package.json` | Node.js 의존성 (eleventy, fast-glob) |
| `site/_includes/layouts/base.njk` | 공통 HTML 셸 (헤더, 푸터) |
| `site/_includes/layouts/post.njk` | MD 포스트 레이아웃 (토글 링크 포함) |
| `site/_data/htmlPairs.js` | MD-HTML 페어링 데이터 (글로벌 데이터) |
| `site/css/style.css` | 사이트 테마 + 카드 UI |
| `docs/index.njk` | 홈페이지 (글 목록, 카테고리 탭) |
| `docs/docs.11tydata.js` | docs/ 공통 설정 (레이아웃, permalink, 제목 추출) |
| `.github/workflows/pages.yml` | GitHub Actions 배포 워크플로우 |
| `.nojekyll` | Jekyll 비활성화 |

### 수정할 파일

| 파일 | 변경 내용 |
|------|-----------|
| `.gitignore` | `_output/` 추가 |

---

## Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `site/package.json`
- Create: `.nojekyll`
- Modify: `.gitignore`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "playbook-site",
  "private": true,
  "scripts": {
    "build": "eleventy --config=site/.eleventy.js",
    "serve": "eleventy --config=site/.eleventy.js --serve"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "fast-glob": "^3.3.0"
  }
}
```

- [ ] **Step 2: .nojekyll 생성**

빈 파일 생성: `touch .nojekyll`

- [ ] **Step 3: .gitignore에 _output/ 추가**

`.gitignore` 끝에 추가:
```
# 11ty build output
_output/
node_modules/
```

(`node_modules/`는 이미 `.gitignore`의 `build` 섹션에 있으므로, `_output/`만 추가하면 됨. 중복 확인 후 추가.)

- [ ] **Step 4: npm install 실행**

```bash
cd site && npm install
```

- [ ] **Step 5: 커밋**

```bash
git add site/package.json site/package-lock.json .nojekyll .gitignore
git commit -m "chore: scaffold 11ty project with package.json and .nojekyll"
```

---

## Task 2: 11ty 설정 파일 (.eleventy.js)

**Files:**
- Create: `site/.eleventy.js`

- [ ] **Step 1: .eleventy.js 생성**

```js
const fs = require("fs");
const path = require("path");
const glob = require("fast-glob");

module.exports = function (eleventyConfig) {
  // --- Ignores: 블로그가 아닌 디렉토리 ---
  const ignoreDirs = [
    "docs/analysis/**",
    "docs/jira-records/**",
    "docs/confluence-guides/**",
    "docs/worklog-templates/**",
    "docs/superpowers/**",
    "docs/task-history/**",
  ];
  for (const dir of ignoreDirs) {
    eleventyConfig.ignores.add(dir);
  }
  // HTML 파일은 11ty가 처리하지 않음 (post-build에서 별도 처리)
  eleventyConfig.ignores.add("docs/**/*.html");

  // --- 정적 자산 ---
  eleventyConfig.addPassthroughCopy({ "site/css": "css" });

  // --- 컬렉션: 모든 포스트 (날짜 역순) ---
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("docs/**/*.md")
      .filter((item) => !item.inputPath.endsWith("index.njk"))
      .sort((a, b) => {
        const dateA = a.data.date || a.date;
        const dateB = b.data.date || b.date;
        return dateB - dateA;
      });
  });

  // --- 필터: 카테고리 추출 ---
  eleventyConfig.addFilter("category", function (inputPath) {
    // docs/dev-learnings/post.md → dev-learnings
    const parts = inputPath.replace(/^\.?\/?(docs\/)?/, "").split("/");
    return parts.length > 1 ? parts[0] : "uncategorized";
  });

  // --- 필터: 날짜 포맷 (YYYY-MM-DD) ---
  eleventyConfig.addFilter("dateFormat", function (date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  });

  // --- Post-build: HTML 파일 복사 + 플로팅 버튼 주입 ---
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const htmlFiles = glob.sync("docs/**/*.html");
    const floatingBtn = `
<a href="../"
   style="position:fixed;bottom:20px;right:20px;background:#333;color:#fff;
          padding:8px 16px;border-radius:8px;text-decoration:none;
          font-size:14px;z-index:9999;opacity:0.85;
          transition:opacity 0.2s;font-family:sans-serif;"
   onmouseover="this.style.opacity='1'"
   onmouseout="this.style.opacity='0.85'">
  MD 버전 보기
</a>`;

    for (const htmlFile of htmlFiles) {
      // docs/dev-learnings/slug.html → _output/dev-learnings/slug/interactive/index.html
      const relative = htmlFile.replace(/^docs\//, "");
      const withoutExt = relative.replace(/\.html$/, "");
      const outPath = path.join(
        dir.output,
        withoutExt,
        "interactive",
        "index.html"
      );

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      let content = fs.readFileSync(htmlFile, "utf-8");
      content = content.replace("</body>", floatingBtn + "\n</body>");
      fs.writeFileSync(outPath, content, "utf-8");
    }
  });

  // --- pathPrefix: GitHub Pages 경로 ---
  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/playbook/";

  return {
    pathPrefix,
    dir: {
      input: "docs",
      includes: "../site/_includes",
      data: "../site/_data",
      output: "_output",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
```

- [ ] **Step 2: 빌드 테스트 (실패 확인)**

```bash
npx eleventy --config=site/.eleventy.js
```

Expected: 레이아웃 파일 없어서 에러 (Task 3에서 생성)

- [ ] **Step 3: 커밋**

```bash
git add site/.eleventy.js
git commit -m "feat: add 11ty config with collections, HTML copy, and category filter"
```

---

## Task 3: 기본 레이아웃 + CSS

**Files:**
- Create: `site/_includes/layouts/base.njk`
- Create: `site/_includes/layouts/post.njk`
- Create: `site/css/style.css`

- [ ] **Step 1: base.njk 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title | default("Playbook") }}</title>
  <link rel="stylesheet" href="{{ '/css/style.css' | url }}">
</head>
<body>
  <header class="site-header">
    <a href="{{ '/' | url }}" class="site-title">Playbook</a>
  </header>
  <main class="site-main">
    {{ content | safe }}
  </main>
  <footer class="site-footer">
    <p>Playbook &middot; <a href="https://github.com/dEitY719/playbook">GitHub</a></p>
  </footer>
</body>
</html>
```

- [ ] **Step 2: post.njk 생성**

```html
---
layout: layouts/base.njk
---
<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{ title }}</h1>
    <div class="post-meta">
      {% if date %}<time>{{ date | dateFormat }}</time>{% endif %}
      <span class="post-category">{{ page.inputPath | category }}</span>
    </div>
    {% if htmlPairs[page.filePathStem] %}
    <a href="{{ page.url }}interactive/" class="format-toggle format-toggle--html">
      HTML 버전 보기
    </a>
    {% endif %}
  </header>
  <div class="post-content">
    {{ content | safe }}
  </div>
</article>
```

- [ ] **Step 3: style.css 생성**

```css
/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.7;
  color: #1a1a1a;
  background: #f8f9fa;
}
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }

/* === Layout === */
.site-header {
  padding: 1.5rem 2rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.site-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a1a;
}
.site-title:hover { text-decoration: none; }
.site-main { max-width: 48rem; margin: 2rem auto; padding: 0 1.5rem; }
.site-footer {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 0.875rem;
}

/* === Card List (Homepage) === */
.category-tabs {
  display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
}
.category-tab {
  padding: 0.4rem 1rem;
  border-radius: 2rem;
  background: #e5e7eb;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}
.category-tab:hover, .category-tab.active {
  background: #2563eb;
  color: #fff;
}
.card-list { display: flex; flex-direction: column; gap: 1rem; }
.card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s, transform 0.2s;
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}
.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}
.card-meta {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: 0.75rem;
}
.card-links { display: flex; gap: 0.75rem; }
.card-link {
  font-size: 0.8125rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  background: #f3f4f6;
  color: #374151;
  transition: background 0.2s;
}
.card-link:hover { background: #e5e7eb; text-decoration: none; }

/* === Post === */
.post-header { margin-bottom: 2rem; }
.post-title { font-size: 1.75rem; font-weight: 800; line-height: 1.3; }
.post-meta { margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280; }
.post-category {
  background: #e5e7eb; padding: 0.15rem 0.6rem;
  border-radius: 1rem; font-size: 0.75rem;
}
.format-toggle {
  display: inline-block; margin-top: 0.75rem;
  padding: 0.4rem 1rem; border-radius: 2rem;
  font-size: 0.875rem; font-weight: 500;
}
.format-toggle--html { background: #fef3c7; color: #92400e; }
.format-toggle--html:hover { background: #fde68a; text-decoration: none; }

/* === Post Content (rendered markdown) === */
.post-content h1 { font-size: 1.5rem; margin-top: 2rem; }
.post-content h2 { font-size: 1.3rem; margin-top: 1.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3rem; }
.post-content h3 { font-size: 1.1rem; margin-top: 1.5rem; }
.post-content p { margin-top: 0.75rem; }
.post-content ul, .post-content ol { margin-top: 0.75rem; padding-left: 1.5rem; }
.post-content pre {
  background: #1e293b; color: #e2e8f0;
  padding: 1rem; border-radius: 8px;
  overflow-x: auto; margin-top: 1rem;
  font-size: 0.875rem; line-height: 1.5;
}
.post-content code {
  background: #f1f5f9; padding: 0.15rem 0.4rem;
  border-radius: 4px; font-size: 0.875em;
}
.post-content pre code { background: none; padding: 0; }
.post-content blockquote {
  border-left: 3px solid #2563eb;
  padding-left: 1rem; color: #4b5563;
  margin-top: 1rem;
}
.post-content img { max-width: 100%; border-radius: 8px; margin-top: 1rem; }
.post-content table {
  width: 100%; border-collapse: collapse; margin-top: 1rem;
}
.post-content th, .post-content td {
  border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left;
}
.post-content th { background: #f9fafb; font-weight: 600; }
```

- [ ] **Step 4: 커밋**

```bash
git add site/_includes/ site/css/
git commit -m "feat: add base/post layouts and CSS theme with card UI"
```

---

## Task 4: docs 디렉토리 데이터 + MD-HTML 페어링

**Files:**
- Create: `docs/docs.11tydata.js`
- Create: `site/_data/htmlPairs.js`

- [ ] **Step 1: docs.11tydata.js 생성 (공통 레이아웃 + 제목 추출)**

이 파일은 `docs/` 내 모든 MD 파일에 자동 적용되는 디렉토리 데이터 파일이다.

```js
const fs = require("fs");

module.exports = {
  layout: "layouts/post.njk",
  eleventyComputed: {
    title: (data) => {
      if (data.title) return data.title; // frontmatter 우선
      // 첫 번째 # 제목에서 추출
      try {
        const content = fs.readFileSync(data.page.inputPath, "utf-8");
        const match = content.match(/^#\s+(.+)/m);
        if (match) {
          // 이모지 제거 후 반환
          return match[1].replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
        }
      } catch (e) { /* fallback */ }
      return data.page.fileSlug;
    },
    category: (data) => {
      const parts = data.page.inputPath.replace(/^\.?\/?docs\//, "").split("/");
      return parts.length > 1 ? parts[0] : "uncategorized";
    },
  },
};
```

- [ ] **Step 2: htmlPairs.js 생성 (글로벌 데이터)**

```js
const glob = require("fast-glob");

module.exports = function () {
  const htmlFiles = glob.sync("docs/**/*.html");
  const pairs = {};
  for (const f of htmlFiles) {
    // docs/dev-learnings/litellm-blog.html → /dev-learnings/litellm-blog
    const key = "/" + f.replace(/^docs\//, "").replace(/\.html$/, "");
    pairs[key] = true;
  }
  return pairs;
};
```

`post.njk`에서 `htmlPairs[page.filePathStem]`으로 접근하여 대응 HTML 존재 여부를 확인한다.

- [ ] **Step 3: 빌드 테스트**

```bash
npx eleventy --config=site/.eleventy.js
```

Expected: `_output/dev-learnings/litellm-timeout-sdk-retry-blog/index.html` 등 생성 확인

- [ ] **Step 4: 커밋**

```bash
git add docs/docs.11tydata.js site/_data/htmlPairs.js
git commit -m "feat: add directory data and MD-HTML pairing logic"
```

---

## Task 5: 홈페이지 (글 목록 + 카테고리 탭)

**Files:**
- Create: `docs/index.njk`

- [ ] **Step 1: index.njk 생성**

```html
---
layout: layouts/base.njk
title: Playbook
permalink: /index.html
---
<section class="home">
  <h1 class="home-heading">Playbook</h1>

  {%- set allPosts = collections.posts -%}
  {%- set categories = [] -%}
  {%- for post in allPosts -%}
    {%- set cat = post.data.category -%}
    {%- if cat and cat not in categories -%}
      {%- set categories = (categories.push(cat), categories) -%}
    {%- endif -%}
  {%- endfor -%}

  <div class="category-tabs">
    <button class="category-tab active" data-category="all">All</button>
    {%- for cat in categories | sort -%}
    <button class="category-tab" data-category="{{ cat }}">{{ cat }}</button>
    {%- endfor -%}
  </div>

  <div class="card-list">
    {%- for post in allPosts -%}
    {%- set cat = post.data.category -%}
    <div class="card" data-category="{{ cat }}">
      <a href="{{ post.url | url }}" class="card-title-link">
        <h2 class="card-title">{{ post.data.title }}</h2>
      </a>
      <div class="card-meta">
        {% if post.data.date %}<time>{{ post.data.date | dateFormat }}</time> &middot;{% endif %}
        <span>{{ cat }}</span>
      </div>
      <div class="card-links">
        <a href="{{ post.url | url }}" class="card-link">MD</a>
        {%- if htmlPairs[post.page.filePathStem] -%}
        <a href="{{ post.url | url }}interactive/" class="card-link">HTML</a>
        {%- endif -%}
      </div>
    </div>
    {%- endfor -%}
  </div>
</section>

<script>
document.querySelectorAll('.category-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
    this.classList.add('active');
    var cat = this.dataset.category;
    document.querySelectorAll('.card').forEach(function(card) {
      card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
    });
  });
});
</script>
```

- [ ] **Step 2: 빌드 + 로컬 확인**

```bash
npx eleventy --config=site/.eleventy.js --serve
```

브라우저에서 `http://localhost:8080/playbook/` 접속하여 확인:
- 글 목록이 카드 형태로 표시되는지
- 카테고리 탭 필터링이 동작하는지
- MD 링크 클릭 시 포스트 페이지로 이동하는지
- litellm 포스트에 HTML 링크가 보이는지

- [ ] **Step 3: 커밋**

```bash
git add docs/index.njk
git commit -m "feat: add homepage with card list and category tabs"
```

---

## Task 6: GitHub Actions 배포 워크플로우

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: pages.yml 생성**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: site/package-lock.json

      - name: Install dependencies
        run: cd site && npm ci

      - name: Build 11ty
        run: npx eleventy --config=site/.eleventy.js
        env:
          ELEVENTY_PATH_PREFIX: /playbook/

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _output

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 커밋**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: add GitHub Actions workflow for 11ty → GitHub Pages deploy"
```

---

## Task 7: 로컬 빌드 검증 + 성공 기준 확인

- [ ] **Step 1: 클린 빌드**

```bash
rm -rf _output && npx eleventy --config=site/.eleventy.js
```

- [ ] **Step 2: 출력 파일 구조 확인**

```bash
find _output -name "index.html" | sort
```

Expected 출력 (기존 MD 파일 기준):
```
_output/dev-learnings/claude-pro-parallel-work-blog/index.html
_output/dev-learnings/git-worktree-ai-multi-agent-blog/index.html
_output/dev-learnings/knox-portal-esb-html-sanitizer-blog/index.html
_output/dev-learnings/litellm-timeout-sdk-retry-blog/index.html
_output/dev-learnings/litellm-timeout-sdk-retry-blog/interactive/index.html
_output/dev-learnings/sso-prod-deploy-disaster-blog-v2/index.html
_output/dev-learnings/sso-prod-deployment-hell-postmortem-v2/index.html
_output/dev-learnings/sso-prod-three-failures-blog-v2/index.html
_output/dev-learnings/test-mock-lies-partial-update-blog/index.html
_output/dev-learnings/test-mock-lies-partial-update-blog-v2-general/index.html
_output/index.html
```

- [ ] **Step 3: 성공 기준 체크리스트**

1. `_output/index.html` — 홈페이지에 카드 목록이 있는가
2. `_output/dev-learnings/litellm-timeout-sdk-retry-blog/index.html` — MD가 테마 적용되어 렌더링되는가
3. `_output/dev-learnings/litellm-timeout-sdk-retry-blog/interactive/index.html` — 원본 HTML + 플로팅 "MD 버전 보기" 버튼이 주입되어 있는가
4. MD 포스트 페이지에 "HTML 버전 보기" 토글 링크가 있는가 (litellm 포스트만)
5. HTML 대응이 없는 포스트에는 토글 링크가 없는가

```bash
# 플로팅 버튼 주입 확인
grep "MD 버전 보기" _output/dev-learnings/litellm-timeout-sdk-retry-blog/interactive/index.html

# MD 포스트에 HTML 토글 링크 확인
grep "interactive" _output/dev-learnings/litellm-timeout-sdk-retry-blog/index.html

# HTML 없는 포스트에 토글 링크 없는지 확인
grep "interactive" _output/dev-learnings/knox-portal-esb-html-sanitizer-blog/index.html || echo "OK: no toggle link"
```

- [ ] **Step 4: 로컬 서버로 최종 확인**

```bash
npx eleventy --config=site/.eleventy.js --serve
```

브라우저에서 확인:
- `http://localhost:8080/playbook/` → 홈페이지 카드 목록
- 카드 클릭 → MD 포스트 페이지
- "HTML 버전 보기" 클릭 → 인터랙티브 HTML 페이지
- "MD 버전 보기" 플로팅 버튼 → MD 포스트로 복귀

---

## 완료 후 참고

- **GitHub Pages 활성화**: 레포 Settings → Pages → Source를 "GitHub Actions"로 설정 필요
- **새 글 추가 시**: `docs/{category}/slug.md` (+ 선택적으로 `slug.html`) 추가 후 push하면 자동 반영
- **새 카테고리 추가 시**: `docs/` 아래 새 폴더 생성하면 자동으로 탭에 표시됨
- **무시할 폴더 추가 시**: `site/.eleventy.js`의 `ignoreDirs` 배열에 추가
