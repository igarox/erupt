import type { Vault } from 'obsidian';
import type { ExtractionRunState, Decision } from '../types';
import { ensureDir } from '../fs';

export async function writeArticleDecisionLogs(
  vault: Vault,
  state: ExtractionRunState,
  magmaRoot: string,
): Promise<void> {
  if (state.runArticleTurnMap.size === 0) return;

  const allDecisions: Decision[] = [
    ...state.decisionLog.active,
    ...state.decisionLog.retired,
    ...state.decisionLog.open,
  ];
  if (allDecisions.length === 0) return;

  for (const [articlePath, turn] of state.runArticleTurnMap) {
    const decisionsForArticle = allDecisions.filter(d => d.createdTurn === turn);
    if (decisionsForArticle.length === 0) continue;

    const articleName = articlePath.split('/').pop() ?? articlePath;
    const decisionFilePath = `${magmaRoot}/_decisions/${articleName}.decisions.md`;
    const content = formatDecisionLogFile(articlePath, decisionsForArticle);

    await ensureDir(vault, decisionFilePath);
    await writeMagmaFile(vault, decisionFilePath, content);

    // Append wikilink to article body if not already present
    const articleFullPath = `${magmaRoot}/${articlePath}.md`;
    const articleContent = await readMagmaFile(vault, articleFullPath);
    if (articleContent !== null) {
      const wikilink = `[[_decisions/${articleName}.decisions]]`;
      if (!articleContent.includes(wikilink)) {
        await writeMagmaFile(vault, articleFullPath, articleContent.trimEnd() + '\n\n' + wikilink + '\n');
      }
    }
  }
}

/**
 * Read a Magma file with vault-index fallback to adapter.
 * Obsidian's reconcileFile excludes dot-prefixed paths (.magma/), so
 * vault.getFileByPath() can return null even when the file exists on disk.
 */
async function readMagmaFile(vault: Vault, path: string): Promise<string | null> {
  const indexed = vault.getFileByPath(path);
  if (indexed) return vault.read(indexed);
  if (await vault.adapter.exists(path)) return vault.adapter.read(path);
  return null;
}

/**
 * Write a Magma file with vault-index fallback to adapter.
 * Same .magma/ dot-prefix caveat as readMagmaFile.
 */
async function writeMagmaFile(vault: Vault, path: string, content: string): Promise<void> {
  const indexed = vault.getFileByPath(path);
  if (indexed) {
    await vault.modify(indexed, content);
    return;
  }
  if (await vault.adapter.exists(path)) {
    await vault.adapter.write(path, content);
    return;
  }
  await vault.create(path, content);
}

function formatDecisionLogFile(articlePath: string, decisions: Decision[]): string {
  const lines = [
    `# Decision Log — ${articlePath}`,
    '',
    '_Decisions recorded during the extraction session that affected this article._',
    '',
  ];

  const active = decisions.filter(d => d.status === 'active');
  const open = decisions.filter(d => d.status === 'open');
  const retired = decisions.filter(d => d.status === 'retired');

  if (active.length > 0) {
    lines.push('## Active Decisions', '');
    for (const d of active) {
      lines.push(`- **${d.id}**: ${d.text} _(turn ${d.createdTurn})_`);
    }
    lines.push('');
  }

  if (open.length > 0) {
    lines.push('## Open Questions', '');
    for (const d of open) {
      lines.push(`- **${d.id}**: ${d.text} _(turn ${d.createdTurn})_`);
    }
    lines.push('');
  }

  if (retired.length > 0) {
    lines.push('## Retired', '');
    for (const d of retired) {
      const turnStr = d.resolutionTurn !== undefined
        ? `turns ${d.createdTurn} → ${d.resolutionTurn}`
        : `turn ${d.createdTurn}`;
      lines.push(`- **${d.id}**: ${d.text} _(${turnStr})_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
