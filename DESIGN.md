# Design System — Erupt by Slipstream

> **STATUS: STUB — pending /design-consultation.**
> Run `/design-consultation` with the UI Design Specifications section from
> `Slipstream Products and Planning/` as input to generate this document.
> Erupt's design system is Obsidian-native and DISTINCT from Bleeper's (`bleeper/DESIGN.md`).
> Do NOT apply Bleeper design tokens here.

---

## Product Context

- **What this is:** An Obsidian plugin that extracts structured notes from conversations (ChatGPT, Claude, Gemini) using Claude AI.
- **Who it's for:** Knowledge workers, researchers, writers, Obsidian power users.
- **Platform:** Obsidian desktop (Windows, macOS, Linux). `isDesktopOnly: true`. No mobile support.
- **Project type:** PLUGIN UI (settings panel, status bar, modals) constrained by Obsidian's plugin API and theming system.
- **Brand relationship:** Erupt is a Slipstream product. External-facing design treats Erupt as standalone. The Slipstream connection is internal context.

---

## Pending Design Decisions

The following decisions are documented in the CEO plan and must be formalized in this document via `/design-consultation`:

- **Color tokens:** Ember orange (#E85D26 or variant), mapped to Obsidian CSS variables. 4 core CSS variables.
- **Settings panel IA:** Two states — BYOK (Free plan) vs Cloud (paid plan). Exact field layout, labels, and help text.
- **Status bar state machine:** Copy for each state (idle, processing "Erupt: turn X/Y...", complete, error).
- **Completion notice copy:** Full text for the notice that appears when extraction completes.
- **Upgrade modal layout:** Trigger conditions, copy, CTA design.
- **Session picker UX:** Modal triggered when "Update Notes" fires on an unlinked note. Keyboard navigation required (↑/↓, Enter, Escape).
- **Accessibility requirements:** aria-live for status bar, keyboard navigation for all modals, WCAG AA.

---

## Provisional Tokens

These are provisional until `/design-consultation` confirms them:

```css
/* Provisional — to be confirmed by /design-consultation */
:root {
  --erupt-accent: #E85D26;        /* Ember orange — brand accent */
  --erupt-accent-hover: #CC4D1E;  /* 15% darker hover state */
  --erupt-accent-light: #FEF0EA;  /* Accent tint */
  --erupt-success: #16A34A;       /* Completion state */
}
```

*Replace this entire file with the output of `/design-consultation` once run.*
