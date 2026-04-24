import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig, ClarifyingQuestion } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { ensureDir } from '../fs';

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
} as const;

const PATH_RE = /^[a-z0-9_\/\-]+$/;

function validateMagmaPath(path: string): string | null {
  if (!path) return 'path is required';
  if (path.startsWith('/')) return 'path must not start with /';
  if (path.includes('//')) return 'path must not contain //';
  if (path.includes('..')) return 'path must not contain ..';
  if (!PATH_RE.test(path)) return 'path must match [a-z0-9_/\\-]+';
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
  if (!file) return { error: 'not found' };

  const content = await ctx.vault.read(file);
  return { content };
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

  const pathErr = validateMagmaPath(path);
  if (pathErr) return { error: pathErr };
  if (!content) return { error: 'content is required' };
  if (!Array.isArray(citations) || citations.length === 0) {
    return { error: 'citations must be a non-empty array' };
  }
  if (confidence !== 'stub' && confidence !== 'provisional') {
    return { error: 'confidence must be stub or provisional' };
  }

  const fullPath = `${ctx.magmaRoot}/${path}.md`;

  // Snapshot existing content before overwrite
  const existing = ctx.vault.getFileByPath(fullPath);
  if (existing) {
    const prev = await ctx.vault.read(existing);
    ctx.state.lastGoodContent.set(fullPath, prev);
  }

  // Write the file (create dirs as needed)
  await ensureDir(ctx.vault, fullPath);
  if (existing) {
    await ctx.vault.modify(existing, content);
  } else {
    await ctx.vault.create(fullPath, content);
  }

  // Track in runArticles (write order index)
  if (!ctx.state.runArticles.has(path)) {
    ctx.state.runArticles.set(path, ctx.state.runArticles.size);
  }
  ctx.state.currentTurnWritten.add(fullPath);

  return { success: true, path };
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
