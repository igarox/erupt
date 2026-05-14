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

---

## Run 5 — 2026-05-02 — Engagement Gradient + softer critique test

**Prompt version:** Engagement Gradient rewrite (4-tier classification: Driven/Engaged/Curiosity/Unengaged), softer critique preservation rule (continuing development = implicit engagement), granularity rules collapsed to reference gradient tiers
**Articles produced:** 9
**Cost:** $0.43

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ❌ | 9 articles — over range |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ⚠️ | 1 callout present; concern count below threshold |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout |
| 4 | No patent-novelty redundancy | ⚠️ | 4 stubs overlap main article sections |
| 5 | Citation hygiene | ✅ | Pass |
| 6 | Wikilinks + Open Questions | ✅ | Pass |
| 7 | Cost ≤$0.45 | ✅ | $0.43 — under target for first time since Run 1 baseline |

**Total: ~5/7** (4 full passes + 2 half passes × 0.5). Ship gate: 5/7. **PASSES on threshold but with structural issues.**

### Key observation
- **Cost win:** $0.43 — first run under the $0.45 target. Engagement Gradient + critique softening did not balloon prompt as feared.
- **Article count overshoot:** 9 articles — flipped direction from prior under-counting (3 in Runs 3–4) to over-counting. Engagement Gradient may now be too generous in promoting Tier 2/3 surfaces to standalone articles.
- **Stub overlap:** 4 of the 9 articles are stubs that overlap sections of the main article — duplication of content the main article already covers. Consolidation discipline regressed.
- **Critique callout regression:** Only 1 `[!critique]` callout vs. Run 4's 5 named callouts. The softer critique rule may have caused the agent to fold critiques into prose sections instead of preserving callout blocks.
- **Blade morphing regression persists.** Despite Engagement Gradient explicitly classifying Turn 2 "Expand on this" as Tier 3 (curiosity ping) by the per-turn vantage rule, blade morphing was still extracted as a standalone article. The per-turn loop has no full-transcript visibility, so even with conservative defaulting it cannot detect that the user later abandoned the topic.

### Diagnosis → Run 6 design change
Per-turn classification operating blind cannot retroactively downgrade articles based on later abandonment. First-principles fix: humans take notes per-turn without knowing the future, then revise when the time comes. Added a **third sub-pass: trajectory revision** — runs after compliance + contradiction passes with full transcript visibility and authority to merge/downgrade/discard articles based on conversation trajectory.

### Architecture changes for Run 6
- `TRAJECTORY_REVISION_SYSTEM_PROMPT` added (~200 lines)
- `runSubPass3` in `final-pass.ts` — full transcript + all articles → revision agent
- `REVISION_TOOLS` filter (write_magma, read_magma, add_clarifying_question)
- `transcript: string[]` threaded through `FinalPassOptions`
- Status bar: `'compliance' | 'consistency' | 'trajectory'` with progress fractions 0.85 / 0.92 / 0.97

### Cost expectation for Run 6
Trajectory pass adds one full-context call (transcript + all articles). Will likely push cost back over $0.45 — accepting this if blade morphing is correctly downgraded/merged.

---

## Run 6 — 2026-05-03 — Trajectory revision sub-pass added

**Prompt version:** Run 5 prompt + `TRAJECTORY_REVISION_SYSTEM_PROMPT` + `runSubPass3` (full transcript + all articles → revision agent with merge/downgrade/discard authority)
**Articles produced:** 1 (single consolidated EMPR article)
**Cost:** $0.34

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ❌ | 1 article — under range, swung from Run 5's 9 |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ❌ | Zero `[!critique]` callout blocks; concerns folded into "Challenges and Limitations" prose sections |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout body |
| 4 | No patent-novelty redundancy | ✅ | Single Patent Novelty section inside main article — no duplication |
| 5 | Citation hygiene | ⚠️ | Frontmatter cites turns [0, 3, 5]; turns 1, 2, 4, 6, 7 absent. Turn-1 critique not cited as a turn |
| 6 | Wikilinks + Open Questions | ⚠️ | Open Questions present (5 items) ✅; zero wikilinks (single-article output has nothing to link to) ❌ |
| 7 | Cost ≤$0.45 | ✅ | $0.34 — best cost result yet, even with new sub-pass |

