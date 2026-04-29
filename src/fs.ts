import type { Vault } from 'obsidian';

export async function ensureDir(vault: Vault, filePath: string): Promise<void> {
  const parts = filePath.split('/');
  parts.pop(); // remove filename
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    // vault.createFolder() indexes the folder so TFolder.children stays accurate.
    // Skip if already in vault index; catch the race where two calls create concurrently.
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current).catch(() => undefined);
    }
  }
}
