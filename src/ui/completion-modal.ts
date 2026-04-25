import { App, Modal, Setting, TFile, Vault } from 'obsidian';
import type { ExtractionRunState, ClarifyingQuestion } from '../types';

interface CompletionModalOptions {
  state: ExtractionRunState;
  vault: Vault;
  magmaRoot: string;
  feedbackRatingsGiven: number;
  onFeedback: (rating: 'up' | 'down') => void;
  onOpenFolder: () => void;
}

export class CompletionModal extends Modal {
  private resolve!: () => void;
  private draftFailed: string[] = [];
  private reviewIndex = 0;

  constructor(app: App, private opts: CompletionModalOptions) {
    super(app);
  }

  openAsync(): Promise<void> {
    return new Promise(resolve => { this.resolve = resolve; this.open(); });
  }

  async onOpen() {
    this.draftFailed = await this.loadDraftFailed();
    this.renderStep1();
  }

  onClose() {
    this.contentEl.empty();
    this.resolve?.();
  }

  // ── Step 1: Result ──────────────────────────────────────────────────────────

  private renderStep1() {
    const el = this.contentEl;
    el.empty();
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    el.createEl('div', { cls: 'erupt-magic-label erupt-modal-eyebrow', text: 'Erupt' });

    const byline = el.createEl('div', { cls: 'slipstream-byline', text: 'by Slipstream' });
    this.attachShimmerListener(this.modalEl, byline);

    const { errorCount, runArticles } = this.opts.state;
    const headline = errorCount > 0 ? '⚠ Completed with warnings' : 'Extraction complete';
    el.createEl('h2', { text: headline, cls: 'erupt-magic-label' });

    const articleCount = runArticles.size;
    if (articleCount === 0) {
      el.createEl('p', { cls: 'erupt-modal-subheading', text: 'Nothing extracted yet' });
      el.createEl('p', {
        cls: 'erupt-modal-subheading',
        text: 'No Magma articles were written. The transcript may not have contained extractable knowledge, or this was a short session.',
      });
    } else {
      el.createEl('p', {
        cls: 'erupt-modal-subheading',
        text: `Erupt — ${articleCount} article${articleCount !== 1 ? 's' : ''}`,
      });
      el.createEl('code', {
        cls: 'erupt-modal-subheading erupt-folder-path',
        text: this.opts.magmaRoot + '/',
      });
    }

    if (errorCount > 0 || this.draftFailed.length > 0) {
      const banner = el.createEl('div', { cls: 'erupt-warning-banner' });
      const parts: string[] = [];
      if (errorCount > 0) parts.push(`${errorCount} turn${errorCount !== 1 ? 's' : ''} failed`);
      if (this.draftFailed.length > 0) parts.push(`${this.draftFailed.length} article${this.draftFailed.length !== 1 ? 's' : ''} incomplete`);
      banner.createEl('div', { text: parts.join(' — ') + ':' });
      if (this.draftFailed.length > 0) {
        const pathList = banner.createEl('div', { cls: 'erupt-warning-paths' });
        for (const path of this.draftFailed) {
          pathList.createEl('code', { text: path, cls: 'erupt-warning-path-item' });
        }
      }
      const logLink = banner.createEl('a', { text: 'Show full log', href: '#', cls: 'erupt-warning-log-link' });
      logLink.addEventListener('click', (e) => {
        e.preventDefault();
        const logPath = this.opts.magmaRoot.replace(/\/wiki$/, '') + '/extraction_log.jsonl';
        this.app.workspace.openLinkText(logPath, '', false);
      });
    }

    if (this.opts.feedbackRatingsGiven < 5) {
      const feedbackRow = el.createEl('div', { cls: 'erupt-feedback-row' });
      feedbackRow.createEl('span', { text: 'How did this extraction go?  ' });
      const thumbsUp = feedbackRow.createEl('button', { text: '👍', cls: 'erupt-feedback-btn' });
      const thumbsDown = feedbackRow.createEl('button', { text: '👎', cls: 'erupt-feedback-btn' });
      const thanks = feedbackRow.createEl('span', { cls: 'erupt-feedback-thanks', text: 'Thanks!' });
      (thanks as HTMLElement).style.display = 'none';

      const onFeedback = (rating: 'up' | 'down') => {
        this.submitFeedback(rating);
        thumbsUp.remove();
        thumbsDown.remove();
        feedbackRow.querySelector('span:first-child')?.remove();
        (thanks as HTMLElement).style.display = '';
        setTimeout(() => { (feedbackRow as HTMLElement).style.opacity = '0'; }, 1500);
      };
      thumbsUp.addEventListener('click', () => onFeedback('up'));
      thumbsDown.addEventListener('click', () => onFeedback('down'));
    }

    const ctaEl = el.createEl('div', { cls: 'erupt-modal-ctas' });
    const questions = this.opts.state.clarifyingQuestions;

    if (questions.length > 0) {
      new Setting(ctaEl)
        .addButton(btn =>
          btn.setButtonText(`Review ${questions.length} question${questions.length !== 1 ? 's' : ''} →`)
            .setCta().onClick(() => this.renderStep2())
        )
        .addButton(btn =>
          btn.setButtonText('Open folder').onClick(() => { this.opts.onOpenFolder(); this.close(); })
        );
    } else if (this.draftFailed.length > 0) {
      new Setting(ctaEl)
        .addButton(btn =>
          btn.setButtonText('Review incomplete →').setCta().onClick(() => this.renderStep3())
        )
        .addButton(btn =>
          btn.setButtonText('Open folder').onClick(() => { this.opts.onOpenFolder(); this.close(); })
        );
      ctaEl.createEl('a', { text: 'Done — skip', href: '#', cls: 'erupt-skip-link' })
        .addEventListener('click', (e) => { e.preventDefault(); this.close(); });
    } else if (articleCount === 0) {
      new Setting(ctaEl)
        .addButton(btn => btn.setButtonText('Done').setCta().onClick(() => this.close()));
    } else {
      new Setting(ctaEl)
        .addButton(btn => btn.setButtonText('Done').setCta().onClick(() => this.close()))
        .addButton(btn =>
          btn.setButtonText('Open folder').onClick(() => { this.opts.onOpenFolder(); this.close(); })
        );
    }
  }

