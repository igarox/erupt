import type { Vault } from 'obsidian';

export async function ensureDir(vault: Vault, filePath: string): Promise<void> {
  const parts = filePath.split('/');
  parts.pop(); // remove filename
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const exists = vault.getAbstractFileByPath(current);
    if (!exists) {
      await vault.createFolder(current).catch(() => undefined);
    }
  }
}
