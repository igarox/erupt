import Anthropic from '@anthropic-ai/sdk';
import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';

export interface FinalPassOptions {
  client: Anthropic;
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  magmaRoot: string;
  onProgress: (label: string) => void;
}

// TODO: implement two-round final pass (spec: src/extraction/final-pass.ts)
// Sub-pass 1: compliance (Round 1 decompose + Round 2 parallel compliance at concurrency=3)
// Sub-pass 2: contradiction detection (batches of SUBPASS2_BATCH_SIZE, solo for large articles)
export async function runFinalPass(opts: FinalPassOptions): Promise<void> {
  opts.onProgress('final pass');
  await runSubPass1(opts);
  await runSubPass2(opts);
}

async function runSubPass1(_opts: FinalPassOptions): Promise<void> {
  // Round 1: decompose articles > DECOMPOSE_THRESHOLD chars
  // Round 2: compliance check in parallel (concurrency = SUBPASS1_CONCURRENCY)
  // TODO: implement
}

async function runSubPass2(_opts: FinalPassOptions): Promise<void> {
  // Batch articles (max SUBPASS2_BATCH_SIZE per call, solo for articles > SUBPASS2_SOLO_THRESHOLD)
  // Check cross-article contradictions; call write_magma or add_clarifying_question
  // TODO: implement
}
