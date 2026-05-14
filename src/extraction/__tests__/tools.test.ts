import { describe, it, expect } from 'vitest';
import { validateMagmaPath, validateWriteMagmaInput, extractFrontmatterTitle, extractBodyTurnCitations, extractCritiqueConcerns, countBodyWords, handleTool, TOOL_NAMES, type ToolContext } from '../tools';
import { createRunState, DEFAULT_EXTRACTION_CONFIG } from '../../types';

function makeCtx(turn = 0): ToolContext {
  return {
    vault: {} as any,
    transcript: [],
    currentPosition: turn,
    state: createRunState(),
    config: DEFAULT_EXTRACTION_CONFIG,
    vaultScanner: {} as any,
    magmaRoot: 'test/wiki',
  };
}

// ─── validateMagmaPath (regression baseline) ───────────────────────────────

describe('validateMagmaPath', () => {
  it('accepts Title Case with spaces', () => {
    expect(validateMagmaPath('rotors/EMPR Blade Morphing')).toBeNull();
  });

  it('accepts hyphens, underscores, and slashes', () => {
    expect(validateMagmaPath('a/b-c_d/e')).toBeNull();
  });

  it('accepts parentheses (Run 7 — needed for "(EMPR)" suffix)', () => {
    expect(validateMagmaPath('rotors/ElectroMag Pitch Rotor (EMPR)')).toBeNull();
  });

  it('rejects empty path', () => {
    expect(validateMagmaPath('')).toMatch(/required/);
  });

  it('rejects leading slash', () => {
    expect(validateMagmaPath('/rotors/foo')).toMatch(/start with/);
  });

  it('rejects double slashes', () => {
    expect(validateMagmaPath('rotors//foo')).toMatch(/\/\//);
  });

  it('rejects path traversal', () => {
    expect(validateMagmaPath('rotors/../etc')).toMatch(/\.\./);
  });

  it('rejects disallowed characters', () => {
    expect(validateMagmaPath('rotors/foo@bar')).toMatch(/Title Case/);
  });
});

// ─── validateWriteMagmaInput baseline (existing behavior) ──────────────────

describe('validateWriteMagmaInput — baseline', () => {
  const baseInput = {
    path: 'rotors/Test Article',
    // 'stub' confidence skips the 150-word floor — these tests cover other validators
    content: '---\ntitle: Test\n---\n\nBody (turn 0).',
    citations: [0],
    confidence: 'stub',
    prevContent: null,
  };

  it('accepts valid input', () => {
    const r = validateWriteMagmaInput(baseInput);
    expect(r.valid).toBe(true);
  });

  it('rejects missing content', () => {
    const r = validateWriteMagmaInput({ ...baseInput, content: '' });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('content');
      expect(r.error).toMatch(/required/);
    }
  });

  it('rejects empty citations array', () => {
    const r = validateWriteMagmaInput({ ...baseInput, citations: [] });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('citations');
    }
  });

  it('rejects non-array citations', () => {
    const r = validateWriteMagmaInput({ ...baseInput, citations: undefined as unknown as number[] });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.validator).toBe('citations');
  });

  it('rejects invalid confidence value', () => {
    const r = validateWriteMagmaInput({ ...baseInput, confidence: 'final' });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('confidence');
      expect(r.error).toMatch(/stub|provisional|settled/);
    }
  });

  it('accepts each valid confidence level', () => {
    const longBody = '---\ntitle: T\n---\n\n' + 'word '.repeat(160) + '(turn 0)';
    for (const c of ['stub', 'provisional', 'settled']) {
      const content = c === 'stub' ? baseInput.content : longBody;
      const r = validateWriteMagmaInput({ ...baseInput, confidence: c, content });
      expect(r.valid).toBe(true);
    }
  });

  it('rejects invalid path before checking other fields', () => {
    const r = validateWriteMagmaInput({ ...baseInput, path: '/bad' });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.validator).toBe('path');
  });
});

