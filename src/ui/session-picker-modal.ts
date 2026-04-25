import { App, Modal, TFile, TFolder, Vault } from 'obsidian';

interface SessionRecord {
  title: string;
  date: string;
  turnCount: number;
  path: string;
}

export class SessionPickerModal extends Modal {
  private sessions: SessionRecord[] = [];
  private focusedIndex = 0;
  private listEl!: HTMLElement;

  constructor(
    app: App,
    private vault: Vault,
    private magmaRoot: string,
    private onLink: (path: string) => void,
    private onNewSession: () => void,
  ) {
    super(app);
  }

  async onOpen() {
    await this.loadSessions();
    this.render();
    this.scope.register([], 'ArrowDown', () => { this.moveFocus(1); return false; });
    this.scope.register([], 'ArrowUp', () => { this.moveFocus(-1); return false; });
    this.scope.register([], 'Enter', () => { this.selectFocused(); return false; });
  }

  onClose() { this.contentEl.empty(); }

  private async loadSessions(): Promise<void> {
    const sessionsPath = this.magmaRoot.replace(/\/wiki$/, '') + '/sessions';
    const folder = this.vault.getAbstractFileByPath(sessionsPath);
    if (!(folder instanceof TFolder)) return;
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== 'json') continue;
      try {
        const raw = JSON.parse(await this.vault.read(child)) as SessionRecord;
        this.sessions.push({ ...raw, path: child.path });
      } catch { /* skip malformed */ }
    }
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    el.createEl('h3', { text: 'Select session to link' });
    el.createEl('p', {
      text: 'Erupt extracts from saved conversation sessions. Which session does this note come from?',
      cls: 'erupt-session-subtitle',
    });

    if (this.sessions.length === 0) {
      el.createEl('p', { text: 'No sessions yet.', cls: 'erupt-empty-state' });
    } else {
      this.listEl = el.createEl('div', { cls: 'erupt-session-list', attr: { role: 'listbox' } });
      this.sessions.forEach((s, i) => this.renderSessionRow(s, i));
      this.updateFocus();
    }

    const footer = el.createEl('div', { cls: 'erupt-modal-footer' });
    const newLink = footer.createEl('a', { text: '+ New session from this note', href: '#' });
    newLink.addEventListener('click', (e) => { e.preventDefault(); this.close(); this.onNewSession(); });
  }

  private renderSessionRow(s: SessionRecord, index: number) {
    const row = this.listEl.createEl('div', {
      cls: 'erupt-session-row',
      attr: { role: 'option', tabindex: '0', 'aria-selected': 'false' },
    });
    row.createEl('span', { text: s.title, cls: 'erupt-session-title' });
    row.createEl('span', { text: s.date + '  ', cls: 'erupt-session-date' });
    row.createEl('code', { text: `${s.turnCount} turns`, cls: 'erupt-session-turns' });
    row.addEventListener('click', () => { this.focusedIndex = index; this.selectFocused(); });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.selectFocused(); });
  }

  private moveFocus(delta: number) {
    if (this.sessions.length === 0) return;
    this.focusedIndex = Math.max(0, Math.min(this.sessions.length - 1, this.focusedIndex + delta));
    this.updateFocus();
  }

  private updateFocus() {
    const rows = this.listEl?.querySelectorAll<HTMLElement>('.erupt-session-row');
    rows?.forEach((r, i) => {
      const active = i === this.focusedIndex;
      r.setAttribute('aria-selected', String(active));
      if (active) r.focus();
    });
  }

  private selectFocused() {
    const s = this.sessions[this.focusedIndex];
    if (s) { this.close(); this.onLink(s.path); }
  }
}
