export function parseTranscript(content: string): string[] {
  // 1. Single JSON document (Claude Exporter, ChatGPT export, etc.)
  const docTurns = tryJsonDocument(content);
  if (docTurns) return docTurns;

  // 2. JSON-per-line (one message object per line)
  const lines = content.split('\n').filter(l => l.trim());
  const jsonTurns = tryJsonPerLine(lines);
  if (jsonTurns) return jsonTurns;

  // 3. Markdown heading split (## Human / ## Assistant)
  const headingTurns = tryHeadingSplit(content);
  if (headingTurns.length > 1) return headingTurns;

  // 4. Fallback: treat entire note as a single turn
  return content.trim() ? [content.trim()] : [];
}

// ── Format: single JSON document with a messages array ───────────────────────
// Handles Claude Exporter ({ messages: [{ role, say }] }),
// standard exports ({ messages: [{ role, content }] }),
// and role variants: Prompt/Response, user/assistant, human/assistant.

function tryJsonDocument(content: string): string[] | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const obj = JSON.parse(trimmed) as unknown;

    // Array of message objects at top level
    if (Array.isArray(obj)) {
      return extractMessages(obj);
    }

    // Object with a messages array (Claude Exporter, OpenAI export, etc.)
    if (typeof obj === 'object' && obj !== null) {
      const rec = obj as Record<string, unknown>;
      if (Array.isArray(rec.messages)) {
        return extractMessages(rec.messages);
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractMessages(messages: unknown[]): string[] | null {
  const turns: string[] = [];
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) return null;
    const m = msg as Record<string, unknown>;

    // Content field: try 'content' then 'say' (Claude Exporter uses 'say')
    const text = typeof m.content === 'string' ? m.content
               : typeof m.say     === 'string' ? m.say
               : null;
    if (!text) return null;

    const role = typeof m.role === 'string' ? normaliseRole(m.role) : null;
    if (!role) return null;

    turns.push(`[${role}]\n${text}`);
  }
  return turns.length >= 2 ? turns : null;
}

function normaliseRole(role: string): string {
  switch (role.toLowerCase()) {
    case 'prompt':
    case 'user':
    case 'human':
      return 'human';
    case 'response':
    case 'assistant':
      return 'assistant';
    default:
      return role.toLowerCase();
  }
}

// ── Format: one JSON object per line (JSONL) ──────────────────────────────────

function tryJsonPerLine(lines: string[]): string[] | null {
  if (lines.length < 2) return null;
  const parsed: Array<{ role: string; content: string }> = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as unknown;
      if (typeof obj !== 'object' || obj === null) return null;
      const m = obj as Record<string, unknown>;
      const text = typeof m.content === 'string' ? m.content
                 : typeof m.say     === 'string' ? m.say
                 : null;
      if (!text || typeof m.role !== 'string') return null;
      parsed.push({ role: normaliseRole(m.role), content: text });
    } catch {
      return null;
    }
  }
  return parsed.map(t => `[${t.role}]\n${t.content}`);
}

// ── Format: Markdown heading split ────────────────────────────────────────────

function tryHeadingSplit(content: string): string[] {
  const MARKER_RE = /(?:^|\n)(?:##\s*(human|assistant)|\*\*(human|assistant):\*\*)/gi;
  const segments: string[] = [];
  let lastEnd = 0;
  let lastRole: string | null = null;

  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(content)) !== null) {
    if (lastRole !== null) {
      const seg = content.slice(lastEnd, match.index).trim();
      if (seg) segments.push(`[${lastRole}]\n${seg}`);
    }
    lastRole = ((match[1] ?? match[2]) as string).toLowerCase();
    lastEnd = match.index + match[0].length;
  }

  if (lastRole !== null) {
    const seg = content.slice(lastEnd).trim();
    if (seg) segments.push(`[${lastRole}]\n${seg}`);
  }

  return segments;
}
