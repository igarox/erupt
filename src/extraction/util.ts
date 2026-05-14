import type { DecisionLog } from '../types';

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export function serializeDecisionLog(log: DecisionLog): string {
  if (log.active.length === 0 && log.retired.length === 0 && log.open.length === 0) return '';

  const lines: string[] = ['## Session Decision Log'];

  for (const d of log.active) {
    lines.push(`Active: [${d.text} (turn ${d.createdTurn})]`);
  }
  for (const d of log.open) {
    lines.push(`Open: [${d.text} (turn ${d.createdTurn})]`);
  }

  const retiredLines = [...log.retired]
    .sort((a, b) => a.createdTurn - b.createdTurn)
    .map(d => {
      const turnStr = d.resolutionTurn !== undefined
        ? `turn ${d.createdTurn} → ${d.resolutionTurn}`
        : `turn ${d.createdTurn}`;
      return `Retired: [${d.text} (${turnStr})]`;
    });

  // 2000-char budget: drop oldest retired entries first
  while (retiredLines.join('\n').length > 2000 && retiredLines.length > 0) {
    retiredLines.shift();
  }

  lines.push(...retiredLines);
  return lines.join('\n');
}
