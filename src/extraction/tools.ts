import type Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig, ClarifyingQuestion, Decision } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { ensureDir } from '../fs';
import { parseBlocks } from './block-parser';

// Tool name constants — must match what the LLM sees in the tool list
export const TOOL_NAMES = {
  READ_TURNS: 'read_turns',
  READ_MAGMA: 'read_magma',
  SEARCH_VAULT: 'search_vault',
  READ_VAULT: 'read_vault',
  WRITE_MAGMA: 'write_magma',
  ADD_CLARIFYING_QUESTION: 'add_clarifying_question',
  SEARCH_MAGMA: 'search_magma',
  LIST_RUN_ARTICLES: 'list_run_articles',
  ADD_OR_UPDATE_DECISION: 'add_or_update_decision',
  RETIRE_DECISION: 'retire_decision',
  RESOLVE_QUESTION: 'resolve_question',
} as const;

// Tool schemas passed to the Anthropic API — collocated with handlers so names can't drift
export const MAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: TOOL_NAMES.READ_TURNS,
    description: 'Read a range of past transcript turns for context. Start at 0 and work forward.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start: { type: 'integer', description: '0-based inclusive start turn index' },
        end:   { type: 'integer', description: 'Inclusive end index. Must be < current turn.' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: TOOL_NAMES.READ_MAGMA,
    description: 'Read an existing Magma article by path. Always read before rewriting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path without .md extension. E.g. "auth/jwt-tokens"' },
      },
      required: ['path'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_MAGMA,
    description: 'Search existing Magma articles by topic. Use before creating to avoid duplicates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Topic keywords' },
      },
      required: ['query'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_VAULT,
    description: 'Search vault notes by topic for additional context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: TOOL_NAMES.READ_VAULT,
    description: 'Read a specific vault note by full path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Full vault path including .md extension' },
      },
      required: ['path'],
    },
  },
  {
    name: TOOL_NAMES.WRITE_MAGMA,
    description: 'Write or overwrite a Magma article. Replaces the entire file. Read first if it exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:       { type: 'string', description: 'Article path without .md. Title Case with spaces. E.g. "rotors/EMPR Blade Morphing".' },
        content:    { type: 'string', description: 'Full Markdown content including frontmatter.' },
        citations:  { type: 'array', items: { type: 'integer' }, description: 'Turn numbers cited in this article.' },
        confidence: { type: 'string', enum: ['stub', 'provisional', 'settled'], description: 'Confidence level.' },
      },
      required: ['path', 'content', 'citations', 'confidence'],
    },
  },
  {
    name: TOOL_NAMES.ADD_CLARIFYING_QUESTION,
    description: 'Queue a question for the user when information is ambiguous and requires human input.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question:         { type: 'string', description: 'Specific, answerable question.' },
        context:          { type: 'string', description: 'Why this came up and why it matters.' },
        affectedArticles: { type: 'array', items: { type: 'string' }, description: 'Article paths affected.' },
      },
      required: ['question', 'context'],
    },
  },
  {
    name: TOOL_NAMES.LIST_RUN_ARTICLES,
    description: 'List all Magma articles written in this session. Use sparingly — prefer the context seed.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: TOOL_NAMES.ADD_OR_UPDATE_DECISION,
    description: 'Create or update an Active or Open decision log entry. Call after writing articles for a turn.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:          { type: 'string', description: 'kebab-case slug, e.g. "empr-primary-invention"' },
        text:        { type: 'string', description: 'Human-readable statement (≤200 chars)' },
        status:      { type: 'string', enum: ['active', 'open'], description: '"active" = decision currently shaping note-taking; "open" = question whose answer would change article structure' },
        createdTurn: { type: 'number', description: 'Turn number where this decision or question arose' },
      },
      required: ['id', 'text', 'status', 'createdTurn'],
    },
  },
  {
    name: TOOL_NAMES.RETIRE_DECISION,
    description: 'Move an Active or Open entry to Retired. One-way — retired entries cannot be reactivated.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:             { type: 'string', description: 'ID of the entry to retire' },
        reason:         { type: 'string', description: 'Why this entry is being retired (≤200 chars)' },
        resolutionTurn: { type: 'number', description: 'Turn where retirement was decided (optional)' },
      },
      required: ['id', 'reason'],
    },
  },
  {
    name: TOOL_NAMES.RESOLVE_QUESTION,
    description: 'Graduate an Open Question to Active Decision or Retired.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:         { type: 'string', description: 'ID of the Open Question to resolve' },
        resolution: { type: 'string', enum: ['active', 'retired'], description: '"active" = answered, now a standing decision; "retired" = answered no or thread abandoned' },
      },
      required: ['id', 'resolution'],
    },
  },
];