  // ── Step 2: Clarifying questions ───────────────────────────────────────────

  private renderStep2() {
    const el = this.contentEl;
    el.empty();
    el.createEl('h3', { text: 'Needs clarification' });

    const questions = this.opts.state.clarifyingQuestions;
    for (const q of questions) {
      const row = el.createEl('div', { cls: 'erupt-question-row' });
      row.createEl('p', { text: q.question, cls: 'erupt-question-text' });
      if (q.affectedArticles.length > 0) {
        row.createEl('small', {
          text: `Affects: ${q.affectedArticles.join(', ')}`,
          cls: 'erupt-question-context',
        });
      }
      row.createEl('textarea', {
        cls: 'erupt-question-textarea',
        attr: { 'aria-label': q.question, placeholder: 'Your answer...' },
      });
    }

    new Setting(el)
      .addButton(btn =>
        btn.setButtonText('Submit answers').setCta().onClick(async () => {
          const textareas = el.querySelectorAll<HTMLTextAreaElement>('.erupt-question-textarea');
          textareas.forEach((ta, i) => {
            if (questions[i]) questions[i].answer = ta.value;
          });
          if (questions.some(q => q.answer)) {
            await this.writeAnswersToLog(questions);
          }
          if (this.draftFailed.length > 0) this.renderStep3();
          else this.close();
        })
      )
      .addButton(btn =>
        btn.setButtonText('Skip').onClick(() => {
          if (this.draftFailed.length > 0) this.renderStep3();
          else this.close();
        })
      );
  }

