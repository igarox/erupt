import type { Vault } from 'obsidian';
import type { ExtractionRunState, ExtractionConfig } from '../types';
import type { VaultScanner } from '../vault-scanner';
import { handleTool, TOOL_NAMES, type ToolContext } from './tools';

export interface ScoutOutput {
  topics: {
    name: string;
    articlePath: string;
    turnStart: number;
    turnEnd: number;
    summary: string;
  }[];
}

export interface QAOutput {
  corrections: {
    path: string;
    issue: string;
    fix: string;
  }[];
}

export interface FallbackOptions {
  ollamaBaseUrl: string;
  ollamaModel: string;
  transcript: string[];
  vault: Vault;
  state: ExtractionRunState;
  config: ExtractionConfig;
  magmaRoot: string;
  onProgress: (label: string) => void;
}

// Null VaultScanner — fallback tools (write_magma) don't use vault search
const NULL_VAULT_SCANNER: VaultScanner = {
  build: async () => undefined,
  search: () => [],
  isEmpty: () => true,
} as unknown as VaultScanner;

export async function run3PassFallback(opts: FallbackOptions): Promise<void> {
  opts.onProgress('scouting topics');
  const scout = await runScoutPass(opts);
  if (!scout) return; // Scout JSON parse failure — abort; error already counted

  opts.onProgress('extracting articles');
  await runExtractPass(opts, scout);

  opts.onProgress('quality check');
  await runQAPass(opts);
}

// ─── Pass 1: Scout ────────────────────────────────────────────────────────────

const SCOUT_SYSTEM = `You analyze conversation transcripts to identify topics for a knowledge base.

For each distinct technical topic, design decision, system, entity, or concept discussed, provide:
- name: human-readable topic name
- articlePath: lowercase path slug using hyphens and forward slashes (e.g. "auth/jwt-tokens")
- turnStart: 0-based index of the first turn where this topic appears
- turnEnd: 0-based index of the last turn where this topic appears
- summary: one sentence describing the topic

Output ONLY valid JSON. No text before or after.
Schema: {"topics": [{"name": "string", "articlePath": "string", "turnStart": 0, "turnEnd": 0, "summary": "string"}]}`;

