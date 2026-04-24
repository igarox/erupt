# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the Erupt workspace — an Obsidian plugin by Slipstream that extracts structured notes from conversations using Claude AI.

## Repo structure

This is `erupt/` — git submodule of `igarox/slipstream-workspace` (workspace branch: `master`).
Repo: `igarox/erupt`, branch `main`. Registered as submodule 2026-04-22.

**When to commit:**
- Code changes → commit in `erupt/` (on `main`)
- Then bump the submodule pointer in the workspace with a follow-up commit on `master`

**Rules:**
- Default branch is `main` in erupt (workspace uses `master`)
- Commit submodule first, workspace pointer bump second — never the reverse

## Product Vision & Strategy — Canonical Source of Truth

The folder `Slipstream Products and Planning/` at the workspace root is the **authoritative source of intent** for the entire Slipstream ecosystem. It contains product documents, brand direction, and the founding strategy document for every Slipstream product.

**Rules:**
- Always read relevant documents from this folder before making any product, design, architecture, or business model decision.
- Nothing deviates from these documents without express consent from the founder.
- When design intent is unclear, these documents supersede all other sources.
- Consult `Strategy and Data Architecture (Slipstream).txt` for overall strategic context, legal posture, and launch sequencing.

## Design System

Always read DESIGN.md before making any visual or UI decisions.
All design tokens, color variables, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

Note: Erupt's design system is Obsidian-native (CSS variables, plugin API constraints).
It is distinct from Bleeper's design system (`bleeper/DESIGN.md`). See DESIGN.md for Erupt-specific tokens.

## Architecture

Erupt is an Obsidian plugin (TypeScript, Obsidian Plugin API).

**Entry points:**
- `main.ts` — plugin entry point (`Plugin` subclass)
- `manifest.json` — Obsidian plugin manifest (`"isDesktopOnly": true`)
- Settings stored via `Plugin.loadData()` / `Plugin.saveData()`

**Build toolchain:** esbuild (standard Obsidian plugin toolchain)

**Plan tiers:**
- **Free:** 3 lifetime extraction jobs. Routes through Slipstream proxy (`api.slipstream.app/proxy/claude`). Requires Slipstream account (JWT). No API key required.
- **Local ($5/mo):** Ollama at `http://localhost:11434`. No proxy, no account. Agentic pipeline for tool-use models; 3-pass fallback for non-tool-use models (Phi3 etc.).
- **Cloud ($15-20/mo):** Unlimited. Routes through Slipstream proxy. Requires Slipstream account (JWT). Haiku 4.5 default + Sonnet boost toggle.

**Core user flow:**
1. User opens a conversation (ChatGPT, Claude, Gemini) and runs "Erupt: Extract Notes"
2. Plugin reads the active note's conversation content
3. Sends to Claude (via BYOK or proxy) with extraction prompt
4. Streams structured notes back into the active note (or a linked note)

**Key architectural decisions to respect:**
- `mobile: false` in manifest — desktop only
- Session picker modal required when "Update Notes" fires on an unlinked note
- Status bar item shows extraction progress (`aria-live="polite"`)
- Auth flow uses Obsidian deep-link: `obsidian://erupt/auth?token=<jwt>`

## Commands

[PLACEHOLDER — fill in once scaffolding begins]

```bash
# Install dependencies
npm install

# Development build (watch)
npm run dev

# Production build
npm run build
```

## Environment Variables / Settings

Settings stored in Obsidian's plugin data (not env vars):

| Setting | Type | Purpose |
|---|---|---|
| `plan` | `'free' \| 'local' \| 'cloud'` | Active plan tier |
| `authToken` | string | JWT (Free and Cloud plans — proxy auth) |
| `ollamaBaseUrl` | string | Ollama URL (Local plan, default `http://localhost:11434`) |
| `ollamaModel` | string | Active Ollama model name (Local plan) |
| `suppressedCompatibilityNotice` | `string[]` | Model names for which the 3-pass fallback notice is suppressed |

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours` — structured thinking session
- `/plan-ceo-review` — CEO-level plan review
- `/plan-eng-review` — engineering plan review
- `/plan-design-review` — design plan review
- `/design-consultation` — design feedback session
- `/review` — code review
- `/ship` — ship a change end-to-end
- `/land-and-deploy` — land and deploy a change
- `/canary` — canary deployment
- `/benchmark` — run benchmarks
- `/browse` — web browsing (use this for all web browsing)
- `/qa` — QA testing
- `/qa-only` — QA only (no code changes)
- `/design-review` — design review
- `/setup-browser-cookies` — set up browser cookies
- `/setup-deploy` — set up deployment
- `/retro` — retrospective
- `/investigate` — investigate an issue
- `/document-release` — document a release
- `/codex` — codex agent
- `/cso` — CSO review
- `/careful` — careful mode
- `/freeze` — freeze deployments
- `/guard` — guard mode
- `/unfreeze` — unfreeze deployments
- `/gstack-upgrade` — upgrade gstack

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

This project vendors gstack at `.claude/skills/gstack/` for portability. Install or rebuild:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git .claude/skills/gstack
cd .claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use .claude/skills/gstack/... for gstack file paths.

## Output preferences

Do not state the current git branch in conversational output or AskUserQuestion re-grounding. Branch context is only relevant when performing git operations directly.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the plugin, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
