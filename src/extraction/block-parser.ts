/**
 * Markdown block parser for block-indexed write_magma operations (v1.5).
 *
 * A "block" is a top-level logical unit in a Magma article:
 *   - The YAML frontmatter (everything between the opening and closing ---)
 *   - A heading line (## Section)
 *   - A paragraph (one or more non-blank lines, not inside a fenced code block or blockquote)
 *   - A fenced code block (``` ... ```)
 *   - A blockquote block (> ... lines, including blank continuation lines)
 *   - A list block (- or 1. lines, treated as one unit)
 *
 * Block indices are used by the future block-indexed write_magma to perform
 * surgical updates without rewriting the entire file.
 */

export type BlockType =
  | 'frontmatter'
  | 'heading'
  | 'paragraph'
  | 'code'
  | 'blockquote'
  | 'list'
  | 'blank';

export interface Block {
  type: BlockType;
  content: string;   // raw text including newlines, without the trailing blank separator
  startLine: number; // 0-based inclusive
  endLine: number;   // 0-based inclusive
}

/**
 * Parse a Magma article into top-level blocks.
 *
 * Rules:
 * - YAML frontmatter (--- ... ---) is a single block, delimiters included.
 * - Fenced code blocks (``` or ~~~) are single blocks even if they contain blank lines.
 * - Blockquotes (lines starting with >) are grouped; blank lines inside a blockquote
 *   that are followed by another > line are kept inside the block.
 * - List items (-, *, 1.) are grouped into one list block until the first non-list line.
 * - Headings are standalone blocks.
 * - Paragraphs end at the first blank line.
 * - Blank lines between blocks are not returned as blocks.
 */
export function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  // YAML frontmatter
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end !== -1) {
      blocks.push({
        type: 'frontmatter',
        content: lines.slice(0, end + 1).join('\n'),
        startLine: 0,
        endLine: end,
      });
      i = end + 1;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines between blocks
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith('```') || line.startsWith('~~~')) {
      const fence = line.startsWith('```') ? '```' : '~~~';
      const start = i;
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) i++;
      if (i < lines.length) i++; // consume closing fence
      blocks.push({
        type: 'code',
        content: lines.slice(start, i).join('\n'),
        startLine: start,
        endLine: i - 1,
      });
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const start = i;
      i++;
      // Include continuation lines and blank lines followed by another > line
      while (i < lines.length) {
        if (lines[i].startsWith('>')) { i++; continue; }
        // Blank line — peek ahead to see if a > follows
        if (lines[i].trim() === '' && i + 1 < lines.length && lines[i + 1].startsWith('>')) {
          i++; continue;
        }
        break;
      }
      blocks.push({
        type: 'blockquote',
        content: lines.slice(start, i).join('\n'),
        startLine: start,
        endLine: i - 1,
      });
      continue;
    }

    // Heading
    if (/^#{1,6} /.test(line)) {
      blocks.push({
        type: 'heading',
        content: line,
        startLine: i,
        endLine: i,
      });
      i++;
      continue;
    }

    // List block
    if (/^(\s*[-*+]|\s*\d+\.) /.test(line)) {
      const start = i;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (/^(\s*[-*+]|\s*\d+\.) /.test(l) || /^\s+/.test(l)) { i++; continue; }
        if (l.trim() === '' && i + 1 < lines.length && /^(\s*[-*+]|\s*\d+\.) /.test(lines[i + 1])) {
          i++; continue;
        }
        break;
      }
      blocks.push({
        type: 'list',
        content: lines.slice(start, i).join('\n'),
        startLine: start,
        endLine: i - 1,
      });
      continue;
    }

    // Paragraph — runs until a blank line
    {
      const start = i;
      i++;
      while (i < lines.length && lines[i].trim() !== '') i++;
      blocks.push({
        type: 'paragraph',
        content: lines.slice(start, i).join('\n'),
        startLine: start,
        endLine: i - 1,
      });
    }
  }

  return blocks;
}