// Paths use Title Case with spaces: "rotors/EMPR Blade Morphing"
// Allow a-z A-Z 0-9 spaces hyphens underscores forward-slashes parentheses
const PATH_RE = /^[a-zA-Z0-9 _/()\-]+$/;

export function validateMagmaPath(path: string): string | null {
  if (!path) return 'path is required';
  if (path.startsWith('/')) return 'path must not start with /';
  if (path.includes('//')) return 'path must not contain //';
  if (path.includes('..')) return 'path must not contain ..';
  if (!PATH_RE.test(path)) return 'path must use Title Case with spaces (e.g. "rotors/EMPR Blade Morphing")';
  return null;
}

export interface ValidateInput {
  path: string;
  content: string;
  citations: number[];
  confidence: string;
  prevContent: string | null;
  isTrajectoryPass?: boolean;
  perTurnArticles?: Set<string>;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; validator: string; error: string };

/**
 * Run all structural validators against a write_magma input.
 * Each validator returns a corrective error message naming the offending values
 * so the LLM gets it right on retry.
 */
export function validateWriteMagmaInput(input: ValidateInput): ValidationResult {
  const { path, content, citations, confidence } = input;

  const pathErr = validateMagmaPath(path);
  if (pathErr) return { valid: false, validator: 'path', error: pathErr };
  if (!content) return { valid: false, validator: 'content', error: 'content is required' };
  if (!Array.isArray(citations) || citations.length === 0) {
    return { valid: false, validator: 'citations', error: 'citations must be a non-empty array' };
  }
  if (confidence !== 'stub' && confidence !== 'provisional' && confidence !== 'settled') {
    return { valid: false, validator: 'confidence', error: 'confidence must be stub, provisional, or settled' };
  }

  // Validator 1: path↔title parens consistency.
  const titleParensErr = checkPathTitleParens(path, content);
  if (titleParensErr) {
    return { valid: false, validator: 'path_title_parens', error: titleParensErr };
  }

  // Validator 2: citation completeness.
  // Every (turn N) reference in the body must appear in frontmatter citations.
  const citationErr = checkCitationCompleteness(content, citations);
  if (citationErr) {
    return { valid: false, validator: 'citation_completeness', error: citationErr };
  }

  // Validator 3: [!critique] block append-only preservation.
  if (input.prevContent) {
    const critiqueErr = checkCritiquePreservation(input.prevContent, content);
    if (critiqueErr) {
      return { valid: false, validator: 'critique_preservation', error: critiqueErr };
    }
  }

  // Validator 4: per-turn article protection.
  if (input.isTrajectoryPass && input.prevContent && input.perTurnArticles?.has(path)) {
    const shrinkErr = checkPerTurnShrink(input.prevContent, content, path);
    if (shrinkErr) {
      return { valid: false, validator: 'per_turn_protection', error: shrinkErr };
    }
  }

  // Validator 5: 150-word granularity floor.
  // Non-stub articles must have substantive body content. Below the floor,
  // reject with corrective message — the agent should either expand the article
  // or downgrade confidence to "stub".
  const wordFloorErr = checkWordFloor(content, confidence);
  if (wordFloorErr) {
    return { valid: false, validator: 'word_floor', error: wordFloorErr };
  }

  return { valid: true };
}

const WORD_FLOOR = 150;

export function countBodyWords(content: string): number {
  let body = content;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4);
  }
  // Strip code fences (don't count code as content)
  body = body.replace(/```[\s\S]*?```/g, ' ');
  const words = body.match(/\b\w+\b/g);
  return words ? words.length : 0;
}

