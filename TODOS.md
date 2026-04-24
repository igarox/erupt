# TODOS — Erupt

Added by /plan-design-review on 2026-04-22. These gate v1 development.
Canonical location: erupt/TODOS.md (extracted from workspace TODOS.md 2026-04-22).

Items marked **[BLOCKER — ERUPT]** must be resolved before development starts.
Items marked **[PRE-LAUNCH — ERUPT]** must be resolved before Obsidian Community Plugins submission.

---

## [BLOCKER — ERUPT] Build Slipstream API Proxy Backend

**What:** `api.slipstream.app/proxy/claude` — required for both Free tier (server-side job counter enforcement) and Cloud plan (proxy extraction). Plugin routes by plan tier: Free / Cloud → proxy (JWT bearer auth), Local → Ollama at `http://localhost:11434`.

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

**What:** Free and Cloud plan users authenticate with a Slipstream account. The plugin opens a browser auth flow (`auth.slipstream.app`), user signs in, JWT returned and stored via `Plugin.saveData()`.

**Why:** Both Free and Cloud tiers route through the proxy. The proxy validates JWT to enforce the Free tier job counter and Cloud plan entitlement. Local plan users do NOT need an account.

**JWT payload:** `{ plan: 'free'|'local'|'cloud', valid_until: ISO8601, user_id }`

**How to apply:** Implement OAuth or email/password auth at `auth.slipstream.app`. After successful auth, redirect to Obsidian deep-link (`obsidian://erupt/auth?token=<jwt>`). Plugin receives JWT, validates expiry on load + before each API call, stores securely via `Plugin.saveData()`.

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

## [P1 — ERUPT] Pull Wikipedia Editorial Rules for MagmaWiki Prompt Construction

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

## [P1 — ERUPT] Block Parser Test Suite

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
