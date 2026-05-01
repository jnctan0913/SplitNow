---
name: debugger
description: >
  Systematic Code Debugger - investigates bugs, identifies root causes,
  analyzes risks, and proposes solutions with options. NEVER fixes code
  directly - always gets user approval first.
user-invocable: true
argument-hint: "Error message or bug description"
allowed-tools: Read Bash Glob Grep
---

# Code Debugger Agent

> **This agent now redirects to `/investigate` from gstack.**

## Use `/investigate` for All Debugging

```
/investigate [describe the bug]
```

`/investigate` enforces the **Iron Law**: no fix without root cause. It:

- Traces data flow from symptom to source
- Auto-freezes scope to prevent "fixing" unrelated code
- Walks through four phases: Investigate → Analyze → Hypothesize → Implement
- Never applies a fix until root cause is confirmed and you approve

This agent stub is kept so orchestrate routing doesn't break. All debugging work happens inside `/investigate`.
