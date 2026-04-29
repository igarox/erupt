import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type EruptPlugin from '../../main';

export const MAGMA_VIEW_TYPE = 'magma-explorer';

export class MagmaExplorerView extends ItemView {
  private magmaRowMap = new Map<string, HTMLElement>();
  private lockBannerEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: EruptPlugin) {
    super(leaf);
  }

  getViewType() { return MAGMA_VIEW_TYPE; }
  getDisplayText() { return 'Magma'; }
  getIcon() { return 'magma-graph'; }

  async onOpen() {
    // Defer initial render until the vault has finished scanning the filesystem.
    // Without this, onOpen fires during workspace restore before getAbstractFileByPath
    // can find .magma — same pattern Obsidian's native file explorer uses.
    if (this.app.workspace.layoutReady) {
      await this.render();
    } else {
      this.app.workspace.onLayoutReady(() => this.render());
    }
    this.registerEvent(this.app.vault.on('create', () => this.render()));
    this.registerEvent(this.app.vault.on('delete', () => this.render()));
    this.registerEvent(this.app.vault.on('rename', () => this.render()));
  }

  async onClose() {
    (this.containerEl.children[1] as HTMLElement)?.empty();
  }

  private async render() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('magma-explorer-container');
    this.magmaRowMap.clear();

    root.createEl('div', { cls: 'magma-explorer-header', text: '🌋 Magma' });

    this.lockBannerEl = root.createEl('div', { cls: 'magma-lock-banner' });
    this.updateLockBanner();

    const wikiRoot = this.plugin.getMagmaRoot();

    if (!(await this.app.vault.adapter.exists(wikiRoot))) {
      root.createEl('div', { cls: 'magma-empty-state', text: 'No Magma articles yet.' });
      return;
    }

    const hasArticles = await this.renderAdapterFolder(root, wikiRoot, 0);
    if (!hasArticles) {
      root.createEl('div', { cls: 'magma-empty-state', text: 'No Magma articles yet.' });
    }
  }

  private async renderAdapterFolder(
    container: HTMLElement,
    folderPath: string,
    indent: number,
  ): Promise<boolean> {
    let hasArticles = false;
    try {
      const { files, folders } = await this.app.vault.adapter.list(folderPath);
      const name = (p: string) => p.split('/').pop() ?? p;
      const sortedFolders = [...folders].sort((a, b) => name(a).localeCompare(name(b)));
      const sortedFiles = [...files]
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => name(a).localeCompare(name(b)));

      for (const sub of sortedFolders) {
        const folderRow = container.createEl('div', { cls: 'magma-folder-row' });
        folderRow.style.paddingLeft = `${indent * 12 + 8}px`;
        const arrow = folderRow.createEl('span', { cls: 'magma-folder-arrow', text: '▼ ' });
        folderRow.createEl('span', { text: '📁 ' + name(sub) });

        // Children go in a sibling container so collapse toggling is O(1)
        const childContainer = container.createEl('div', { cls: 'magma-folder-children' });
        const childHas = await this.renderAdapterFolder(childContainer, sub, indent + 1);

        if (!childHas) {
          folderRow.remove();
          childContainer.remove();
        } else {
          hasArticles = true;
          let collapsed = false;
          folderRow.addEventListener('click', () => {
            collapsed = !collapsed;
            childContainer.style.display = collapsed ? 'none' : '';
            arrow.textContent = collapsed ? '▶ ' : '▼ ';
          });
        }
      }

      for (const filePath of sortedFiles) {
        const fileName = name(filePath).replace(/\.md$/, '');
        const rowEl = container.createEl('div', { cls: 'magma-file-row', text: fileName });
        rowEl.style.paddingLeft = `${indent * 12 + 8}px`;

        rowEl.addEventListener('click', async () => {
          // .magma/ is a dot-prefixed folder — Obsidian's reconcileFile() runs ru()
          // which returns true for any path with a dot-prefix component, routing it to
          // reconcileDeletion instead of the indexing path. vault.fileMap never contains
          // .magma/ TFiles after restart. We bypass this by calling vault.onChange()
          // directly, which is the same indexing method Obsidian uses for normal files.
          let tfile = this.app.vault.getFileByPath(filePath)
            ?? await this.ensureVaultIndexed(filePath);
          if (!tfile) {
            new Notice(`Erupt: could not open article — ${filePath}`, 3000);
            return;
          }
          try {
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(tfile, { active: true });
            this.app.workspace.revealLeaf(leaf);
          } catch (err) {
            new Notice(`Erupt: openFile failed — ${err}`, 5000);
          }
        });

        const wikiPrefix = this.plugin.getMagmaRoot() + '/';
        const articlePath = filePath.startsWith(wikiPrefix)
          ? filePath.slice(wikiPrefix.length).replace(/\.md$/, '')
          : filePath.replace(/\.md$/, '');
        this.magmaRowMap.set(articlePath, rowEl);
        hasArticles = true;
      }
    } catch { /* unreadable — skip */ }
    return hasArticles;
  }

  private async ensureVaultIndexed(filePath: string): Promise<TFile | null> {
    // vault.onChange() is Obsidian's internal indexing method. It bypasses reconcileFile()
    // (which excludes dot-prefixed paths via ru()) and directly updates vault.fileMap.
    // We must index ancestor folders first because vault.addChild() requires parent in fileMap.
    const vault = this.app.vault as any;
    const parts = filePath.split('/');
    for (let i = 1; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      if (!vault.fileMap[folderPath]) {
        vault.onChange('folder-created', folderPath);
      }
    }
    if (!vault.fileMap[filePath]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stat: any = null;
      try { stat = await this.app.vault.adapter.stat(filePath); } catch { /* missing */ }
      if (!stat) return null;
      vault.onChange('file-created', filePath, undefined, stat);
    }
    return this.app.vault.getFileByPath(filePath) as TFile | null;
  }

  flashRow(path: string) {
    const el = this.magmaRowMap.get(path);
    if (!el) return;
    el.addClass('erupt-magic-label');
    setTimeout(() => el.removeClass('erupt-magic-label'), 2000);
  }

  updateLockBanner() {
    if (!this.lockBannerEl) return;
    if (this.plugin.extractionActive) {
      this.lockBannerEl.addClass('magma-lock-banner--active');
      this.lockBannerEl.setText('⚠ Extraction in progress — read only');
    } else {
      this.lockBannerEl.removeClass('magma-lock-banner--active');
      this.lockBannerEl.setText('');
    }
  }
}
