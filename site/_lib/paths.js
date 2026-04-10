const path = require("path");

const DOCS_DIR = "docs";

/**
 * `docs/foo/bar.html` → `foo/bar`
 *
 * 11ty의 `page.filePathStem`과 동일한 형태(앞에 `/` 없음, 확장자 없음)를 만든다.
 * POSIX 경로를 강제해 Windows에서도 동일한 키가 나오도록 한다.
 */
function toPageStem(file) {
  const posix = file.split(path.sep).join("/");
  const rel = path.posix.relative(DOCS_DIR, posix);
  const parsed = path.posix.parse(rel);
  return parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name;
}

/**
 * 꼬리의 `/index` (또는 bare `index`)를 제거해 11ty pretty URL과 정렬한다.
 *
 *   `foo/index` → `foo`
 *   `index`     → `""`
 *   `foo`       → `foo`
 *
 * 이 함수를 경유하지 않으면 `foo/index.md`의 URL은 `/foo/`인데 짝이 되는
 * `foo/index.html`은 `/foo/index/interactive/`로 드리프트되어 카드 링크가 깨진다.
 */
function toPrettyStem(stem) {
  if (stem === "index") return "";
  if (stem.endsWith("/index")) return stem.slice(0, -"/index".length);
  return stem;
}

module.exports = { toPageStem, toPrettyStem };
