---
name: tier-awareness
description: >
  Background context providing the current project tier (QUICK/STANDARD/FULL)
  and tier-specific behavior rules. Auto-loaded for all agents to eliminate
  duplicated tier-checking logic.
user-invocable: false
---

# Tier Awareness Context

## Current Project State

!`cat .claude/state/resume.md 2>/dev/null | head -20 || echo "No active project. Tier not yet set."`

## Tier System Overview

This project uses a **tiered ceremony** system. Every agent must adapt its output to the active tier.

### Tier Comparison

| Aspect | QUICK | STANDARD | FULL |
|--------|-------|----------|------|
| **Discovery** | Skip | Optional | Required |
| **PRD** | Minimal (1 page) | Standard | Comprehensive |
| **RICE Scoring** | Skip | Simplified | Full analysis |
| **Stakeholder Map** | Skip | Skip | Required |
| **Competitive Analysis** | Skip | Skip | Required |
| **Sprint Planning** | Basic list | DoR/DoD | Full ceremony |
| **Architecture Docs** | Inline notes | Standard docs | Full specs |
| **Handovers** | None | context.md only | Full handovers |
| **State Tracking** | resume.md only | resume.md + context.md | All files |
| **Retros** | Skip | Optional | Required |
| **Token Usage** | Minimal | Moderate | High |
| **Best For** | Prototypes, solo dev | Most projects | Enterprise, teams |

### Tier Detection Keywords

| User Says | Suggested Tier |
|-----------|---------------|
| "just build it", "quick", "fast", "prototype", "skip ceremony" | QUICK |
| "normal project", "need documentation", "production app" | STANDARD |
| "enterprise", "compliance", "full audit trail", "document everything" | FULL |

### How to Check Tier

1. Read `.claude/state/resume.md` for the current tier
2. If not set, ask orchestrator or user
3. When in doubt: "Which tier are we using? (quick/standard/full)"

### Universal Rules (All Tiers)

- **Commits ALWAYS require user approval**, regardless of tier
- Match ceremony to tier — don't over-document QUICK, don't under-document FULL
- When in doubt, ask — better to confirm tier than waste effort

### Tier Instructions by Agent

| Agent | QUICK | STANDARD | FULL |
|-------|-------|----------|------|
| Market Researcher | Quick scan (top 3) | Full research with citations | Comprehensive + survey design |
| PM | Quick PRD only | Standard PRD + RICE | Full discovery + PRD |
| Scrum | Skip or basic list | Sprint Plan with DoR/DoD | Full ceremony |
| Designer | Skip or inline notes | Standard DRD | Full DRD |
| Data Engineer | Skip or inline notes | Standard architecture | Full architecture |
| Software Engineer | Skip or inline notes | Standard architecture | Full architecture |
| AI Engineer | Skip unless needed | Standard if needed | Full if needed |
| Developer | Implement directly | Implement with plan | Full implementation plan |
| Debugger | Always thorough | Always thorough | Always thorough |
| Tester | Basic tests | Standard test plan | Full test plan |

### Token Budget by Tier

| Tier | Typical Tokens | Sessions |
|------|----------------|----------|
| QUICK | 10-30k | 1 |
| STANDARD | 50-100k | 1-3 |
| FULL | 100-200k+ | 3+ |
