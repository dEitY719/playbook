const fs = require("fs");
const path = require("path");
const glob = require("fast-glob");
const { toPageStem, toPrettyStem } = require("./_lib/paths");

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

  // --- HTML 파일: 가상 템플릿으로 등록 (dev server 호환) ---
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

  const htmlFiles = glob.sync("docs/**/*.html");
  for (const htmlFile of htmlFiles) {
    // index.html 은 `index.md` 의 pretty URL(`/foo/`) 과 짝이 되도록
    // 경로 꼬리의 `/index` 를 떼서 같은 디렉토리에 착륙시킨다.
    const prettyStem = toPrettyStem(toPageStem(htmlFile));
    const permalink = prettyStem
      ? `${prettyStem}/interactive/index.html`
      : `interactive/index.html`;

    let content = fs.readFileSync(htmlFile, "utf-8");
    content = content.replace("</body>", floatingBtn + "\n</body>");

    eleventyConfig.addTemplate(permalink, content, {
      permalink: permalink,
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
