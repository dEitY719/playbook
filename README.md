# RCA Knowledge Base

Root Cause Analysis documentation for incidents, bug fixes, and technical challenges. Serves as a repository for postmortem reviews, technical blogging, AI tool training, and junior engineer onboarding.

## Purpose

This repository captures technical challenges and their solutions in a structured, multi-audience format:

- **Postmortem Review**: Incident investigation and prevention planning
- **Technical Blog**: Publication-ready learning content
- **AI Tool Training**: Pattern recognition and anti-pattern learning
- **Junior Engineer Onboarding**: Educational reference material

## Organization

```
docs/analysis/
├── YYYY-MM-DD-{slug}/
│   ├── README.md           # Main RCA document
│   ├── _metadata.json      # Searchable metadata
│   └── media/              # Diagrams, screenshots (optional)
├── YYYY-MM-DD-{another-slug}/
└── ...
```

## Quick Navigation

Browse by category:

- [Shell Scripting](#shell-scripting)
- [Docker & Containers](#docker--containers)
- [Database](#database)
- [Python & Backend](#python--backend)
- [DevOps & Infrastructure](#devops--infrastructure)

### Shell Scripting

- [2025-01-15: Bash mapfile Compatibility](./docs/analysis/2025-01-15-mapfile-compatibility)

### Docker & Containers

(No entries yet)

### Database

(No entries yet)

### Python & Backend

(No entries yet)

### DevOps & Infrastructure

(No entries yet)

## Usage

### Reading RCA Documents

1. Start with **Executive Summary** (10-second overview)
2. Read **Problem & Context** for situation understanding
3. Review **Root Cause Analysis** for technical depth
4. Check **Solution** for how to fix
5. Study **Deep Dive** for principles and learning
6. Use **Prevention Checklist** for future work
7. Reference **Quick Reference** for quick lookup

### Creating New RCA

Use Claude's `write-rca-doc` skill during conversation:

```bash
/write-rca-doc              # Auto-generates from conversation context
/write-rca-doc --commit     # Auto-commit to git
/write-rca-doc --blog       # Blog-first optimization
```

The skill will:
1. Analyze conversation
2. Extract problem and solution
3. Create structured document
4. Generate metadata
5. Update this index

## Metadata Index

Master index of all RCA documents: See `_index.json`

Query by:
- **Category**: shell-scripting, docker, database, python, devops
- **Severity**: low, medium, high, critical
- **Audience**: postmortem, blog, ai-learning, junior-engineers
- **Tags**: bash, mapfile, posix, etc.

## Contributing

When creating RCA documents:

1. Use `write-rca-doc` skill (auto-formatting)
2. Follow document structure:
   - Executive Summary
   - Problem & Context
   - Root Cause Analysis
   - Solution & Implementation
   - Deep Dive
   - Prevention Checklist
   - Related Issues
   - Quick Reference
3. Complete `_metadata.json` with all fields
4. Update `_index.json` (auto via skill)
5. Commit with message: `docs: Add RCA for {issue-slug}`

## Statistics

- Total Documents: 1
- Categories: 1
- Last Updated: 2025-01-15

---

**Maintained**: 2025-01-15 onwards
**Tools**: Claude AI, write-rca-doc skill
