# State File Templates

## resume.md Full Template

```markdown
# Project Resume

## Project Info
| Field | Value |
|-------|-------|
| **Project** | [Project name] |
| **Tier** | [QUICK/STANDARD/FULL] |
| **Started** | [Date] |
| **Last Updated** | [Date] |

## Current State
| Field | Value |
|-------|-------|
| **Phase** | [Current phase] |
| **Active Agent** | [Agent name] |
| **Last Action** | [What was just done] |
| **Status** | [In progress / Blocked / Complete] |

## Progress
- [x] Tier Selected
- [x] Market Research (if applicable)
- [ ] PRD
- [ ] Sprint Plan
- [ ] Architecture
- [ ] Implementation
- [ ] Testing
- [ ] Feedback / Retro

## Key Decisions
- [Decision 1 with rationale]
- [Decision 2 with rationale]

## Blockers
- [Blocker description, or "None"]

## Git State
| Field | Value |
|-------|-------|
| Current Branch | [branch name] |
| Main Status | [Clean/Dirty] |
| Uncommitted Changes | [None/Description] |
| Ready to Merge | [Yes/No] |

## Quick Resume Prompt
> [Specific prompt to continue exactly where left off, e.g. "Continue MilesMax project. We're in FULL tier, PRD is complete, ready for Scrum Master to create sprint plan from docs/PRD.md"]

## Activity Log
| Date | Agent | Action |
|------|-------|--------|
| [Date] | [Agent] | [Action taken] |
```

## context.md Full Template

```markdown
# Agent Context Transfer

## Current Handoff
**From**: [Previous agent name]
**To**: [Next agent name]
**Timestamp**: [Date/time]

## Summary
[2-3 sentences of what was completed and key outcomes]

## Key Artifacts
- PRD: `docs/PRD.md`
- Market Research: `docs/MARKET_RESEARCH.md`
- [Other]: `path/to/file`

## Critical Context
- [Key decision that affects next agent's work]
- [Constraint the next agent must respect]
- [Assumption to carry forward]

## Next Steps
1. [Immediate next action for receiving agent]
2. [Following action]
3. [Any time-sensitive items]

## Open Questions
- [Question 1 that needs resolution]
- [Question 2]
```

## Token Limit State Save Template

When approaching token limits, use this condensed format:

```markdown
## EMERGENCY STATE SAVE

**Project**: [Name]
**Tier**: [Tier]
**Phase**: [Phase]
**Agent**: [Current agent]
**Branch**: [Git branch]
**Uncommitted**: [Yes/No - what]

**Last completed**: [Action]
**Next step**: [Exact next action]

**Resume prompt**: "[Copy-paste prompt for next session]"
```
