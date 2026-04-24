import Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { handleTool, type ToolContext } from './tools';

export interface LoopOptions {
  client: Anthropic;
  transcript: string[];
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  vaultScanner: VaultScanner;
  magmaRoot: string;
  onProgress: (turn: number, total: number, etaMs?: number) => void;
  onWriteMagma: (path: string) => void;
}

// TODO: implement full agentic extraction loop (spec: src/extraction/loop.ts)
// Reference: design doc — Main Extraction Loop section
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
      // continue to next turn — partial extraction > none
    } finally {
      state.currentController = null;
    }
  }

  onProgress(total, total);
}

async function processTurn(
  _turn: number,
  _content: string,
  _ctx: ToolContext,
  _opts: LoopOptions
): Promise<void> {
  // TODO: implement per-turn agentic loop
  // 1. Build context seed (Magma title list + vault note titles)
  // 2. Call API with streaming, handle tool_use blocks
  // 3. Dispatch each tool_use to handleTool()
  // 4. Enforce MAX_TOOL_CALLS_PER_TURN
  // 5. Handle HTTP 429 with exponential backoff (RETRY_429_MAX, RETRY_429_BASE_MS)
  // 6. Continue until stop_reason === 'end_turn'
  throw new Error('processTurn not yet implemented');
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
