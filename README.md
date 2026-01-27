# RCA Knowledge Repository

Root Cause Analysis documentation for technical incidents, bug fixes, and problem-solving insights.

## Purpose

This repository serves four distinct audiences:
- **Postmortem Reviews**: Incident analysis and prevention planning
- **Technical Blogs**: Narrative-driven learning content
- **AI Tool Training**: Pattern recognition and anti-pattern learning
- **Junior Engineer Onboarding**: Educational reference material

## Structure

```
docs/analysis/
├── YYYY-MM-DD-{slug}.md           # RCA documents with YAML frontmatter
├── ...
_assets/                            # Centralized images/diagrams
├── {slug}-diagram.png
├── {slug}-diagram.svg
_index.json                         # Searchable index
README.md                           # This file
```

## Documents

### 2025-01-19: Shell Function Propagation Issues in Zsh

**File**: `docs/analysis/2025-01-19-shell-function-propagation-issues.md`

**Summary**: Two critical bugs in dotfiles shell initialization:
1. Subshell isolation broke function definition propagation (`src()` function missing)
2. Alias/function name conflicts caused zsh parse errors on reload

**Severity**: High
**Reading Time**: 15 minutes
**Keywords**: zsh, bash, subshell, function-propagation, alias-conflict, dotfiles

**Key Insights**:
- Command substitution `$(...)` creates subshells where side effects (function definitions) don't propagate
- Exit codes must be captured immediately: `cmd; exit=$?` not `exit=$(cmd)`
- Identical alias/function names cause parse errors on reload but not on virgin load
- Solution: Direct parent shell sourcing + `unalias` loop for safe reloads

---

## Quick Navigation

### By Severity
- **High**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)

### By Category
- **shell-initialization**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)

### By Project
- **dotfiles**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)

### By Target Audience
- **postmortem**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)
- **blog**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)
- **ai-learning**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)
- **junior-engineers**: [Shell Function Propagation Issues (2025-01-19)](#2025-01-19-shell-function-propagation-issues)

---

## Format

All documents use **hybrid Jekyll-compatible format**:
- YAML frontmatter for metadata
- Single `.md` files (no separate directories)
- Relative paths for portability
- GitHub Pages compatible

### Using Documents

**For Personal Blog**:
Copy `.md` files to your blog engine (Medium, Dev.to, Ghost, etc.)

**For Jekyll/GitHub Pages**:
Files work directly - no conversion needed

**For Notion/Obsidian**:
Import `.md` files; frontmatter preserved as properties

---

## Contributing

When adding new RCA documents:

1. Create document with naming: `YYYY-MM-DD-{slug}.md`
2. Include complete YAML frontmatter
3. Follow 9-section structure
4. Place diagrams in `_assets/` folder
5. Update `_index.json`

---

## Repository Statistics

- **Total Documents**: 1
- **Total Word Count**: ~2,100
- **Average Reading Time**: 15 minutes
- **Projects Covered**: 1 (dotfiles)
- **Severity Distribution**:
  - High: 1
  - Medium: 0
  - Low: 0

---

## License

Technical documentation for internal use and learning purposes.

**Generated**: 2025-01-19
**Last Updated**: 2025-01-19
