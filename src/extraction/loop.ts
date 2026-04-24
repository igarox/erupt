import Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { handleTool, MAIN_TOOLS, TOOL_NAMES, type ToolContext } from './tools';
import { EXTRACTION_SYSTEM_PROMPT } from './prompt';

export interface LoopOptions {
  client: Anthropic;
  model: string;
  transcript: string[];
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  vaultScanner: VaultScanner;
  magmaRoot: string;
  onProgress: (turn: number, total: number, etaMs?: number) => void;
  onWriteMagma: (path: string) => void;
}

export async function runExtractionLoop(opts: LoopOptions): Promise<void> {
  const { transcript, state, config, onProgress } = opts;
  const total = transcript.length;
  const startMs = Date.now();

  for (let turn = 0; turn < total; turn++) {
    state.currentTurnWritten.clear();

    onProgress(turn, total, estimateEta(startMs, turn, total));

    const ctx: ToolContext = {
      vault: opts.vault,
      transcript,
      currentPosition: turn,
      state,
      config,
      vaultScanner: opts.vaultScanner,
      magmaRoot: opts.magmaRoot,
    };

    state.currentController = new AbortController();

    try {
      await processTurn(turn, transcript[turn], ctx, opts);
    } catch (err) {
      if (isAbortError(err)) throw err; // propagate cancellation
      state.errorCount++;
      await quarantineTurnArticles(opts.vault, state);
      await appendLog(opts.vault, opts.magmaRoot, {
        event: 'turn_error',
        turn,
        error: err instanceof Error ? err.message : String(err),
      });
      // continue to next turn — partial extraction > none
    } finally {
      state.currentController = null;
    }
  }

  onProgress(total, total);
}

async function processTurn(
  turn: number,
  content: string,
  ctx: ToolContext,
  opts: LoopOptions,
): Promise<void> {
  const { client, state, config } = opts;
  const signal = state.currentController!.signal;

  // Build context seed: article list + vault titles + current turn content
  const magmaTitles = [...state.runArticles.keys()];
  const vaultTitles = opts.vault.getMarkdownFiles().map(f => f.basename);

  const contextSeed = [
    magmaTitles.length > 0
      ? `Magma articles in this session:\n${magmaTitles.join('\n')}`
      : 'Magma articles in this session: (none yet)',
    vaultTitles.length > 0
      ? `Vault note titles:\n${vaultTitles.join('\n')}`
      : 'Vault note titles: (none)',
    '',
    `Process turn ${turn}:`,
    content,
  ].join('\n');

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: contextSeed },
  ];

  let toolCallCount = 0;

  while (true) {
    const response = await callWithRetry(client, opts.model, messages, signal, config);

    // Accumulate assistant response for next round
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let limitReached = false;

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        toolCallCount++;

        let result: Record<string, unknown>;
        if (toolCallCount > config.MAX_TOOL_CALLS_PER_TURN) {
          result = { error: 'Tool call limit reached for this turn.' };
          limitReached = true;
        } else {
          result = await handleTool(block.name, block.input as Record<string, unknown>, ctx);
          if (block.name === TOOL_NAMES.WRITE_MAGMA && result.success) {
            opts.onWriteMagma(result.path as string);
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });

      if (limitReached) {
        await appendLog(opts.vault, opts.magmaRoot, {
          event: 'loop_depth_exceeded',
          turn,
          toolCallCount,
        });
        break;
      }
    }
  }
}

async function callWithRetry(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
  signal: AbortSignal,
  config: ExtractionConfig,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= config.RETRY_429_MAX; attempt++) {
    try {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: 4096,
          system: [
            {
              type: 'text',
              text: EXTRACTION_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
          tools: MAIN_TOOLS,
        },
        { signal },
      );
      return await stream.finalMessage();
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof Anthropic.APIError && err.status === 429 && attempt < config.RETRY_429_MAX) {
        await sleep(config.RETRY_429_BASE_MS * Math.pow(2, attempt), signal);
        continue;
      }
      throw err;
    }
  }
  // unreachable — loop always throws or returns before exhausting
  throw new Error('callWithRetry: retry limit exceeded without throwing');
}

async function appendLog(
  vault: Vault,
  magmaRoot: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const logPath = magmaRoot.replace(/\/wiki$/, '') + '/extraction_log.jsonl';
  const line = JSON.stringify({ ...entry, ts: Date.now() }) + '\n';
  const file = vault.getFileByPath(logPath);
  if (file) {
    await vault.modify(file, (await vault.read(file)) + line);
  } else {
    await vault.create(logPath, line);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function estimateEta(startMs: number, turnsDone: number, total: number): number | undefined {
  if (turnsDone === 0) return undefined;
  const elapsed = Date.now() - startMs;
  return Math.round((elapsed / turnsDone) * (total - turnsDone));
}

async function quarantineTurnArticles(vault: Vault, state: ExtractionRunState): Promise<void> {
  for (const fullPath of state.currentTurnWritten) {
    const file = vault.getFileByPath(fullPath);
    if (!file) continue;
    const content = await vault.read(file);
    // Inject draft-failed: true into frontmatter
    if (content.startsWith('---')) {
      const endFm = content.indexOf('---', 3);
      if (endFm > 0) {
        const fm = content.slice(0, endFm);
        const rest = content.slice(endFm);
        if (!fm.includes('draft-failed:')) {
          await vault.modify(file, fm + 'draft-failed: true\n' + rest);
        }
        continue;
      }
    }
    // No frontmatter — prepend it
    await vault.modify(file, '---\ndraft-failed: true\n---\n' + content);
  }
}

function isAbortError(err: unknown): err is Error {
  return err instanceof Error && err.name === 'AbortError';
}