function checkWordFloor(content: string, confidence: string): string | null {
  if (confidence === 'stub') return null; // stubs are allowed to be small
  const words = countBodyWords(content);
  if (words >= WORD_FLOOR) return null;
  return `article body has ${words} words, below the ${WORD_FLOOR}-word floor for confidence: ${confidence} — either expand to >=${WORD_FLOOR} words or set confidence: stub`;
}

const PER_TURN_SHRINK_FLOOR = 0.5; // new content must be at least 50% of prev body length

function bodyLength(content: string): number {
  // Strip frontmatter for shrink comparison
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) return content.length - (end + 4);
  }
  return content.length;
}

function checkPerTurnShrink(prevContent: string, newContent: string, path: string): string | null {
  const prevLen = bodyLength(prevContent);
  const newLen = bodyLength(newContent);
  if (prevLen < 100) return null; // tiny prev — no protection needed
  if (newLen >= prevLen * PER_TURN_SHRINK_FLOOR) return null;
  return `trajectory pass cannot collapse "${path}" — it was written by the main loop and shrinking from ${prevLen} to ${newLen} chars exceeds the protection threshold. Downgrade confidence or create a separate merge-target article instead of emptying this one.`;
}

/**
 * Extract named critique concerns from `[!critique]` callout blocks.
 * A "named concern" is a bold heading (**Name**) inside a > [!critique] callout.
 * Returns the set of concern names found.
 *
 * Example callout:
 *   > [!critique] Turn 1
 *   > **Control authority concern**: ...
 *   > **Yaw simplicity concern**: ...
 * → {"Control authority concern", "Yaw simplicity concern"}
 */
export function extractCritiqueConcerns(content: string): Set<string> {
  const concerns = new Set<string>();
  const blocks = parseBlocks(content);
  for (const b of blocks) {
    if (b.type !== 'blockquote') continue;
    if (!/\[!critique\]/i.test(b.content)) continue;
    // Find bold headings: **Concern Name** (with optional trailing colon).
    // Only count those at the start of a quoted line (after `>` and whitespace).
    const re = /^>\s*\*\*([^*\n]+?)\*\*/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b.content)) !== null) {
      concerns.add(m[1].trim());
    }
  }
  return concerns;
}

function checkCritiquePreservation(prevContent: string, newContent: string): string | null {
  const prevConcerns = extractCritiqueConcerns(prevContent);
  if (prevConcerns.size === 0) return null;
  const newConcerns = extractCritiqueConcerns(newContent);
  const missing: string[] = [];
  for (const c of prevConcerns) {
    if (!newConcerns.has(c)) missing.push(c);
  }
  if (missing.length === 0) return null;
  return `[!critique] block lost named concern(s) during rewrite: ${missing.map(c => `"${c}"`).join(', ')} — preserve all original named concerns; you may add new ones or expand existing body content`;
}

/**
 * Extract turn numbers referenced as "(turn N)" in article body content.
 * Uses block-parser to skip frontmatter and code blocks (where literal
 * "turn N" might appear without being a real citation).
 */
export function extractBodyTurnCitations(content: string): number[] {
  const blocks = parseBlocks(content);
  const found = new Set<number>();
  const re = /\(turn\s+(\d+)\)/g;
  for (const b of blocks) {
    if (b.type === 'frontmatter' || b.type === 'code') continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b.content)) !== null) {
      found.add(parseInt(m[1], 10));
    }
  }
  return [...found].sort((a, b) => a - b);
}

function checkCitationCompleteness(content: string, citations: number[]): string | null {
  const referenced = extractBodyTurnCitations(content);
  if (referenced.length === 0) return null; // body has no (turn N) refs — nothing to enforce
  const cited = new Set(citations);
  const missing = referenced.filter(t => !cited.has(t));
  if (missing.length === 0) return null;
  return `frontmatter cites [${[...cited].sort((a, b) => a - b).join(', ')}] but body references turn(s) [${missing.join(', ')}] — include all referenced turns in citations`;
}

/**
 * Extract the `title:` field from a YAML frontmatter block.
 * Returns null if no frontmatter or no title field.
 */
