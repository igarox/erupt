import { App, Modal, Setting, TFile } from 'obsidian';

interface LengthComplianceOptions {
  file: TFile;
  charCount: number;
  onSplit: () => void;
  onSuppress: (path: string) => void;
}

export class LengthComplianceModal extends Modal {
  constructor(app: App, private opts: LengthComplianceOptions) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Article getting long' });
    contentEl.createEl('p', {
      text: `"${this.opts.file.basename}" is ${this.opts.charCount.toLocaleString()} characters. Magma articles work best under 8,000. Want Erupt to split it, or edit yourself?`,
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Split with Erupt').setCta().onClick(() => {
          this.close();
          this.opts.onSplit();
        })
      )
      .addButton(btn =>
        btn.setButtonText('Edit myself').onClick(() => this.close())
      );

    const suppressEl = contentEl.createEl('div', { cls: 'erupt-suppress-link' });
    suppressEl.createEl('a', { text: "Don't ask for this article", href: '#' })
      .addEventListener('click', (e) => {
        e.preventDefault();
        this.opts.onSuppress(this.opts.file.path);
        this.close();
      });

    setTimeout(() => (contentEl.querySelector('button.mod-cta') as HTMLButtonElement)?.focus(), 50);
  }

  onClose() { this.contentEl.empty(); }
}
