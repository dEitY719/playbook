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

/**
 * `interactive/` 페이지에서 짝이 되는 MD 페이지로 돌아가는 상대 경로를 만든다.
 *
 *   `skills/foo/README-CX` → `../../README/`   (MD: `/skills/foo/README/`)
 *   `skills/foo/index-CX`  → `../../`          (MD: `/skills/foo/`)
 *   `skills/foo/index`     → `../`             (MD: `/skills/foo/`)
 *   `dev/post`             → `../`             (MD: `/dev/post/`)
 *
 * 플로팅 "MD 버전 보기" 버튼을 HTML 에 주입할 때 사용한다.
 */
function toMdHrefFromInteractive(stem) {
  const variantMatch = stem.match(/^(.+?)-(C|CX|G)$/);
  const baseStem = variantMatch ? variantMatch[1] : stem;
  const mdPretty = toPrettyStem(baseStem);
  const interactivePretty = toPrettyStem(stem);

  const fromPath = interactivePretty
    ? `/${interactivePretty}/interactive`
    : `/interactive`;
  const toPath = mdPretty ? `/${mdPretty}` : "/";

  const rel = path.posix.relative(fromPath, toPath);
  if (!rel) return "./";
  return rel.endsWith("/") ? rel : `${rel}/`;
}

module.exports = { toPageStem, toPrettyStem, toMdHrefFromInteractive };