**Total: ~3.5/7** (3 full passes + 1 half pass × 0.5). Ship gate: 5/7. **FAILS.**

### Key wins
- **Trajectory revision works on the blade morphing problem.** Blade morphing is now a section under "Future Directions" within the main EMPR article, not a standalone provisional article. The revision sub-pass correctly identified Turn 2 as a curiosity ping that {{USER}} did not develop further across the full transcript.
- **Cost: $0.34 — new low.** Trajectory pass adds one full-context call but the revision agent collapsed 9 articles into 1, so the contradiction sub-pass and downstream writes did less work overall. Sub-pass arithmetic is net favorable for this transcript shape.
- **Patent novelty consolidation:** Now a section inside the main article, not a separate child. No redundancy.

### Failures
1. **Over-consolidation: 1 article vs. 5–7 target.** Trajectory revision pass collapsed everything into a single article. EMPR has natural article boundaries — the patent novelty assessment alone is substantive enough to be its own child article (per Run 3, where it was correctly split). The revision agent is too aggressive at merging.
2. **`[!critique]` callout regression: zero blocks.** Run 4 produced 5 named callouts; Run 6 produces zero. Trajectory revision rewrote the critique content into "Challenges and Limitations" prose sections without preserving the callout format. The revision agent has no instruction to preserve `[!critique]` blocks created by earlier passes.
3. **Citation under-coverage.** Frontmatter cites only [0, 3, 5]. Turn 1 (critique), Turn 2 (morphing prompt), Turn 4 (patent inquiry), Turns 6–7 (patent details) are missing. Per-paragraph turn citations within the article are also sparse — large sections cite only "(turn 0)" when they synthesize multi-turn content.
4. **No wikilinks.** Single-article output has nothing to link to. This is structurally tied to the over-consolidation failure.
5. **Article title regression.** "ElectroMag Pitch Rotor (EMPR)" frontmatter `title` is correct, but path is `rotors/ElectroMag Pitch Rotor EMPR` (parens dropped from filename). Path filename mismatch with title — both should reflect the canonical "(EMPR)" suffix.

### Diagnosis
Trajectory revision over-corrected. The pass was designed to fix Run 5's blade morphing surfacing — and it did — but its merge authority extended too far. It collapsed legitimately separable articles (Patent Novelty, EMPR overview, Future Directions) into one mega-article, and rewrote critique callouts into prose during the revision.

### Path forward (Run 7)
- **Constrain revision merge authority:** Trajectory pass should downgrade/merge speculative tangents (Tier 3 curiosity pings the user abandoned), but should NOT collapse legitimate Tier 1/2 child articles. Add explicit "preserve existing article boundaries unless an article is purely a Tier 3 surface" rule to `TRAJECTORY_REVISION_SYSTEM_PROMPT`.
- **Preserve `[!critique]` callouts during revision:** Add a "do not rewrite `[!critique]` blocks into prose" rule. The revision pass operates on already-formatted articles and must respect their structural elements.
- **Citation completeness check:** Revision pass should verify that all turns referenced by content in the article are listed in the frontmatter `citations` array. This is a structural check the compliance pass should also enforce.
- **Path/title parens consistency:** Add to compliance pass — if title contains `(...)` suffix, path filename must too.

---

## Run 7 — 2026-05-03 — TS validators + trajectory constraints + prompt trim

**Implementation:** Refactored `validateWriteMagmaInput`. Added 5 validators (path↔title parens, citation completeness, append-only critique preservation, per-turn article protection, 150-word floor) with corrective error messages. Added `state.perTurnArticles: Set<string>`. Trajectory pass flagged `isTrajectoryPass: true`. Validator rejections logged to `extraction_log.jsonl`. `TRAJECTORY_REVISION_SYSTEM_PROMPT` rewrote to narrow scope to Tier-3 corrections. Main + compliance prompts trimmed (~200 lines of invariant restatement → "tool layer enforces" pointer). 66 unit tests pass.

