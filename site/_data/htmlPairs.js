const glob = require("fast-glob");
const { toPageStem, toPrettyStem } = require("../_lib/paths");

const VARIANT_ORDER = ["HTML", "C", "CX", "G"];
const VARIANT_SUFFIX_RE = /^(.+?)-(C|CX|G)$/;

/**
 * 한 md 파일에 대응되는 HTML variant 목록 생성.
 *
 * 규칙:
 *   - `foo.html`                → baseKey `/foo`, label "HTML"
 *   - `foo-C.html` / `-CX` / `-G` → baseKey `/foo`, label "C"/"CX"/"G"
 *   - `index.html`              → baseKey `/index`, url은 pretty URL로 정렬
 *
 * baseKey 는 11ty `page.filePathStem` 과 매칭되어 템플릿에서
 * `htmlPairs[post.page.filePathStem]` 으로 variant 리스트를 조회한다.
 *
 * 반환 shape: { [baseKey]: [{ label, url }] }
 */
module.exports = function () {
  const htmlFiles = glob.sync("docs/**/*.html");
  const pairs = {};

  for (const file of htmlFiles) {
    const stem = toPageStem(file);
    const variantMatch = stem.match(VARIANT_SUFFIX_RE);

    let baseKey;
    let label;
    let url;

    if (variantMatch) {
      baseKey = "/" + variantMatch[1];
      label = variantMatch[2];
      url = "/" + stem + "/interactive/";
    } else {
      baseKey = "/" + stem;
      label = "HTML";
      const pretty = toPrettyStem(stem);
      url = pretty ? "/" + pretty + "/interactive/" : "/interactive/";
    }

    pairs[baseKey] ??= [];
    pairs[baseKey].push({ label, url });
  }

  for (const key of Object.keys(pairs)) {
    pairs[key].sort(
      (a, b) => VARIANT_ORDER.indexOf(a.label) - VARIANT_ORDER.indexOf(b.label)
    );
  }

  return pairs;
};