// ─── Validator 1: path↔title parens consistency ─────────────────────────────

describe('extractFrontmatterTitle', () => {
  it('reads title from frontmatter', () => {
    const c = '---\ntitle: ElectroMag Pitch Rotor (EMPR)\nconfidence: provisional\n---\n\nbody';
    expect(extractFrontmatterTitle(c)).toBe('ElectroMag Pitch Rotor (EMPR)');
  });

  it('strips surrounding quotes', () => {
    const c = '---\ntitle: "Quoted Title (X)"\n---';
    expect(extractFrontmatterTitle(c)).toBe('Quoted Title (X)');
  });

  it('returns null when no frontmatter', () => {
    expect(extractFrontmatterTitle('# Just a heading\n\nbody')).toBeNull();
  });

  it('returns null when frontmatter has no title field', () => {
    const c = '---\nconfidence: provisional\n---';
    expect(extractFrontmatterTitle(c)).toBeNull();
  });
});

describe('validateWriteMagmaInput — path↔title parens (Validator 1)', () => {
  const make = (path: string, title: string) => ({
    path,
    content: `---\ntitle: ${title}\n---\n\nbody (turn 0).`,
    citations: [0],
    confidence: 'stub', // stub skips word floor — keep this test focused on Validator 1
    prevContent: null,
  });

  it('accepts when path and title both have the same parens suffix', () => {
    const r = validateWriteMagmaInput(make('rotors/ElectroMag Pitch Rotor (EMPR)', 'ElectroMag Pitch Rotor (EMPR)'));
    expect(r.valid).toBe(true);
  });

  it('rejects with corrective message when path filename drops the parens suffix', () => {
    const r = validateWriteMagmaInput(make('rotors/ElectroMag Pitch Rotor EMPR', 'ElectroMag Pitch Rotor (EMPR)'));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('path_title_parens');
      expect(r.error).toContain('(EMPR)');
      expect(r.error).toMatch(/must contain the title suffix/);
    }
  });

  it('accepts title without parens suffix regardless of path', () => {
    const r = validateWriteMagmaInput(make('rotors/Some Article', 'Some Article'));
    expect(r.valid).toBe(true);
  });
});

// ─── Validator 2: citation completeness ─────────────────────────────────────

describe('extractBodyTurnCitations', () => {
  it('finds (turn N) references in paragraphs', () => {
    const c = '---\ntitle: T\n---\n\nFirst point (turn 0). Second point (turn 3).';
    expect(extractBodyTurnCitations(c)).toEqual([0, 3]);
  });

  it('skips citations inside code fences', () => {
    const c = '---\ntitle: T\n---\n\nReal cite (turn 1).\n\n```\n// (turn 99) is not a real cite\n```';
    expect(extractBodyTurnCitations(c)).toEqual([1]);
  });

  it('skips frontmatter', () => {
    const c = '---\ntitle: T\nnote: turn 7 in here is not a citation\n---\n\nbody (turn 2).';
    // frontmatter is a "frontmatter" block type and is excluded
    expect(extractBodyTurnCitations(c)).toEqual([2]);
  });

  it('deduplicates turn references', () => {
    const c = '---\n---\n\nA (turn 5). B (turn 5). C (turn 5).';
    expect(extractBodyTurnCitations(c)).toEqual([5]);
  });

  it('returns empty array when no citations present', () => {
    const c = '---\ntitle: T\n---\n\nbody with no citations.';
    expect(extractBodyTurnCitations(c)).toEqual([]);
  });
});

