import Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';

// ScoutOutput — Pass 1 of the 3-pass fallback for non-tool-use Ollama models
export interface ScoutOutput {
  topics: {
    name: string;
    articlePath: string;
    turnStart: number;
    turnEnd: number;
    summary: string;
  }[];
}

// QAOutput — Pass 3 of the 3-pass fallback
export interface QAOutput {
  corrections: {
    path: string;
    issue: string;
    fix: string;
  }[];
}

export interface FallbackOptions {
  client: Anthropic;
  transcript: string[];
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  magmaRoot: string;
  onProgress: (label: string) => void;
}

// TODO: implement 3-pass blob fallback (spec: src/extraction/fallback.ts)
// Pass 1: Scout — full transcript → ScoutOutput JSON
// Pass 2: Extract — per topic, transcript slice → write_magma
// Pass 3: QA — all articles → QAOutput JSON → apply corrections
export async function run3PassFallback(opts: FallbackOptions): Promise<void> {
  opts.onProgress('scouting topics');
  const scout = await runScoutPass(opts);
  if (!scout) return; // abort on parse failure

  opts.onProgress('extracting articles');
  await runExtractPass(opts, scout);

  opts.onProgress('quality check');
  await runQAPass(opts);
}

async function runScoutPass(_opts: FallbackOptions): Promise<ScoutOutput | null> {
  // TODO: implement Scout pass
  // On JSON parse failure: log to extraction_log.jsonl + Notice + return null
  return null;
}

async function runExtractPass(
  _opts: FallbackOptions,
  _scout: ScoutOutput
): Promise<void> {
  // TODO: implement per-topic extraction
  // Validate turnStart/turnEnd before slicing; skip + log on invalid range
}

async function runQAPass(_opts: FallbackOptions): Promise<void> {
  // TODO: implement QA pass
  // On JSON parse failure: log warning + skip corrections for that batch
}