export function extractFrontmatterTitle(content: string): string | null {
  if (!content.startsWith('---')) return null;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return null;
  const fm = content.slice(0, endIdx);
  const m = /^title:\s*(.+?)\s*$/m.exec(fm);
  if (!m) return null;
  // Strip surrounding quotes if present
  return m[1].replace(/^["'](.*)["']$/, '$1').trim();
}

function checkPathTitleParens(path: string, content: string): string | null {
  const title = extractFrontmatterTitle(content);
  if (!title) return null;
  const titleSuffix = /\(([^)]+)\)\s*$/.exec(title);
  if (!titleSuffix) return null;
  const suffix = `(${titleSuffix[1]})`;
  // Check the path's filename portion (after the last /)
  const filename = path.split('/').pop() ?? path;
  if (!filename.includes(suffix)) {
    return `path filename "${filename}" must contain the title suffix "${suffix}" — e.g. path: "${path} ${suffix}"`;
  }
  return null;
}

export interface ToolContext {
  vault: Vault;
  transcript: string[];
  currentPosition: number;
  state: ExtractionRunState;
  config: ExtractionConfig;
  vaultScanner: VaultScanner;
  magmaRoot: string;
  /** True when invoked from the trajectory revision sub-pass.
   *  Per-turn article protection is enforced when true. */
  isTrajectoryPass?: boolean;
}

type ToolResult = Record<string, unknown>;

export async function handleTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  switch (name) {
    case TOOL_NAMES.READ_TURNS:
      return handleReadTurns(input, ctx);
    case TOOL_NAMES.READ_MAGMA:
      return handleReadMagma(input, ctx);
    case TOOL_NAMES.SEARCH_VAULT:
      return handleSearchVault(input, ctx);
    case TOOL_NAMES.READ_VAULT:
      return handleReadVault(input, ctx);
    case TOOL_NAMES.WRITE_MAGMA:
      return handleWriteMagma(input, ctx);
    case TOOL_NAMES.ADD_CLARIFYING_QUESTION:
      return handleAddClarifyingQuestion(input, ctx);
    case TOOL_NAMES.SEARCH_MAGMA:
      return handleSearchMagma(input, ctx);
    case TOOL_NAMES.LIST_RUN_ARTICLES:
      return handleListRunArticles(ctx);
    case TOOL_NAMES.ADD_OR_UPDATE_DECISION:
      return handleAddOrUpdateDecision(input, ctx);
    case TOOL_NAMES.RETIRE_DECISION:
      return handleRetireDecision(input, ctx);
    case TOOL_NAMES.RESOLVE_QUESTION:
      return handleResolveQuestion(input, ctx);
    default:
      return { error: `unknown tool: ${name}` };
  }
}

function handleReadTurns(
  input: Record<string, unknown>,
  ctx: ToolContext
): ToolResult {
  const start = input.start as number;
  const end = input.end as number;

  if (typeof start !== 'number' || start < 0) return { error: 'start must be >= 0' };
  if (typeof end !== 'number') return { error: 'end must be a number' };
  if (end >= ctx.currentPosition) {
    return { error: `Cannot read turn ${end} — currently at turn ${ctx.currentPosition}` };
  }
  if (end - start + 1 > ctx.config.MAX_TURN_RANGE) {
    return {
      error: `Range too large — max ${ctx.config.MAX_TURN_RANGE} turns per call (requested ${end - start + 1})`,
    };
  }

  const turns = ctx.transcript.slice(start, end + 1);
  const payload = JSON.stringify(turns);
  if (payload.length > ctx.config.MAX_TURN_CHARS) {
    return { error: `Payload exceeds ${ctx.config.MAX_TURN_CHARS} chars — narrow the range` };
  }

  return { turns };
}

async function handleReadMagma(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const path = input.path as string;
  const err = validateMagmaPath(path);
  if (err) return { error: err };

  const fullPath = `${ctx.magmaRoot}/${path}.md`;
  const file = ctx.vault.getFileByPath(fullPath);
  if (file) {
    return { content: await ctx.vault.read(file) };
  }
  // Vault doesn't index .magma on restart — fall back to adapter
  if (await ctx.vault.adapter.exists(fullPath)) {
    return { content: await ctx.vault.adapter.read(fullPath) };
  }
  return { error: 'not found' };
}