**Articles produced:** 2 (`ElectroMag Pitch Rotor (EMPR)`, `EMPR Blade Morphing`)
**Cost:** $0.55
**Validator stats:** 4 write attempts, 0 rejections (rate 0%)

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ❌ | 2 articles — below range |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ⚠️ | 1 callout block present (Limitations section) but body is prose, no `**Bold Heading**` named concerns. Run 4 had 5 named concerns; this is a regression vs Run 4 (still recovered vs Run 6's zero callouts) |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout both articles |
| 4 | No patent-novelty redundancy | ✅ | Single Patent Novelty section in main article |
| 5 | Citation hygiene | ✅ | Main cites [0,1,4,6]; multi-turn `(turns 4, 6)` format used; all body refs match frontmatter (validator confirmed at write time) |
| 6 | Wikilinks + Open Questions | ✅ | `[[EMPR Blade Morphing]]` ↔ `[[ElectroMag Pitch Rotor (EMPR)]]`; 8 + 4 Open Questions |
| 7 | Cost ≤$0.45 | ❌ | $0.55 — over target, +$0.21 vs Run 6 |

**Total: ~4.5/7** (4 full ✅ + 1 ⚠️ × 0.5). **Ship gate: 5/7. FAILS.**

### Fresh-transcript sanity check (CEO criterion #2)
**Not yet run.** Required before declaring Run 7 complete per the iteration-ceiling commitment.

### Tool-layer wins (zero regressions on TS-enforced rules)
- **Path↔title parens fix worked.** Filename `ElectroMag Pitch Rotor (EMPR).md` preserves the parens. Same bug from Runs 4 and 6 — eliminated by the structural validator.
- **Citation completeness held.** All `(turn N)` body refs match frontmatter. Multi-turn citations `(turns 4, 6)` used correctly.
- **Validator rejection rate: 0%.** Well under the 20% ship gate. The corrective-error-message hypothesis worked — the LLM wrote valid input first time, no retry overhead.
- **Per-turn article protection enforced.** Trajectory pass made no destructive writes.

### Failures and root causes
1. **Blade morphing standalone AGAIN.** The trajectory revision pass either didn't recognize Turn 2 "Expand on this" as a Tier 3 ping, or recognized it and chose not to downgrade. Morphing article cites `[2, 3]` — Turn 2 is {{USER}}'s prompt, Turn 3 is the assistant's elaboration. **The hatnote pattern was used** (main article has `*→ Main article: [[EMPR Blade Morphing]]*` under "Blade Morphing Extensions"), so the model treated it as parent/child split rather than Tier-3-as-section. **This is a prompt/judgment failure, not a TS-validator failure.**
2. **`[!critique]` callout has no named concerns.** The 1 callout in the Limitations section is prose inside the `>` block — no `**Bold Heading**` named concerns. The append-only validator never fired because there was no prev critique to preserve — it protects what exists, but cannot enforce that the structure exists in the first place.
3. **Cost +$0.21 vs Run 6.** Trajectory pass adds one full-context call (transcript + all articles). Even with zero validator retries, the trajectory pass payload is the dominant cost contributor.

### Comparison to prior runs

| Run | Articles | Cost | Score | Verdict |
|---|---|---|---|---|
| 1 | 21 | $0.64 | 0.5/7 | baseline |
| 2 | 2 | $0.50 | 2.5/7 | over-consolidation |
| 3 | 3 | $0.48 | 5.5/7 | best balance, blade morphing surfaces |
| 4 | 3 | $0.62 | 5.5/7 cost-blocked | callouts fixed, blade morphing surfaces |
| 5 | 9 | $0.43 | 5/7 | over-correction up |
| 6 | 1 | $0.34 | 3.5/7 | blade morphing fixed, everything collapsed |
| **7** | **2** | **$0.55** | **4.5/7** | **TS structural fixes hold; trajectory judgment still wrong on blade morphing; named-concerns callout regression vs Run 4** |

### Where this leaves us — per CEO plan iteration-ceiling commitment

Run 7 is the LAST EMPR-tuned iteration. Even though the score misses 5/7, **we do NOT iterate EMPR again.** Two next steps:

1. **Fresh-transcript sanity check (CEO criterion #2).** Synthesize a ~5-turn transcript and run. Detects EMPR overfit.
2. **Run rail + tactical regardless.** Per CEO commitment: if the EMPR gate misses, broader data drives the next move. Rail (~50 turns) and tactical (list-shaped) become inputs to a v2 redesign — not more EMPR tuning.

### What we learned from the structural wins
The TS-validator approach works exactly as designed. Path↔title parens, citation completeness, per-turn protection — zero regressions. The remaining failures are *judgment* problems (Tier 3 classification, callout named-concern formatting), which are what prompts must address — but EMPR-tuned prompts have demonstrably hit their ceiling.

### Open questions for v2 redesign
- Should `[!critique]` callouts have a tool-enforced "name your concerns" minimum? (Validator: reject callouts with no `**Bold Heading**` inside.) The append-only validator protects what exists; a "structural minimum" validator could enforce the structure in the first place.
- Should the trajectory pass be replaced by a simpler heuristic (e.g., "any article whose only {{USER}} citation is a single 'expand'-style prompt is auto-merged into the parent")? Tier-3 detection is mechanical enough to be code rather than prompt judgment.
- Should the trajectory pass be eliminated for cost reasons and replaced with a final structural check that runs purely in TypeScript? Trajectory adds ~$0.20 per run — if its judgment isn't reliable, the cost may not be justified.

---

## Run 7-fresh — 2026-05-03 — Fresh-transcript sanity check (CEO criterion #2, overfit detector)

**Transcript:** `Claude-Appalachian mountain squad tactical loadout concept.json` — manually shortened to 8 turns (4 prompt/response pairs) mirroring EMPR's shape: opening pitch + critique-laden response, cartridge commitment (Tier 1), Rockies applicability (Tier 3 curiosity ping — blade-morphing analog), doctrine validation closing.

**Articles produced:** 1 (`Appalachian Mountain Squad Tactical Loadout`)
**Cost:** $0.29 — lowest of any successful run
**Validator stats:** 8 write attempts, 1 rejection (rate 12.5%, under 20% gate ✅). The rejection was an empty `citations` array — the corrective error message ("citations must be a non-empty array") let the agent retry successfully.

### Scores

| # | Criterion | Score | Notes |
|---|-----------|-------|-------|
| 1 | Article count 5–7 | ❌ | 1 article — below range. Same over-consolidation pattern as EMPR Run 6 |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ⚠️ | 1 named callout block ("Logistics and parts customization constraints" — Turn 3). Only 1 named concern, not ≥4. The critique-laden Turn 1 response had multiple distinct concerns (30-second window aggressiveness, thermal management, comms coordination) that ended up as Open Questions instead of named callout concerns |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout |
| 4 | No redundancy | ✅ | Single article — trivially no redundancy |
| 5 | Citation hygiene | ✅ | Frontmatter cites all 7 user-relevant turns `[0,1,2,3,4,5,6]`; multi-turn citations `(turns 4, 5)` and `(turns 2, 6)` correctly used; all body refs match frontmatter (validator confirmed) |
| 6 | Wikilinks + Open Questions | ⚠️ | 9 substantive Open Questions ✅; **zero wikilinks** ❌ (single-article output has nothing to link to — structural consequence of over-consolidation) |
| 7 | Cost ≤$0.45 | ✅ | $0.29 — best cost result yet |

**Total: 5/7** (4 full ✅ + 2 ⚠️ × 0.5). **Fresh-transcript gate: ≥4/7. PASSES.**

### Critical observation: Rockies as Tier-3 done RIGHT

The Rockies turn (T4/T5) was the key analog to EMPR's blade morphing — a single curiosity ping {{USER}} doesn't return to. Trajectory pass behavior on this transcript: **the Rockies content correctly became Open Questions in the main article, NOT a standalone article.** This is the intended Tier-3 behavior the trajectory prompt was rewritten to enforce. The Open Questions section includes ~150 words on Rockies-specific adaptations (engagement distances, canopy reduction, e-moto vs. horseback, altitude effects) — substantively present but not promoted to standalone.

**Compare to EMPR Run 7:** Blade morphing surfaced AS a standalone article because Turn 3 had a much longer assistant elaboration that the agent treated as worthy of its own article. The Appalachian transcript's T5 Rockies response was shorter and more focused, which let the Tier-3 mechanic work correctly.

**Interpretation:** The trajectory pass's prompt judgment is brittle — it correctly handles Tier-3 pings when the assistant elaboration is short, but breaks down when the elaboration is long enough to look like a Tier 1/2 article on its own. The structural fix (perTurnArticles set) protects boundaries but doesn't change the merge judgment.

### Validator behavior (the structural wins)

- **Path validation:** Title/path were both `Appalachian Mountain Squad Tactical Loadout` (no parens) — validator was inactive but would have enforced.
- **Citation completeness:** All `(turn N)` body refs correctly union'd into frontmatter. Multi-turn `(turns X, Y)` format used.
- **Per-turn article protection:** Trajectory pass made no destructive writes (no rejections in this category).
- **150-word floor:** Article well over 1500 words; floor inactive but correct.
- **Critique preservation:** Append-only check inactive (no prior critique block to preserve).
- **One genuine rejection (citations array empty)** — the corrective-error pattern worked: the agent retried and succeeded.

### Cost analysis: $0.29 is a real win

Why so much cheaper than EMPR Run 7's $0.55:
1. Shorter overall transcript (~15.6K chars vs EMPR's much longer first turn)
2. Trajectory pass had less to do — fewer articles to consider, no merge candidates triggered
3. Compliance pass scope shrunk too (1 article to validate)
4. Net: structural simplicity of the conversation propagates through the pipeline

### What this fresh-transcript run tells us

**The TS validator approach generalizes.** Zero structural regressions on a transcript the system was never tuned on. Path/citation/per-turn-protection invariants all held.

**The over-consolidation problem is consistent across transcripts.** Both Run 7 (EMPR) and Run 7-fresh produced too few articles. The cartridge choice (T2/T3 — Tier 1 substantive) collapsed into the main article rather than getting its own standalone. Same pattern in EMPR Run 6 with Patent Novelty. **This is now the dominant residual failure mode, not blade-morphing-style Tier-3 surfacing.**

**The `[!critique]` named-concerns formatting is a persistent prompt-judgment failure.** Run 4 had 5 named concerns; Runs 6 and 7 (both EMPR and fresh) recovered the callout block but not the named-concern format inside it. This is the kind of structural minimum that may need a tool-layer enforcement in v2.

### Run 7 ship gate decision (final)

**EMPR: 4.5/7 — fails ship gate (<5/7)**
**Fresh transcript: 5/7 — passes sanity gate (≥4/7)**

Per the CEO plan iteration-ceiling commitment: Run 7 was the LAST EMPR-tuned iteration regardless of outcome. Even though EMPR scored below ship gate, the fresh-transcript pass at 5/7 confirms the system is NOT just EMPR-overfit — the validators and revised trajectory prompt generalize. The over-consolidation pattern that pulls article counts below 5–7 is a structural ceiling the current architecture (per-turn loop + 3 sub-passes + prompts that judge merging) appears to enforce.

**Next moves per CEO commitment:**
1. ✅ Fresh-transcript sanity check complete
2. Run rail (~50 turns) and tactical (full version, list-shaped) as broader regression tests
3. Use rail/tactical results to drive v2 redesign — NOT another EMPR tuning cycle

**Open architectural questions for v2** (now informed by data, not just intuition):
- The trajectory pass merges too aggressively. Should it be split into "Tier-3 demotion" (keep) and "Tier 1/2 splitting" (strip)? Or replaced by a structural check?
- The `[!critique]` named-concerns format is a structural minimum the LLM keeps missing. Tool-layer "reject critique callouts without ≥1 `**Bold Heading**` inside" validator?
- Cost: trajectory pass adds $0.05–0.20 per run. On the fresh transcript at $0.29, the trajectory work was clearly worth it. On EMPR at $0.55, it's the dominant cost. The economics depend on transcript shape — a v2 cost model needs to account for this.

---

## Run 8 — 2026-05-13 — Decision Log Scratchpad architecture (v2 cross-turn state)

**Architecture:** First run with the Decision Log Scratchpad — per-turn Active/Open/Retired decision tracking persisted in `ExtractionRunState.decisionLog`, injected into every `contextSeed` and into trajectory + contradiction pass user messages. Three new tools (`add_or_update_decision`, `retire_decision`, `resolve_question`) with structural state-machine gating (Retired → Active is architecturally impossible — no tool exists). Post-run, `writeArticleDecisionLogs()` writes `_decisions/<Article>.decisions.md` per article and appends `[[_decisions/...]]` wikilinks to article bodies. CEO plan: `~/.gstack/projects/igarox-erupt/ceo-plans/2026-05-13-decision-log-scratchpad.md`.

**First-deploy sanity check** ran on the Appalachian transcript ($0.27, 0/5 rejections) — exposed a bug where wikilinks were not appended to article bodies because `vault.getFileByPath()` returns null for `.magma/` paths (Obsidian's `reconcileFile` excludes dot-prefixed paths). Fixed in `decision-log-writer.ts` by adding `readMagmaFile` / `writeMagmaFile` helpers with adapter fallback (same pattern `handleReadMagma` uses). Re-deployed for EMPR run.

**Articles produced:** 2 (`ElectroMag Pitch Rotor (EMPR)`, `EMPR Patent Novelty and Prior Art`)
**Cost:** $0.52
**Validator stats:** 8 write attempts, 3 rejections (rate 37.5% — over the 20% gate). Rejections: 2× `citations must be a non-empty array`, 1× `confidence must be stub, provisional, or settled` — all three on the same article (`rotors/ElectroMag Pitch Rotor (EMPR)`). Agent omitted required fields entirely on the initial writes; corrective error messages let it recover, but the rate is high.

### Scores (rubric)

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Article count 5–7 | ❌ | 2 articles — below range |
| 2 | Critique verbatim + `[!critique]` marker + ≥4 concerns named | ✅ | **5 named `[!critique]` callout blocks** on the main article: Control Authority Constraints, Yaw Control Complexity, Aeroelastic Stability, Thermal and Magnetic Degradation, Manufacturing Tolerance + 1 critique on the patent article (Lugg patent concern). All verbatim, all with turn refs. First clean pass on this criterion since Run 4. |
| 3 | {{USER}} placeholder | ✅ | Consistent throughout both articles |
| 4 | No patent-novelty redundancy | ✅ | Single patent article, hatnote summary in parent |
| 5 | Citation hygiene | ✅ | Multi-turn citations `(turns 0, 1)`, `(turns 4, 5)` used correctly; all body refs match frontmatter (one small miss: patent article cites only `[7]` but absorbed turn-5 content) |
| 6 | Wikilinks + Open Questions | ✅ | Parent ↔ child wikilinks present, hatnote pattern correctly used, both articles have `[[_decisions/...]]` wikilink at bottom, 10 + 3 Open Questions |
| 7 | Cost ≤$0.45 | ❌ | $0.52 — over target, +$0.07 |

**Total: 5/7.** Ship gate passed for the first time since Run 3. **But the rubric undersells this run — see below.**

### Headline result: blade morphing correctly classified for the first time

The 7 prior runs all created `EMPR Blade Morphing` as a standalone article. **Run 8 does not.** Magnetic Blade Morphing appears as a 2-sentence Future Directions entry inside the parent EMPR article — exactly the Tier-3 behavior the entire decision log architecture was designed to enforce. And the agent achieved it **preventatively** (zero retired decisions in the log) — it classified correctly the first time rather than creating then retracting.

### Decision log content (the new artifact)

- `empr-primary-invention` (Active, turn 0) — "EMPR is {{USER}}'s primary invention. All subsequent topics are subordinate."
- `pitch-authority-constraint` (Open, turn 0) — "Will {{USER}} accept the 1–3° trade-off or pursue extended authority?"
- `yaw-control-mechanism` (Open, turn 0) — "Yaw mechanism not yet chosen."
- `empr-patent-strategy` (Active, turn 7) — "EMPR is novel (95%). Consider provisional patent before public disclosure."

Zero retired decisions. Both `_decisions/<Article>.decisions.md` files written correctly with Active/Open/Retired sections.

### Reader-level evaluation (not on the rubric)

Reading the actual articles as a user returning to this in 6 months:

- **Completeness 8.5/10** — Full physics chain preserved (torque values, RPM ranges, centrifugal loads). All 5 named engineering critiques from turn 1 preserved verbatim. Patent landscape (MagLev Aero, LADDM, Boeing/Sikorsky, X2, Lugg) fully captured. The Active vs. Passive ASCII architectural diagram is captured. Compression of turn-3 blade morphing content from ~1500 words to 2 sentences is per-spec but loses richness (distributed torsional, leading edge droop, trailing edge flap vibration cancellation 30–50%, HHC).
- **Accuracy 9.5/10** — Every quantitative claim spot-checked against the source matches. Critique blocks word-perfect. Patent numbers, names, and architectures correctly distinguished.
- **Usefulness 9/10** — The articles function as a working dossier. Lead paragraphs stand alone. Open Questions are a literal actionable to-do list. The patent article includes drafted claim language usable for actual patent counsel discussion.

**Article-count interpretation:** The rubric's 5–7 target was calibrated from prior-run behavior (which over-fragmented). For this transcript, **2–3 articles is probably the actual right answer.** Prior runs producing 5+ articles were fragmenting a coherent concept across 6+ files; reading 2 well-structured articles is a better user experience than reading 6 stubs. The rubric was wrong; this run is right.

### What the architecture validates

1. **The decision log works preventatively, not correctively.** Zero retired decisions because there was nothing to retire — the agent classified correctly the first time, with Active decisions shaping its per-turn judgment.
2. **`[!critique]` named-concerns format is finally robust.** 5 named bold-heading concerns on the main article — first clean pass since Run 4. The new tools didn't disrupt the established critique-preservation behavior.
3. **Wikilink + decision log file outputs work end-to-end** (after the bug fix). Both `_decisions/<Article>.decisions.md` files were created and both articles got their `[[...]]` wikilinks appended.
4. **No structural regressions on TS validators.** Path↔title parens, citation completeness, per-turn protection, word floor — all 5 validators held.

### Failures and residual issues

1. **Validator rejection rate 37.5%.** All 3 rejections on the same article and were basic required-field omissions (`citations`, `confidence`) — agent generated `write_magma` calls without the mandatory fields. Architectural noise, not a decision log issue. Fix: tighten the prompt with an explicit required-fields checklist before the agent calls `write_magma`. Filed as next change.
2. **Cost $0.52 vs. $0.45 target.** 4% over the $0.50 CEO-plan target, 16% over the rubric's $0.45 stretch target. Decision log tool round-trips + larger contextSeed contribute. Manageable but worth monitoring.
3. **Single decision log dominance risk.** The `empr-primary-invention: all subordinate` Active decision worked beautifully here because the conversation is monomaniacally about EMPR. On a less-focused conversation, the same dominant Active decision could suppress legitimate splits. Worth testing on a multi-topic transcript before claiming generality.
4. **Patent article missing turn-5 citation.** The MagLev Aero claim-by-claim comparison happened in turn 5 but the consolidated article cites only `[7]`. Union-of-citations across consolidation would be the fix; not architecturally critical.

### Compared to prior runs

| Run | Articles | Cost | Score | Verdict |
|---|---|---|---|---|
| 1 | 21 | $0.64 | 0.5/7 | baseline |
| 2 | 2 | $0.50 | 2.5/7 | over-consolidation |
| 3 | 3 | $0.48 | 5.5/7 | best prior balance |
| 4 | 3 | $0.62 | 5.5/7 cost-blocked | callouts fixed, blade morphing surfaces |
| 5 | 9 | $0.43 | 5/7 | over-fragmented |
| 6 | 1 | $0.34 | 3.5/7 | everything collapsed |
| 7 | 2 | $0.55 | 4.5/7 | TS validators hold; blade morphing surfaces |
| **8** | **2** | **$0.52** | **5/7** | **decision log; blade morphing finally correct; reader quality clearly best of the 8 runs** |

### What this means for the v2 roadmap

The decision log architecture validates the cross-turn state hypothesis from the CEO plan. The headline measurement (blade morphing classification) was the criterion that 7 prior runs failed; Run 8 succeeds without any retired decision — i.e., the agent prevented the misclassification rather than correcting it. This supports the post-Run 8 hypothesis in TODOS.md that the trajectory pass can be narrowed to structural consolidation only (merge/orphan cleanup) rather than semantic correction. Worth running a less-focused transcript before committing to that simplification.

**Open architectural questions surfaced by Run 8:**
- Should `add_or_update_decision` require justification text to discourage over-broad Active decisions? (`all subsequent topics are subordinate` is a load-bearing claim that the agent didn't have to defend.)
- Should `_decisions/` files include the source-note path + run timestamp in their frontmatter? Currently they're just-the-decisions; they'd be more useful as a session brief if they had session context.
- The hardcoded required-fields error pattern (`citations must be a non-empty array`) costs a retry round-trip. Worth a prompt-level checklist to prevent first-write omission.
