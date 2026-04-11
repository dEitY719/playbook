const fs = require("fs");
const path = require("path");
const glob = require("fast-glob");
const {
  toPageStem,
  toPrettyStem,
  toMdHrefFromInteractive,
} = require("./_lib/paths");

module.exports = function (eleventyConfig) {
  // --- Ignores: 블로그가 아닌 디렉토리 ---
  const ignoreDirs = [
    "docs/analysis/**",
    "docs/jira-records/**",
    "docs/confluence-guides/**",
    "docs/worklog-templates/**",
    "docs/superpowers/**",
    "docs/task-history/**",
    // skills/*/SKILL_ko.md 는 README.md 와 쌍이므로 홈 카드 중복 방지를 위해 제외
    "docs/skills/**/SKILL_ko.md",
  ];
  for (const dir of ignoreDirs) {
    eleventyConfig.ignores.add(dir);
  }
  // HTML 파일은 11ty 기본 처리에서 제외 (커스텀 확장자로 처리)
  eleventyConfig.ignores.add("docs/**/*.html");

  // --- 정적 자산 ---
  eleventyConfig.addPassthroughCopy({ "site/css": "css" });

  // --- 컬렉션: 모든 포스트 (날짜 역순) ---
  //
  // `docs/skills/<plugin>/<skill>/*.md` 깊이의 파일은 홈 카드 리스트에서 제외한다.
  // `skills` 탭 밑에는 각 플러그인을 **한 장의 카드**로만 노출하고, 그 카드의
  // 링크는 플러그인 레벨 페이지(`docs/skills/<plugin>/index.md`)로 연결된다.
  // 향후 다른 플러그인들이 추가되어도 같은 패턴으로 동작한다.
  const isNestedSkillPage = (inputPath) => {
    const rel = inputPath.replace(/^\.?\/?/, "").replace(/^docs\//, "");
    const parts = rel.split("/");
    return parts[0] === "skills" && parts.length > 3;
  };

  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("docs/**/*.md")
      .filter((item) => !item.inputPath.endsWith("index.njk"))
      .filter((item) => !isNestedSkillPage(item.inputPath))
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

  // --- HTML 파일: 가상 템플릿으로 등록 (dev server 호환) ---
  //
  // `href` 는 파일마다 달라지므로 (예: `README-CX.html` → `../../README/`,
  // `index-CX.html` → `../../`) 루프 안에서 계산한다.
  const buildFloatingBtn = (href) => `
<a href="${href}"
   style="position:fixed;bottom:20px;right:20px;background:#333;color:#fff;
          padding:8px 16px;border-radius:8px;text-decoration:none;
          font-size:14px;z-index:9999;opacity:0.85;
          transition:opacity 0.2s;font-family:sans-serif;"
   onmouseover="this.style.opacity='1'"
   onmouseout="this.style.opacity='0.85'">
  MD 버전 보기
</a>`;

  // 모든 텍스트 출력물의 줄 끝 공백을 제거해 배포용 commit 훅 차단을 예방한다.
  const stripTrailingWhitespace = (text) => text.replace(/[ \t]+$/gm, "");

  eleventyConfig.addTransform("strip-trailing-whitespace", function (content) {
    if (typeof content !== "string") return content;
    return stripTrailingWhitespace(content);
  });

  const htmlFiles = glob.sync("docs/**/*.html");
  for (const htmlFile of htmlFiles) {
    const stem = toPageStem(htmlFile);
    // index.html 은 `index.md` 의 pretty URL(`/foo/`) 과 짝이 되도록
    // 경로 꼬리의 `/index` 를 떼서 같은 디렉토리에 착륙시킨다.
    const prettyStem = toPrettyStem(stem);
    const permalink = prettyStem
      ? `${prettyStem}/interactive/index.html`
      : `interactive/index.html`;

    let content = fs.readFileSync(htmlFile, "utf-8");
    content = stripTrailingWhitespace(content);
    const mdHref = toMdHrefFromInteractive(stem);
    content = content.replace("</body>", buildFloatingBtn(mdHref) + "\n</body>");

    // layout: false — CX HTML 파일들은 자체 <!DOCTYPE html> 을 가진
    // standalone 페이지라서 post.njk 로 감싸면 <main> 중첩이 생기고, CX 의
    // 전역 `#main-content` (구 `main`) 셀렉터가 바깥 `<main class="site-main">`
    // 까지 건드려 article 열이 붕괴한다. docs.11tydata.js 의 기본
    // layout 상속을 여기서 해제한다.
    eleventyConfig.addTemplate(permalink, content, {
      permalink: permalink,
      layout: false,
    });
  }

  // HTML 소스 변경 시 리빌드
  eleventyConfig.addWatchTarget("docs/**/*.html");

  // --- pathPrefix: GitHub Pages 경로 (로컬은 /, 배포 시 Actions에서 /playbook/ 설정) ---
  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

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
