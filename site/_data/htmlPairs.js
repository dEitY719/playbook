const glob = require("fast-glob");

/**
 * 한 md 파일에 대응되는 HTML variant 목록 생성.
 *
 * 규칙:
 *   - `foo.html`                → baseKey `/foo`, label "HTML"
 *   - `foo-C.html` / `-CX` / `-G` → baseKey `/foo`, label "C"/"CX"/"G"
 *   - `index.html`              → baseKey `/index`,  url은 pretty URL로 정렬 (`/interactive/`)
 *
 * baseKey 는 11ty `page.filePathStem` 과 매칭됨.
 * 반환 shape: { [baseKey]: [{ label, url }] }
 */
module.exports = function () {
  const htmlFiles = glob.sync("docs/**/*.html");
  const pairs = {};

  for (const f of htmlFiles) {
    const rel = f.replace(/^docs\//, "").replace(/\.html$/, "");
    const variantMatch = rel.match(/^(.+?)-(C|CX|G)$/);

    let baseKey;
    let label;
    let url;

    if (variantMatch) {
      // variant HTML: 같은 디렉토리의 base md와 페어링
      const base = variantMatch[1];
      baseKey = "/" + base;
      label = variantMatch[2];
      url = "/" + rel + "/interactive/";
    } else {
      // base HTML
      baseKey = "/" + rel;
      label = "HTML";
      // index.html은 pretty URL로 경로 단축 (index.md 와 정렬)
      const pretty = rel.replace(/(^|\/)index$/, "");
      url = pretty ? "/" + pretty + "/interactive/" : "/interactive/";
    }

    if (!pairs[baseKey]) pairs[baseKey] = [];
    pairs[baseKey].push({ label, url });
  }

  // 정렬: HTML → C → CX → G
  const order = { HTML: 0, C: 1, CX: 2, G: 3 };
  for (const key of Object.keys(pairs)) {
    pairs[key].sort(
      (a, b) => (order[a.label] ?? 99) - (order[b.label] ?? 99)
    );
  }

  return pairs;
};
