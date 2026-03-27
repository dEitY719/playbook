# 회사 메일 스타일이 갑자기 다 깨진 이유 — 포털이 `<style>`을 훔쳐갔다 🕵️
## (feat. Knox Portal ESB, BeautifulSoup sanitizer, 13가지 규칙)

---

## TL;DR

**Knox Portal은 수신한 HTML의 `<style>`을 통째로 빼서 전역 CSS로 올립니다. 우리 클래스명이 포털 공통 CSS와 싸우게 됩니다.**
13가지 규칙(R1~R13)을 강제 적용하는 ESB sanitizer를 만들어 대응했고, PR 리뷰에서 4개 버그가 추가로 발견됐습니다.

---

## 문제 상황: 잘 되던 메일이 어느 날 갑자기 깨졌다

### 🔥 나의 현상: "분명히 예쁘게 만들었는데?"

[JIRAvis](https://github.com/dev-team-404/JIRAvis.git)는 Jira 이슈 현황을 LLM이 예쁜 HTML 이메일로 변환해서 사내 메일로 발송하는 기능이 있습니다. LLM이 hero 섹션, KPI 카드, 테이블, 배지까지 갖춘 그럴싸한 HTML을 뚝딱 만들어줍니다.

그런데 어느 순간부터 사내 메일함에서 열면 CSS가 다 날아가버렸다는 제보가 들어왔습니다.

로컬 브라우저에서 열면:

```
[멋진 인디고 hero 섹션]
[KPI 카드 4개가 가로로 쭉]
[정렬된 테이블]
```

Knox Portal 메일함에서 열면:

```
JIRA Due Date Briefing
Total 1건 | Overdue 0 | Today 0 | Upcoming 1
---
SWINNOTEAM-5367 | Confluence Tool 정리 및 검증 | ...
```

순수 텍스트. 브라우저 기본 스타일만 남아있었습니다.

---

## 진짜 원인: Knox Portal이 HTML을 "재편집"하고 있었다

### 📦 회사 가이드에 적혀 있었던 것

사내에서 가이드 문서가 돌았는데, 읽어보니 충격적인 내용이 있었습니다:

> **Knox Portal의 메일 본문 표시방식이 변경됨**
> - 기존: `<iFrame>`으로 처리
> - 변경: `<div>`로 변경 (One-Page 렌더링)
> - `<div>` 내 `<style>`이 메일 조회 화면 전체에 영향을 주게 됨에 따라, **`<style>` 태그를 `<div>` 밖으로 빼고 CSS를 별도 클래스로 재정의**

다시 읽었습니다.

Knox Portal이 우리 HTML을 받아서 **스스로 분해하고 재조립**한다는 뜻입니다.

우리가 보낸 HTML:
```html
<div class="container">
  <style>
    .container { max-width: 960px; }
    .badge { padding: 2px 8px; border-radius: 6px; }
    /* ... */
  </style>
  <div class="badge">High</div>
</div>
```

Knox Portal이 보여주는 HTML (포털 내부 처리 후):
```html
<!-- 포털 전역 영역 -->
<style>
  /* 우리 CSS가 여기로 올라옴 */
  .container { max-width: 960px; }
  .badge { padding: 2px 8px; border-radius: 6px; }
  /* 근데 포털 공통 CSS에도 .badge가 있다면? 💥 */
</style>

<!-- 포털 공통 CSS -->
<style>
  .badge { ... }   /* 충돌! */
</style>

<div>
  <div class="badge">High</div>
</div>
```

`.container`, `.badge`, `.section`, `.hero`... 이 범용 클래스명들이 포털의 공통 CSS와 싸우고 있었던 것입니다.

게다가 Knox Portal은 이것도 합니다:

| Knox Portal 처리 | 영향 |
|---|---|
| `<link ~.css>` 태그 삭제 | 외부 폰트, 스타일시트 전부 날아감 |
| `<style>` 파싱 실패 시 통째로 삭제 | `@media` 쿼리 하나가 파싱 실패하면 모든 스타일이 삭제됨 |
| XSS 방지 처리 | `onclick`, `onload` 등 이벤트 핸들러 전부 제거 |

---

## 설계: 2-layer 방어 전략

### 🛡️ Layer 1 (예방): LLM 프롬프트

LLM에게 처음부터 Knox Portal 호환 HTML을 생성하도록 시스템 프롬프트에 명시합니다:

```
## Knox Portal ESB Compatibility (MANDATORY)
- Use exactly ONE <style> block inside <head>
- Do NOT use <link rel="stylesheet"> — external CSS is stripped
- Do NOT use @media queries — they are stripped
- Always specify CSS units (px, em, %) for margin, padding
- Add display:block to all <img> elements
- Do NOT set display:block on <tr> elements
```

### 🛡️ Layer 2 (강제): ESB HTML Sanitizer

LLM이 실수하더라도 발송 직전에 강제로 교정합니다.
`backend/notification/esb_html_sanitizer.py`를 새로 만들었습니다.

**Rule Set R1~R13:**

```python
def sanitize_html_for_knox_portal(html: str, *, strict: bool = True) -> SanitizedHtmlResult:
    soup = BeautifulSoup(html, "lxml")

    # 보안 규칙 (strict 무관, 항상 적용)
    _remove_scripts(soup)        # R10: <script>, javascript: href 제거
    _remove_event_attrs(soup)    # R10/R11: onclick, onload 등 제거

    if strict:
        _remove_link_tags(soup)      # R3/R5: <link rel=stylesheet> 제거
        _remove_meta_compat(soup)    # R8: X-UA-Compatible 제거
        _consolidate_styles(soup)    # R2/R4/R12/R13: <style> 단일화, @media 제거
        _patch_css_units(soup)       # R7: margin:10 → margin:10px
        _convert_align_attrs(soup)   # R6: align="center" → style="text-align:center"
        _patch_img_display_block(soup) # R9: <img>에 display:block 강제
```

`strict=False` 모드는 보안 규칙만 적용하고 나머지는 위반 카운트만 합니다. 크기 초과 등 풀 처리가 불가할 때 사용합니다.

---

## PR 리뷰에서 4개 버그가 나왔다

자신 있게 PR을 올렸는데, 동료 리뷰에서 버그가 4개 발견됐습니다. 🫠

### 🐛 Bug 1 (High): `<link href="x.css">` 미처리

**R3/R5 의도**: CSS 링크 `<link>` 태그를 제거해야 함

**기존 코드**:
```python
# rel=stylesheet 있는 것만 제거
if "stylesheet" in tag.get("rel", []):
    tag.decompose()
```

**문제**: `<link href="https://cdn.example.com/a.css">` — `rel` 없이 `.css` URL만 있는 경우 미처리

**수정**:
```python
def _is_css_link(tag: Tag) -> bool:
    rel_str = " ".join(str(v) for v in (tag.get("rel") or []))
    if "stylesheet" in rel_str.lower():
        return True
    return bool(_CSS_HREF_RE.search(str(tag.get("href", ""))))  # .css URL 패턴도 확인
```

### 🐛 Bug 2 (High): `display:inline` → `display:block` override 안 됨

**R9 의도**: `<img>` 태그에 display:block을 강제해야 함

**기존 코드**:
```python
if "display" not in existing.lower():
    tag["style"] = f"display:block;{existing}"
    # display가 이미 있으면 그냥 통과 → display:inline 그대로 남음
```

**수정**:
```python
m = _DISPLAY_PROP_RE.search(existing)
if m and m.group(1).lower() == "block":
    continue  # 이미 block이면 OK
# 그 외 모든 경우(inline, inline-block, 없음) → display:block으로 교체
without_display = _DISPLAY_PROP_RE.sub("", existing).strip(";").strip()
tag["style"] = f"display:block;{without_display}" if without_display else "display:block;"
```

### 🐛 Bug 3 (Medium): 크기 제한 초과 시 보안 규칙도 건너뜀

**기존 코드**:
```python
if len(html_bytes) > max_bytes:
    logger.warning("HTML too large, skipping sanitize")
    return result  # R10/R11도 적용 안 됨! <script> 그대로 전달
```

**수정**:
```python
if len(html_bytes) > max_bytes:
    # 크기가 커도 보안 규칙(R10/R11)은 반드시 적용
    sanitized = sanitize_html_for_knox_portal(result.html, strict=False)
    result.html = sanitized.html
```

### 🐛 Bug 4 (Medium): 프롬프트에서 Google Fonts `<link>` 허용

**기존 프롬프트**:
```
Load Google Fonts via <link> tags in <head>
```

**문제**: Knox Portal은 `<link>` 태그를 **rel=stylesheet 여부와 무관하게** 삭제합니다. 프롬프트에서 허용한 것을 Knox Portal이 삭제하는 모순.

**수정**:
```
Load Google Fonts via @import inside the single <style> block instead.
```

---

## E2E 검증 결과

### 📊 1차 테스트: Sanitizer가 실제로 동작함

```
[visualize] LLM HTML generation completed (34.0s, 10052 chars)
[esb_sanitizer] strict=true applied: {
  "removed_media_blocks": 2,
  "converted_align_attrs": 3,
  "patched_img_display_block": 4,
  ...
}
[visualize] result=llm html_length=8939
```

10052자 → 8939자 (1113자 감소). Sanitizer가 실제로 Knox Portal 비호환 요소를 제거했습니다.

### 📊 2차 테스트 (DEBUG 모드): 카운터가 전부 0인데 1310자가 줄었다

```
[visualize] LLM HTML generation completed (68.0s, 11725 chars)
[esb_sanitizer] strict=true applied: {
  "removed_link_tags": 0, "removed_media_blocks": 0,
  "converted_align_attrs": 0, "patched_img_display_block": 0,
  ... 모두 0
}
[visualize] result=llm html_length=10415
```

**카운터가 전부 0인데 1310자가 줄었습니다.** 처음엔 버그인 줄 알았는데, 알고 보니:

- **Sanitizer 카운터 = 0**: LLM이 프롬프트를 잘 따라서 처음부터 위반 요소 없음 ✅
- **1310자 감소**: BeautifulSoup이 `str(soup)`로 직렬화할 때 발생하는 **HTML 정규화** (들여쓰기 압축, attribute 따옴표 정규화 등)

Sanitizer가 제 역할을 했다는 증거였습니다. 위반이 없으면 0, 있으면 수정. 정상 동작입니다.

---

## 아직 남은 숙제

ESB sanitizer로 가이드 필수 항목은 모두 충족했지만, 한 가지 리스크가 남아있습니다.

Knox Portal은 우리가 보낸 `<style>` 내용을 **전역 CSS로 올립니다**. LLM이 생성한 HTML의 클래스명들:

```css
.container { max-width: 960px; }
.section { background: #fff; }
.badge { padding: 2px 8px; }
.hero { background: linear-gradient(...); }
```

이것들이 Knox Portal 공통 CSS의 `.container`, `.badge`와 충돌할 가능성이 있습니다. **Stage 환경(`v70.stage.samsung.net:8090`)에서 실제 렌더링 확인이 필수**입니다.

만약 깨진다면 선택지는 두 가지:
1. **LLM 프롬프트에 네임스페이스 접두사 지시** — `jiravis-hero`, `jiravis-badge` 등
2. **CSS inlining 레이어 추가** (premailer) — 클래스 기반 CSS를 모두 inline style로 변환

---

## 교훈

1. **Knox Portal은 HTML의 수동적 수신자가 아닙니다.** `<style>`을 전역으로 올리고, `<link>`를 삭제하고, XSS를 방지합니다. 보내기 전에 그 동작을 이해해야 합니다.

2. **LLM 프롬프트(예방) + 코드 sanitizer(강제) 2-layer가 맞습니다.** LLM이 규칙을 따르면 sanitizer가 할 일이 없고, 실수하면 sanitizer가 수습합니다. 어느 하나만으로는 불안합니다.

3. **`strict=False` 모드는 "관찰 모드"입니다.** 기존 파이프라인을 건드리지 않고 위반 현황만 먼저 파악할 때 유용합니다. 바로 `strict=True`로 적용하기 불안할 때 단계적으로 도입할 수 있습니다.

4. **PR 리뷰가 진짜 일을 합니다.** High 버그 2개(R3/R5 href-only, R9 display override)는 자동 테스트에서 잡히지 않고 동료 리뷰에서 발견됐습니다. 보안 우회 버그도 마찬가지입니다.

5. **카운터 전부 0 = 성공입니다.** 처음엔 "sanitizer가 아무것도 안 했나?"라고 의심했지만, 그건 LLM이 프롬프트를 잘 따랐다는 증거입니다. 숫자가 작을수록 좋은 지표입니다.

---

## 결론

Knox Portal 가이드 문서는 담담하게 "본문 처리 방식이 변경됐습니다"라고 적혀있지만, 실제로는 우리 HTML을 받아서 분해하고 재조립하고 있었습니다. `<style>`을 훔쳐가서 전역으로 올리고, `<link>`를 삭제하고, 스크립트를 차단합니다.

대응은 간단합니다: 포털이 건드리기 전에 우리가 먼저 정리해서 보내면 됩니다. R1~R13.

남은 숙제인 CSS 클래스명 충돌은 Stage 환경 테스트 결과를 보고 결정하겠습니다. 깨지면 그때 또 삽질 블로그를 쓰겠습니다. 🙂

---

*P.S. DEBUG 로그를 켰더니 LiteLLM이 `GLM-5-Non-Thinking` 모델이 비용 테이블에 없다고 매번 스택 트레이스를 20줄씩 출력했습니다. 테스트 끝나면 `LOG_LEVEL=info`로 꼭 되돌리세요.*
