---
name: supabase-postgres-best-practices
description: >
  Postgres performance optimization and best practices from Supabase.
  Shared reference skill for software-engineer, developer, and data-engineer agents.
  Use when writing, reviewing, or optimizing Postgres queries, schema designs,
  RLS policies, or database configurations.
license: MIT
metadata:
  author: supabase
  version: "1.1.0"
  organization: Supabase
  date: January 2026
  abstract: >
    Comprehensive Postgres performance optimization guide. Contains performance
    rules across 8 categories, prioritized by impact from critical (query
    performance, connection management) to incremental (advanced features).
    Each rule includes detailed explanations, incorrect vs. correct SQL examples,
    query plan analysis, and specific performance metrics.
---

# Supabase Postgres Best Practices

Comprehensive performance optimization guide for Postgres, maintained by Supabase. Contains rules across 8 categories, prioritized by impact to guide automated query optimization and schema design.

## Integration with Agent Team

This is a **shared reference skill** consumed by multiple agents:

| Agent | When to Reference |
|-------|-------------------|
| **Software Engineer** | Schema design, index strategy, RLS policy architecture |
| **Developer** | Writing migrations, query optimization, INSERT/UPSERT patterns |
| **Data Engineer** | Data modeling, partitioning, JSONB indexing, batch operations |
| **Tester** | Performance testing, EXPLAIN ANALYZE verification |

Agents should read the relevant `references/` files on-demand when working on database-related tasks. Do NOT load all 30 files at once — pick the category relevant to the current task.

## When to Apply

Reference these guidelines when:
- Writing SQL queries or designing schemas
- Implementing indexes or query optimization
- Reviewing database performance issues
- Configuring connection pooling or scaling
- Optimizing for Postgres-specific features
- Working with Row-Level Security (RLS)
- Writing or reviewing database migrations

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Key Files |
|----------|----------|--------|--------|-----------|
| 1 | Query Performance | CRITICAL | `query-` | `query-missing-indexes.md`, `query-composite-indexes.md` |
| 2 | Connection Management | CRITICAL | `conn-` | `conn-pooling.md`, `conn-limits.md` |
| 3 | Security & RLS | CRITICAL | `security-` | `security-rls-basics.md`, `security-rls-performance.md` |
| 4 | Schema Design | HIGH | `schema-` | `schema-primary-keys.md`, `schema-foreign-key-indexes.md` |
| 5 | Concurrency & Locking | MEDIUM-HIGH | `lock-` | `lock-short-transactions.md`, `lock-deadlock-prevention.md` |
| 6 | Data Access Patterns | MEDIUM | `data-` | `data-batch-inserts.md`, `data-n-plus-one.md` |
| 7 | Monitoring & Diagnostics | LOW-MEDIUM | `monitor-` | `monitor-explain-analyze.md`, `monitor-pg-stat-statements.md` |
| 8 | Advanced Features | LOW | `advanced-` | `advanced-jsonb-indexing.md`, `advanced-full-text-search.md` |

## How to Use

Read individual rule files from `references/` for detailed explanations and SQL examples:

```
references/query-missing-indexes.md
references/security-rls-basics.md
references/schema-partial-indexes.md
references/_sections.md              # Full index of all rules
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect SQL example with explanation
- Correct SQL example with explanation
- Optional EXPLAIN output or metrics
- Additional context and references
- Supabase-specific notes (when applicable)

## Quick Reference — Most Common Rules

### For New Projects (Schema Design Phase)
1. `schema-primary-keys.md` — Always use UUID or BIGINT PKs
2. `schema-foreign-key-indexes.md` — Index all FK columns
3. `schema-data-types.md` — Use appropriate types (TIMESTAMPTZ, TEXT vs VARCHAR)
4. `security-rls-basics.md` — Enable RLS on ALL tables from day one

### For Migrations & Queries
1. `query-missing-indexes.md` — Add indexes for WHERE/JOIN columns
2. `query-composite-indexes.md` — Multi-column index ordering matters
3. `data-batch-inserts.md` — Batch INSERTs for performance
4. `lock-short-transactions.md` — Keep transactions short

### For Performance Reviews
1. `monitor-explain-analyze.md` — Always EXPLAIN ANALYZE slow queries
2. `security-rls-performance.md` — RLS policy optimization patterns
3. `conn-pooling.md` — Use connection pooling (PgBouncer/Supavisor)
4. `query-partial-indexes.md` — Partial indexes for filtered queries

## References

- https://www.postgresql.org/docs/current/
- https://supabase.com/docs
- https://wiki.postgresql.org/wiki/Performance_Optimization
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/auth/row-level-security