describe('validateWriteMagmaInput — citation completeness (Validator 2)', () => {
  const make = (citations: number[], body: string) => ({
    path: 'rotors/Test',
    content: `---\ntitle: Test\n---\n\n${body}`,
    citations,
    confidence: 'stub', // skip word floor for these tests
    prevContent: null,
  });

  it('accepts when all body refs are in frontmatter citations', () => {
    const r = validateWriteMagmaInput(make([0, 3, 5], 'A (turn 0). B (turn 3). C (turn 5).'));
    expect(r.valid).toBe(true);
  });

  it('accepts when frontmatter has more turns than body references', () => {
    const r = validateWriteMagmaInput(make([0, 1, 2, 3], 'Just one ref (turn 0).'));
    expect(r.valid).toBe(true);
  });

  it('rejects with corrective message naming the missing turns', () => {
    const r = validateWriteMagmaInput(make([0, 3, 5], 'A (turn 0). B (turn 1). C (turn 4).'));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('citation_completeness');
      expect(r.error).toMatch(/\[1, 4\]/);
      expect(r.error).toMatch(/include all referenced turns/);
    }
  });

  it('accepts when body has no (turn N) references', () => {
    const r = validateWriteMagmaInput(make([0], 'no citations in this body.'));
    expect(r.valid).toBe(true);
  });
});

// ─── Validator 3: [!critique] append-only preservation ──────────────────────

describe('extractCritiqueConcerns', () => {
  it('extracts named bold-heading concerns from a critique callout', () => {
    const c = [
      '---', 'title: T', '---', '',
      '> [!critique] Turn 1',
      '> **Control authority concern**: only 1-3° of pitch.',
      '> **Yaw concern**: no inherent yaw torque.',
      '',
    ].join('\n');
    const got = extractCritiqueConcerns(c);
    expect(got).toEqual(new Set(['Control authority concern', 'Yaw concern']));
  });

  it('ignores blockquotes without [!critique] marker', () => {
    const c = '> [!note] Just a note\n> **Bold thing**: not a concern.\n';
    expect(extractCritiqueConcerns(c).size).toBe(0);
  });

  it('returns empty set when no critique blocks present', () => {
    expect(extractCritiqueConcerns('just a paragraph.').size).toBe(0);
  });
});

describe('validateWriteMagmaInput — [!critique] preservation (Validator 3)', () => {
  const prev = [
    '---', 'title: T', '---', '',
    '> [!critique] Turn 1',
    '> **Concern A**: original wording.',
    '> **Concern B**: original wording.',
    '',
  ].join('\n');

  const make = (newBody: string) => ({
    path: 'rotors/Test',
    content: newBody,
    citations: [0],
    confidence: 'stub',
    prevContent: prev,
  });

  it('accepts when all original concerns persist verbatim', () => {
    const r = validateWriteMagmaInput(make(prev));
    expect(r.valid).toBe(true);
  });

  it('accepts when body content within concerns grows (append-only)', () => {
    const expanded = [
      '---', 'title: T', '---', '',
      '> [!critique] Turn 1',
      '> **Concern A**: original wording, plus elaboration.',
      '> **Concern B**: more detail added.',
      '> **Concern C**: a new concern was added — that is allowed.',
      '',
    ].join('\n');
    const r = validateWriteMagmaInput(make(expanded));
    expect(r.valid).toBe(true);
  });

  it('rejects with corrective message when a concern is removed', () => {
    const reduced = [
      '---', 'title: T', '---', '',
      '> [!critique] Turn 1',
      '> **Concern A**: original wording.',
      '',
    ].join('\n');
    const r = validateWriteMagmaInput(make(reduced));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('critique_preservation');
      expect(r.error).toContain('Concern B');
      expect(r.error).toMatch(/preserve all original/i);
    }
  });

  it('rejects when critique block is rewritten as prose (Run 6 regression)', () => {
    const proseRewrite = [
      '---', 'title: T', '---', '',
      '## Challenges and Limitations',
      '',
      'The original Concern A is now described in prose. Concern B too.',
      '',
    ].join('\n');
    const r = validateWriteMagmaInput(make(proseRewrite));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.validator).toBe('critique_preservation');
  });
});

// ─── Validator 4: per-turn article protection ───────────────────────────────

