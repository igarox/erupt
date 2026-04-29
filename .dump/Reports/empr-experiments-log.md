# EMPR Extraction Experiments Log

Transcript: `Claude-Magnetic pitch control rotor without swashplate.md`
Turns: 8 (4 prompt/response pairs)
Location of snapshots: `Obsidian Vault/.snapshots/.magma/wiki/` (Run 1)

Success criteria (per design doc `Base MC-main-design-20260428-180417.md`):
1. Article count: 5–7
2. Turn-1 critique verbatim + `> [!critique]` marker + 4 concerns named
3. {{USER}} placeholder consistently in body (never titles/filenames/wikilinks)
4. No patent-novelty redundancy (≤2 articles on that conclusion)
5. Citation hygiene: originating/finalizing turns cited; multi-turn citations where warranted
6. MagmaWiki features: wikilinks present + Open Questions populated (≥2 decisions)
7. Cost: ≤$0.45 target; >$0.55 = regression blocker

Ship gate: 5/7. One iteration allowed if 4/7. Surface to founder if ≤3/7.

---

## Run 1 — ~2026-04-27 — Baseline (old prompt)

**Prompt version:** Pre-v1 (commit before `2a1b37b`)
**Articles produced:** 21
**Cost:** ~$0.64

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ❌ | 21 articles |
| 2 | Critique verbatim + marker | ❌ | Turn-1 critique entirely lost |
| 3 | {{USER}} placeholder | ❌ | No placeholder concept existed |
| 4 | No redundancy | ❌ | 12 articles for one patent-novelty conclusion |
| 5 | Citation hygiene | ⚠️ | Citations present but no multi-turn format |
| 6 | Wikilinks + Open Questions | ❌ | Neither present |
| 7 | Cost ≤$0.45 | ❌ | $0.64 |

**Total: 0/7** (⚠️ = 0.5 → effectively 0.5/7)

### Key failures
- Agent used "make a new filename" recovery on file collision at turn 3 (log error) instead of merging
- 6 MagmaWiki spec features absent from prompt entirely
- Voice: neutral third-person encyclopedia paraphrase throughout
- Turn-1 adversarial critique was the most valuable content and was the most completely lost

---

## Run 2 — 2026-04-28 — v1 Prompt Rewrite

**Prompt version:** `2a1b37b` (13-item rewrite: voice/{{USER}}, shape/consolidation, fidelity, MagmaWiki spec)
**Articles produced:** 2
**Cost:** $0.50

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ⚠️ | 2 articles — under range but correct direction |
| 2 | Critique verbatim + marker | ⚠️ | Content verbatim ✅; `[!critique]` callout absent ❌ |
| 3 | {{USER}} placeholder | ❌ | Zero tokens in either article |
| 4 | No redundancy | ✅ | Novelty consolidated to one section; no duplicate articles |
| 5 | Citation hygiene | ✅ | Turn citations correct; multi-turn format not triggered |
| 6 | Wikilinks + Open Questions | ⚠️ | Wikilink present ✅; Open Questions absent ❌ |
| 7 | Cost ≤$0.45 | ⚠️ | $0.50 — over target, under blocker ($0.55) |

**Total: ~2.5/7** (below 4/7 iterate threshold)

### Key wins
- Consolidation fully fixed: 21 → 2 articles, zero redundancy
- Critique content preserved verbatim (just missing the callout format)
- Wikilinks present and correct between articles
- `add_clarifying_question` fired correctly on MagLev Aero patent ambiguity
- Article structure, section organization, and prose quality significantly improved
- `search_magma` → `read_magma` → `write_magma` workflow followed

### Key failures
1. **{{USER}} token: zero.** Items 1–3 completely ignored. Agent wrote neutral third-person throughout. Root cause: agent doesn't know it's processing the user's own invention (intent problem, see TODOS `[P1] Extraction Agent Has No Awareness of Conversation Purpose`).
2. **`[!critique]` callout: absent.** Critique content preserved but not formatted as callout block. Instruction describes format; inline example needed.
3. **Open Questions: absent.** Item 12 produced nothing in either article despite clear open decisions in transcript (yaw mechanism, patent timing, phase-1 commitment).
4. **`source_note`: absent.** Item 14 frontmatter field not populated.
5. **Article count 2 vs. 5–7.** Consolidation instruction may be too aggressive, OR turns 4–7 (patent/novelty) were correctly folded into the main article's "Novelty" section (which would be correct behavior). Boundary unclear.
6. **Blade morphing article.** Created as `confidence: provisional` for what was a speculative exploratory exchange (turn 3). Should have been `confidence: stub` or triggered a clarifying question. Root cause: same intent problem — agent can't distinguish committed work from exploratory tangents without knowing whose project this is.
7. **Path typo:** `electromagnag` instead of `electromagnet` in the article path slug.

