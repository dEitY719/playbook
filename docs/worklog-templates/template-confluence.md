# [Title of Technical Guide]

**작성자**: Your Name | **일정**: 2026-01-##
**카테고리**: [Testing/Infrastructure/Documentation] | **난이도**: ⭐⭐

## TL;DR (1분 요약)

- Key achievement or solution 1 with metric
- Key achievement or solution 2 with metric
- Applicability: Who can use this / what projects

## 문제 (Problem)

**현상**: Describe the problem or challenge
- Symptom 1
- Symptom 2

**영향**: Impact of the problem
- Business impact
- Developer/team impact

**빈도**: How often this occurs

---

## 원인 (Root Cause)

- Root cause 1: Explanation
- Root cause 2: Explanation
- Contributing factor: Explanation

*(Why the problem exists, not just what it is)*

---

## 해결 (Solution)

### 1단계: [First Step Title]

Brief description

```bash
# Example code or command
code snippet here
```

### 2단계: [Second Step Title]

Brief description

```python
# Example configuration
code snippet here
```

### 3단계: [Third Step Title]

Brief description

```bash
# Example usage
code snippet here
```

---

## 성과 (Results)

- ✅ Metric 1: Improvement (Before → After)
- ✅ Metric 2: Achievement
- ✅ Metric 3: Validation result

### 수치 기반 증명
- Performance: XX% improvement
- Reliability: YY% increase
- Scale: ZZ new capability

---

## 재현/검증 (Reproduction)

### Before (Before implementation)
```bash
command or process                      # Result: old_value
```

### After (After implementation)
```bash
command or process                      # Result: new_value
```

---

## 주의사항 (Caution)

⚠️ Important consideration 1
⚠️ Important consideration 2

*Gotchas, limitations, or edge cases to be aware of*

---

## 적용 가능 프로젝트

- ✅ Project type / condition 1
- ✅ Project type / condition 2
- ❌ Not applicable to: Condition or project type

---

## 참고 (References)

- **상세 가이드**: [Link to detailed documentation](...)
- **Git Commit**: abc1234
- **PR**: https://github.com/.../pull/###
- **외부 참고**: https://external-reference.com/doc

---

## 자주 묻는 질문 (FAQ)

**Q: When should I use this approach?**
A: When you have [specific condition/scenario]. Alternative: Use other-approach when [condition].

**Q: What are common pitfalls?**
A: [Pitfall 1], [Pitfall 2]. Avoid by [solution/prevention].

---

## 다음 단계 (Next Steps)

- Suggested enhancement 1
- Suggested enhancement 2
- Related topics to explore

---

**작성자 노트**: Internal notes or context (optional)

---

## 사용 방법

1. 이 템플릿을 복사하여 실제 가이드 작성
2. TL;DR은 3줄 이하, 각 줄 15단어 이내
3. 각 섹션(문제/원인/해결/성과)은 균등하게 배치
4. 코드 예제는 실제 테스트된 코드만 포함
5. Confluence 에디터에 복붙 (마크다운 모드)
6. 사내 용어/링크는 반드시 조정

### 섹션별 작성 팁

- **문제**: 비즈니스 임팩트 강조
- **원인**: 기술적 근거 제시
- **해결**: 단계별, 재현 가능하도록
- **성과**: 정량적 수치 포함
- **주의사항**: 실전 경험 기반

---

**생성 출처**: make-confluence 스킬 또는 수동 작성
**저장 위치**: rca-knowledge/docs/confluence-guides/{category}/{date}-{title}.md
**마지막 업데이트**: 2026-01-27