function handleSearchVault(
  input: Record<string, unknown>,
  ctx: ToolContext
): ToolResult {
  const query = input.query as string;
  if (!query) return { results: [] };

  const results = ctx.vaultScanner.search(query, 3);
  return { results };
}

async function handleReadVault(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const path = input.path as string;
  if (!path || path.includes('..')) return { error: 'invalid path' };

  const file = ctx.vault.getFileByPath(path);
  if (!file) return { error: 'not found' };

  const content = await ctx.vault.read(file);
  return { content };
}

async function handleWriteMagma(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const path = input.path as string;
  const content = input.content as string;
  const citations = input.citations as number[];
  const confidence = input.confidence as string;

  const fullPath = `${ctx.magmaRoot}/${path}.md`;
  const prevContent = await readPrevContent(ctx, fullPath);

  ctx.state.writeAttempts++;
  const result = validateWriteMagmaInput({
    path, content, citations, confidence, prevContent,
    isTrajectoryPass: ctx.isTrajectoryPass === true,
    perTurnArticles: ctx.state.perTurnArticles,
  });
  if (!result.valid) {
    ctx.state.validatorRejections.push({
      validator: result.validator,
      path: path ?? '',
      reason: result.error,
      isTrajectoryPass: ctx.isTrajectoryPass === true,
      ts: Date.now(),
    });
    return { error: result.error, validator: result.validator };
  }

  // Ensure parent directories exist (adapter-level, no vault-index side effects)
  await ensureDir(ctx.vault, fullPath);

  const indexed = ctx.vault.getFileByPath(fullPath);
  if (indexed) {
    // File is in vault index — standard modify path
    if (prevContent !== null) ctx.state.lastGoodContent.set(fullPath, prevContent);
    await ctx.vault.modify(indexed, content);
  } else if (await ctx.vault.adapter.exists(fullPath)) {
    // File on disk but not in vault index (Obsidian doesn't re-index .magma on restart).
    // Remove and recreate so vault.create() re-indexes it — makes it openable in Editor.
    if (prevContent !== null) ctx.state.lastGoodContent.set(fullPath, prevContent);
    await ctx.vault.adapter.remove(fullPath);
    await ctx.vault.create(fullPath, content);
  } else {
    await ctx.vault.create(fullPath, content);
  }

  // Track in runArticles (write order index)
  if (!ctx.state.runArticles.has(path)) {
    ctx.state.runArticles.set(path, ctx.state.runArticles.size);
  }
  ctx.state.currentTurnWritten.add(fullPath);

  // Per-turn article protection: only the main loop populates perTurnArticles.
  // The trajectory pass cannot delete or shrink articles in this set.
  if (!ctx.isTrajectoryPass) {
    ctx.state.perTurnArticles.add(path);
    if (!ctx.state.runArticleTurnMap.has(path)) {
      ctx.state.runArticleTurnMap.set(path, ctx.currentPosition);
    }
  }

  return { success: true, path };
}

async function readPrevContent(ctx: ToolContext, fullPath: string): Promise<string | null> {
  const indexed = ctx.vault.getFileByPath(fullPath);
  if (indexed) return ctx.vault.read(indexed);
  if (await ctx.vault.adapter.exists(fullPath)) return ctx.vault.adapter.read(fullPath);
  return null;
}

function handleAddClarifyingQuestion(
  input: Record<string, unknown>,
  ctx: ToolContext
): ToolResult {
  const question = input.question as string;
  const context = input.context as string;
  const affectedArticles = (input.affectedArticles as string[] | undefined) ?? [];

  if (!question) return { error: 'question is required' };
  if (!context) return { error: 'context is required' };

  const q: ClarifyingQuestion = { question, context, affectedArticles };
  ctx.state.clarifyingQuestions.push(q);

  return { success: true };
}

