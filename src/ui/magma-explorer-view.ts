import { ItemView, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
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
    await this.render();
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

    const wikiPath = this.app.vault.getAbstractFileByPath(this.plugin.getMagmaRoot());
    if (wikiPath instanceof TFolder) {
      this.renderFolder(root, wikiPath, 0);
    } else {
      root.createEl('div', { cls: 'magma-empty-state', text: 'No Magma articles yet.' });
    }
  }

  private renderFolder(container: HTMLElement, folder: TFolder, indent: number) {
    const sorted = [...folder.children].sort((a, b) => {
      const aIsFolder = a instanceof TFolder;
      const bIsFolder = b instanceof TFolder;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of sorted) {
      if (child instanceof TFolder) {
        const folderEl = container.createEl('div', { cls: 'magma-folder-row', text: '📁 ' + child.name });
        folderEl.style.paddingLeft = `${indent * 12 + 8}px`;
        this.renderFolder(container, child, indent + 1);
      } else if (child instanceof TFile && child.extension === 'md') {
        const rowEl = container.createEl('div', { cls: 'magma-file-row', text: child.basename });
        rowEl.style.paddingLeft = `${indent * 12 + 8}px`;
        rowEl.addEventListener('click', () => this.app.workspace.openLinkText(child.path, '', false));

        const wikiPrefix = this.plugin.getMagmaRoot() + '/';
        const articlePath = child.path.startsWith(wikiPrefix)
          ? child.path.slice(wikiPrefix.length).replace(/\.md$/, '')
          : child.path.replace(/\.md$/, '');
        this.magmaRowMap.set(articlePath, rowEl);
      }
    }
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
