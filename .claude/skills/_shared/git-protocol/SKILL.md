---
name: git-protocol
description: >
  Git branching, commit, merge, and push protocol with human-in-the-loop
  checkpoints. Applies to all agents that modify code. Defines branch
  naming, checkpoint templates, and the universal approval requirement.
user-invocable: false
---

# Git Protocol

## Core Rule

**CRITICAL: Never commit, merge, or push without explicit user approval.**

This rule applies to ALL tiers, ALL agents, ALL situations.

## Branch Strategy

All development uses **feature branches** to keep `main` clean and deployable.

```
main (always clean, deployable)
  |
  +-- feat/[feature-name]    <- Development happens here
        |-- commits...
        +-- merge to main    <- User approves
```

### Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feat/[name]` | `feat/user-auth` |
| Bug fix | `fix/[name]` | `fix/login-error` |
| Refactor | `refactor/[name]` | `refactor/api-cleanup` |
| Docs | `docs/[name]` | `docs/readme-update` |

### When to Create Branches

| Tier | Branching Approach |
|------|-------------------|
| QUICK | Optional (can commit to main for speed) |
| STANDARD | Required — feature branch per story/feature |
| FULL | Required — feature branch + detailed merge review |

## 4 Checkpoints (All Require User Approval)

### Checkpoint 1: Branch Creation

```markdown
## Creating Feature Branch

**Branch**: `feat/[feature-name]`
**Purpose**: [Brief description]

This keeps `main` clean while we work.

**Create branch and continue? (y/n)**
```

### Checkpoint 2: Each Commit (on feature branch)

```markdown
## Ready to Commit

**Current branch**: `feat/[feature-name]`

**Files changed:**
- path/to/file1.ext (added)
- path/to/file2.ext (modified)

**Commit message:**
type(scope): brief description

- Detail 1
- Detail 2

**Approve commit? (y/n)**
```

### Checkpoint 3: Merge to Main

```markdown
## Ready to Merge to Main

**Feature branch**: `feat/[feature-name]`
**Target**: `main`

**All commits in this branch**:
1. [commit message 1]
2. [commit message 2]

**Pre-merge checklist**:
- [ ] All tests passing
- [ ] No linting errors
- [ ] Code self-reviewed
- [ ] Documentation updated

**Approve merge to main? (y/n)**
```

### Checkpoint 4: Push to Remote

```markdown
## Ready to Push

**Branch**: `main`
**Remote**: `origin`
**Commits to push**: X

**Push to GitHub? (y/n)**
```

## Commit Message Format

```
type(scope): brief description

- Detail 1
- Detail 2

Closes #issue (if applicable)
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Branch State in resume.md

Always track git state in `resume.md`:

```markdown
## Git State
| Field | Value |
|-------|-------|
| Current Branch | feat/[name] |
| Main Status | Clean |
| Uncommitted Changes | None |
| Ready to Merge | No |
```
