---
name: handover-protocol
description: >
  Standard protocol for agent-to-agent handovers. Defines file locations,
  templates, notification rules, and approval checkpoints. Background
  reference for all agents that produce or consume handovers.
user-invocable: false
---

# Agent Handover Protocol

## When Handovers Are Required

| Tier | Handover Requirement |
|------|---------------------|
| QUICK | None (direct agent-to-agent) |
| STANDARD | Update `context.md` only |
| FULL | Full handover files + context.md |

## Handover File Locations

```
.claude/handover/
├── researcher-to-pm.md
├── pm-to-scrum.md
├── pm-to-marketer.md         # PM -> Product Marketer (positioning inputs)
├── marketer-to-developer.md  # Product Marketer -> Developer (launch readiness)
├── scrum-to-designer.md
├── scrum-to-data.md
├── scrum-to-engineer.md
├── designer-to-developer.md
├── data-to-engineer.md
├── engineer-to-ai.md
├── engineer-to-developer.md
├── ai-to-developer.md
├── developer-to-review.md   # Developer -> /review gate
├── review-to-qa.md          # /review -> /qa
├── qa-to-ship.md            # /qa -> /ship
└── developer-status.md      # For pausing/resuming work
```

## Handover Process

Every agent completing its phase must:

1. **Save artifacts** to the appropriate `docs/` file
2. **Create handover file** at `.claude/handover/<from>-to-<to>.md`
3. **Update state files** (resume.md always, context.md for Standard/Full)
4. **Notify user**: "[Phase] complete. Ready for [Next Agent]? (y/n)"
5. **Wait for approval** before the next agent begins

## Handover Template

```markdown
# Handover: [From Agent] -> [To Agent]

## Summary
[1-2 sentence summary of what was completed]

## Key Artifacts
- [Document]: `docs/[FILENAME].md`
- [Other artifact]: `path/to/file`

## Critical Context for Next Agent
- [Decision 1 that affects next agent's work]
- [Constraint the next agent must respect]
- [Key assumption to carry forward]

## Priority Summary (if applicable)
| Priority | Count | Key Items |
|----------|-------|-----------|
| P0 | X | [List] |
| P1 | X | [List] |

## Open Items
- [ ] [Item requiring attention]
- [ ] [Question to resolve]

## Recommended Next Steps
1. [First action for receiving agent]
2. [Second action]
```

## Workflow Order

Standard agent flow (receiving agent reads handover from previous):

```
PRODUCT PHASE
Market Researcher -> PM -> Scrum Master -> [Designer + Data Eng] (parallel) -> AI Eng (if needed)
                      |
                      +-> Product Marketer (parallel with Scrum, or after PM) -> Developer (launch readiness)

ENGINEERING EXECUTION PHASE (gstack)
Developer -> /review gate -> /qa (browser testing) -> /ship (PR automation)
                |
           [Tester + /investigate] (as needed during build)
```

## Handover Quality Checklist

Before creating a handover, verify:
- [ ] All deliverable documents are saved and complete
- [ ] Key decisions are explicitly stated (not buried in documents)
- [ ] Constraints and blockers are called out
- [ ] Next agent has enough context to begin without re-reading everything
- [ ] State files are updated
