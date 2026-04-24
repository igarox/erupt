import { App, Modal, Setting } from 'obsidian';

export class CompatNoticeModal extends Modal {
  private suppressNext = false;
  private resolve!: () => void;

  constructor(
    app: App,
    private model: string,
    private onSuppress: (model: string) => void,
  ) {
    super(app);
  }

  // Opens the modal and returns a Promise that resolves when the user dismisses it
  openAsync(): Promise<void> {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: '3-Pass Extraction Mode' });
    contentEl.createEl('p', {
      text: `"${this.model}" doesn't support tool use. Erupt will use 3-pass extraction mode — output quality may be lower than with a tool-use capable model.`,
    });

    new Setting(contentEl)
      .setName(`Don't show this again for "${this.model}"`)
      .addToggle(toggle =>
        toggle.setValue(false).onChange(v => { this.suppressNext = v; })
      );

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('OK').setCta().onClick(() => this.close())
      );
  }

  onClose() {
    if (this.suppressNext) {
      this.onSuppress(this.model);
    }
    this.contentEl.empty();
    this.resolve?.();
  }
}