describe('validateWriteMagmaInput — per-turn protection (Validator 4)', () => {
  const longPrev =
    '---\ntitle: T\n---\n\n' +
    'A substantial article body. '.repeat(40); // ~1000 chars

  const make = (
    newContent: string,
    isTrajectoryPass: boolean,
    perTurnArticles: Set<string>,
  ) => ({
    path: 'rotors/Patent Novelty Assessment',
    content: newContent,
    citations: [0],
    confidence: 'stub', // word floor not the focus here
    prevContent: longPrev,
    isTrajectoryPass,
    perTurnArticles,
  });

  it('rejects trajectory pass collapsing a per-turn article (Run 6 bug)', () => {
    const collapsed = '---\ntitle: T\n---\n\nstub.';
    const r = validateWriteMagmaInput(
      make(collapsed, true, new Set(['rotors/Patent Novelty Assessment'])),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('per_turn_protection');
      expect(r.error).toMatch(/main loop|trajectory|cannot collapse/i);
    }
  });

  it('accepts trajectory pass writing similar-size content (legitimate edit)', () => {
    const sameSizeUpdate =
      '---\ntitle: T\nconfidence: stub\n---\n\n' +
      'Updated body. '.repeat(40);
    const r = validateWriteMagmaInput(
      make(sameSizeUpdate, true, new Set(['rotors/Patent Novelty Assessment'])),
    );
    expect(r.valid).toBe(true);
  });

  it('accepts main loop write (not trajectory pass) regardless of size', () => {
    const collapsed = '---\ntitle: T\n---\n\nstub.';
    const r = validateWriteMagmaInput(
      make(collapsed, false, new Set(['rotors/Patent Novelty Assessment'])),
    );
    expect(r.valid).toBe(true);
  });

  it('accepts trajectory write to article NOT in perTurnArticles (a merge target)', () => {
    const collapsed = '---\ntitle: T\n---\n\nstub.';
    const r = validateWriteMagmaInput(make(collapsed, true, new Set([])));
    expect(r.valid).toBe(true);
  });
});

// ─── Validator 5: 150-word granularity floor ────────────────────────────────

describe('countBodyWords', () => {
  it('counts words in body excluding frontmatter', () => {
    const c = '---\ntitle: should not be counted\n---\n\none two three four.';
    expect(countBodyWords(c)).toBe(4);
  });

  it('excludes content inside code fences', () => {
    const c = '---\n---\n\nbody words here.\n\n```\nmany words inside this code block here\n```';
    expect(countBodyWords(c)).toBe(3);
  });
});

describe('validateWriteMagmaInput — word floor (Validator 5)', () => {
  const longBody = 'word '.repeat(200) + '(turn 0)';
  const shortBody = 'just six short words here for now (turn 0)';

  const make = (body: string, confidence: string) => ({
    path: 'rotors/Test',
    content: `---\ntitle: T\n---\n\n${body}`,
    citations: [0],
    confidence,
    prevContent: null,
  });

  it('accepts long-body provisional article', () => {
    const r = validateWriteMagmaInput(make(longBody, 'provisional'));
    expect(r.valid).toBe(true);
  });

  it('rejects short-body provisional with corrective message naming threshold', () => {
    const r = validateWriteMagmaInput(make(shortBody, 'provisional'));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.validator).toBe('word_floor');
      expect(r.error).toContain('150');
      expect(r.error).toMatch(/expand|stub/);
    }
  });

  it('accepts short-body stub (stubs are allowed to be small)', () => {
    const r = validateWriteMagmaInput(make(shortBody, 'stub'));
    expect(r.valid).toBe(true);
  });

  it('rejects short-body settled (highest confidence requires substance)', () => {
    const r = validateWriteMagmaInput(make(shortBody, 'settled'));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.validator).toBe('word_floor');
  });
});

// ─── createRunState ──────────────────────────────────────────────────────────

