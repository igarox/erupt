# TODOS — Erupt

Added by /plan-design-review on 2026-04-22. These gate v1 development.
Canonical location: erupt/TODOS.md (extracted from workspace TODOS.md 2026-04-22).

Items marked **[BLOCKER — ERUPT]** must be resolved before development starts.
Items marked **[PRE-LAUNCH — ERUPT]** must be resolved before Obsidian Community Plugins submission.

---

## [SPRINT — 2026-05-19] Quality Sprint + Vault Generation (gates Magazine work)

This fortnight is Erupt's last quality+model push before closed beta. The closed beta landing — handing copies to non-founder users — is the gate that triggers Magazine code work (see workspace `TODOS.md` "Magazine — Gate"). Order matters: business-model decision → quality runs → quality gate → vault generation → beta cohort.

**Sprint workstreams (this fortnight) — updated post-Run 9:**

1. **Prompt sprint: rail QA issue fixes.** Run 9 surfaced a new failure cluster distinct from EMPR: hub completeness (governance omitted, Dynamic Consist not in main article), content routing errors (misplaced sections), missing stubs for recognized-but-thin topics, American-unit defaults, {{USER}} framing density, critique callout placement. This workstream addresses prompt-level fixes. See `[P1 — ERUPT] Prompt Sprint: Rail QA Issue Fixes` below. Validated with at least one re-run on both EMPR and a rail-type transcript before quality gate attempt.
2. **Stub generation mechanism** — see `[P1 — ERUPT] Stub Generation Mechanism` below. Must ship before vault generation begins; gates vault completeness.
3. **Business model decision** — see "[SPRINT — DECISION] Free/Local/Cloud → BYOK reframe" below.
4. **Cost reduction work.** Run 9: $2.43 for 21 pairs (2× per-pair over Run 8). If BYOK lands, cost falls on user's key and the absolute-cost gate loosens. Regardless, contextSeed accumulation (prior article body content growing monotonically per turn on multi-arc runs) is the primary driver to investigate — see `[P2 — ERUPT] contextSeed Sliding Window`. Decouple: investigate contextSeed separately from the business model decision.
5. **Quality gate — updated criteria.** See "[SPRINT — GATE] Quality threshold before real vault generation" below. Gate now requires EMPR rubric ≥6.5/7 AND a new multi-arc checklist on a clean run.
6. **Vault generation against Magazine-context chats** (post-gate). The first hard dogfood + the unlock for Magazine work.
7. **Some UI polish on breaks** — Session Picker keyboard nav (P1), Status Bar aria-live (P1), other XS items in this file.

**Out of scope this fortnight:** Slipstream API proxy + account auth. See "[SPRINT — DECISION] Proxy this fortnight vs v1.5" below — leaning v1.5 (ship Local-only v1, add Free + Cloud later).

---

## [SPRINT — DECISION] Free/Local/Cloud → BYOK + small monthly reframe

**What:** Re-evaluate the three-tier plan structure. Two candidate models:

1. **BYOK + small monthly fee.** User brings their own Anthropic/OpenAI key (and/or runs Ollama locally). Slipstream charges a small monthly fee ($3-5/mo) for the plugin itself, with no proxy. Slipstream account optional, used for entitlement only.
2. **Pure usage-based.** Slipstream provides API access through the proxy, billed per-extraction or per-token to the user. No flat fee. Honest but creates billing anxiety.

**Why this is on the table:** The current Free/Local/Cloud tiers require the Slipstream proxy + account auth + Stripe wiring before any non-Local user can use the plugin. That's two BLOCKER TODOs of infrastructure work between today and shipping. BYOK + small monthly bypasses the proxy entirely for v1, converts Slipstream's role from "API cost center" to "thin entitlement layer," and ships faster.

**Why BYOK is probably right for Erupt specifically:**
- Erupt's audience is Obsidian power users — the segment most likely to already have an Anthropic API key, an OpenAI key, or an Ollama setup. The onboarding friction BYOK creates is lower for this audience than for Bleeper's audience.
- Bleeper-audience friction is higher (consumer-facing), so they should not share this model.
- BYOK is what the strategy doc's Drift architecture pattern implies anyway — user-owned credentials, Slipstream as facilitator not custodian.

**What needs deciding:**
- BYOK + monthly OR pure usage-based OR keep current Free/Local/Cloud?
- If BYOK: $3, $5, or no monthly fee at all (free with key)?
- Does v1 still need any Slipstream account, or can entitlement be a one-time license key like Bleeper?

**Decision deadline:** Before any further proxy/auth work or pricing-page copy is committed. Cascades into everything downstream (proxy decision, Stripe items, account auth items, distribution decision).

**Depends on:** Founder decision. Consults: existing Free/Local/Cloud `[BLOCKER — ERUPT]` items.

**Effort:** Decision XS; implementation impact varies by choice.

---

## [SPRINT — GATE] Quality threshold before real vault generation

**What:** Erupt EMPR runs must clear a quality+cost bar before founder starts using Erupt to write into a real Magazine knowledge-base vault.

**Why:** The vault is the substrate for Magazine code work (CC reads vault content as knowledge base, see workspace `TODOS.md` "Magazine — Gate"). If extraction is at 5.5/7 with $0.62/run cost when vault generation begins, the vault inherits noise faster than the founder can curate it, and Magazine work inherits that noise downstream. The vault is regenerable, but founder time spent triaging bad notes is not.

**Gate condition (must all hold):**
- **Quality (EMPR rubric):** EMPR runs reliably hit ≥6.5/7 — not one cherry-picked run.
- **Quality (multi-arc checklist):** One clean rail-type or Magazine-type run passes all of:
  - Hub article includes wikilinks to all major child articles discussed
  - Governance/decisions content captured in hub if discussed in transcript
  - Stub articles generated for recognized-but-thin topics (no silent drops)
  - No major section-level content routing errors (content in correct article and section)
  - American-first units throughout
  - Critique callouts placed inline, not lumped into a single section
