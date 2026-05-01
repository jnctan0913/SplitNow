---
name: ui-ux-quality-gates
description: >
  Shared UI/UX quality standards: product-type design matrix, 10-tier priority
  system, anti-patterns, pre-delivery checklist, and chart decision matrix.
  Background reference for designer, developer, and frontend-design.
user-invocable: false
---

# UI/UX Quality Gates

Shared reference for `/designer`, `/developer`, and `/frontend-design`. These standards apply to all UI work regardless of which agent is building it.

---

## Product-Type Design Matrix

State the chosen row at the start of every design or build task.

| Product Type | Primary Style | Secondary Style | Key Focus |
|---|---|---|---|
| SaaS (General) | Glassmorphism | Flat Design | Clarity, dashboard density |
| SaaS (Enterprise) | Dark Mode (OLED) | Data-Dense | Information hierarchy |
| E-commerce (Standard) | Flat Design | Minimalist | Trust, conversion |
| E-commerce (Luxury) | Liquid Glass | Glassmorphism | Emotion, premium feel |
| Healthcare / Wellness | Neumorphism | Accessible & Ethical | Safety, calm, WCAG AA |
| Financial / Dashboard | Dark Mode (OLED) | Data-Dense | Precision, readability |
| Social / Consumer App | Claymorphism | Playful | Engagement, delight |
| Developer Tool | Brutalism | Dark Mode | Speed, information density |
| Creative / Portfolio | Maximalist | Editorial | Memorability, uniqueness |
| Marketplace | Flat Design | Card-based | Scannability, trust signals |
| AI Product | Glassmorphism | Futuristic | Modernity, transparency |
| Education / Learning | Soft/Pastel | Neumorphism | Focus, low cognitive load |

---

## 10-Tier Priority System

Apply in order. Higher tiers block lower tiers.

| Priority | Area | Non-negotiables |
|---|---|---|
| 1 — Accessibility | WCAG AA | Contrast ≥4.5:1, keyboard nav, visible focus 2–4px, ARIA labels |
| 2 — Touch & Interaction | Targets | ≥44×44pt targets, ≥8px spacing, feedback within 150ms |
| 3 — Performance | Assets | WebP/AVIF, lazy load, input <100ms, zero layout shift |
| 4 — Style Consistency | Design language | Locked to matrix style, SVG icons only, tokens throughout |
| 5 — Layout & Responsive | Structure | Mobile-first, no h-scroll, 4/8pt grid |
| 6 — Typography & Color | Readability | ≥16px base, 1.5 line-height, semantic tokens, dark+light contrast |
| 7 — Animation & Motion | Micro-interactions | 150–300ms, ease-in-out, respect `prefers-reduced-motion` |
| 8 — Forms & Feedback | Input patterns | Visible labels, errors near fields, success states |
| 9 — Navigation | Wayfinding | Predictable back, bottom nav ≤5 items, active state always visible |
| 10 — Data Viz | Charts | Legends, tooltips, accessible colour pairs, correct chart type |

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|---|---|
| Emoji as icons | SVG library: Heroicons, Lucide, or Phosphor |
| Inconsistent icon sizing | Tokens: `icon-sm` 16px / `icon-md` 20px / `icon-lg` 24px |
| No touch feedback | Ripple/opacity/elevation within 80–150ms |
| Random spacing | 4pt/8pt increment rhythm only |
| Layout-shifting transitions | `transform` and `opacity` only |
| Placeholder-only labels | Visible label above or beside every field |
| Colour-only error states | Icon + text + colour — never colour alone |
| Hardcoded colour values | CSS variables / design tokens always |
| Generic fonts (Inter, Roboto, Arial) | Distinctive font pairing matched to product type |
| Purple gradient on white | Product-specific palette from the design matrix |

---

## Pre-Delivery Checklist (7 items — all must pass)

- [ ] All tappable elements have visible pressed/active feedback
- [ ] Contrast ≥4.5:1 in both light and dark mode
- [ ] Touch targets ≥44×44pt on all interactive elements
- [ ] Safe areas respected (notches, gesture bars, bottom nav)
- [ ] `prefers-reduced-motion` and dynamic text size accounted for
- [ ] Screen reader focus order matches visual reading order
- [ ] Zero emoji used as structural icons — SVG library specified

---

## Chart Type Decision Matrix

| Data Shape | Conditions | Chart Type |
|---|---|---|
| Trend over time | ≥4 points, ≤6 series | Line chart |
| Category comparison | ≤10 categories | Bar / column chart |
| Part-to-whole | ≤5 categories, no zeros | Donut / pie chart |
| Correlation | ≥20 points, 2 variables | Scatter plot |
| Distribution | Continuous, ≥30 points | Histogram |
| Geographic | Location-bound values | Choropleth map |
| Funnel / conversion | Monotonically decreasing | Funnel chart |
| Ranking over time | Multiple entities | Bump chart |
| Heat / density | 2 categorical dimensions | Heatmap |
| Hierarchical part-of-whole | Nested categories | Treemap |

Every chart: legend + tooltip on hover + accessible colour pairs (never red/green alone).

---

## Design System File Structure

For Standard and Full tier projects:

```
design-system/
├── MASTER.md          ← global tokens (colour, type, spacing, motion, icons)
└── pages/
    ├── landing.md     ← page-level overrides
    ├── dashboard.md
    └── [screen].md
```

`MASTER.md` is the single source of truth. Developer reads it first before touching any UI file.

---

## How to Pass These Standards to /frontend-design

`/frontend-design` is a marketplace plugin and cannot be modified. To enforce these quality gates when using it, prepend your prompt with:

```
Before building, read .claude/skills/_shared/ui-ux-quality-gates/SKILL.md.
Product type: [e.g. SaaS General]
Design direction: [e.g. Glassmorphism + Flat]
Apply the 10-tier priority system and pass all 7 pre-delivery checklist items before finishing.
```

Or paste the checklist directly into your `/frontend-design` prompt as a requirement block.