describe('createRunState', () => {
  it('initializes decisionLog as empty', () => {
    const s = createRunState();
    expect(s.decisionLog).toEqual({ active: [], retired: [], open: [] });
  });

  it('initializes runArticleTurnMap as empty Map', () => {
    const s = createRunState();
    expect(s.runArticleTurnMap).toBeInstanceOf(Map);
    expect(s.runArticleTurnMap.size).toBe(0);
  });
});

// ─── add_or_update_decision ───────────────────────────────────────────────────

describe('add_or_update_decision', () => {
  it('adds Active entry', async () => {
    const ctx = makeCtx();
    const r = await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'empr-primary', text: 'EMPR is the primary invention', status: 'active', createdTurn: 0,
    }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.active).toHaveLength(1);
    expect(ctx.state.decisionLog.active[0].id).toBe('empr-primary');
  });

  it('adds Open entry', async () => {
    const ctx = makeCtx();
    const r = await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'blade-morph-tier', text: 'Is blade morphing Tier 2 or Tier 3?', status: 'open', createdTurn: 1,
    }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.open).toHaveLength(1);
  });

  it('updates existing Active entry text by id', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'empr-primary', text: 'original text', status: 'active', createdTurn: 0,
    }, ctx);
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'empr-primary', text: 'updated text', status: 'active', createdTurn: 0,
    }, ctx);
    expect(ctx.state.decisionLog.active).toHaveLength(1);
    expect(ctx.state.decisionLog.active[0].text).toBe('updated text');
  });

  it('rejects text > 200 chars', async () => {
    const ctx = makeCtx();
    const r = await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'x', text: 'a'.repeat(201), status: 'active', createdTurn: 0,
    }, ctx);
    expect(r.error).toMatch(/200/);
  });

  it('rejects attempt to move Active entry to Open via add_or_update', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'dec-1', text: 'decision', status: 'active', createdTurn: 0,
    }, ctx);
    const r = await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'dec-1', text: 'question', status: 'open', createdTurn: 0,
    }, ctx);
    expect(r.error).toBeTruthy();
    expect(ctx.state.decisionLog.active).toHaveLength(1); // unchanged
  });

  it('rejects update to a Retired entry (one-way door)', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'dec-1', text: 'decision', status: 'active', createdTurn: 0,
    }, ctx);
    await handleTool(TOOL_NAMES.RETIRE_DECISION, { id: 'dec-1', reason: 'obsolete' }, ctx);
    const r = await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'dec-1', text: 'new text', status: 'active', createdTurn: 0,
    }, ctx);
    expect(r.error).toMatch(/retired/i);
  });
});

// ─── retire_decision ──────────────────────────────────────────────────────────

describe('retire_decision', () => {
  it('retires Active entry (happy path)', async () => {
    const ctx = makeCtx(3);
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'blade-article', text: 'blade morphing as standalone article', status: 'active', createdTurn: 1,
    }, ctx);
    const r = await handleTool(TOOL_NAMES.RETIRE_DECISION, {
      id: 'blade-article', reason: 'merged into parent Future Directions',
    }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.active).toHaveLength(0);
    expect(ctx.state.decisionLog.retired).toHaveLength(1);
    expect(ctx.state.decisionLog.retired[0].text).toContain('merged into parent Future Directions');
    expect(ctx.state.decisionLog.retired[0].resolutionTurn).toBe(3);
  });

  it('retires Open entry', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'yaw-q', text: 'Does yaw mechanism undermine simplicity?', status: 'open', createdTurn: 2,
    }, ctx);
    const r = await handleTool(TOOL_NAMES.RETIRE_DECISION, {
      id: 'yaw-q', reason: 'thread abandoned',
    }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.open).toHaveLength(0);
    expect(ctx.state.decisionLog.retired).toHaveLength(1);
  });

  it('returns error when ID not found', async () => {
    const ctx = makeCtx();
    const r = await handleTool(TOOL_NAMES.RETIRE_DECISION, { id: 'nonexistent', reason: 'x' }, ctx);
    expect(r.error).toBeTruthy();
  });

  it('returns error when already Retired', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'dec-1', text: 'decision', status: 'active', createdTurn: 0,
    }, ctx);
    await handleTool(TOOL_NAMES.RETIRE_DECISION, { id: 'dec-1', reason: 'first retirement' }, ctx);
    const r = await handleTool(TOOL_NAMES.RETIRE_DECISION, { id: 'dec-1', reason: 'second attempt' }, ctx);
    expect(r.error).toMatch(/already retired/i);
  });
});

