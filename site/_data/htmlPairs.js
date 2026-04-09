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
