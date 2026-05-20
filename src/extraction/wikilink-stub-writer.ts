import type { Vault } from 'obsidian';
import type { ExtractionRunState } from '../types';
import { validateMagmaPath } from './tools';
import { ensureDir } from '../fs';

// Matches [[Title]] and [[Title|display alias]] — captures the title before | or ]]
// Excludes ] | # from the title group so section links ([[Art#Section]]) only capture "Art"
const WIKILINK_RE = /\[\[([^\]|#]+?)(?:[|#][^\]]+?)?\]\]/g;

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  return end === -1 ? content : content.slice(end + 4);
}

function extractWikilinks(content: string): Set<string> {
  const body = stripFrontmatter(content);
  const titles = new Set<string>();
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    const t = m[1].trim();
    if (t) titles.add(t);
  }
  return titles;
}

/**
 * Check whether an article already exists for the given display title.
 * Compares case-insensitively against the last path segment of every runArticle,
 * and also against the full path (for path-style wikilinks like [[Folder/Title]]).
 */
function articleExistsForTitle(title: string, state: ExtractionRunState): boolean {
  const norm = title.toLowerCase();
  for (const path of state.runArticles.keys()) {
    if (path.toLowerCase() === norm) return true;
    const segment = (path.split('/').pop() ?? path).toLowerCase();
    if (segment === norm) return true;
  }
  return false;
}

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildStubContent(
  title: string,
  stubPath: string,
  linkingTitle: string,
  turn: number,
  sourceNote: string,
): string {
  const slug = titleToSlug(title);
  return [
    '---',
    `path: ${stubPath}`,
    `title: ${title}`,
    'confidence: stub',
    `citations: [${turn}]`,
    `source_note: ${sourceNote}`,
    '---',
    '',
    // Single lead sentence — enough to establish the concept exists.
    // Intentionally minimal: a later extraction session will expand this.
    `${title} is referenced in [[${linkingTitle}]] but has not yet been fully extracted from the source conversation. ^${slug}-1`,
  ].join('\n');
}

/**
 * After each extraction turn, scan articles written that turn for [[wikilinks]] that
 * don't yet have a corresponding Magma article. For each missing target, write a minimal
 * stub so subsequent turns see it in the context seed and search_magma can find it.
 *
 * Called from loop.ts after a successful processTurn — never after a turn error.
 */
export async function fillWikilinkStubs(
  vault: Vault,
  state: ExtractionRunState,
  magmaRoot: string,
  sourceNotePath: string,
  currentTurn: number,
): Promise<void> {
  // Collect missing wikilink targets from articles written this turn.
  // Map: display title → logical path of the first article that references it.
  const missing = new Map<string, string>();

  for (const fullPath of state.currentTurnWritten) {
    if (!fullPath.startsWith(magmaRoot + '/')) continue;
    const logicalPath = fullPath.slice(magmaRoot.length + 1).replace(/\.md$/, '');

    let content: string;
    const file = vault.getFileByPath(fullPath);
    if (file) {
      content = await vault.read(file);
    } else if (await vault.adapter.exists(fullPath)) {
      content = await vault.adapter.read(fullPath);
    } else {
      continue;
    }

    for (const title of extractWikilinks(content)) {
      // Skip _decisions/ links and anything that already has an article
      if (title.startsWith('_')) continue;
      if (articleExistsForTitle(title, state)) continue;
      if (!missing.has(title)) missing.set(title, logicalPath);
    }
  }

  for (const [title, linkingPath] of missing) {
    // Path-style wikilinks ([[Folder/Title]]) already carry folder info.
    // Plain titles ([[Title]]) inherit the folder of the article that links them.
    let stubPath: string;
    if (title.includes('/')) {
      stubPath = title;
    } else {
      const parts = linkingPath.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      stubPath = folder ? `${folder}/${title}` : title;
    }

    // Skip if the resulting path is structurally invalid (e.g. external URLs that
    // leaked past the regex, titles with special chars the path validator rejects)
    if (validateMagmaPath(stubPath) !== null) continue;

    const fullStubPath = `${magmaRoot}/${stubPath}.md`;

    // Never overwrite — an existing file (from a prior session) takes precedence
    if (vault.getFileByPath(fullStubPath)) continue;
    if (await vault.adapter.exists(fullStubPath)) continue;

    const turn = state.runArticleTurnMap.get(linkingPath) ?? currentTurn;
    const linkingTitle = linkingPath.split('/').pop() ?? linkingPath;
    const stubContent = buildStubContent(title, stubPath, linkingTitle, turn, sourceNotePath);

    await ensureDir(vault, fullStubPath);
    await vault.create(fullStubPath, stubContent);

    // Register so subsequent turns see the stub in context seed + search_magma
    if (!state.runArticles.has(stubPath)) {
      state.runArticles.set(stubPath, state.runArticles.size);
    }
    if (!state.runArticleTurnMap.has(stubPath)) {
      state.runArticleTurnMap.set(stubPath, turn);
    }
    // Protect from trajectory pass deletion/shrink — same as main-loop articles
    state.perTurnArticles.add(stubPath);
  }
}