async function runScoutPass(opts: FallbackOptions): Promise<ScoutOutput | null> {
  const transcriptText = opts.transcript
    .map((t, i) => `[turn ${i}]: ${t}`)
    .join('\n\n');

  try {
    const raw = await callOllama(opts.ollamaBaseUrl, opts.ollamaModel, [
      { role: 'system', content: SCOUT_SYSTEM },
      { role: 'user', content: transcriptText },
    ]);
    const parsed = JSON.parse(raw) as unknown;
    if (!isScoutOutput(parsed)) {
      throw new Error('Scout response did not match expected schema');
    }
    return parsed;
  } catch (err) {
    opts.state.errorCount++;
    await appendLog(opts.vault, opts.magmaRoot, {
      event: 'scout_failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function isScoutOutput(val: unknown): val is ScoutOutput {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  if (!Array.isArray(obj.topics)) return false;
  return (obj.topics as unknown[]).every(
    (t) =>
      typeof t === 'object' && t !== null &&
      typeof (t as Record<string, unknown>).name === 'string' &&
      typeof (t as Record<string, unknown>).articlePath === 'string' &&
      typeof (t as Record<string, unknown>).turnStart === 'number' &&
      typeof (t as Record<string, unknown>).turnEnd === 'number',
  );
}

// ─── Pass 2: Extract ──────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You write MagmaWiki articles from conversation transcripts.

MagmaWiki article format:
---
path: <topic-path>
title: <Human-readable title>
confidence: stub | provisional
citations: [<turn numbers, comma-separated>]
---

<lead paragraph (2–5 sentences identifying the topic, establishing context, summarizing key points)>

<body paragraphs with (turn N) citations at end of sentences for non-obvious claims>

Rules:
- confidence "stub": topic barely mentioned (2–7 sentences). "provisional": substantively discussed.
- Every non-obvious claim ends with (turn N). Self-evident facts need no citation.
- Each paragraph ends with a ^<slug>-N block anchor (N starts at 1, slug = last path segment).
- Prose over bullet lists. No pro/con lists. No weasel words.

Output ONLY valid JSON — no other text:
{"path": "string", "title": "string", "content": "string (full markdown)", "confidence": "stub", "citations": [0]}`;

async function runExtractPass(opts: FallbackOptions, scout: ScoutOutput): Promise<void> {
  const ctx = makeFallbackCtx(opts);

  for (const topic of scout.topics) {
    // Validate turn range before slicing
    if (
      typeof topic.turnStart !== 'number' || topic.turnStart < 0 ||
      typeof topic.turnEnd !== 'number' || topic.turnEnd >= opts.transcript.length ||
      topic.turnStart > topic.turnEnd
    ) {
      opts.state.errorCount++;
      await appendLog(opts.vault, opts.magmaRoot, {
        event: 'extract_skip_invalid_range',
        topic: topic.name,
        turnStart: topic.turnStart,
        turnEnd: topic.turnEnd,
        transcriptLength: opts.transcript.length,
      });
      continue;
    }

    const turnSlice = opts.transcript
      .slice(topic.turnStart, topic.turnEnd + 1)
      .map((t, i) => `[turn ${topic.turnStart + i}]: ${t}`)
      .join('\n\n');

    const existingPaths = [...opts.state.runArticles.keys()].join('\n') || '(none yet)';

    const userMsg = [
      `Topic: ${topic.name}`,
      `Suggested path: ${topic.articlePath}`,
      `Summary: ${topic.summary}`,
      '',
      'Relevant turns:',
      turnSlice,
      '',
      'Existing article paths (do not create duplicates):',
      existingPaths,
    ].join('\n');

    try {
      const raw = await callOllama(opts.ollamaBaseUrl, opts.ollamaModel, [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: userMsg },
      ]);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed.path || !parsed.content || !parsed.confidence || !Array.isArray(parsed.citations)) {
        throw new Error('Extract response missing required fields');
      }
      await handleTool(TOOL_NAMES.WRITE_MAGMA, parsed, ctx);
    } catch (err) {
      opts.state.errorCount++;
      await appendLog(opts.vault, opts.magmaRoot, {
        event: 'extract_failed',
        topic: topic.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ─── Pass 3: QA ───────────────────────────────────────────────────────────────

const QA_SYSTEM = `You review MagmaWiki articles for quality issues.

Check each article for:
- Missing or weak lead paragraph (should be 2–5 sentences identifying the topic and context)
- Non-obvious claims without a (turn N) citation
- Weasel words ("it seems", "might be", "probably") — replace with direct assertion
- Missing ^slug-N block anchors at end of paragraphs
- Bullet lists that should be prose paragraphs

For each article needing correction, provide the complete corrected markdown content.
Output ONLY valid JSON — no other text:
{"corrections": [{"path": "string", "issue": "string", "fix": "string (full corrected markdown)"}]}
If no corrections are needed: {"corrections": []}`;

async function runQAPass(opts: FallbackOptions): Promise<void> {
  const articles: Array<{ path: string; content: string }> = [];
  for (const [path] of opts.state.runArticles) {
    const fullPath = `${opts.magmaRoot}/${path}.md`;
    const file = opts.vault.getFileByPath(fullPath);
    if (!file) continue;
    const content = await opts.vault.read(file);
    articles.push({ path, content });
  }
  if (articles.length === 0) return;

  const ctx = makeFallbackCtx(opts);
  const batchSize = opts.config.SUBPASS2_BATCH_SIZE;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchText = batch
      .map(a => `Article: ${a.path}\n---\n${a.content}\n---`)
      .join('\n\n');

    try {
      const raw = await callOllama(opts.ollamaBaseUrl, opts.ollamaModel, [
        { role: 'system', content: QA_SYSTEM },
        { role: 'user', content: batchText },
      ]);
      const parsed = JSON.parse(raw) as unknown;
      if (!isQAOutput(parsed)) throw new Error('QA response did not match schema');

      for (const correction of parsed.corrections) {
        if (!correction.fix) continue;
        const fmMatch = correction.fix.match(/^---\n([\s\S]*?)\n---/);
        const fm = fmMatch?.[1] ?? '';
        const citations = extractCitationsFromFm(fm);
        const confidence = extractConfidenceFromFm(fm) ?? 'stub';
        // Use try/catch inline — a bad correction doesn't abort the batch
        await handleTool(TOOL_NAMES.WRITE_MAGMA, {
          path: correction.path,
          content: correction.fix,
          citations,
          confidence,
        }, ctx).catch(() => undefined);
      }
    } catch (err) {
      opts.state.errorCount++;
      await appendLog(opts.vault, opts.magmaRoot, {
        event: 'qa_batch_failed',
        batchStart: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function isQAOutput(val: unknown): val is QAOutput {
  if (typeof val !== 'object' || val === null) return false;
  return Array.isArray((val as Record<string, unknown>).corrections);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFallbackCtx(opts: FallbackOptions): ToolContext {
  return {
    vault: opts.vault,
    transcript: opts.transcript,
    currentPosition: opts.transcript.length,
    state: opts.state,
    config: opts.config,
    vaultScanner: NULL_VAULT_SCANNER,
    magmaRoot: opts.magmaRoot,
  };
}

async function callOllama(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, format: 'json' }),
  });
  if (!resp.ok) {
    throw new Error(`Ollama API error: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json() as { message?: { content?: string } };
  const content = data?.message?.content;
  if (!content) throw new Error('Ollama returned empty response');
  return content;
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

function extractCitationsFromFm(fm: string): number[] {
  const match = fm.match(/citations:\s*\[([^\]]*)\]/);
  if (!match) return [0];
  const nums = match[1]
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
  return nums.length > 0 ? nums : [0];
}

function extractConfidenceFromFm(fm: string): 'stub' | 'provisional' | null {
  const match = fm.match(/confidence:\s*(stub|provisional)/);
  return (match?.[1] as 'stub' | 'provisional') ?? null;
}
