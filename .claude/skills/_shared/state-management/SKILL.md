---
name: state-management
description: >
  Protocol for reading and updating .claude/state/resume.md and context.md.
  Defines when to update, templates for updates, and state file locations.
  Background reference for all agents.
user-invocable: false
---

# State Management Protocol

## State Files

```
.claude/state/
├── resume.md    # Always updated - primary resume point
└── context.md   # Standard/Full only - agent context transfer
```

## When to Update State

| Event | Update resume.md | Update context.md |
|-------|------------------|-------------------|
| Project starts | Yes | Tier: Standard/Full only |
| Phase completes | Yes | Yes |
| Agent handoff | Yes | Yes |
| Important decision | Yes | - |
| Session ends | Yes | - |
| Token limit approaching | Yes | Yes |

## resume.md Template

When updating `resume.md`, use this structure:

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
- [x] Completed phases
- [ ] Pending phases

## Key Decisions
- [Decision 1]
- [Decision 2]

## Blockers
- [Blocker if any, or "None"]

## Git State
| Field | Value |
|-------|-------|
| Current Branch | [branch name] |
| Main Status | [Clean/Dirty] |
| Uncommitted Changes | [None/Description] |

## Quick Resume Prompt
> [Specific prompt to continue exactly where left off]

## Activity Log
| Date | Agent | Action |
|------|-------|--------|
| [Date] | [Agent] | [Action taken] |
```

## context.md Template (Standard/Full Only)

When updating `context.md` for agent handoffs:

```markdown
# Agent Context Transfer

## Current Handoff
**From**: [Previous agent]
**To**: [Next agent]
**Timestamp**: [Now]

## Summary
[2-3 sentences of what was done]

## Key Artifacts
- [Artifact]: `path/to/file`

## Critical Context
- [Key decision or constraint the next agent must know]

## Next Steps
1. [Immediate next action]
2. [Following action]
```

## Compaction & Token Limit Protocol

Claude Code automatically compacts conversations when the context window fills. When this happens, prior conversation turns are summarised — but **files on disk are never lost**. This means `resume.md` and `context.md` are the only reliable memory that survives compaction.

### Rules for compaction resilience

1. **Write state to disk before doing substantial work** — not just after. If compaction hits mid-task, the last written state is what survives.
2. **Write state after every agent handoff** — both `resume.md` and `context.md` must reflect the handoff before the next agent begins.
3. **Write state after every significant output** — PRD created, sprint planned, migration written, etc.
4. **Never rely on conversation memory alone** — if something matters, it must be in a file.

### Detection signals for imminent compaction
- Conversation is very long (many tool calls, many turns)
- Multiple agents have run in the same session
- User says "context is getting long" or "save state"

### Response protocol
1. Immediately write current progress to `resume.md` (use the template above)
2. Update `context.md` with agent handoff context
3. Notify user:

```markdown
## State Saved — Safe to Compact

I've saved current state to disk. If the conversation is compacted or you start a new session, resume with:

> Continue from where we left off on TalentVerse.
> Read .claude/state/resume.md for current state.

**Current phase**: [phase]
**Last completed**: [action]
**Next step**: [specific next action]
```

### On session start / after compaction
Every agent MUST read `resume.md` at startup (already enforced via `!cat .claude/state/resume.md` in each SKILL.md). If resume.md contradicts conversation context, **resume.md is authoritative**.
