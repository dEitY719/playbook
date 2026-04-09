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
