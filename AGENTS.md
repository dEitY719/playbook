# AGENTS.md — RCA Knowledge Repository

## Project Context

**Purpose**: Centralized Root Cause Analysis knowledge base for incident postmortems, technical blogs, AI training patterns, and junior engineer onboarding.

**Tech Stack**:
- Markdown + YAML frontmatter (Jekyll-compatible)
- JSON index (_index.json for searchability)
- GitHub Pages compatible
- No build dependencies

**Repository Structure**:
```
docs/analysis/              # RCA documents: YYYY-MM-DD-{slug}.md
docs/jira-records/          # Weekly JIRA work logs
docs/confluence-guides/     # Confluence-synced guides
docs/worklog-templates/     # Template generators
_assets/                    # Centralized images/diagrams
_index.json                 # Searchable document index
README.md                   # Main navigation
```

---

## Operational Commands

### Document Management
- **Create new RCA**: Copy template, rename to `YYYY-MM-DD-{slug}.md`, add frontmatter
- **Update index**: `python3 scripts/update_index.py` (when available)
- **Check frontmatter**: `grep -E "^(title|date|project|tags):" docs/analysis/*.md`

### Validation & Linting
- **Validate Markdown**: `tox -e mdlint` (when tox configured)
- **Check link integrity**: `find . -name "*.md" -exec grep -l "^\[" {} \;`
- **Line count check**: `wc -l docs/analysis/*.md`

### Publishing Workflow
- **GitHub Pages**: Files automatically rendered (Jekyll picks up frontmatter)
- **Obsidian/Notion import**: Drag `.md` files; frontmatter preserved
- **Blog export**: Copy `.md` to Medium/Dev.to; remove frontmatter if needed

---

## Golden Rules

### Immutable Constraints
- **500-line limit per document**: Break into multiple docs or create index if exceeded
- **No secrets/tokens**: All docs are public-ready
- **Naming convention**: `YYYY-MM-DD-{slug}.md` for all RCA documents
- **Frontmatter required**: Every document must include complete YAML header
- **Asset storage**: All images/diagrams in `_assets/` folder with relative paths
- **No emojis**: Preserve token efficiency and cross-platform rendering

### Do's
- DO write incidents while fresh (within 2 days of root cause identification)
- DO include YAML frontmatter: title, date, project, category, severity, tags, solution_type
- DO link to related documents using relative paths: `[link](./docs/analysis/YYYY-MM-DD-slug.md)`
- DO include both problem description and solution implementation
- DO use clear section headers for navigation
- DO tag with multiple keywords for discoverability
- DO include reading time estimate in frontmatter

### Don'ts
- DON'T modify `_index.json` manually; regenerate programmatically
- DON'T commit without updating README.md table if severity=high or new project
- DON'T mix multiple RCAs in one file; each incident = one document
- DON'T use relative paths like `../` ; always use absolute paths from repo root
- DON'T include code snippets >20 lines without explanation; link to source instead

---

## SOLID & Design Principles

### Single Responsibility Principle (SRP)
- Each RCA document covers ONE incident/problem
- Each template file has ONE audience (worklog, jira, confluence)
- Each section in _index.json represents ONE metadata axis

### Open/Closed Principle (OCP)
- Extend by adding new YYYY-MM-DD-{slug}.md documents
- Add new frontmatter fields WITHOUT modifying existing docs
- Create new templates without changing core structure

### Liskov Substitution Principle (LSP)
- All RCA documents follow same frontmatter schema
- Any document can replace another; frontmatter structure is consistent

### Interface Segregation Principle (ISP)
- Templates expose only required fields (worklog has different frontmatter than RCA)
- Index only includes fields needed for search/navigation

### Dependency Inversion Principle (DIP)
- Content depends on structure (frontmatter schema), not vice versa
- Scripts depend on abstract index format, not specific file names

---

## TDD Protocol

### Test-First Workflow (for automation/scripts)
1. Write failing test demonstrating requirement (e.g., "frontmatter parser validates date format")
2. Implement minimal script logic to pass test
3. Refactor while keeping tests green
4. Commit only when tests pass

### Validation Gates for Documents
- [ ] Frontmatter parses as valid YAML
- [ ] date field matches YYYY-MM-DD format
- [ ] file name matches `YYYY-MM-DD-{slug}.md`
- [ ] All relative links exist and resolve
- [ ] No circular references between documents
- [ ] Reading time estimate accurate (140 words/minute)
- [ ] At least one tag present
- [ ] severity in {high, medium, low}

### Test Commands
```bash
# When pytest available:
pytest tests/frontmatter/ -v
pytest tests/links/ -v

# Placeholder: add tests when framework ready
```

---

## Naming Conventions

