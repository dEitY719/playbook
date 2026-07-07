const glob = require("fast-glob");
const { toPageStem, toPrettyStem } = require("../_lib/paths");

const VARIANT_ORDER = ["HTML", "C", "CX", "G"];
const VARIANT_SUFFIX_RE = /^(.+?)-(C|CX|G)$/;

/**
 * 11ty 는 `YYYY-MM-DD-` 날짜 접두어가 붙은 파일의 `filePathStem` 에서
 * 날짜를 떼어낸다 (예: `2026-07-04-task-list` → `task-list`). 반면 실제
 * 출력 URL 과 이 HTML 파일명은 날짜를 유지한다. 카드/포스트 템플릿은
 * `htmlPairs[page.filePathStem]` 로 조회하므로, 매칭이 되려면 baseKey 도
 * 마지막 경로 세그먼트의 날짜 접두어를 동일하게 제거해야 한다. (URL 은 날짜 유지)
 */
function stripDatePrefix(stem) {
  const parts = stem.split("/");
  parts[parts.length - 1] = parts[parts.length - 1].replace(
    /^\d{4}-\d{2}-\d{2}-/,
    ""
  );
  return parts.join("/");
}

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
      baseKey = "/" + stripDatePrefix(variantMatch[1]);
      label = variantMatch[2];
      url = "/" + stem + "/interactive/";
    } else {
      baseKey = "/" + stripDatePrefix(stem);
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
