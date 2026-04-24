import Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { MAIN_TOOLS, TOOL_NAMES, handleTool, type ToolContext } from './tools';
import { COMPLIANCE_SYSTEM_PROMPT, CONTRADICTION_SYSTEM_PROMPT } from './prompt';

export interface FinalPassOptions {
  client: Anthropic;
  model: string;
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  vaultScanner: VaultScanner;
  magmaRoot: string;
  onProgress: (label: string) => void;
}

const COMPLIANCE_TOOLS = MAIN_TOOLS.filter(t => t.name === TOOL_NAMES.WRITE_MAGMA);

const CONTRADICTION_TOOLS = MAIN_TOOLS.filter(t =>
  ([TOOL_NAMES.WRITE_MAGMA, TOOL_NAMES.ADD_CLARIFYING_QUESTION, TOOL_NAMES.READ_VAULT] as string[])
    .includes(t.name)
);

export async function runFinalPass(opts: FinalPassOptions): Promise<void> {
  if (opts.state.runArticles.size === 0) return;
  opts.onProgress('final pass');
  await runSubPass1(opts);
  await runSubPass2(opts);
}

// ─── Sub-pass 1: compliance ───────────────────────────────────────────────────

async function runSubPass1(opts: FinalPassOptions): Promise<void> {
  opts.onProgress('compliance check');

  // Round 1: decompose large articles sequentially
  // New articles created here are added to state.runArticles by handleWriteMagma
  const round1Paths = [...opts.state.runArticles.keys()];
  for (const path of round1Paths) {
    const content = await readArticle(path, opts);
    if (content !== null && content.length > opts.config.DECOMPOSE_THRESHOLD) {
      await runComplianceCheck(path, content, opts).catch(() => {
        opts.state.errorCount++;
      });
    }
  }

  // Round 2: compliance on ALL articles in parallel chunks (includes any newly split ones)
  const round2Paths = [...opts.state.runArticles.keys()];
  for (let i = 0; i < round2Paths.length; i += opts.config.SUBPASS1_CONCURRENCY) {
    const chunk = round2Paths.slice(i, i + opts.config.SUBPASS1_CONCURRENCY);
    await Promise.all(chunk.map(async (path) => {
      const content = await readArticle(path, opts);
      if (content === null) return;
      await runComplianceCheck(path, content, opts).catch(() => {
        opts.state.errorCount++;
      });
    }));
  }
}

async function runComplianceCheck(
  path: string,
  content: string,
  opts: FinalPassOptions,
): Promise<void> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Review and fix this article:\n\npath: ${path}\n\n${content}` },
  ];
  await runFinalPassLoop(messages, COMPLIANCE_TOOLS, COMPLIANCE_SYSTEM_PROMPT, opts);
}

// ─── Sub-pass 2: contradiction detection ─────────────────────────────────────

async function runSubPass2(opts: FinalPassOptions): Promise<void> {
  opts.onProgress('consistency check');

  // Load all articles into memory — TypeScript reads them, not the model
  const articles: Array<{ path: string; content: string }> = [];
  for (const [path] of opts.state.runArticles) {
    const content = await readArticle(path, opts);
    if (content !== null) articles.push({ path, content });
  }
  if (articles.length === 0) return;

  // Large articles run solo; small articles run in batches
  const solo = articles.filter(a => a.content.length > opts.config.SUBPASS2_SOLO_THRESHOLD);
  const batch = articles.filter(a => a.content.length <= opts.config.SUBPASS2_SOLO_THRESHOLD);

  for (const article of solo) {
    await runContradictionCheck([article], opts).catch(() => {
      opts.state.errorCount++;
    });
  }

  for (let i = 0; i < batch.length; i += opts.config.SUBPASS2_BATCH_SIZE) {
    await runContradictionCheck(batch.slice(i, i + opts.config.SUBPASS2_BATCH_SIZE), opts).catch(() => {
      opts.state.errorCount++;
    });
  }
}

async function runContradictionCheck(
  articles: Array<{ path: string; content: string }>,
  opts: FinalPassOptions,
): Promise<void> {
  const articlesText = articles
    .map(a => `Article: ${a.path}\n---\n${a.content}\n---`)
    .join('\n\n');
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: articlesText },
  ];
  await runFinalPassLoop(messages, CONTRADICTION_TOOLS, CONTRADICTION_SYSTEM_PROMPT, opts);
}

// ─── Shared agentic loop ──────────────────────────────────────────────────────

async function runFinalPassLoop(
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  systemPrompt: string,
  opts: FinalPassOptions,
): Promise<void> {
  const ctx = makeFinalPassCtx(opts);

  while (true) {
    const response = await callFinalPassApi(
      opts.client, opts.model, messages, tools, systemPrompt, opts.config,
    );
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await handleTool(
          block.name,
          block.input as Record<string, unknown>,
          ctx,
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFinalPassCtx(opts: FinalPassOptions): ToolContext {
  return {
    vault: opts.vault,
    transcript: [],      // unused — final pass tools don't call read_turns
    currentPosition: 0,  // unused
    state: opts.state,
    config: opts.config,
    vaultScanner: opts.vaultScanner,
    magmaRoot: opts.magmaRoot,
  };
}

async function callFinalPassApi(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  systemPrompt: string,
  config: ExtractionConfig,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= config.RETRY_429_MAX; attempt++) {
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages,
        tools,
      });
      return await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIError && err.status === 429 && attempt < config.RETRY_429_MAX) {
        await sleep(config.RETRY_429_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('callFinalPassApi: retry limit exceeded');
}

async function readArticle(path: string, opts: FinalPassOptions): Promise<string | null> {
  const fullPath = `${opts.magmaRoot}/${path}.md`;
  const file = opts.vault.getFileByPath(fullPath);
  if (!file) return null;
  return opts.vault.read(file);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