function handleSearchMagma(
  input: Record<string, unknown>,
  ctx: ToolContext
): ToolResult {
  const query = input.query as string;
  if (!query) return { results: [] };

  // TF-IDF search over in-memory runArticles content (simplified: title matching only for now)
  // TODO: build incremental TF-IDF index over magma article content
  const results: Array<{ path: string; title: string; score: number }> = [];
  const queryTerms = query.toLowerCase().split(/\s+/);

  for (const [path] of ctx.state.runArticles) {
    const title = path.split('/').pop() ?? path;
    const titleLower = title.replace(/_/g, ' ').toLowerCase();
    const matches = queryTerms.filter(t => titleLower.includes(t)).length;
    if (matches > 0) results.push({ path, title, score: matches / queryTerms.length });
  }

  return {
    results: results.sort((a, b) => b.score - a.score).slice(0, 3),
  };
}

function handleListRunArticles(ctx: ToolContext): ToolResult {
  const articles = [...ctx.state.runArticles.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([path]) => path);
  return { articles };
}

function handleAddOrUpdateDecision(
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolResult {
  const id = input.id as string;
  const text = input.text as string;
  const status = input.status as string;
  const createdTurn = input.createdTurn as number;

  if (!id) return { error: 'id is required' };
  if (!text) return { error: 'text is required' };
  if (text.length > 200) return { error: 'text must be ≤200 chars' };
  if (status !== 'active' && status !== 'open') return { error: 'status must be "active" or "open"' };
  if (typeof createdTurn !== 'number') return { error: 'createdTurn must be a number' };

  const log = ctx.state.decisionLog;

  if (log.retired.some(d => d.id === id)) {
    return { error: `"${id}" is retired and cannot be updated` };
  }

  const otherList = status === 'active' ? log.open : log.active;
  if (otherList.some(d => d.id === id)) {
    const tip = status === 'open'
      ? 'use retire_decision to retire an active entry'
      : 'use resolve_question to promote an open question to active';
    return { error: `"${id}" exists with a different status — ${tip}` };
  }

  const targetList = status === 'active' ? log.active : log.open;
  const idx = targetList.findIndex(d => d.id === id);
  if (idx !== -1) {
    targetList[idx].text = text;
    return { success: true };
  }

  targetList.push({ id, text, status: status as 'active' | 'open', createdTurn });
  return { success: true };
}

function handleRetireDecision(
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolResult {
  const id = input.id as string;
  const reason = input.reason as string;
  const resolutionTurn = typeof input.resolutionTurn === 'number'
    ? input.resolutionTurn
    : ctx.currentPosition;

  if (!id) return { error: 'id is required' };
  if (!reason) return { error: 'reason is required' };
  if (reason.length > 200) return { error: 'reason must be ≤200 chars' };

  const log = ctx.state.decisionLog;

  if (log.retired.some(d => d.id === id)) {
    return { error: `"${id}" is already retired` };
  }

  let entry: Decision | undefined;

  const activeIdx = log.active.findIndex(d => d.id === id);
  if (activeIdx !== -1) {
    [entry] = log.active.splice(activeIdx, 1);
  } else {
    const openIdx = log.open.findIndex(d => d.id === id);
    if (openIdx !== -1) {
      [entry] = log.open.splice(openIdx, 1);
    }
  }

  if (!entry) return { error: `"${id}" not found in active or open decisions` };

  log.retired.push({
    ...entry,
    status: 'retired',
    text: `${entry.text} → ${reason}`,
    resolutionTurn,
  });

  return { success: true };
}

function handleResolveQuestion(
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolResult {
  const id = input.id as string;
  const resolution = input.resolution as string;

  if (!id) return { error: 'id is required' };
  if (resolution !== 'active' && resolution !== 'retired') {
    return { error: 'resolution must be "active" or "retired"' };
  }

  const log = ctx.state.decisionLog;
  const openIdx = log.open.findIndex(d => d.id === id);
  if (openIdx === -1) {
    return { error: `"${id}" not found in open questions` };
  }

  const [entry] = log.open.splice(openIdx, 1);

  if (resolution === 'active') {
    log.active.push({ ...entry, status: 'active' });
  } else {
    log.retired.push({
      ...entry,
      status: 'retired',
      text: `${entry.text} → answered`,
      resolutionTurn: ctx.currentPosition,
    });
  }

  return { success: true };
}
