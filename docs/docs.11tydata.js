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
