import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../block-parser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function types(content: string) {
  return parseBlocks(content).map(b => b.type);
}

// ─── Frontmatter ──────────────────────────────────────────────────────────────

describe('frontmatter', () => {
  it('treats --- delimiters as a single frontmatter block, not horizontal rules', () => {
    const input = '---\npath: test\ntitle: Test\n---\n\nSome paragraph.';
    const blocks = parseBlocks(input);
    expect(blocks[0].type).toBe('frontmatter');
    expect(blocks[0].startLine).toBe(0);
    expect(blocks[0].endLine).toBe(3);
    expect(blocks[1].type).toBe('paragraph');
  });

  it('captures frontmatter content including all fields', () => {
    const fm = '---\npath: rotors/EMPR\ntitle: EMPR\nconfidence: provisional\ncitations: [0, 1]\nsource_note: note.md\n---';
    const blocks = parseBlocks(fm);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('frontmatter');
    expect(blocks[0].content).toBe(fm);
  });

  it('does not treat a mid-body --- as frontmatter', () => {
    const input = 'First paragraph.\n\n---\n\nSecond paragraph.';
    const blocks = parseBlocks(input);
    // no frontmatter block — the first line is not ---
    expect(blocks.every(b => b.type !== 'frontmatter')).toBe(true);
  });
});

// ─── Code blocks ──────────────────────────────────────────────────────────────

describe('code blocks', () => {
  it('does not split a fenced code block that contains blank lines', () => {
    const input = '```typescript\nfunction foo() {\n\n  return 1;\n}\n```';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
  });

  it('handles multiple code blocks correctly', () => {
    const input = '```\nblock one\n```\n\n```\nblock two\n```';
    expect(types(input)).toEqual(['code', 'code']);
  });

  it('supports tilde fences', () => {
    const input = '~~~\nsome code\n~~~';
    const blocks = parseBlocks(input);
    expect(blocks[0].type).toBe('code');
  });
});

// ─── Headings ─────────────────────────────────────────────────────────────────

describe('headings', () => {
  it('treats consecutive headings as separate blocks with no paragraph between', () => {
    const input = '## Section A\n## Section B';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('heading');
  });

  it('recognises all heading levels', () => {
    const input = '# H1\n\n## H2\n\n### H3';
    expect(types(input)).toEqual(['heading', 'heading', 'heading']);
  });
});

// ─── Empty and minimal articles ───────────────────────────────────────────────

describe('empty / minimal articles', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseBlocks('')).toEqual([]);
  });

  it('returns an empty array for a blank-lines-only string', () => {
    expect(parseBlocks('\n\n\n')).toEqual([]);
  });

  it('returns only a frontmatter block for a frontmatter-only article', () => {
    const input = '---\npath: test\ntitle: T\nconfidence: stub\ncitations: []\nsource_note: x.md\n---';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('frontmatter');
  });
});

// ─── Lists ────────────────────────────────────────────────────────────────────

describe('lists', () => {
  it('groups a hyphen list into a single block', () => {
    const input = '- item one\n- item two\n- item three';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
  });

  it('treats a paragraph immediately after a list as a separate block', () => {
    const input = '- item one\n- item two\n\nFollowing paragraph.';
    expect(types(input)).toEqual(['list', 'paragraph']);
  });

  it('keeps a list with a blank continuation line as one block', () => {
    // Blank line between list items (as in loose lists) followed by another item
    const input = '- item one\n\n- item two';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
  });
});

// ─── Blockquotes ──────────────────────────────────────────────────────────────

describe('blockquotes', () => {
  it('groups a simple blockquote as one block', () => {
    const input = '> line one\n> line two\n> line three';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('blockquote');
  });

  it('keeps a blockquote with an internal blank line as a single block', () => {
    const input = '> [!critique] Note.\n> First sentence.\n>\n> Second sentence.\n> — Turn 1';
    const blocks = parseBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('blockquote');
  });

  it('separates two blockquotes divided by a non-quote line', () => {
    const input = '> Quote one.\n\nParagraph.\n\n> Quote two.';
    expect(types(input)).toEqual(['blockquote', 'paragraph', 'blockquote']);
  });
});

// ─── Line numbers ─────────────────────────────────────────────────────────────

describe('line numbers', () => {
  it('assigns correct startLine and endLine to blocks', () => {
    const input = '---\npath: x\n---\n\n## Heading\n\nA paragraph.';
    const blocks = parseBlocks(input);
    expect(blocks[0]).toMatchObject({ type: 'frontmatter', startLine: 0, endLine: 2 });
    expect(blocks[1]).toMatchObject({ type: 'heading',     startLine: 4, endLine: 4 });
    expect(blocks[2]).toMatchObject({ type: 'paragraph',   startLine: 6, endLine: 6 });
  });
});
