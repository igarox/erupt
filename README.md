# Erupt

Obsidian plugin by [Slipstream](https://slipstream.now). Extracts structured knowledge from AI conversation transcripts into a living wiki inside your vault.

Paste a conversation. Run **Erupt: Extract Notes**. Erupt reads the transcript, writes clean Markdown articles to `.magma/wiki/`, and keeps them consistent across future extractions.

---

## Requirements

- Obsidian 1.5.0+ (desktop only)
- An Anthropic API key **or** a Slipstream account (Free/Cloud plans — see below)

---

## Installation

Erupt is not yet in the Community Plugins directory. Install manually:

1. **Build**
   ```bash
   npm install
   npm run build
   ```

2. **Copy files to your vault**

   Create `.obsidian/plugins/erupt/` inside your vault and copy in:
   - `main.js`
   - `manifest.json`
   - `styles.css`

3. **Enable the plugin**

   Obsidian → Settings → Community plugins → toggle **Erupt** on.

---

## Setup

### BYOK (Bring Your Own Key) — works today

Add your Anthropic API key to the plugin's data file. Open `.obsidian/plugins/erupt/data.json` (created on first load) and set:

```json
{
  "byokApiKey": "sk-ant-..."
}
```

Restart Obsidian. BYOK uses `claude-haiku-4-5` by default. No Slipstream account needed.

### Free / Cloud plans — coming soon

Free and Cloud plans route through the Slipstream proxy and require a Slipstream account. The backend is not yet live. Leave `byokApiKey` set for now.

### Local plan (Ollama)

1. Install and start [Ollama](https://ollama.com)
2. In Obsidian → Settings → Erupt, set **Plan** to **Local** and enter your model name (e.g. `llama3.2`)
3. Models with tool-call support run the full agentic pipeline. Others fall back to a 3-pass extraction mode with a quality notice.

---

## Usage

1. Open a note containing a pasted AI conversation
2. Run **Erupt: Extract Notes** from the command palette (`Ctrl+P`)
3. Watch the status bar — it shows turn progress and a shimmer on the "Erupt" word while working
4. When done, a completion modal summarises what was written
5. Run **Erupt: Open Magma Explorer** to browse `.magma/wiki/` in the left sidebar

### Supported transcript formats

**JSON per line** (Claude, ChatGPT exports):
```
{"role":"user","content":"How does JWT signing work?"}
{"role":"assistant","content":"JWT signing uses..."}
```

**Markdown headings**:
```markdown
## Human
How does JWT signing work?

## Assistant
JWT signing uses...
```

**Plain text** — the entire note is treated as a single turn (short pastes).

---

## Output

Articles are written to `.magma/wiki/` with YAML frontmatter:

```markdown
---
path: auth/jwt-signing
title: JWT Signing
confidence: provisional
citations: [4, 7, 12]
---

JWT signing uses RS256 or HS256 to produce a tamper-evident token. (turn 4)
```

- `confidence: provisional` — substantive discussion found in transcript
- `confidence: stub` — topic mentioned but not developed
- `(turn N)` inline citations — traceable back to source turn

The extraction log lives at `.magma/extraction_log.jsonl`.

---

## Development

```bash
npm install       # install dependencies
npm run dev       # watch mode — rebuilds main.js on save
npm run build     # type-check + production bundle
```

After each build, reload the plugin in Obsidian: command palette → **Reload app without saving**.