### Cost analysis
Bigger prompt + forced `search_magma` per potential article added overhead that partially offset output-volume savings. Main article is very long (~100 lines) produced in likely 30+ tool call rounds. `search_magma` scoping rule needs adjustment: require before creating a NEW article, not before every section addition to an existing one.

### Planned fixes for Run 3
- Intent injection: "This conversation belongs to {{USER}} — their own ideas and projects"
- {{USER}} instruction: move to very top, absolute rule, negative example of failure mode
- `[!critique]` callout: add complete formatted inline example in prompt
- Open Questions: make mandatory ("every article MUST end with this section")
- `source_note`: add to compliance pass as required field check
- `search_magma` scope: before creating new articles only, not before every write
- Wikilink first-mention rule: add explicit rule
- Display text aliases: sparingly (acronyms and deep-identity words only)
- Filename convention: Title Case with spaces for readability in Obsidian UI

---

## Run 3 — 2026-04-28 — Intent injection + formatting fixes

**Prompt version:** `393ca77` (9-item prompt fixes: {{USER}} elevated + negative example, per-turn intent assessment, [!critique] inline example, Open Questions mandatory, source_note compliance, search_magma scoped to new-article only, wikilink first-mention rule, alias sparingly rule, Title Case filenames)
**Articles produced:** 3
**Cost:** $0.48

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ⚠️ | 3 articles — improving (2→3) but still under range |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ⚠️ | 5 concerns named in Limitations section ✅; `[!critique]` callout block absent ❌ |
| 3 | {{USER}} placeholder | ✅ | Fixed. All 3 articles use it consistently throughout body text |
| 4 | No patent-novelty redundancy | ✅ | Single Novelty Assessment article; zero duplication |
| 5 | Citation hygiene | ✅ | All turns cited; multi-turn citations (turns 4, 5, 6, 7) in Novelty article |
| 6 | Wikilinks + Open Questions | ✅ | Fixed. Wikilinks in child articles; ≥5 Open Questions per article |
| 7 | Cost ≤$0.45 | ⚠️ | $0.48 — over target, under $0.55 blocker |

**Total: ~5.5/7** (4 full passes + 3 half passes × 0.5). Ship gate: 5/7. **PASSES.**

### Key wins
- **{{USER}} token: fully fixed.** All 3 articles consistently use `{{USER}}` in body text. Primary Run 2 failure resolved.
- **Open Questions: fully fixed.** All 3 articles end with ## Open Questions section, 5–6 items each. Second major Run 2 failure resolved.
- **Title Case filenames:** Paths are now `rotors/ElectroMag Pitch Rotor`, `rotors/EMPR Blade Morphing`, `rotors/EMPR Novelty Assessment` — clean Obsidian display.
- **source_note:** Present in all 3 articles (`source_note: Swashplate-less Rotor Ideation.md`). Fixed.
- **Citation hygiene:** Originating turns cited per paragraph; Novelty article uses multi-turn compound citations correctly (turns 4, 5, 6, 7).
- **No redundancy:** Patent novelty correctly consolidated into one article.

### Remaining failures
1. **`[!critique]` callout: still absent.** Model converts Turn-1 critique into a "Limitations and Open Challenges" prose section (5 concerns named correctly) but does not format as `> [!critique]` callout block despite inline example in prompt. The prompt example shows the callout format; model apparently doesn't apply it when reformatting into a section header.
2. **Article count still under range (3 vs. 5–7).** Consolidation instruction is still too aggressive. Both EMPR Blade Morphing (~70 lines) and EMPR Novelty Assessment (~125 lines) are large enough to be 2 articles each. Turn 4–7 patent research was correctly consolidated (not spread to 12 articles as in Run 1), but the morphing exploration (turn 2) should probably yield 2 articles (e.g., "EMPR Blade Morphing Overview" + "EMPR Higher Harmonic Control").
3. **Cost $0.48 vs. $0.45 target.** Small miss; 3 articles vs. 2 in Run 2 adds one article's worth of write overhead. May need to revisit once article count is corrected.
4. **EMPR Blade Morphing: wrong article, wrong confidence.** Turn 2 is {{USER}} speculating about future extensions ("what if the stator could also control blade shape?") — exploratory tangent, not committed work. The per-turn intent step was supposed to catch the distinction between core invention (provisional/settled) and speculative exploration (stub or no article). It did not: Blade Morphing was created as `confidence: provisional` again, identical to Run 2. Root cause: the intent step identifies the broad category ("developing/inventing") but has no mechanism to distinguish within a session between committed work and exploratory tangents. Fix requires a within-turn sub-classification: "is this turn developing a committed direction, or is {{USER}} speculating about possibilities?" Speculative tangents should produce `stub`-confidence articles or, if very early-stage, trigger a clarifying question before writing.

