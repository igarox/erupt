/**
 * BYOK-guarded integration test for the decision log scratchpad.
 * Requires ANTHROPIC_API_KEY in the environment. Skipped otherwise.
 *
 * Validates Run 8's primary success criterion:
 *   blade morphing correctly classified → agent calls retire_decision at least once
 *   with an id matching /blade|morph/.
 */

import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { createRunState, DEFAULT_EXTRACTION_CONFIG } from '../../types';
import { runExtractionLoop } from '../loop';

const BYOK = process.env.ANTHROPIC_API_KEY;

// 2-turn synthetic transcript: speculative blade-morphing thread
const BLADE_MORPHING_TRANSCRIPT = [
  // Turn 0 — user describes EMPR as their primary invention
  `I've been designing an electromagnetic pitch rotor (EMPR) as a swashplate-free alternative for helicopter blade pitch control. The core mechanism uses a fixed stator generating a rotating magnetic field gradient that induces cyclic pitch changes in passive blade roots. No active blade-mounted actuators — passive ferromagnetic elements respond to the field gradient. The patent novelty angle is strong: all existing systems use active blade-mounted motors; this passive field-gradient approach is architecturally distinct.`,

  // Turn 1 — assistant raises blade morphing as speculative extension; user says "interesting but let's focus"
  `That sounds fascinating! One potential extension could be adaptive blade morphing — if you could modulate the field gradient at higher frequency, you might get active twist control across the span, effectively morphing the blade profile in flight. This could dramatically extend the flight envelope.

User: Interesting thought, but let's stay focused on the core EMPR mechanism for now. I want to nail the patent claims first before exploring extensions.`,
];

describe.skipIf(!BYOK)('decision log integration — blade morphing retirement', () => {
  it('agent retires blade morphing as Tier 3 curiosity', async () => {
    const client = new Anthropic({ apiKey: BYOK });
    const state = createRunState();

    // Minimal vault stub — decision log tools don't need vault access
    const vault = {
      getFileByPath: () => null,
      adapter: { exists: async () => false, read: async () => '', list: async () => ({ files: [], folders: [] }) },
      getMarkdownFiles: () => [],
      read: async () => '',
      modify: async () => {},
      create: async () => ({} as any),
    } as any;

    await runExtractionLoop({
      client,
      model: 'claude-haiku-4-5-20251001',
      transcript: BLADE_MORPHING_TRANSCRIPT,
      vault,
      state,
      config: DEFAULT_EXTRACTION_CONFIG,
      vaultScanner: { search: () => [] } as any,
      magmaRoot: '.magma/wiki',
      sourceNotePath: 'Test Transcript.md',
      onProgress: () => {},
      onWriteMagma: () => {},
    });

    // Primary assertion: blade morphing was retired
    const allRetired = state.decisionLog.retired;
    const bladeMorphRetirement = allRetired.find(d => /blade|morph/i.test(d.id));

    expect(allRetired.length).toBeGreaterThan(0);
    expect(bladeMorphRetirement).toBeDefined();

    // No validator rejections
    expect(state.validatorRejections).toHaveLength(0);
  }, 60_000);
});