### Markdown Files
- **Format**: `YYYY-MM-DD-{slug}.md`
- **Slug**: Lowercase, dash-separated, no special chars
- **Examples**:
  - `2025-01-19-shell-function-propagation-issues.md`
  - `2025-02-15-database-transaction-deadlock.md`

### Asset Files
- **Format**: `{slug}-{type}.{ext}`
- **Types**: diagram, chart, screenshot, graph
- **Examples**:
  - `shell-function-propagation-issues-diagram.svg`
  - `database-deadlock-timeline.png`

### Directory Names
- Lowercase, dash-separated
- **docs/analysis/**: Core RCA documents
- **docs/jira-records/**: Weekly work logs
- **docs/confluence-guides/**: Sync-ready content
- **_assets/**: Media files (leading underscore = system)

---

## Standards & References

### Frontmatter Schema

Every RCA document requires this YAML header:

```yaml
---
title: "Incident Title: What + Why"
date: "YYYY-MM-DD"
project: "project-name"
category: "category-name"
severity: "high|medium|low"
tags:
  - tag1
  - tag2
  - tag3
summary: "1-2 sentence summary of problem and solution"
solution_type: "code-refactor|config-change|documentation|monitoring|architecture"
difficulty_level: "beginner|intermediate|advanced"
reading_time_minutes: 10
audience:
  - postmortem
  - blog
  - ai-learning
  - junior-engineers
---
```

### Document Sections (9-Section Template)

1. **Executive Summary** — Problem + impact + solution (2-3 min read)
2. **Timeline** — When issues occurred, discovered, resolved
3. **Root Cause** — Why it happened, not just what
4. **Incident Impact** — Users affected, severity, blast radius
5. **Detection & Diagnosis** — How we found it, tools used
6. **Solution Implemented** — Code changes, configuration, architecture
7. **Testing & Validation** — How we verified the fix
8. **Prevention** — Monitoring, alerts, guardrails added
9. **Lessons & Follow-Up** — Patterns learned, next steps

### Git Strategy
- **Commit format**: `Type: Summary` (e.g., `docs: Add shell-function-propagation RCA`)
- **Types**: docs, feat, fix, refactor, chore
- **Frequency**: One commit per document + one per index update

### Maintenance Policy
- Update README.md when: new project added, severity=high, reading time >20 min
- Regenerate _index.json: weekly or on each new document
- Review frontmatter: quarterly for consistency

---

## Context Map

Use this to navigate repository domains and automation:

- **[Document Creation & Templates](./docs/worklog-templates/)** — Template generators for worklog, JIRA, Confluence
- **[RCA Documents](./docs/analysis/)** — Core incident analysis, organized by date
- **[Asset Management](./docs/_assets/)** — Diagrams, screenshots, supporting media
- **[JIRA Integration](./docs/jira-records/)** — Weekly work log records
- **[Confluence Guides](./docs/confluence-guides/)** — Documentation synced from Confluence
- **[Searchable Index](./docs/_index.json)** — Machine-readable catalog for automation
- **[Main Navigation](./docs/README.md)** — Central hub and quick links

---

## Automation Roadmap

### Phase 1: Index Generation
- [ ] Python script: parse frontmatter from all .md files
- [ ] Generate _index.json with full metadata
- [ ] Validation: check for missing/invalid frontmatter
- [ ] Git hook: auto-generate index on commit

### Phase 2: JIRA/Confluence Sync
- [ ] Read JIRA API for weekly work logs
- [ ] Generate `docs/jira-records/YYYY-WXX-report.md`
- [ ] Sync RCA links to Confluence database
- [ ] Bidirectional: update _index.json from external sources

### Phase 3: Search & Discovery
- [ ] Build static search index (JSON-based)
- [ ] Frontend: searchable UI for browsing by tag/project/severity
- [ ] API: expose index for external tools

### Phase 4: Analytics
- [ ] Track document views, search queries
- [ ] Identify trending topics (shell issues, database bugs, etc.)
- [ ] Generate quarterly trend reports

---

## Quality Gates

Before committing new RCA documents:

1. **Frontmatter Validation**
   - [ ] Title is descriptive (40-80 chars)
   - [ ] Date matches document name
   - [ ] Project field lowercase, no spaces
   - [ ] Severity assigned (high/medium/low)

2. **Content Validation**
   - [ ] All 9 sections present
   - [ ] No placeholder text ("TODO", "To be filled")
   - [ ] Reading time estimate accurate
   - [ ] Line count < 500 (if exceeded, split into 2 docs)

3. **Link Validation**
   - [ ] All relative links resolve
   - [ ] No broken asset paths
   - [ ] Cross-references point to valid documents

4. **Style Validation**
   - [ ] Markdown lint passes (`tox -e mdlint`)
   - [ ] No emojis
   - [ ] Consistent heading hierarchy (H1 only once)

---

**Generated**: 2025-02-02
**Last Updated**: 2025-02-02
**Version**: 1.0