- **Stub generation shipped** — see `[P1 — ERUPT] Stub Generation Mechanism`. Vault cannot be trusted as complete without stubs.
- **Cost:** Per-extraction cost in a viable range. Threshold TBD; BYOK changes the calculus (cost falls on user's key, so threshold can be looser if BYOK lands).

**If quality is met but cost isn't:** BYOK pivot is the cost answer; proceed with vault generation under BYOK.

**If quality isn't met:** No vault writing yet. More prompt iteration; do not start the Magma vault for Magazine chats. The downstream Magazine-gate stays closed until this gate clears.

**Decision point:** Mid-sprint checkpoint, evaluate honestly. The cost of forcing the gate is a polluted vault; the cost of holding it is one more sprint.

**Depends on:** Prompt sprint + stub generation shipped. Validation runs on both EMPR and rail-type transcript.

---

## [SPRINT] Generate Magma vault from Magazine-context chats (post-quality-gate)

**What:** Use Erupt to extract Magazine-architecture context from accumulated ChatGPT + Claude conversations into a real Magma vault. Goal: a queryable, structured knowledge base that CC can read against when Magazine engineering begins.

**Why:** This is the hardest dogfood test of Erupt's core promise and the unlock for Magazine work. Magazine architecture (Ether pipeline, style library, data flows, layout engine) is currently locked in chat history — well-developed per founder, but unfilterable. Erupt converts immutable chats into a structured Magma vault. Vault is regenerable, so this isn't a one-shot — re-extract as Erupt improves.

**Important — temporal structure preservation.** Magazine architecture chats have a timeline: later decisions supersede earlier speculation. The Decision Log Scratchpad architecture (Run 8) is directly relevant — extraction must preserve provenance (which chat, when) and supersession, not flatten the timeline into a directory of contradictory partial drafts. This is also the failure mode the founder will encounter first if extraction is naive.

**Expected output:**
- A Magma vault under `~/Obsidian/MagazineKnowledge/` (or equivalent) containing extracted articles on: Ether pipeline, style library, data architecture layers, layout system, cover generation, subscriber data flow, legal posture cross-references, etc.
- Decision-log entries preserving chat → article provenance and supersession.
- Founder reviews and curates as the vault forms; gaps and contradictions surface naturally.

**Important caveat:** The vault, once built, will probably expose meaningful architectural gaps where chat-based ideation produced "feels decided" content that was never settled. Plan for it. Re-deciding those before Magazine CC builds against them is part of the unlock value, not a setback.

**Depends on:** Quality gate above cleared. Business-model decision made.

**Effort:** Ongoing during sprint. The vault is never "done"; first useful regeneration is the milestone.

---

## [SPRINT — DECISION] Proxy this fortnight vs v1.5 (defer to BYOK pivot)

**What:** Decide explicitly whether the Slipstream API proxy + account auth lands in v1 or slides to v1.5.

**Recommendation (leaning):** v1.5. Ship Erupt v1 as Local-only (Ollama) + BYOK (user's own Anthropic key) — no proxy needed. Add Free + Cloud tiers in v1.5 once the proxy + auth infrastructure is built (which also serves Bleeper paid tier and Magazine subscriber accounts).

**Why:** Both BLOCKER items (`Build Slipstream API Proxy Backend`, `Slipstream Account Auth System`) are L-effort. Doing them this fortnight blocks Erupt closed beta indefinitely. Local + BYOK ships the v1 product to the closed beta cohort that gates Magazine work; the proxy can be built as a parallel workstream and unlock Free/Cloud tiers later.

**Open question:** If the BYOK + small monthly decision lands, does Free tier exist at all in v1.5, or is the only ladder BYOK ($X/mo) → Cloud (subscription with proxy)? Possibly Free becomes a 3-job trial via Slipstream-provided key for evaluation, not a sustained tier.

**Decision deadline:** End of this fortnight, before v1 plugin distribution begins.

**Depends on:** Business model decision above.

---

## [SPRINT] Erupt closed beta = Magazine code gate

**What:** Erupt closed beta = handing copies of the plugin to non-founder users for real use. The moment that happens is the Magazine-code gate (see workspace `TODOS.md` "Magazine — Gate").

**Why "to other people":** "Good enough for me" is a personal bar. "Good enough to hand to people I'd put my name behind giving it to" is defendable-to-peers. Defendable-to-peers + a working Magma vault from Magazine chats + EMPR ≥6.5/7 = the conditions that unblock Magazine engineering.

**Beta cohort scoping:**
- Identify 5-10 Obsidian power users who use AI chats heavily (the target audience archetype).
- Hand out copies with the BYOK + Local plan path (no proxy needed — see proxy decision above).
- Capture feedback that informs the *next* vault regeneration. The vault Magazine eventually builds against is the post-feedback vault, not this one.

**Depends on:** Quality gate cleared. Vault generation underway. Business model + proxy decisions landed.

---

## [BLOCKER — ERUPT] Build Slipstream API Proxy Backend

**What:** `api.slipstream.now/proxy/claude` — required for both Free tier (server-side job counter enforcement) and Cloud plan (proxy extraction). Plugin routes by plan tier: Free / Cloud → proxy (JWT bearer auth), Local → Ollama at `http://localhost:11434`.

**Why:** The per-account job counter for Free tier enforcement runs server-side. Cloud plan cannot function without the proxy. Local plan ships without it and uses Ollama.

**How to apply:** Build a Slipstream backend service (Node.js/Fastify or similar) that:
1. Accepts `POST /proxy/claude` with JWT bearer token + request body (same shape as Anthropic's `/v1/messages`)
2. Validates JWT against Slipstream account system
3. Enforces Free tier job counter (max 3 lifetime) server-side
4. Forwards to Anthropic with Slipstream's own API key
5. Streams/returns response

**Billing:** Stripe (not LemonSqueezy). See Stripe migration TODO below.

**Context:** Local plan ships without this proxy. Strategy option: ship Local plan in v1 without proxy, add Free + Cloud in v1.5 when proxy is ready.

**Depends on:** Slipstream account auth system (see next TODO), Stripe setup.

**Effort:** L (human: 2-3 weeks / CC: ~4-6 hours for proxy logic, plus infrastructure setup).

---

## [BLOCKER — ERUPT] Slipstream Account Auth System

**What:** Free and Cloud plan users authenticate with a Slipstream account. The plugin opens a browser auth flow (`auth.slipstream.now`), user signs in, JWT returned and stored via `Plugin.saveData()`.

**Why:** Both Free and Cloud tiers route through the proxy. The proxy validates JWT to enforce the Free tier job counter and Cloud plan entitlement. Local plan users do NOT need an account.

**JWT payload:** `{ plan: 'free'|'local'|'cloud', valid_until: ISO8601, user_id }`

**How to apply:** Implement OAuth or email/password auth at `auth.slipstream.now`. After successful auth, redirect to Obsidian deep-link (`obsidian://erupt/auth?token=<jwt>`). Plugin receives JWT, validates expiry on load + before each API call, stores securely via `Plugin.saveData()`.

**Cons:** Significant infrastructure work (auth service, JWT issuance, account DB). Can reuse Bleeper's auth system if one exists.

**Depends on:** Stripe setup (plan tier attached to account via Stripe webhook on subscription event).

**Effort:** L (human: 1-2 weeks / CC: ~2-3 hours for token exchange + plugin integration, plus backend auth service).

---

## [DONE — ERUPT] Create Erupt DESIGN.md

> **Completed 2026-04-23.** `/design-consultation` ran and generated a complete `erupt/DESIGN.md`.
> Updated 2026-04-23 (post office-hours): BYOK → proxy Free state, Local plan state added,
> Upgrade Modal trigger corrected (auto-shows on 4th Free job attempt, not settings-only).

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

## [PRE-LAUNCH — ERUPT] CI/CD Build Pipeline and Plugin Distribution

**What:** Set up the build pipeline and release automation before Obsidian Community Plugins submission.

**Requirements:**
1. **esbuild config** — entry point `main.ts`, outputs `main.js` + `styles.css` to repo root, `manifest.json` stays in root, minified for release
2. **GitHub Actions workflow** — triggered on version tag push (`v*`), runs esbuild, creates a GitHub Release with `main.js`, `manifest.json`, `styles.css` as release assets
3. **Obsidian plugin registry** — requires a PR to `obsidian-md/obsidian-releases` adding the plugin to `community-plugins.json`. Needs: plugin ID, name, author, description, repo URL
4. **Version bump script** — update `manifest.json` + `package.json` versions in sync on each release

**Effort:** XS (CC: ~20 min to scaffold esbuild config + GitHub Actions YAML).

**Depends on:** Nothing blocking — can be set up before implementation is complete.

---

## [P2 — ERUPT] Confirm `mobile: false` in manifest.json

**What:** Erupt's `manifest.json` must have `"isDesktopOnly": true` to prevent installation on Obsidian mobile. Obsidian will show the standard "desktop only" notice automatically.

**How to apply:** Add `"isDesktopOnly": true` to `manifest.json`. One line.

**Effort:** XS (CC: ~1 min).

---

## [BLOCKER — ERUPT] Decide: Proprietary Extraction Engine vs. Open Plugin

**What:** The full extraction engine — system prompts (`src/extraction/prompt.ts`), agentic loop (`src/extraction/loop.ts`), tool handlers (`src/extraction/tools.ts`), final pass (`src/extraction/final-pass.ts`), and fallback pipeline (`src/extraction/fallback.ts`) — currently lives in the open plugin code. A bundled `.js` file is readable by anyone who installs the plugin.

**Why this is a blocker before public launch:** The Local plan is $5/mo and uses a functionally similar extraction engine to Cloud. The product doc originally described "Obsidian plugin → local binary (invoked via CLI) → local processing or cloud API" — a proprietary binary was the intended separation. That was later superseded by "plugin routes directly" (Decision Log, Product Doc §12), but the IP protection concern was never explicitly resolved.

**Options:**
1. **Accept open code.** Ship as-is. The system prompts and pipeline logic are visible. Defensibility comes from the brand, the cloud backend, and ongoing iteration — not secrecy. Obsidian Community Plugins submission requires source availability anyway.
2. **Obfuscate the production build.** Run the esbuild output through a JS obfuscator. Raises the bar for casual inspection but provides no real protection.
3. **Re-introduce a local binary for extraction logic.** Extraction engine compiled to a native binary (e.g. via Bun/pkg). Plugin becomes a thin IPC client. Proprietary binary ships alongside the plugin. Breaks Obsidian Community Plugins path (binaries not permitted) but works for direct distribution. Highest IP protection; highest engineering cost.

**Current state:** Fine for internal testing. Must be resolved before any public release or community plugins submission.

**How to apply:** Make the decision, update the build pipeline if needed, and remove this blocker.

**Depends on:** Distribution strategy decision (Community Plugins vs. direct/paid distribution).

**Effort:** Decision XS; implementation varies by option (option 1: 0, option 2: S, option 3: L).

---

## [BLOCKER — ERUPT + BLEEPER] Migrate Billing to Stripe

**What:** Switch from LemonSqueezy to Stripe everywhere. Bleeper first (existing subscriptions), then Erupt at launch. Goal: become own merchant account with direct card processing. Maintain a backup processor (Paddle or Braintree) as tested failover before v2.

**Why:** Platform risk — LemonSqueezy can restrict accounts. Stripe gives more control and better MCC codes for software subscriptions.

**Checkout copy discipline (non-negotiable):** Never mention "scraping," "downloading from platforms," specific AI platform names (ChatGPT, Claude, Gemini), or anything that reads as ToS-circumvention on checkout pages. Use "personal knowledge management" and "AI session notes" throughout. This applies to all Stripe product descriptions, checkout metadata, and email copy.

**How to apply:**
1. Create Stripe account, configure Erupt product + price objects
2. Migrate Bleeper subscriptions to Stripe (migration tooling)
3. Wire Stripe webhook → account system (set `plan` in JWT on subscription event)
4. Test failover: configure Paddle or Braintree as backup, verify it can activate in <24h
5. Document the failover runbook

**Depends on:** Slipstream account auth system (JWT plan field set by Stripe webhook).

**Effort:** M (human: 1 week / CC: ~2-3 hours for integration + migration).

---

## [PRE-LAUNCH — ERUPT] Trademark Clearance for "Erupt"

**What:** Confirm "Erupt" is clear for use as a commercial product name before Obsidian Community Plugins submission.

**Known conflicts:** Rust crate `erupt` (Vulkan bindings), Chinese admin framework (Erupt Engine), npm packages. None are in the same market, but clearance needed.

**How to apply:** Run a trademark search (USPTO TESS + EU IPO + UK IPO). Check domain availability. Check Obsidian plugin registry for name conflicts. If blocked, fallback is "Erupt by Slipstream" as the display name.

**Effort:** XS-S (human: 2-4 hours of search + legal review if flagged).

---

## [PRE-LAUNCH — ERUPT] Verify isomorphic-git Obsidian Sandbox Compatibility

**What:** Confirm that `isomorphic-git`'s filesystem operations work within Obsidian's plugin security model before committing to it as the git history backend.

**Why:** Obsidian plugins run in a sandboxed renderer process. Some Node.js fs APIs may be restricted. isomorphic-git is pure JS (no native binary) which is promising, but needs verification.

**How to apply:** Build a minimal test plugin that initializes an isomorphic-git repo in `.magma/.git-history/`, makes a commit, and reads back the log. Run on all three platforms (Windows, macOS, Linux). If it fails, evaluate fallback: custom JSONL-based diff log (no git, just append-only diffs).

**Effort:** XS (CC: ~30 min to build test plugin + run).

---

## [DONE — ERUPT] Pull Wikipedia Editorial Rules for MagmaWiki Prompt Construction

> **Completed 2026-04-28.** Researched WP:SIZE, WP:SPLIT, WP:STUB, WP:MERGE, WP:LEAD,
> WP:STRUCTURE, WP:REDIRECT. Distilled into `## MagmaWiki Style Guide` section in
> `src/extraction/prompt.ts`. Key additions: speculative tangent rule, article granularity
> floor (150 words), parent/child split pattern, per-turn article count calibration (N–2N),
> stub discipline, heading level consecutiveness.

**What:** Before writing the extraction system prompt and final pass compliance prompt,
research and distill the subset of Wikipedia's editorial guidelines that apply to MagmaWiki
article structure and style. The goal is to ground the agent's article-writing behavior in
actual Wikipedia rules rather than informal approximations.

**Relevant Wikipedia guidelines to audit:**
- **WP:SPLIT / WP:SUMMARY** — when and how to split a long article into sub-articles;
  summary style (parent article keeps a brief summary, full content in child article)
- **WP:STUB** — what makes a stub legitimate; stub articles whose sum has no information
  loss vs. content removal
- **WP:LIST** — when list-primary articles are appropriate vs. prose articles
- **WP:LEAD** — lead section structure; every article should be understandable from the lead alone
- **WP:NPOV / WP:ASSERT** — avoid asserting facts without attribution; cite or contextualize
- **WP:OVERCITE / WP:UNDERCITE** — balance; don't over-cite obvious things, don't under-cite contested claims
- **WP:STRUCTURE** — section hierarchy, when to use H2 vs H3, prose-first before lists
- **WP:REDIRECT** — when to redirect a concept to a broader article rather than stub it separately
- **WP:MERGE** — criteria for merging two articles vs. keeping them separate (applies to Magma dedup)
- **WP:SIZE** — article length guidance; readable prose size target (~30-50KB / ~4,000-8,000 words
  for a full article, shorter for focused sub-articles)

**How to apply:** Distill the relevant rules into a concise "MagmaWiki Style Guide" section
in the extraction system prompt. The agent should consult these rules when deciding:
(a) whether to split an oversized article vs. trim, (b) when to create a stub vs. a
provisional article, (c) how to structure an article's sections, (d) when to merge vs.
keep two articles separate.

**Key insight:** The extraction agent doesn't need all of Wikipedia's rules — only the
structural and style rules that affect article-writing decisions during extraction and
final pass compliance. Skip editorial policies about verifiability from external sources
(Magma's source is always the transcript).

**Effort:** S (human: 2-3 hours of research + distillation / CC: ~30 min to read guidelines
and write the MagmaWiki Style Guide section).

**Depends on:** Agentic extraction pipeline design doc (approved 2026-04-23).

---

## [P1 — ERUPT] Create `src/models.ts` — Ollama Tool-Use Capability List

**What:** A compile-time static list mapping Ollama model names to their tool-use capability.
Used by the extraction pipeline to route Local plan users to the agentic pipeline (tool use)
or 3-pass blob fallback.

**Initial list:**
- Tool-use capable: `llama3.1`, `llama3.2`, `llama3.3`, `mistral` (7B+), `mixtral`
- Non-tool-use: `phi3`, `phi3:mini`, `phi3:medium`, `mistral:3b`, `mistral:7b-text`
- Unknown models: default to agentic pipeline; fallback to 3-pass if first turn returns
  `stop_reason: "end_turn"` with zero `tool_use` blocks

**How to apply:** Export a `getModelCapabilities(modelName: string): ModelCapabilities`
function from `src/models.ts`. Call at plugin load time after `GET /api/tags` returns the
active Ollama model name. Store result in plugin session state so re-detection is skipped
for subsequent extractions in the same session.

**Updates:** Require a plugin release to update the list (no remote config in v1). File
should be well-commented to make community PRs easy.

**Effort:** XS (CC: ~15 min).

**Depends on:** Agentic extraction pipeline design doc (approved 2026-04-23).

---

## [DONE — ERUPT] Magma Explorer Pane — Custom Graph Icon

Implemented as a custom `magma-graph` SVG icon: hub-and-spoke graph layout with the top hub node rendered as a flame silhouette (teardrop path) instead of a circle. Positioned after the native "Open graph view" ribbon button via `setTimeout` DOM insertion (Obsidian exposes no public API for ribbon ordering — verify after version bumps). Label is "Open Magma graph". `getIcon()` in `MagmaExplorerView` also returns `'magma-graph'`.

---

## [P2 — ERUPT v1.5] Final Pass Tool Enrichment: `compare_articles`

**What:** Add a `compare_articles(pathA, pathB)` tool to the final pass contradiction
detection sub-pass. The tool returns a structured diff of two Magma articles, making it
easier for the model to identify semantic contradictions without reading both articles
in full in-context.

**Why:** The current sub-pass 2 injects all article content into the model's prompt. For
sessions with many articles, a comparison tool reduces the amount of content the model
needs to reason about simultaneously and may improve contradiction detection accuracy.

**How to apply:** Implement in the TypeScript tool handler. The tool reads both articles
from `.magma/wiki/` and returns a structured summary: shared claims, claims unique to A,
claims unique to B, confidence differences. The model uses this to target its
`write_magma` corrections.

**Effort:** S (CC: ~30 min for tool implementation + prompt update).

**Depends on:** v1 final pass shipped and validated. Do not implement until v1 has run
in production and contradiction detection quality has been measured.

---

## [P1 — ERUPT] Draft-Failed Article Review Modal

**What:** After extraction completes with turn failures, surface a Step 3 "Draft Review Modal" that lets the user decide what to do with each incomplete article. Without this, draft-failed articles (articles that had partial content written before a turn error) are invisible — users would need to manually inspect `.magma/wiki/` frontmatter to discover them.

**UI spec (in DESIGN.md):**
- One article at a time: title, path, partial content preview (read-only, max-height 200px, scrollable), error context from `extraction_log.jsonl`
- Two CTAs: `[Keep as stub]` (removes `draft-failed` flag, sets confidence=stub, saves) and `[Discard]` (deletes article)
- Keyboard: `K` = keep, `D` = discard, `→` = next (when decision made). `Escape` = close (undecided articles remain draft-failed)
- Progress indicator: "Article X of Y"
- Footer: keyboard shortcut reference in `--text-faint`

**Entry point:** Step 3 in the completion flow, after the result modal (Step 1) and questions modal (Step 2 if applicable). Accessible via `[Review incomplete articles →]` CTA in the result modal when draft-failed articles exist.

**Data required:** `write_magma` handler must record the "last known good" content snapshot for each article before the failed turn. Store in plugin session state as `Map<path, lastGoodContent: string>`. If no prior content (first write to that path failed), "Keep as stub" creates a minimal stub with just frontmatter.

**Effort:** S (CC: ~30 min for modal + handler changes to track last-good snapshots).

**Depends on:** Plugin scaffold + `write_magma` block-indexed implementation. The `lastGoodContent` tracking can be added to the handler at initial implementation time.

---

## [DONE — ERUPT] Block Parser Test Suite

> **Completed 2026-04-28.** `src/extraction/block-parser.ts` + 18 tests in
> `src/extraction/__tests__/block-parser.test.ts`. All passing. vitest added as
> test runner. Block-indexed write_magma implementation remains v1.5 scope.

**What:** Before using block-indexed `write_magma` in any real extraction, write a dedicated test suite for the Markdown block parser.

**Why:** The block parser is the foundation of the new `write_magma` primitive. Getting it wrong produces silent corruption — the agent writes to block index N but overwrites the wrong content. Edge cases in Markdown block parsing are easy to miss.

**Test cases required:**
- YAML frontmatter boundary (`---` delimiters treated as frontmatter block, not horizontal rule)
- Code block with blank lines inside (must not be split into two blocks)
- Consecutive headings with no paragraph between them
- Empty article (zero content blocks)
- Single-block article (just frontmatter)
- List items as one block vs. multiple blocks
- Blockquote containing blank lines

**Effort:** XS (CC: ~20 min).

**Depends on:** Plugin scaffold + `write_magma` block-indexed redesign.

---

## [P2 — ERUPT v1.5] `search_turns(query)` Tool — Transcript Index

**What:** Add a `search_turns(query)` tool to the main extraction pass. Backed by a pre-built TF-IDF index over the transcript built at extraction start alongside the vault index. Returns up to 5 turn indices mentioning the concept.

**Why:** Currently the agent finds when a concept was first mentioned by scanning from turn 0 in 20-turn chunks via `read_turns`. For a 200-turn conversation, that's up to 10 calls. A `search_turns` tool reduces this to O(1).

**How to apply:** Build transcript TF-IDF index at extraction start (alongside vault index). Add `search_turns(query: string)` as Tool N in the main extraction pass. Returns `{ results: [{ turnIndex, preview }] }`, up to 5 results sorted by relevance.

**Effort:** S (CC: ~30 min for index construction + tool handler).

**Depends on:** v1 agentic pipeline validated in production. Measure whether backward scan is actually a bottleneck before implementing.

---

## [P2 — ERUPT v1.5] Inline Range Granularity for `write_magma`

**What:** Extend `write_magma` with inline range support — update a specific sentence within a paragraph by anchor text, without rewriting the whole block.

**Why:** Block-level writes are a major improvement over full-article rewrites. For v1.5, surgical inline edits would further reduce token cost for citation additions and single-sentence corrections.

**How to apply:** Add `inline: { anchor: string, replace: string }` field to `write_magma`. When `inline` is present, find the `anchor` text within the target block and replace it with `replace`. Fall back to full block replace if anchor not found.

**Effort:** S (CC: ~30 min for implementation + tests).

**Depends on:** v1 block-indexed `write_magma` shipped and validated.

---

## [P1 — ERUPT v1.5] Claude Code + Codex CLI Source Support (Hook-Triggered Extraction)

**What:** Add Claude Code and Codex CLI as extraction source types. Developers running coding agents all day generate high-value intellectual output that currently vanishes. This integration lets Erupt extract those sessions into Magma automatically via a hook trigger.

**Trigger flow:**
1. User configures a post-session hook in Claude Code (`~/.claude/hooks/`) or Codex CLI
2. Hook fires a shell command: `obsidian plugin:command erupt:extract-session --source claude-code --session <id>`
3. Obsidian CLI (1.12+) passes the command to the running Obsidian app
4. Erupt reads the session file, runs the extraction pipeline, writes to `.magma/wiki/`

**Source format work required:**
- **Claude Code:** Sessions stored as JSONL at `~/.claude/projects/<slug>/<session-id>.jsonl`. Each line is a turn object with role + content blocks. Write a `ClaudeCodeAdapter` that converts to Erupt's internal `Turn[]` format with correct turn indices.
- **Codex CLI (OpenAI):** Format TBD — requires research at implementation time. Write a `CodexAdapter` on the same interface.
- Both adapters must preserve turn index fidelity (the extraction pipeline's `read_turns` tool depends on stable indices).

**Hard constraints:**
- **Requires Obsidian CLI 1.12** — still Early Access (Catalyst license) as of 2026-04-24. Do not build until 1.12 is GA and free for all users.
- **Requires Obsidian app running** — CLI is not headless. Users who code with Obsidian closed get nothing.
- **Hook installation is out-of-band** — Erupt cannot install hooks into Claude Code or Codex automatically. Provide a setup guide in settings: copy-pasteable hook script, instructions for each tool.

**Scope boundary (v1.5 only):**
- One-shot extraction per session end: hook fires → Erupt extracts entire session → done.
- Incremental / continuous sync (re-extract only new turns from an in-progress session) is **deferred to v2**. It requires high-watermark tracking per source session and turn-dedup logic that needs design work.

**Effort:** M (CC: ~2-3 hours for adapters + hook spec + settings UI section).

**Depends on:** Obsidian CLI 1.12 GA. v1 extraction pipeline validated in production.

---

## [PRE-LAUNCH — ERUPT] Verify Magma Folder Exclusion API

**What:** Confirm that `app.vault.setConfig('userIgnoreFilters', [..., '.magma'])` works in Obsidian 1.5+ to hide `.magma/` from the file explorer and Quick Switcher.

**Why:** If `setConfig` is sandboxed or unavailable, the CSS fallback must be pre-built and tested before launch. Users should never see `.magma/` polluting their file explorer.

**How to apply:** Test `setConfig` in a dev plugin against Obsidian 1.5+. If unavailable, implement the CSS fallback: `[data-path=".magma"] { display: none !important; }` via `this.addStyle()`. Verify both that the folder is hidden and that Magma view can still access it via `app.vault.getAbstractFileByPath('.magma')`.

**Effort:** XS (CC: ~20 min).

---

## [P2 — ERUPT v1.5] Graph View: Magma Integration

**What:** Smart graph view behavior based on context. When opening graph view while on a vault page, open the standard vault graph. When opening while on a Magma page or within the Magma Explorer pane, open a Magma-only graph with Magma branding. A toggle in either graph's settings panel includes the other's nodes for a combined view.

**Why:** Magma builds a semantic graph of your knowledge. Surfacing that graph makes the interconnection visible and gives users a bird's-eye view of what Erupt has extracted.

**UX spec (from /design-review 2026-04-24):**
- Default behavior: context-sensitive graph type on open (vault page → vault graph; Magma page or pane → Magma-only graph)
- Toggle in graph settings: "Show vault notes" (in Magma graph) / "Show Magma articles" (in vault graph)
- Combined view shows both node sets simultaneously
- Future: settings for color and connection strength of Magma-to-vault edges

**Effort:** M (CC: ~2-3 hours — Obsidian graph API has limited plugin surface; may require CSS + graph renderer hooks investigation).

**Depends on:** v1 Magma Explorer pane shipped. Obsidian graph view plugin API investigation.

---

## [P1 — ERUPT] AI-Assisted Parsing for Non-Standard Transcript Formats

**Problem:** The rule-based parser (`src/transcript-parser.ts`) handles a fixed set of known formats. Any export from an app that uses non-standard field names, role values, nesting, or structure will silently fall through to the single-turn fallback — losing all turn boundaries and degrading extraction quality significantly.

**Proposed approach — two-stage parsing:**
1. **Pre-pass (cheap):** Before invoking the extraction pipeline, send the first ~500 tokens of the note content to the model with a single question: "Is this a chat transcript? If yes, what are the role labels and content field names?" This is a fast, inexpensive call — one round-trip, no tools.
2. **AI parse (if needed):** If the pre-pass confirms it is a transcript but the rule-based parser returned 0 or 1 turns, invoke a second pass: send the full content to the model and ask it to return the transcript as a JSON array of `{"role": "human"|"assistant", "content": "..."}` objects. Feed that output back into `extractMessages()`.

**Gate:** Only invoke the AI parser if the rule-based parser fails AND the pre-pass confirms the content is a transcript. Do not invoke it for notes that are genuinely not transcripts — the pre-pass is the guard.

**Fallback behavior if AI parse also fails:** Proceed with the single-turn fallback and surface a warning to the user (see "No Recognisable Conversation" TODO).

**Cost:** The pre-pass is ~$0.00X per note. The AI parse pass is small (structured extraction, no tools). Acceptable for the value of correct turn boundaries.

**Effort:** S (CC: ~30 min — pre-pass call + structured output parse + wiring into `extractNotes()`).

**Depends on:** `src/transcript-parser.ts` + `buildClient()` in `main.ts`.

---

## [P1 — ERUPT] No Recognisable Conversation — Surface Clearly with Format Guidance

**Problem:** When `parseTranscript` finds no usable turns, the current behavior is a 4-second dismissible Notice: `"Erupt: no conversation turns found in this note."` This tells the user what happened but not why or what to do about it. A user who just pasted a conversation and gets this message has no idea whether their paste was malformed, the wrong note was active, or the format isn't supported.

**Required:** Replace the bare Notice with actionable feedback — either a modal or a richer Notice — that:
1. States clearly that no conversation format was detected in the active note
2. Lists the two supported formats with brief examples (JSON-per-line, `## Human` / `## Assistant` headings)
3. Mentions the fallback: any note with at least one paragraph will be treated as a single turn if neither format matches — so a very short paste might extract as one turn rather than failing

**Also consider:** partial parse — `parseTranscript` may detect some lines as valid JSON turns but silently skip malformed lines. If <50% of lines parse, consider surfacing a warning: `"Parsed N of M lines — the rest were not recognisable conversation turns."` so the user knows the extraction may be incomplete.

**Effort:** XS (CC: ~15 min).

**Depends on:** `src/transcript-parser.ts` (exists).

---

## [P1 — ERUPT] Extraction Agent Has No Awareness of Conversation Purpose

**Problem:** The extraction pipeline processes turns without any representation of what the conversation was *for*. The agent has no basis to distinguish a deliberate architectural decision from a tangential mention, a rejected approach from an adopted one, or a dead-end debugging hypothesis from the actual fix. Everything gets weighted roughly equally against the stub/provisional threshold.

**Compounding factor: purpose drift.** Conversations don't have a single stable goal — they wander. A session might start as a debugging conversation, pivot into a design discussion, then end as a planning session. A flat "conversation goal" statement derived from the whole transcript would misrepresent the later sections. The relevance filter needs to be temporally aware — what the conversation was trying to accomplish *at turn N* is what matters for evaluating turn N's content.

**What's needed:** Some form of local purpose tracking — either a sliding-window summary of recent turns that gives the agent a "what are we trying to do right now" signal, or explicit phase detection (debugging → designing → planning). The agent can then use this to calibrate extraction weight: abandoned approaches → skip or stub, resolved decisions → provisional, active uncertainty → clarifying question.

**Not yet designed.** This is a problem statement, not a solution spec. Resolve before v1 ships if extraction quality on long, drifting conversations is poor.

**Effort:** Unknown — requires design before scoping.

---

## [P1 — ERUPT] Graceful Handling of File References and Unavailable Attachments in Transcripts

**What:** Conversations often reference files, images, code attachments, or external resources that are not present in the pasted transcript — only the text of the conversation is available to the extraction pipeline. The extraction agent must handle these references without hallucinating content or producing confused articles.

**Common cases:**
- Attached files referenced by name: `"Looking at your main.py..."`, `"[Attached: schema.sql]"`, `"Based on the screenshot you shared..."`
- Images described by the AI: `"I can see in the image that..."` where the image itself is absent
- External URLs or docs summarised by the AI without the source being present
- Partial tool-use output (e.g. Claude Code file reads) where the file content appears in the transcript but the actual file is not in the vault

**Required behavior:**
- The extraction system prompt must explicitly instruct the agent: when a turn references a file or attachment that is not available, extract what can be inferred from the surrounding conversation about that file — its name, purpose, structure as described — and note the gap clearly using `confidence: stub` and a prose note like `"The full content of this file was not available in the transcript (turn N)."`
- Do NOT skip turns that reference missing files — the conversation around the file is still valuable
- Do NOT hallucinate file content based on the filename or partial description
- If the AI's response in a later turn summarises or quotes from an attached file, that summary IS available and should be extracted

**Prompt change needed:**
Add a section to `EXTRACTION_SYSTEM_PROMPT` in `src/extraction/prompt.ts`:

```
## Handling missing attachments and file references

Conversations often reference files, images, or documents that are not included in the transcript text. When you encounter a reference to an unavailable attachment:
- Extract what is described or inferred about the file from the surrounding turns
- Set confidence: stub
- Include a sentence like: "The full content of [filename] was not available in the transcript. (turn N)"
- Do NOT fabricate content based on the filename or partial description
- If the AI's reply quotes or summarises the file, treat that summary as the available source
```

**Effort:** XS (CC: ~10 min — prompt addition only, no code changes).

**Depends on:** `src/extraction/prompt.ts` (exists and implemented).

---

## [P1 — ERUPT] Community Plugins Description + Settings Field Tooltips + Empty States

**What:** Minimum documentation surfaces required before Obsidian Community Plugins submission:
1. **Community Plugins description** — the copy shown in the plugin browser. One short paragraph explaining what Erupt does (extract AI conversations into your vault wiki) and what it requires (Obsidian desktop, an account or Ollama).
2. **Settings field tooltips** — `setDesc()` on every `Setting` renderer field so users know what each setting does without reading docs.
3. **Empty states** — the Magma Explorer pane when `.magma/wiki/` is empty (first run): show a brief `"No Magma articles yet — run Extract Notes on a note with a pasted AI conversation."` placeholder. Session picker when no sessions exist: `"No sessions yet — extract from a note to create one."`.

**Why:** Without these, users arriving from the Community Plugins browser have no context. Empty states are the first thing a new user sees.

**Effort:** XS-S (CC: ~30 min).

**Depends on:** Plugin scaffold + settings panel implementation.

---

## [P1 — ERUPT] Settings Schema Migration Pattern

**What:** Implement additive schema migration at plugin load using `Object.assign(DEFAULT_SETTINGS, await this.loadData())`. This ensures new settings fields are added with defaults when upgrading from an older plugin version, without wiping existing user data.

**Why:** Without this pattern, adding a new field to `EruptSettings` will silently leave it `undefined` for existing users on upgrade, causing runtime errors or missed features.

**How to apply:** In `Plugin.onload()`:
```typescript
const DEFAULT_SETTINGS: EruptSettings = { /* all fields with defaults */ };
this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
```

**Effort:** XS (CC: ~5 min).

**Depends on:** Plugin scaffold.

---

## [P1 — ERUPT] Auth UX — Connect Button + Status Indicator in Settings Panel

**What:** Add the pre-auth state to the Free and Cloud settings panel sections. Currently the settings spec only documents the post-auth state. Required:
- "Connect Slipstream account" button (`mod-cta`) in the "Account" section when `authToken` is absent or expired
- After auth: green status dot + "Connected — [email]" label + "Disconnect" button (`mod-warning`)
- Clicking "Connect Slipstream account" opens the browser auth flow at `auth.slipstream.now`

**Why:** Without the Connect button, there is no in-plugin entry point to authentication. Users are stuck.

**Effort:** XS (CC: ~20 min to wire the button to the deep-link auth flow).

**Depends on:** [BLOCKER] Slipstream Account Auth System.

---

## [P1 — ERUPT] Ollama Model Dropdown — Fetched from Running Instance

**What:** Populate the Ollama model dropdown in settings (Local plan) by fetching `GET /api/tags` from the configured Ollama base URL. Show model names with "Recommended" badges on `llama3.2`, `mistral`, `phi3`. Graceful degradation: if Ollama is not running at settings open time, fall back to a freeform text input with a help note: `"Ollama not detected — enter model name manually."`.

**Why:** A static dropdown requires a plugin release every time a new model is released. Fetching live from Ollama keeps the list current without plugin updates.

**How to apply:** On settings panel open (or on "API Access" section render), fire `GET /api/tags`. On success, render dropdown. On failure (network error), render freeform input. Cache the fetched list in memory for the plugin session.

**Effort:** XS-S (CC: ~20 min).

**Depends on:** Plugin scaffold + settings panel implementation.

---

## [P1 — ERUPT] First-run Modal — One-time Post-Auth Orientation

**What:** After the first successful JWT deep-link callback (`obsidian://erupt/auth?token=<jwt>`), show a one-time modal:

```
Title: "You're connected."
Body:  "Open a note with a pasted AI conversation and run Extract Notes to get started."
CTA:   [Got it]
```

**Why:** Without this, users who just authenticated have no signal about what to do next. They land back in Obsidian with no orientation.

**Persistence:** Set `firstRunComplete: true` in plugin settings on dismiss. Check before showing — never show twice.

**Effort:** XS (CC: ~10 min).

**Depends on:** Auth system + plugin scaffold.

---

## [P1 — ERUPT] Inline Error Summary in Completion Modal

**What:** In the completion modal warning banner, replace the static `"See .magma/extraction_log.jsonl"` pointer with:
1. Inline error summary: up to 3 most recent errors as `"Turn N: [human-readable reason]"` in monospace
2. `[Show full log]` button (secondary style) — opens `.magma/extraction_log.jsonl` in an Obsidian leaf via `app.workspace.openLinkText`

**Why:** Making users navigate to a JSONL file to see what went wrong is a DX failure. Top 3 errors inline answers the basic question; full log is one click away for power users.

**Effort:** XS-S (CC: ~20 min — extraction_log.jsonl is already written; just read last 3 error entries at modal render time).

**Depends on:** Completion modal implementation + extraction_log.jsonl schema finalized.

---

## [P1 — ERUPT] Post-Extraction Feedback — Thumbs Up/Down in Completion Modal

**What:** For the first 5 lifetime extractions, show a `"How did this extraction go?"` row in the completion modal with 👍/👎 buttons. On tap: send `{ rating: 'up'|'down', extractionId }` to Slipstream backend (fire-and-forget), replace the row with `"Thanks!"` for 1.5s, then fade out. Hide permanently after the 5th rating or 5th extraction (whichever comes first).

**Why:** Early signal on extraction quality is critical for tuning the system prompt. This is the cheapest possible feedback loop — one tap, in context, no friction.

**Tracking:** Increment `feedbackRatingsGiven` counter in plugin settings. When ≥ 5, stop showing the row. Backend endpoint: `POST /api/extraction-feedback` with JWT auth.

**Effort:** XS-S (CC: ~20 min for the UI row + backend endpoint stub).

**Depends on:** Completion modal implementation + Slipstream backend proxy.

---

## [P1 — ERUPT] JWT Post-Completion Check

**What:** After the completion flow finishes (completion modal shown), validate the stored JWT's `valid_until` field. If expired, show:

```
new Notice("Your session expired — reconnect your Slipstream account for future extractions.", 6000)
```

**Why:** JWT expiry mid-run is possible for long extractions. Rather than aborting mid-run (which loses partial work), check once at the end and alert the user. This gives them a clear signal to re-authenticate before their next run.

**Constraint:** Do NOT validate JWT mid-run. 401s during extraction are treated as standard API errors. This check fires ONLY after the modal is shown — once per run, never during.

**Effort:** XS (CC: ~5 min — check `settings.authToken` expiry date at completion time).

**Depends on:** Auth system + plugin scaffold.

---

## [EXPLORE — ERUPT] Vent Blocks: Erupt Integration Surface

**What:** When "Vent" ships (see workspace TODOS.md for full concept), Erupt is the first integration target. Magma articles become live documents — not just static extracted notes but notes that surface real-time metadata about their own state via Vent blocks.

**Erupt-specific block candidates:**
- `slipstream/magma-confidence` — renders confidence level (`stub` / `provisional`), last extraction date, citing turn count for the current article inline
- `slipstream/magma-related` — lists related Magma articles by semantic similarity (backed by the vault scanner TF-IDF index, no network)
- `slipstream/extraction-status` — shows whether the current note has been extracted, how many turns it produced, and a "Re-extract" CTA (deep-links to the Erupt command)

**Why Erupt is the right first target:** Erupt already owns the `.magma/wiki/` namespace and the vault index. These blocks just surface what the extraction pipeline already knows — zero new data fetching required, so they work at the static-substitution tier (no daemon, no network).

**Erupt as a block registry participant:** The Erupt plugin registers its blocks at load time via `vent.register(...)` — the hook API Vent exposes to third-party plugins. No Vent store dependency required for these blocks.

**Effort:** XS-S per block once Vent's plugin hook API exists. Zero effort before Vent v1.

**Depends on:** Vent v1 shipped with plugin hook registration API. Erupt v1 shipped.

---

## [P2 — ERUPT / CROSS-PRODUCT] Slipstream Custom Emoji Set

**What:** A branded emoji set themed to the Slipstream geological/volcanic aesthetic — packaged as a loadable asset that any Slipstream product can consume. In Erupt: used in Magma Explorer, completion modal, and status surfaces. In non-Obsidian products (Bleeper, future web apps): loaded as a sprite sheet or icon font and aliased to standard emoji codepoints or custom shortcodes.

**Why:** Generic system emojis (🌋, 📁, ✓) undermine the premium, distinctive feel of the design system. A custom set creates visual coherence across the entire Slipstream product family and is a reusable brand asset — one investment, used everywhere.

**Scope:**
- Erupt-specific: extraction-related metaphors (magma flow, geological layers, crystallization states for `stub` / `provisional` / `complete` article confidence), vent/channel navigation icons for Magma Explorer
- Cross-product: Slipstream brand primitives (spectral/prismatic light motifs, core action states: running, complete, warning, error, cancelled) that inherit from `DESIGN.md` industrial-kinetic aesthetic
- Format: SVG sprite sheet for web products; Obsidian-compatible icon registration via `addIcon()` for Erupt (already in use for `magma-graph`)

**How to apply:**
1. Design core set (10–20 icons) aligned with `DESIGN.md` aesthetic — spectral gradients, kinetic geometry, volcanic motifs
2. Package as `@slipstream/icons` (monorepo package or standalone repo) with SVG source + sprite sheet export
3. Erupt consumes via `addIcon()` registration at plugin load; web products via CSS sprite or inline SVG import
4. Define shortcode aliases for any emoji used in UI copy (e.g. `:magma-stub:`, `:magma-done:`) so copy can reference icons symbolically

**Effort:** M (design: 4-8 hours; packaging + integration per product: S each).

**Depends on:** `DESIGN.md` aesthetic finalized (done). No code blockers.

---

## [P1 — ERUPT Strategy] Obsidian Sync Positioning — Do Not Compete

**What:** Think through Erupt's strategic relationship with Obsidian's native sync product before any sync-adjacent features are added to a higher tier plan.

**Context:** Erupt writes structured notes into the user's local vault (`.magma/wiki/`). Obsidian Sync already handles vault synchronization across devices. There is a plausible product path where Erupt Cloud could offer a "Slipstream-hosted vault mirror" or cross-device Magma sync as a premium tier feature — but this would put Slipstream in direct competition with Obsidian Sync, a key revenue line for Obsidian.

**Why this is worth thinking about carefully:**
- Obsidian's team has been explicitly tolerant of the plugin ecosystem and supportive of the community. Taking their revenue is an adversarial move.
- Competing with the host platform's monetization strategy is a high-risk position for a plugin in their store. We depend on Obsidian for distribution.
- The founder has no desire to take money from Obsidian. This is a values constraint, not just a business calculation.

**What to resolve before building anything sync-adjacent:**
1. Define the exact feature: is it "cross-device Magma sync" or "server-side vault mirror for AI batch processing"? These have very different Obsidian Sync overlap profiles.
2. Check Obsidian's plugin policies for explicit restrictions on sync/storage features.
3. Consider complementary positioning: Erupt extracts; Obsidian Sync carries the results to other devices. Let Obsidian handle sync entirely. If cloud storage is ever needed (e.g. for AI batch operations over a hosted vault copy), frame it as an optional "AI workspace" that does not replace or compete with Obsidian Sync.
4. If a hosted vault feature is ever built, it should be explicitly scoped to AI processing pipelines only — not positioned as a sync alternative to users.

**Decision needed from founder before any implementation.** This is a strategic and values-level question, not a technical one.

**Effort:** 0 (this is a thinking and alignment TODO, not a code TODO).

**Depends on:** Founder alignment on product positioning vs. Obsidian ecosystem.

---

## [P2 — ERUPT] Magma Article TOC Post-Processor — Settings Toggle + Remove Button

**What:** The planned per-article table of contents (Wikipedia-style, injected after the lead paragraph by an Obsidian MarkdownPostProcessor) needs:
1. A settings toggle: `"Show table of contents in Magma articles"` (default: on). Gates whether the post-processor injects the TOC.
2. A "Remove existing TOCs" command or button in settings, for users who installed a separate TOC plugin that already added TOC markup to articles — lets them clean up without manual edits.

**Why:** TOC injection conflicts with user-installed TOC plugins (e.g. `obsidian-dynamic-toc`, `obsidian-plugin-toc`). Without a settings toggle, the TOC post-processor has no off switch. Without a remove button, users who hit the conflict have no clean recovery path.

**How to apply:**
1. Add `showMagmaToc: boolean` (default `true`) to `EruptSettings` + `DEFAULT_SETTINGS`.
2. Gate the TOC post-processor: `if (this.settings.showMagmaToc) { this.registerMarkdownPostProcessor(...) }`.
3. Add a "Remove Magma TOCs" command (`erupt-remove-magma-tocs`) that iterates all `.magma/wiki/` articles and strips any injected TOC div. The TOC div should have a stable class (`magma-toc`) for reliable identification.

**Note:** TOC injection itself (the post-processor logic) is a separate TODO (implement first, add toggle second). Gate this TODO on the base TOC post-processor being shipped.

**Effort:** XS (CC: ~20 min once base TOC post-processor exists).

**Depends on:** Base Magma TOC post-processor (not yet implemented).

---

## [POST-V1 — ERUPT] Trim vaultTitles in extraction contextSeed

**What:** `src/extraction/loop.ts:75-87` builds the per-turn `contextSeed` by including every markdown file's basename via `opts.vault.getMarkdownFiles().map(f => f.basename)`. For users with 500-1000+ vault notes, that's a linear cost paid on every turn of every extraction.

**Why:** The new v1 system prompt is ~3-5KB longer than current. Combined with full-vault-titles bloat in contextSeed, big vaults will pay disproportionately on multi-turn extractions. P3 finding from /plan-eng-review on 2026-04-28.

**How to apply:** Replace `getMarkdownFiles().map(f => f.basename)` with a relevance filter. Options:
1. Recently modified (last N files by mtime)
2. Notes referenced (by basename match) in the current conversation
3. Sliding window centered on the active note's folder
4. Combination — recent + referenced, deduplicated

**Pros:** Meaningful cost reduction on big vaults; better signal-to-noise in agent context.

**Cons:** Requires deciding what "relevant" means; over-filtering loses search-friendliness for the agent.

**Context:** Existing behavior, not introduced by v1, but v1's longer prompt makes the asymmetry worse. Captured by /plan-eng-review 2026-04-28.

**Depends on:** Nothing.

**Effort:** S (human: ~2 hours / CC: ~30 min).

---

## [POST-V1 — ERUPT] Run rail + tactical transcripts as post-ship regression

**What:** After v1 extraction quality work ships and the EMPR re-test passes, run the rail (`Claude-Reimagining American rail with auto-train integration.md`, 923KB, ~50 turns expected) and tactical (`Claude-Appalachian mountain squad tactical loadout concept.md`, 65KB, list-shaped content) transcripts through the new extractor. Write a brief diagnostic report on each per the format of `.dump/Reports/2026-04-28-magma-output-analysis-empr.md`.

**Why:** The /office-hours session on 2026-04-28 explicitly deferred this validation step for project-dev-budget reasons, with the founder's stated reasoning that "the changes needed are likely coarse and apply to all transcripts. we can verify by running the others [later]." This TODO is the "later." Without it, we don't know if v1 generalizes or over-fit to EMPR.

**How to apply:**
1. After v1 ships and EMPR re-test passes 5/7 success criteria, snapshot the post-v1 magma output for EMPR.
2. Wipe magma vault, run extraction on rail. Diagnose against the same failure-category framework as the EMPR report.
3. Wipe magma vault, run extraction on tactical. Same diagnostic.
4. Compare failure modes across all 3 transcripts. If new failure categories appear that v1 doesn't address, surface as v2 priorities with data.

**Pros:** Confirms v1 quality across conversation shapes; surfaces v2 priorities with data instead of intuition.

**Cons:** ~$2 in API spend + a few hours of diagnostic time. Founder explicitly chose to defer this once.

**Context:** Documented as known gap during /office-hours session 2026-04-28. Serves as the actual validation that EMPR was a coarse-enough representative test.

**Depends on:** v1 ship.

**Effort:** S (human: ~1 day / CC: ~2 hours for diagnostic reports).

---

## [P2 — ERUPT] Decision Log Entry Cap for Dense Sessions

**What:** When a session produces more Active/Open decisions than a configurable threshold, auto-retire the entry least recently touched (lowest resolutionTurn, fallback to createdTurn) to prevent unbounded context growth in long-session extractions.

**Why:** The Active/Open entry cap was explicitly removed from Run 8 scope (eng review D10b — "removed as premature; real data needed to set threshold"). Run 8 and subsequent sessions will reveal whether the agent self-manages retirement correctly or whether unbounded growth is observed in practice.

**How to apply:** In `add_or_update_decision` handler, after adding/updating: if `state.decisionLog.active.length > CAP` or `open.length > CAP`, call `getAutoRetireCandidate()` (sort by `resolutionTurn ?? createdTurn`, ascending) and move to Retired. Add `DECISION_LOG_CAP` constant to `ExtractionConfig`.

**Pros:** Prevents unbounded context growth in 30+ turn sessions; auto-retire by recency is semantically correct (retire cold threads, not foundational decisions).

**Cons:** Adds cap enforcement code + getAutoRetireCandidate helper + unit tests; premature without real session data.

**Context:** Removed from Run 8 scope in /plan-eng-review 2026-05-13. Cap threshold should be informed by Run 8+ session data on typical Active/Open entry counts per session.

**Depends on:** Decision log core mechanic (Run 8 validation), real session data showing entry count patterns.

**Effort:** XS (human: ~30min / CC: ~5min once threshold is known).

---

## [P2 — ERUPT] Cross-Turn Article Attachment for Decision Logs

**What:** `writeArticleDecisionLogs()` currently attaches decisions only to articles first written in the same turn (`runArticleTurnMap`). Decisions that affect articles from prior turns (e.g., a turn-5 retire-decision on a turn-2 article) don't get attached to the affected article's decision log.

**Why:** Identified in /plan-eng-review 2026-05-13 D2 user note: "couldn't things cascade outside of the articles edited at that turn?" Creation-turn attachment is a correct approximation for Run 8 but loses cross-turn causality.

**How to apply:** Track an edit history map (`runArticleEditsByTurn: Map<string, number[]>`) that records all turns in which an article was written/modified (not just the first). In `writeArticleDecisionLogs()`, use the union of createdTurn articles and editedTurn articles for each decision.

**Pros:** Full locality-of-reference: every article log includes all decisions that touched it, regardless of when. Enables the "session intelligence layer" vision in the CEO plan.

**Cons:** Requires edit history tracking (more state in ExtractionRunState); complex many-to-many article↔decision mapping; needs real decision log data to validate usefulness.

**Context:** Deferred from Run 8 scope. Revisit post-Run 8 once we can observe real decision log data and see how often cross-turn attachment would be triggered.

**Depends on:** Decision log core mechanic (Run 8 validation), real session data.

**Effort:** S (human: ~2h / CC: ~15min).

---

## [P2 — ERUPT] Trajectory as Per-Turn Signal, Not Post-Run Pass

**Core architectural reframe:** Trajectory and the decision log are two distinct per-turn signals with different frequencies:
- **Decision log** — high-frequency boundary info: what's committed, what's open, what's retired. Changes every few turns.
- **Trajectory** — low-frequency color info: the arc and phase of the conversation ("we started debugging, pivoted to design, now planning"). Changes slowly across the session. Lags naturally, so it can be injected per-turn without sync problems.

Both belong in the main loop, not in a post-run pass. The post-run pass existed only because the main loop was context-poor. With per-turn trajectory + decision log, the main pass should produce nearly-final articles and the post-run pass becomes a structural consistency check only.

**Open question:** Can the decision log alone synthesize trajectory, or does trajectory need its own dedicated tool? Run 8 (EMPR — a monomaniacal single-topic transcript) suggests the decision log alone may be sufficient: `empr-primary-invention: all subordinate` effectively *was* the trajectory. But EMPR is the easiest possible test. A multi-topic transcript with 2–3 parallel arcs will reveal whether Active/Open/Retired entries can carry parallel trajectories without collapsing one arc under a dominant Active decision.

**Run 8 evidence:** Zero retired decisions, blade morphing correctly classified as Future Directions for the first time in 8 runs — preventatively, not correctively. The post-run structural pass had no semantic work to do.

**Progress so far (2026-05-14):**
- ✅ Post-run pass stripped to structural-only (`TRAJECTORY_REVISION_SYSTEM_PROMPT` rewritten: orphan repair, hatnote consistency, duplicate detection only — all semantic mandates deleted). Decision log tools removed from the structural pass tool set.
- ✅ Post-run pass progress label renamed to `'structural check'`.
- ✅ **Run 9 baseline** — Rail transcript (21 pairs, ~90KB, multi-arc). 10 articles produced, no arc collapse, decision log remained article-scoped throughout. Cost $2.43 (4× longer transcript than Run 8). 2026-05-15.
- 🔲 **If Run 9 reveals arc collapse** — *(not triggered — Run 9 was clean)*
- ✅ **If Run 9 is clean** — decision log alone is sufficient; trajectory tool is unnecessary. Confirmed 2026-05-15: 11 Active decisions across 10 articles, none session-wide scope, zero arc collapse.

**Known risk:** Single dominant Active decision can over-suppress legitimate splits. Tune the prompt to discourage over-broad "all subordinate" framing in Active decisions.

**Validation criteria:** Run 9 cost below Run 8's $0.52 baseline; post-run structural pass makes zero semantic corrections; parallel arcs in the rail transcript each get their own articles without arc collapse.

**Depends on:** Decision log core mechanic (Run 8 — validated).

**Effort:** Run 9 observation: XS. Trajectory tool if needed: S (CC: ~1h).

---

## [P3] Status Bar Decision Count During Extraction

**What:** Show active + open decision count in the Obsidian status bar during extraction: `"Extracting... (turn 3/8 — 2 active, 1 open)"`.

**Why:** Makes the decision log visible to the user. Provides live feedback that the agent is tracking something meaningful, not just processing text. Trust-building without cluttering the UI.

**How to apply:** In `main.ts`, thread `state.decisionLog` into the `onProgress` callback. In the status bar update: append ` — ${active} active, ${open} open` when either count > 0.

**Pros:** Surfaces the scratchpad to the user; builds confidence in the feature; ~30 minutes of implementation once the decision log is live.

**Cons:** Minimal — adds one string concatenation to the status bar update path.

**Context:** Cherry-picked from /plan-ceo-review session 2026-05-13 as a delight opportunity. Decision log core mechanic must ship and pass Run 8 first.

**Depends on:** Decision log core mechanic (Run 8 validation).

**Effort:** S (human: 1h / CC: ~10min).

---

## [P1 — ERUPT] Stub Generation Mechanism

**What:** The extraction pipeline must be able to create stub articles for topics that are clearly their own discrete concept but don't yet have enough transcript content for a full article. Currently the system has two states: full article or nothing.

**Why:** Without stubs the vault has a false closed-world appearance — topics the agent recognized as real and distinct simply don't appear. Two downstream costs: (1) future sessions can't find the topic via `search_vault` to expand it, producing either duplicates or re-drops; (2) the vault misleads the user about coverage gaps. Run 9 identified at least 7 missing stubs: `Linear Park Trail Program`, `Booking System`, `Dual-Use Cargo Design`, `Dynamic Consist` (standalone), `72-Hour All-Access Pass`, `Solar Beltway`, `Pan American Railway`.

**Design (settled):**

**Trigger: wikilink obligation.** If the agent writes `[[X]]` in any article, X must exist as at least a stub before the turn ends. The stub obligation is a consequence of the wikilink decision, not a separate judgment. This ties recognition to the moment it's live (per-turn) rather than reconstructing it post-extraction. Prompt rule: "For every `[[wikilink]]` you write to a concept that does not yet have an article, create a stub for it in the same turn using `write_magma` with `confidence: stub`."

**No pruning.** Stubs are always accurate even when redundant — a stub for a concept that's already fully covered by its parent article is still a correct description of that concept. The only cost of redundant stubs is future token overhead (reading more articles in contextSeed / refinement passes). That cost is acceptable. Keeping design simple: create aggressively, never auto-delete. User can manually merge or let future sessions promote stubs naturally as topics get more coverage.

**How to apply:**
1. Add the wikilink-obligation rule to `EXTRACTION_SYSTEM_PROMPT` in `src/extraction/prompt.ts`.
2. Use existing `write_magma` with `confidence: stub` — no new tool. Body: 1–2 sentence lead establishing what the concept is + Open Questions section with ≥1 question.
3. Relax the word-count validator for `confidence: stub`: 50-word floor instead of the 150-word provisional floor.

**Depends on:** `src/extraction/prompt.ts`, `src/extraction/tools.ts` (word floor relaxation).

**Effort:** XS–S (CC: ~20 min for prompt change + validator tweak).

---

## [P1 — ERUPT] Prompt Sprint: Rail QA Issue Fixes

**What:** Focused prompt editing session to address the quality failures identified in the Run 9 QA review.

**Issues to address (all prompt-level):**
- **American-first units.** Explicit rule: use the common American domain expression (`156 mph`, not `250 km/h (156 mph)`).
- **Hub completeness contract.** Required-sections rule for main hub articles: if governance or decision-making structure was discussed it must appear in the hub; if a major subsystem has its own child article it must be wikilinked and summarized in the hub; cross-system capabilities (e.g. Dynamic Consist) may not be silently dropped from the hub even if they have a standalone article.
- **Lead paragraph jurisdictional scope.** Rule: the lead paragraph must establish geographic or institutional scope if the topic is jurisdiction-specific.
- **Section placement rules.** Charging infrastructure → operational/infrastructure sections; product offerings (passes, pricing tiers) → pricing/ticketing sections or stubs; not "Vision and Strategy".
- **Folder naming convention.** Topic folders should use jurisdiction-aware specificity: "US Rail Infrastructure" not "Rail Infrastructure".
- **{{USER}} framing density.** Use `{{USER}}` when attributing a specific design choice; prefer article-register prose for system descriptions that are just describing how the system works.

**Validation:** Re-run EMPR (must still hit ≥5.5/7) + one rail-type run. Both must pass before quality gate attempt.

**Depends on:** `src/extraction/prompt.ts`. Critique callout placement design decision (`[P2 — ERUPT] Critique Callout Placement`) should be resolved before this sprint touches critique language.

**Effort:** S (CC: ~30 min for prompt edits + 2 validation runs ~$3–4 total).

---

## [P2 — ERUPT] Critique Callout Placement — Design Decision

**What:** Settle the canonical philosophy for `[!critique]` callout placement before the next prompt sprint touches critique-related language.

**The problem:** Run 9 produced `[!critique]` blocks gathered into a single section rather than placed inline. A gathered section is structurally a "Criticisms" section and should use regular bold-headed prose. The `[!critique]` callout format only adds value inline — annotating the specific claim being critiqued, immediately after it appears.

**Options:**
1. **Inline only.** `[!critique]` blocks appear immediately after the claim they annotate, within the section where the claim lives. No dedicated critique section.
2. **Compiled section with prose.** All critiques go in a "Limitations" or "Criticisms" section as regular bold-headed prose. Drop `[!critique]` callout syntax entirely for that section.
3. **Both by type.** Technical/engineering critiques inline (annotate specific claims); strategic/viability critiques compiled in a Limitations section.

**Why this gates the prompt sprint:** Any further `[!critique]` prompt tuning without settling placement will keep pulling in the wrong direction. The current prompt says "add critique callouts" without placement rules — that's why they lump.

**Depends on:** Founder decision.

**Effort:** XS (decision) + S (prompt update + validation run).

---

## [P2 — ERUPT] contextSeed Sliding Window for Multi-Arc Cost

**What:** Investigate and implement a sliding window or summary strategy for prior article content in the extraction contextSeed to reduce per-turn cost on multi-arc runs.

**Why:** Run 9 cost $2.43 for 21 pairs — 2× per-pair cost of Run 8 even accounting for transcript length. Leading hypothesis: on multi-arc runs, each turn arrives with all previously written articles in the contextSeed and this content grows monotonically. By turn 20 of a 10-arc run the agent has 10 partial or complete articles in context. A real Magazine-type run (30–60 turns, 15+ arcs) could cost $5–15.

**How to apply:**
1. **Instrument first.** Add per-turn contextSeed token logging to `loop.ts`. Run once to measure the growth curve.
2. **If accumulation confirmed:** articles written >N turns ago get a compressed summary (title + lead paragraph only) in the contextSeed; recent-turn articles keep full text.
3. **Validate:** Re-run EMPR and rail. Any new cross-article contradictions or missed wikilinks indicate the window is too aggressive.

**Note:** Distinct from `[POST-V1] Trim vaultTitles`, which addresses vault-wide file listing bloat. This addresses prior-article body content accumulation.

**Depends on:** Instrumentation run to confirm hypothesis.

**Effort:** S (instrument: ~30 min; sliding window: ~1h; validation: 2 runs).

---

## [P2 — ERUPT] writeArticleDecisionLogs — Empty File for Zero-Decision Articles

**What:** `writeArticleDecisionLogs()` currently skips articles with zero decisions — no file is written and no `[[_decisions/...]]` wikilink is appended to the article body. Run 9's Ridgeliner article demonstrates the result: article ends with a block anchor instead of the standard footer.

**Recommendation:** Write an empty decisions file for every article. Every article gets `_decisions/<Article>.decisions.md` with the standard header and empty Active/Open/Retired sections. The `[[_decisions/...]]` wikilink should be a structural footer present on all articles — its absence signals "we forgot" not "no decisions".

**Depends on:** `src/extraction/tools.ts` (`writeArticleDecisionLogs`).

**Effort:** XS (CC: ~10 min).

---

## [P2 — ERUPT] Multi-Session Decision Log Conflict Detection

**What:** When a new extraction session runs on a transcript that overlaps with a topic already in the vault, detect and surface conflicts between the new session's decision log entries and existing entries in `_decisions/<Article>.decisions.md`.

**Why:** Decision log entries from session 1 can be contradicted by session 3 without reconciliation when sessions run non-sequentially. The vault would hold two canonical decisions that contradict each other with no signal to the user. Users can't always run sessions in chronological order.

**How to apply:**
- At extraction start, read existing `_decisions/*.decisions.md` for articles the current session will touch.
- After extraction, compare new Active decisions against existing Active decisions on the same article. If a decision key conflicts or two Active decisions semantically contradict, surface a conflict modal with three resolution options: keep new, keep old, merge manually.

**Note:** v2 architectural problem, not a prompt fix. Design the interface now; implement when closed beta confirms multi-session conflict frequency.

**Depends on:** Closed beta data confirming actual conflict frequency. Do not implement before measuring.

**Effort:** M (design: ~1h; implementation: ~3h).

---

## [P3 — ERUPT] Open Questions Answer Slots → Decision Log Integration

**What:** Change Open Questions entries to a callout format with an answer slot. A background Erupt pass detects when a question is answered in a later session and promotes the entry to the decision log as a resolved item.

**Example format:**
```
> [!question] Will {{USER}} accept the 1–3° pitch authority trade-off?
> **Answer:** *(unresolved)*
```

When the answer field is filled (manually by the user or by a future extraction pass that detects resolution), Erupt converts the entry to a resolved decision log entry and removes the Open Question from the article.

**Why:** Closes the feedback loop between Open Questions and the decision log. A question answered in session 3 currently has no mechanism to update the session-1 article that asked it, creating growing drift between article state and conversation state.

**Depends on:** Decision log core mechanic (shipped). Requires design for how Erupt detects that a question has been answered in a later session.

**Effort:** M (design first: ~1h; implementation: ~2h).

---

## [P3 — ERUPT] Post-Vault Refinement Pass

**What:** A lightweight second pass after extraction that improves article linking (missing wikilinks between related articles), adds external citations for unexplained domain terms of art, and polishes prose quality ({{USER}} framing density, section flow).

**Why:** Extraction optimizes for completeness and accuracy. Refinement optimizes for readability and navigation. Separating the goals lets each pass do its job without distraction.

**Implementation options:**
- **Cloud (Haiku 4.5 via proxy):** Low cost ($0.01–0.05/article), works on any plan.
- **Local (Ollama):** Scalable on capable hardware; degrades on low-spec machines.
- **Fold into existing structural pass:** Lower quality ceiling; no additional cost.

**Note:** v1.5+ feature. Do not implement before the main extraction pass produces clean, complete articles. A refinement pass on structurally incomplete source articles adds noise, not quality.

**Depends on:** v1 extraction quality validated and vault generation running. Business model decision (determines proxy vs. local path).

**Effort:** S–M depending on implementation path.