  private async writeAnswersToLog(questions: ClarifyingQuestion[]): Promise<void> {
    const logPath = this.opts.magmaRoot.replace(/\/wiki$/, '') + '/extraction_log.jsonl';
    const file = this.opts.vault.getFileByPath(logPath);
    for (const q of questions) {
      if (!q.answer) continue;
      const line = JSON.stringify({
        event: 'clarification',
        question: q.question,
        answer: q.answer,
        ts: Date.now(),
      }) + '\n';
      if (file) {
        await this.opts.vault.modify(file, (await this.opts.vault.read(file)) + line);
      } else {
        await this.opts.vault.create(logPath, line);
      }
    }
  }

  // ── Step 3: Draft review ───────────────────────────────────────────────────

  private async renderStep3(): Promise<void> {
    if (this.reviewIndex >= this.draftFailed.length) { this.close(); return; }

    const el = this.contentEl;
    el.empty();
    el.createEl('h3', { text: 'Incomplete article' });
    el.createEl('small', {
      text: `Article ${this.reviewIndex + 1} of ${this.draftFailed.length}`,
      cls: 'erupt-modal-subheading',
    });

    const path = this.draftFailed[this.reviewIndex];
    el.createEl('code', { text: path, cls: 'erupt-article-path' });

    const fullPath = `${this.opts.magmaRoot}/${path}.md`;
    const file = this.opts.vault.getFileByPath(fullPath);
    if (file) {
      const content = await this.opts.vault.read(file);
      const preview = el.createEl('pre', { cls: 'erupt-draft-preview' });
      preview.textContent = content.slice(0, 2000);
    }

    const advance = () => { this.reviewIndex++; this.renderStep3(); };

    new Setting(el)
      .addButton(btn =>
        btn.setButtonText('Keep as stub').setCta().onClick(async () => {
          if (file) await this.keepAsStub(file);
          advance();
        })
      )
      .addButton(btn =>
        btn.setButtonText('Discard').onClick(async () => {
          if (file) await this.opts.vault.delete(file);
          advance();
        })
      );

    const keyHandler = async (e: KeyboardEvent) => {
      if (e.key === 'k' || e.key === 'K') {
        el.removeEventListener('keydown', keyHandler);
        if (file) await this.keepAsStub(file);
        advance();
      } else if (e.key === 'd' || e.key === 'D') {
        el.removeEventListener('keydown', keyHandler);
        if (file) await this.opts.vault.delete(file);
        advance();
      }
    };
    el.addEventListener('keydown', keyHandler);
  }

  private async keepAsStub(file: TFile): Promise<void> {
    let content = await this.opts.vault.read(file);
    content = content.replace(/^draft-failed: true\n/m, '');
    content = content.replace(/^confidence: (stub|provisional)$/m, 'confidence: stub');
    await this.opts.vault.modify(file, content);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async loadDraftFailed(): Promise<string[]> {
    const failed: string[] = [];
    for (const [path] of this.opts.state.runArticles) {
      const fullPath = `${this.opts.magmaRoot}/${path}.md`;
      const file = this.opts.vault.getFileByPath(fullPath);
      if (!file) continue;
      const content = await this.opts.vault.read(file);
      if (content.includes('draft-failed: true')) failed.push(path);
    }
    return failed;
  }

  private attachShimmerListener(modalEl: HTMLElement, bylineEl: HTMLElement): void {
    modalEl.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = modalEl.getBoundingClientRect();
      bylineEl.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width).toFixed(3));
      bylineEl.style.setProperty('--my', ((e.clientY - rect.top) / rect.height).toFixed(3));
    });
  }

  private submitFeedback(rating: 'up' | 'down'): void {
    fetch('https://api.slipstream.now/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, product: 'erupt', ts: Date.now() }),
    }).catch(() => undefined);
    this.opts.onFeedback(rating);
  }
}
