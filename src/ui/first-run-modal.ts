import { App, Modal, Setting } from 'obsidian';

export class FirstRunModal extends Modal {
  private resolve!: () => void;

  constructor(app: App, private onDismiss: () => void) {
    super(app);
  }

  openAsync(): Promise<void> {
    return new Promise(resolve => { this.resolve = resolve; this.open(); });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setAttribute('role', 'dialog');
    contentEl.setAttribute('aria-modal', 'true');
    contentEl.createEl('h3', { text: "You're connected." });
    contentEl.createEl('p', {
      text: 'Open a note with a pasted AI conversation and run Extract Notes to get started.',
    });
    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Got it').setCta().onClick(() => this.close()));
    setTimeout(() => (contentEl.querySelector('button.mod-cta') as HTMLButtonElement)?.focus(), 50);
    this.scope.register([], 'Enter', () => { this.close(); return false; });
  }

  onClose() {
    this.onDismiss();
    this.contentEl.empty();
    this.resolve?.();
  }
}
