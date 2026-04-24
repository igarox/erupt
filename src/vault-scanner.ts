import type { Vault } from 'obsidian';

export interface VaultSearchResult {
  path: string;
  title: string;
  score: number;
}

export class VaultScanner {
  private tfIndex = new Map<string, Map<string, number>>();
  private df = new Map<string, number>();
  private docCount = 0;

  async build(vault: Vault): Promise<void> {
    this.tfIndex.clear();
    this.df.clear();
    this.docCount = 0;

    const files = vault.getMarkdownFiles();
    this.docCount = files.length;

    for (const file of files) {
      const content = await vault.cachedRead(file);
      const tf = termFrequency(tokenize(content));
      this.tfIndex.set(file.path, tf);
      for (const term of tf.keys()) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }
  }

  search(query: string, topK = 3): VaultSearchResult[] {
    if (this.docCount === 0) return [];

    const queryTerms = tokenize(query);
    const scores = new Map<string, number>();

    for (const term of queryTerms) {
      const df = this.df.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log((this.docCount + 1) / (df + 1));
      for (const [path, tf] of this.tfIndex) {
        const tfVal = tf.get(term) ?? 0;
        if (tfVal > 0) scores.set(path, (scores.get(path) ?? 0) + tfVal * idf);
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([path, score]) => ({
        path,
        title: path.replace(/\.md$/, '').split('/').pop() ?? path,
        score,
      }));
  }

  isEmpty(): boolean {
    return this.docCount === 0;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const total = terms.length || 1;
  for (const [t, count] of tf) tf.set(t, count / total);
  return tf;
}
