# TODOS — Erupt

Added by /plan-design-review on 2026-04-22. These gate v1 development.
Canonical location: erupt/TODOS.md (extracted from workspace TODOS.md 2026-04-22).

Items marked **[BLOCKER — ERUPT]** must be resolved before development starts.
Items marked **[PRE-LAUNCH — ERUPT]** must be resolved before Obsidian Community Plugins submission.

---

## [BLOCKER — ERUPT] Build Slipstream API Proxy Backend for Cloud Plan

**What:** Before any Cloud plan user can extract without an API key, a Slipstream proxy service must exist at `api.slipstream.app/proxy/claude`. The plugin detects plan tier from stored JWT and routes accordingly: Cloud → proxy, Free/Local → direct Anthropic API.

**Why:** Design review (2026-04-22) resolved the API model: Cloud plan = Slipstream proxies (no user API key). This is the correct long-term UX. Without the proxy, Cloud plan must be BYOK too, which undermines the value proposition of paying $15/mo.

**How to apply:** Build a Slipstream backend service (Node.js/Fastify or similar) that:
1. Accepts `POST /proxy/claude` with JWT bearer token + request body (same shape as Anthropic's `/v1/messages`)
2. Validates JWT against Slipstream account system
3. Forwards to Anthropic with Slipstream's own API key
4. Streams/returns response

**Pros:** Cloud plan has the right UX (no API key friction). Slipstream controls model selection for cloud users.

**Cons:** Backend infrastructure required before v1 ships. Adds weeks of work. Slipstream's Anthropic API costs are now variable with usage — must track per-account usage for billing.

**Context:** Free and Local plan tiers can ship without this proxy. Only Cloud plan requires it. Strategy option: ship Free + Local in v1 without proxy, add Cloud plan in v1.5 when proxy is ready.

**Depends on:** Slipstream account system (see next TODO).

**Effort:** L (human: 2-3 weeks / CC: ~4-6 hours for proxy logic, plus infrastructure setup).

---

## [BLOCKER — ERUPT] Slipstream Account Auth System for Cloud Plan

**What:** Cloud plan users authenticate with a Slipstream account. The plugin opens a browser auth flow (`auth.slipstream.app`), user signs in, JWT returned and stored via `Plugin.saveData()`.

**Why:** The proxy backend needs to validate that a user has a paid Cloud plan before forwarding their requests. This requires a Slipstream account with plan tier attached.

**How to apply:** Implement OAuth or email/password auth at `auth.slipstream.app`. After successful auth, redirect to an Obsidian deep-link (`obsidian://erupt/auth?token=<jwt>`) or poll a short-lived code. Plugin receives JWT, validates expiry, stores securely.

**Pros:** Clean UX for cloud users. Enables per-account usage tracking for billing fairness.

**Cons:** Significant infrastructure work (auth service, JWT issuance, account DB). Can reuse Bleeper's auth system if one exists.

**Context:** If Bleeper already has Slipstream account infrastructure (LemonSqueezy account creation flow), this may be partially built.

**Depends on:** LemonSqueezy integration (for plan tier detection from payment).

**Effort:** L (human: 1-2 weeks / CC: ~2-3 hours for token exchange + plugin integration, plus backend auth service).

---

## [PRE-LAUNCH — ERUPT] Create Erupt DESIGN.md

> **Partial:** DESIGN.md stub created 2026-04-22. Run `/design-consultation` to complete.

**What:** Create `erupt/DESIGN.md` documenting Erupt's design system — distinct from Bleeper's. Use the UI Design Specifications section of the CEO plan as the source, expand into a standalone design reference.

**Why:** Bleeper's DESIGN.md doesn't apply to an Obsidian plugin. Erupt has different constraints (plugin API, Obsidian theming, dark/light themes, no custom fonts). Without a dedicated design doc, implementation will diverge from the design decisions made in the design review.

**What to include:** Erupt brand tokens (ember orange, 4 CSS variables), settings panel IA and two states (BYOK / Cloud), status bar state machine copy, completion notice copy, upgrade modal layout, session picker UX, a11y requirements, mobile exclusion.

**Effort:** XS (CC: ~15 min — translate from CEO plan UI Design Specifications section).

**Depends on:** Nothing.

---

## [P1 — ERUPT] Session Picker Modal — Keyboard Navigation

**What:** The session picker modal (triggered when "Update Notes" fires on an unlinked note) must support keyboard navigation: ↑/↓ arrows to move between sessions, Enter to confirm, Escape to cancel.

**Why:** Obsidian users are keyboard-first. A modal list without keyboard nav is inaccessible and feels unfinished.

**How to apply:** `role="listbox"`, each row `role="option"` with `aria-selected`. Add `keydown` listener to the modal container. Track selected index in state, update `aria-selected` on ↑/↓. Enter fires "Link & Update". Escape calls `this.close()`.

**Effort:** XS (CC: ~10 min).

---

## [P1 — ERUPT] Status Bar aria-live Region

**What:** The status bar text during extraction (e.g., "Erupt: turn 12/47...") must be announced by screen readers. Obsidian's `addStatusBarItem()` doesn't add `aria-live` automatically.

**How to apply:** After `const statusBarItem = this.addStatusBarItem()`, call `statusBarItem.setAttribute('aria-live', 'polite')`. That's it.

**Effort:** XS (CC: ~2 min).

---

## [P2 — ERUPT] Confirm `mobile: false` in manifest.json

**What:** Erupt's `manifest.json` must have `"isDesktopOnly": true` to prevent installation on Obsidian mobile. Obsidian will show the standard "desktop only" notice automatically.

**How to apply:** Add `"isDesktopOnly": true` to `manifest.json`. One line.

**Effort:** XS (CC: ~1 min).
