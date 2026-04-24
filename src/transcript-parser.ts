export function parseTranscript(content: string): string[] {
  const lines = content.split('\n').filter(l => l.trim());
  const jsonTurns = tryJsonPerLine(lines);
  if (jsonTurns) return jsonTurns;

  const headingTurns = tryHeadingSplit(content);
  if (headingTurns.length > 1) return headingTurns;

  return content.trim() ? [content.trim()] : [];
}

function tryJsonPerLine(lines: string[]): string[] | null {
  if (lines.length < 2) return null;
  const parsed: Array<{ role: string; content: string }> = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as unknown;
      if (
        typeof obj !== 'object' || obj === null ||
        typeof (obj as Record<string, unknown>).role !== 'string' ||
        typeof (obj as Record<string, unknown>).content !== 'string'
      ) return null;
      parsed.push(obj as { role: string; content: string });
    } catch {
      return null;
    }
  }
  return parsed.map(t => `[${t.role}]\n${t.content}`);
}

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