### Path forward (next sprint)
- **`[!critique]` fix:** The prompt now has an inline example but the model is routing the critique content into a section instead of a callout. The consolidation of critique into "Limitations" section is probably reasonable behavior — the fix may need to require the callout in ADDITION to the section, not instead of it. Or add "this section must open with a `[!critique]` callout before the prose".
- **Article count fix:** Add a minimum article count expectation: "A conversation spanning multiple major topics should yield one article per major topic, with sub-topics becoming sections within an article rather than separate articles. As a rough guide, 4 user turns should yield 4–6 articles." Currently the per-turn intent step correctly detects topics but consolidation instruction is overriding it.
- **Committed vs. speculative sub-classification:** The per-turn intent step needs a second axis: committed ("{{USER}} is building/has built this") vs. speculative ("{{USER}} is exploring what might be possible"). Speculative turns → `stub` confidence maximum. Explicit language signals: "what if", "could we also", "in the future", "imagine if" → speculative. "I designed", "I tested", "the system does" → committed. This is the underlying fix for the blade morphing misclassification.

---

## Run 4 — 2026-04-28 — MagmaWiki Style Guide added (Phase 3)

**Prompt version:** `615e183` (Phase 3: MagmaWiki Style Guide section — article granularity rules, speculative tangent rule, parent/child split pattern, N–2N article count calibration, stub discipline, heading levels)
**Articles produced:** 3
**Cost:** $0.62

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ⚠️ | 3 articles — unchanged from Run 3 |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ✅ | **Fixed.** 5 named `[!critique]` callout blocks, verbatim content, turn references, descriptive headers |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout all 3 articles |
| 4 | No patent-novelty redundancy | ✅ | Single novelty article |
| 5 | Citation hygiene | ✅ | All turns cited; multi-turn citations correct |
| 6 | Wikilinks + Open Questions | ✅ | Both present in all articles |
| 7 | Cost ≤$0.45 | ❌ | **$0.62 — above $0.55 blocker. HARD FAIL.** |

**Total: ~5.5/7, BLOCKED on cost ($0.62 > $0.55 blocker).**

### Key wins
- **[!critique] fully fixed.** After 3 failed runs, critique callout blocks are now properly generated — 5 distinct named critiques, verbatim content, `— Turn 1` references, correct `> [!critique]` format. The inline example in the prompt finally worked.
- **{{USER}}, Open Questions, source_note, wikilinks, citation hygiene:** All maintained from Run 3.

### Failures
1. **Cost blocker: $0.62.** Two compounding causes: (a) Style Guide added ~54 lines to the system prompt, increasing input tokens every turn; (b) fixing `[!critique]` substantially increased output — 5 critique blocks × ~8 lines each = ~40 extra output lines not present in Run 3. Fixing criterion 2 caused criterion 7 to regress from ⚠️ to ❌.
2. **Blade morphing: still surfaces as standalone provisional article.** The speculative-tangent language-signal rule (Phase 3) did not fire. Root cause: Turn 2 in the EMPR transcript is NOT speculative language — the user describes morphing in declarative, inventing terms with specific architectures and numbers. The model correctly classifies this turn as `developing/inventing`. The "what if / imagine if" language signals don't match. The real issue: extensions to a session's primary invention discussed in the same conversation should be sections of the primary article, not standalone articles, unless the user explicitly frames them as an independent build track.
3. **Article count: still 3.** The N–2N calibration rule was not effective — blade morphing persisting as a standalone article prevents the count from rising, and the consolidation instruction still keeps all patent discussion in one article.
4. **Title regression: "Electromagnetically Pitch Rotor EMPR".** Should be "ElectroMag Pitch Rotor (EMPR)" (canonical from the transcript). Title drifted between runs despite no prompt change targeting the title. The model is generating its own paraphrase of the title rather than using the transcript's name.

### Path forward (Run 5)
- **Cost reduction:** Blade morphing becoming a section saves ~100 lines of output. Trimming the Style Guide section (which is now overfitting at ~54 lines) may recover some input token overhead. Target: get back under $0.50.
- **Primary-invention extension rule:** Replace the speculative-tangent language-signal approach with a structural rule: "When the conversation has a single primary invention as its subject (identifiable from turn 0), sub-topics in subsequent turns that extend or elaborate on that invention belong in the primary article as sections, not as standalone articles. A standalone article for a sub-topic is only warranted if the user explicitly names it as an independent development track or if it could have a lifecycle independent of the parent invention."
- **Title anchoring:** Either add a rule requiring the agent to use the exact terminology from the first turn where a concept is named, or add title drift to the compliance pass checks.