// ─── resolve_question ─────────────────────────────────────────────────────────

describe('resolve_question', () => {
  it('graduates Open → Active', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'blade-tier', text: 'Is blade morphing Tier 2 or 3?', status: 'open', createdTurn: 1,
    }, ctx);
    const r = await handleTool(TOOL_NAMES.RESOLVE_QUESTION, { id: 'blade-tier', resolution: 'active' }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.open).toHaveLength(0);
    expect(ctx.state.decisionLog.active).toHaveLength(1);
    expect(ctx.state.decisionLog.active[0].status).toBe('active');
  });

  it('graduates Open → Retired', async () => {
    const ctx = makeCtx();
    await handleTool(TOOL_NAMES.ADD_OR_UPDATE_DECISION, {
      id: 'blade-tier', text: 'Is blade morphing Tier 2 or 3?', status: 'open', createdTurn: 1,
    }, ctx);
    const r = await handleTool(TOOL_NAMES.RESOLVE_QUESTION, { id: 'blade-tier', resolution: 'retired' }, ctx);
    expect(r.success).toBe(true);
    expect(ctx.state.decisionLog.open).toHaveLength(0);
    expect(ctx.state.decisionLog.retired).toHaveLength(1);
  });

  it('returns error when ID not in Open', async () => {
    const ctx = makeCtx();
    const r = await handleTool(TOOL_NAMES.RESOLVE_QUESTION, { id: 'nonexistent', resolution: 'active' }, ctx);
    expect(r.error).toBeTruthy();
  });
});

// ─── serializeDecisionLog ─────────────────────────────────────────────────────

import { serializeDecisionLog } from '../util';
import type { DecisionLog } from '../../types';

describe('serializeDecisionLog', () => {
  it('returns empty string for empty log', () => {
    const log: DecisionLog = { active: [], retired: [], open: [] };
    expect(serializeDecisionLog(log)).toBe('');
  });

  it('includes all three status types in output', () => {
    const log: DecisionLog = {
      active:  [{ id: 'a1', text: 'EMPR primary', status: 'active',  createdTurn: 0 }],
      open:    [{ id: 'o1', text: 'Yaw question', status: 'open',    createdTurn: 1 }],
      retired: [{ id: 'r1', text: 'blade → merged', status: 'retired', createdTurn: 2, resolutionTurn: 4 }],
    };
    const s = serializeDecisionLog(log);
    expect(s).toContain('## Session Decision Log');
    expect(s).toContain('Active: [EMPR primary');
    expect(s).toContain('Open: [Yaw question');
    expect(s).toContain('Retired: [blade → merged');
    expect(s).toContain('turn 2 → 4');
  });

  it('truncates Retired section when > 2000 chars (oldest first)', () => {
    const retired = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      text: 'x'.repeat(80),
      status: 'retired' as const,
      createdTurn: i,
    }));
    const log: DecisionLog = { active: [], retired, open: [] };
    const s = serializeDecisionLog(log);
    const retiredInOutput = (s.match(/^Retired:/gm) ?? []).length;
    expect(retiredInOutput).toBeLessThan(30);
    // Oldest (turn 0) should be dropped before newest (turn 29)
    expect(s).not.toContain('createdTurn: 0'); // entries use text not field names
    // Newest entries should still be present
    const lines = s.split('\n').filter(l => l.startsWith('Retired:'));
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain('turn 29');
  });
});
