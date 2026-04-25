import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, Vault, addIcon } from 'obsidian';
import { FirstRunModal } from './src/ui/first-run-modal';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_EXTRACTION_CONFIG, createRunState, type ExtractionRunState } from './src/types';
import { VaultScanner } from './src/vault-scanner';
import { runExtractionLoop } from './src/extraction/loop';
import { run3PassFallback } from './src/extraction/fallback';
import { runFinalPass } from './src/extraction/final-pass';
import { CompatNoticeModal } from './src/ui/compat-notice-modal';
import { CompletionModal } from './src/ui/completion-modal';
import { LengthComplianceModal } from './src/ui/length-compliance-modal';
import { MagmaExplorerView, MAGMA_VIEW_TYPE } from './src/ui/magma-explorer-view';
import { SessionPickerModal } from './src/ui/session-picker-modal';
import { ensureDir } from './src/fs';
import { parseTranscript } from './src/transcript-parser';
import {
  getCachedCapability,
  getKnownCapability,
  type ModelCapability,
} from './src/models';

// ---- Settings ---------------------------------------------------------------

interface EruptSettings {
  plan: 'free' | 'local' | 'cloud';
  authToken: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  suppressedCompatibilityNotice: string[]; // persisted; NOT rendered in settings UI
  suppressedLengthCheck: string[];          // persisted; NOT rendered in settings UI
  wikigameUnlocked: boolean;
  firstRunComplete: boolean;
  feedbackRatingsGiven: number;
  byokApiKey: string;                        // dev testing only — not rendered in settings UI
}

const DEFAULT_SETTINGS: EruptSettings = {
  plan: 'free',
  authToken: '',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: '',
  suppressedCompatibilityNotice: [],
  suppressedLengthCheck: [],
  wikigameUnlocked: false,
  firstRunComplete: false,
  feedbackRatingsGiven: 0,
  byokApiKey: '',
};

const MAGMA_WIKI_ROOT = '.magma/wiki';

// ---- Status bar types -------------------------------------------------------

type StatusBarState =
  | { kind: 'idle' }
  | { kind: 'extracting'; turn: number; total: number; etaMs?: number }
  | { kind: 'final_pass'; label: 'compliance' | 'consistency' }
  | { kind: 'cancelled' }
  | { kind: 'done'; warnings: boolean }
  | { kind: 'error' };

function progressBar(fraction: number, width = 10): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.floor(clamped * width);
  const partial = clamped * width - filled >= 0.5 && filled < width;
  const empty = width - filled - (partial ? 1 : 0);
  return '█'.repeat(filled) + (partial ? '▒' : '') + '░'.repeat(empty);
}

// ---- Plugin -----------------------------------------------------------------

export default class EruptPlugin extends Plugin {
  settings!: EruptSettings;
  private statusBarItem!: HTMLElement;
  private statusWordEl!: HTMLElement;
  private statusDetailEl!: HTMLElement;
  private statusCancelEl!: HTMLElement;
  private ariaAnnounceEl!: HTMLElement;
  private cancelClickCount = 0;
  private cancelClickTimer: ReturnType<typeof setTimeout> | null = null;
  private doneTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAriaAnnounce = '';
  private lastAriaTurn = -1;

  extractionActive = false;
  private runState: ExtractionRunState | null = null;
  private vaultScanner = new VaultScanner();
  private lengthCheckTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async onload() {
    await this.loadSettings();
    this.buildStatusBar();
    this.registerCommands();
    this.registerVaultListeners();
    this.addSettingTab(new EruptSettingTab(this.app, this));
    this.registerView(MAGMA_VIEW_TYPE, leaf => new MagmaExplorerView(leaf, this));

    // Custom graph icon: standard hub-and-spoke graph with top node as flame silhouette
    addIcon('magma-graph',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="12" y1="11" x2="5" y2="17"/>' +
      '<line x1="12" y1="11" x2="19" y2="17"/>' +
      '<line x1="12" y1="11" x2="12" y2="20"/>' +
      '<line x1="5" y1="17" x2="19" y2="17"/>' +
      '<circle cx="5" cy="17" r="1.8"/>' +
      '<circle cx="19" cy="17" r="1.8"/>' +
      '<circle cx="12" cy="20" r="1.8"/>' +
      '<path d="M12 2 C11 2 9 4.5 9 6.5 C9 8.5 10.3 10 12 10 C13.7 10 15 8.5 15 6.5 C15 4.5 13 2 12 2 Z"/>' +
      '</svg>'
    );

    const ribbonIconEl = this.addRibbonIcon('magma-graph', 'Open Magma graph', () => this.openMagmaExplorer());
    // Position after native graph view button once layout is fully ready.
    // Uses icon class (locale-independent) rather than aria-label text.
    this.app.workspace.onLayoutReady(() => {
      const ribbonContainer = ribbonIconEl.parentElement;
      if (!ribbonContainer) return;
      const graphSvg = ribbonContainer.querySelector('svg.lucide-graph');
      const graphBtn = graphSvg?.closest<HTMLElement>('.side-dock-ribbon-action');
      if (graphBtn) graphBtn.after(ribbonIconEl);
    });

    this.registerObsidianProtocolHandler('auth', async (params) => {
      const token = params['token'];
      if (!token || typeof token !== 'string') return;
      this.settings.authToken = token;
      await this.saveSettings();
      if (!this.settings.firstRunComplete) {
        await new FirstRunModal(this.app, async () => {
          this.settings.firstRunComplete = true;
          await this.saveSettings();
        }).openAsync();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settingModal = (this.app as any).setting;
      if (settingModal) {
        settingModal.close();
        settingModal.open();
        settingModal.openTabById('erupt');
      }
    });
  }

  onunload() {
    this.runState?.currentController?.abort();
    for (const t of this.lengthCheckTimers.values()) clearTimeout(t);
    if (this.cancelClickTimer) clearTimeout(this.cancelClickTimer);
    if (this.doneTransitionTimer) clearTimeout(this.doneTransitionTimer);
    this.ariaAnnounceEl?.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getMagmaRoot(): string {
    return MAGMA_WIKI_ROOT;
  }

  private getMagmaExplorerView(): MagmaExplorerView | null {
    const leaves = this.app.workspace.getLeavesOfType(MAGMA_VIEW_TYPE);
    return leaves.length > 0 ? (leaves[0].view as MagmaExplorerView) : null;
  }

  // ---- Status bar -----------------------------------------------------------

  private buildStatusBar() {
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('erupt-status-bar');
    this.statusBarItem.setAttribute('aria-label', 'Erupt extraction status');

    this.statusWordEl = this.statusBarItem.createEl('span', { cls: 'erupt-status-word' });
    this.statusDetailEl = this.statusBarItem.createEl('span', { cls: 'erupt-status-detail' });
    this.statusCancelEl = this.statusBarItem.createEl('span', {
      cls: 'erupt-status-cancel',
      attr: { role: 'button', tabindex: '0', 'aria-label': 'Cancel extraction' },
      text: ' ✕',
    });
    this.statusCancelEl.style.display = 'none';
    this.statusCancelEl.addEventListener('click', () => this.handleCancelClick());
    this.statusCancelEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.handleCancelClick();
    });

    this.ariaAnnounceEl = document.body.createEl('div', {
      cls: 'erupt-aria-live',
      attr: { 'aria-live': 'polite', 'aria-atomic': 'true' },
    });

    this.updateStatusBar({ kind: 'idle' });
  }

  private updateStatusBar(state: StatusBarState) {
    if (this.doneTransitionTimer) {
      clearTimeout(this.doneTransitionTimer);
      this.doneTransitionTimer = null;
    }

    this.statusBarItem.removeClass(
      'erupt-status-idle', 'erupt-status-active', 'erupt-status-success',
      'erupt-status-warning', 'erupt-status-error', 'erupt-status-cancelled',
    );

    switch (state.kind) {
      case 'idle': {
        this.statusWordEl.setText('Erupt');
        this.statusWordEl.removeClass('erupt-magic-label');
        this.statusDetailEl.setText('');
        this.statusCancelEl.style.display = 'none';
        this.statusBarItem.addClass('erupt-status-idle');
        this.announceAria('Erupt idle', true);
        break;
      }
      case 'extracting': {
        if (state.total === 0) {
          // Detecting model — muted, no shimmer, no progress bar, no cancel
          this.statusWordEl.setText('Erupt: detecting model...');
          this.statusWordEl.removeClass('erupt-magic-label');
          this.statusDetailEl.setText('');
          this.statusCancelEl.style.display = 'none';
          this.statusBarItem.addClass('erupt-status-idle');
          this.announceAria('Erupt: detecting model', true);
        } else {
          // Active extraction — shimmer, progress bar, cancel visible
          this.statusWordEl.setText('Erupt');
          this.statusWordEl.addClass('erupt-magic-label');
          this.statusCancelEl.style.display = '';
          this.statusBarItem.addClass('erupt-status-active');
          const fraction = (state.turn / state.total) * 0.8;
          const bar = progressBar(fraction);
          const eta = state.etaMs != null ? `  ~${Math.ceil(state.etaMs / 1000)}s` : '';
          this.statusDetailEl.setText(`  ${bar}  ${state.turn}/${state.total}${eta}`);
          this.maybeAnnounceAria(`Erupt: turn ${state.turn} of ${state.total}`, state.turn);
        }
        break;
      }
      case 'final_pass': {
        this.statusWordEl.setText('Erupt');
        this.statusWordEl.addClass('erupt-magic-label');
        this.statusCancelEl.style.display = 'none';
        this.statusBarItem.addClass('erupt-status-active');
        const fraction = state.label === 'compliance' ? 0.85 : 0.92;
        const bar = progressBar(fraction);
        this.statusDetailEl.setText(`  ${bar}  ${state.label}`);
        this.announceAria(`Erupt: final pass — ${state.label}`, true);
        break;
      }
      case 'cancelled': {
        this.statusWordEl.setText('Erupt: cancelled');
        this.statusWordEl.removeClass('erupt-magic-label');
        this.statusDetailEl.setText('');
        this.statusCancelEl.style.display = 'none';
        this.statusBarItem.addClass('erupt-status-cancelled');
        this.announceAria('Erupt: extraction cancelled', true);
        this.doneTransitionTimer = setTimeout(() => this.updateStatusBar({ kind: 'idle' }), 2000);
        break;
      }
      case 'done': {
        const text = state.warnings ? 'Erupt: done with warnings ✓' : 'Erupt: done ✓';
        this.statusWordEl.setText(text);
        this.statusWordEl.removeClass('erupt-magic-label');
        this.statusDetailEl.setText('');
        this.statusCancelEl.style.display = 'none';
        this.statusBarItem.addClass(state.warnings ? 'erupt-status-warning' : 'erupt-status-success');
        this.announceAria(text, true);
        this.doneTransitionTimer = setTimeout(() => this.updateStatusBar({ kind: 'idle' }), 2000);
        break;
      }
      case 'error': {
        this.statusWordEl.setText('Erupt: error');
        this.statusWordEl.removeClass('erupt-magic-label');
        this.statusDetailEl.setText('');
        this.statusCancelEl.style.display = 'none';
        this.statusBarItem.addClass('erupt-status-error');
        this.announceAria('Erupt: extraction error', true);
        this.doneTransitionTimer = setTimeout(() => this.updateStatusBar({ kind: 'idle' }), 3000);
        break;
      }
    }
  }

  private announceAria(text: string, force = false) {
    if (force || text !== this.lastAriaAnnounce) {
      this.ariaAnnounceEl.setText(text);
      this.lastAriaAnnounce = text;
    }
  }

  private maybeAnnounceAria(text: string, turn: number) {
    if (turn % 5 === 0 || this.lastAriaTurn < 0) {
      this.announceAria(text, true);
      this.lastAriaTurn = turn;
    }
  }

  private handleCancelClick() {
    this.cancelClickCount++;
    if (this.cancelClickCount === 1) {
      new Notice('Click again to cancel extraction.', 1500);
      this.cancelClickTimer = setTimeout(() => {
        this.cancelClickCount = 0;
        this.cancelClickTimer = null;
      }, 3000);
    } else if (this.cancelClickCount >= 2) {
      if (this.cancelClickTimer) clearTimeout(this.cancelClickTimer);
      this.cancelClickCount = 0;
      this.cancelClickTimer = null;
      this.runState?.currentController?.abort();
    }
  }

  // ---- Commands -------------------------------------------------------------

  private registerCommands() {
    this.addCommand({
      id: 'erupt-extract-notes',
      name: 'Extract Notes',
      callback: () => this.extractNotes(),
    });

    this.addCommand({
      id: 'erupt-open-magma-explorer',
      name: 'Open Magma Explorer',
      callback: () => this.openMagmaExplorer(),
    });

    this.addCommand({
      id: 'erupt-link-session',
      name: 'Link Session',
      callback: () => this.linkSession(),
    });

    this.addCommand({
      id: 'erupt-toggle-diffs',
      name: 'Toggle diff view',
      callback: () => this.toggleDiffView(),
    });

    this.addCommand({
      id: 'erupt-check-article-length',
      name: 'Check article length',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !file.path.startsWith(MAGMA_WIKI_ROOT + '/')) {
          new Notice('Erupt: open a Magma article to check its length.', 3000);
          return;
        }
        if (this.settings.suppressedLengthCheck.includes(file.path)) {
          new Notice('Erupt: length check suppressed for this article.', 3000);
          return;
        }
        const content = await this.app.vault.read(file);
        if (content.length > 8000) {
          new LengthComplianceModal(this.app, {
            file,
            charCount: content.length,
            onSplit: () => this.splitArticle(file),
            onSuppress: async (path) => {
              this.settings.suppressedLengthCheck.push(path);
              await this.saveSettings();
            },
          }).open();
        } else {
          new Notice(`Erupt: article is ${content.length.toLocaleString()} characters — within limit.`, 3000);
        }
      },
    });

    if (this.settings.wikigameUnlocked) this.registerWikiGameCommand();
  }

  private registerWikiGameCommand() {
    this.addCommand({
      id: 'erupt-play-wikigame',
      name: 'Play WikiGame',
      callback: () => new Notice('Erupt: WikiGame not yet implemented', 3000),
    });
  }

  // ---- Core command handlers ------------------------------------------------

  private async extractNotes() {
    if (this.extractionActive) {
      new Notice("Extraction already running — wait for it to complete or restart Obsidian if it's stuck.", 5000);
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('Erupt: open a note with a pasted conversation to extract from.', 4000);
      return;
    }

    if (this.settings.plan === 'local') {
      const reachable = await this.pingOllama();
      if (!reachable) {
        new Notice('Ollama not detected — make sure Ollama is running.', 5000);
        return;
      }
    }

    const locked = await acquireLock(this.app.vault, MAGMA_WIKI_ROOT);
    if (!locked) {
      new Notice('Erupt: another extraction is in progress (lock file exists).', 5000);
      return;
    }

    this.extractionActive = true;
    this.getMagmaExplorerView()?.updateLockBanner();
    this.updateStatusBar({ kind: 'extracting', turn: 0, total: 0 });

    try {
      const content = await this.app.vault.read(activeFile);
      const transcript = parseTranscript(content);
      if (transcript.length === 0) {
        new Notice('Erupt: no conversation turns found in this note.', 4000);
        return;
      }

      await this.vaultScanner.build(this.app.vault);
      this.runState = createRunState();

      const client = buildClient(this.settings);
      const model = getModel(this.settings);
      const capability = getCapability(this.settings);

      if (capability === '3pass' &&
          !this.settings.suppressedCompatibilityNotice.includes(model)) {
        await new CompatNoticeModal(
          this.app,
          model,
          (m) => {
            this.settings.suppressedCompatibilityNotice.push(m);
            this.saveSettings();
          },
        ).openAsync();
      }

      const loopOpts = {
        client,
        model,
        transcript,
        vault: this.app.vault,
        state: this.runState,
        config: DEFAULT_EXTRACTION_CONFIG,
        vaultScanner: this.vaultScanner,
        magmaRoot: MAGMA_WIKI_ROOT,
        onProgress: (turn: number, total: number) => {
          this.updateStatusBar({ kind: 'extracting', turn, total });
        },
        onWriteMagma: (path: string) => {
          this.getMagmaExplorerView()?.flashRow(path);
        },
      };

      if (capability === 'agentic') {
        await runExtractionLoop(loopOpts);
      } else {
        await run3PassFallback({
          ollamaBaseUrl: this.settings.ollamaBaseUrl,
          ollamaModel: this.settings.ollamaModel || 'llama3.2',
          transcript,
          vault: this.app.vault,
          state: this.runState,
          config: DEFAULT_EXTRACTION_CONFIG,
          magmaRoot: MAGMA_WIKI_ROOT,
          onProgress: (label: string) => {
            const map: Record<string, StatusBarState> = {
              'scouting topics':     { kind: 'extracting', turn: 1, total: 5 },
              'extracting articles': { kind: 'extracting', turn: 2, total: 5 },
              'quality check':       { kind: 'final_pass', label: 'compliance' },
            };
            this.updateStatusBar(map[label] ?? { kind: 'extracting', turn: 0, total: 0 });
          },
        });
      }

      this.updateStatusBar({ kind: 'final_pass', label: 'compliance' });
      await runFinalPass({
        client,
        model,
        vault: this.app.vault,
        state: this.runState,
        config: DEFAULT_EXTRACTION_CONFIG,
        vaultScanner: this.vaultScanner,
        magmaRoot: MAGMA_WIKI_ROOT,
        onProgress: (label: string) => {
          const fpLabel = label.includes('compliance') ? 'compliance' : 'consistency';
          this.updateStatusBar({ kind: 'final_pass', label: fpLabel });
        },
      });

      const hasWarnings = this.runState.errorCount > 0;
      this.updateStatusBar({ kind: 'done', warnings: hasWarnings });

      await new CompletionModal(this.app, {
        state: this.runState,
        vault: this.app.vault,
        magmaRoot: MAGMA_WIKI_ROOT,
        feedbackRatingsGiven: this.settings.feedbackRatingsGiven,
        onFeedback: async (_rating) => {
          this.settings.feedbackRatingsGiven++;
          await this.saveSettings();
        },
        onOpenFolder: () => this.openMagmaExplorer(),
      }).openAsync();

      await this.checkWikiGameUnlock();
      this.checkJwtExpiry();

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.updateStatusBar({ kind: 'cancelled' });
      } else {
        this.updateStatusBar({ kind: 'error' });
        new Notice(`Erupt: extraction failed — ${err instanceof Error ? err.message : String(err)}`, 5000);
      }
    } finally {
      this.extractionActive = false;
      this.getMagmaExplorerView()?.updateLockBanner();
      this.runState = null;
      await releaseLock(this.app.vault, MAGMA_WIKI_ROOT);
    }
  }

  private async openMagmaExplorer() {
    const leaves = this.app.workspace.getLeavesOfType(MAGMA_VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
    } else {
      const leaf = this.app.workspace.getLeftLeaf(false);
      if (leaf) await leaf.setViewState({ type: MAGMA_VIEW_TYPE, active: true });
    }
  }

  private async linkSession() {
    new SessionPickerModal(
      this.app,
      this.app.vault,
      MAGMA_WIKI_ROOT,
      (path) => new Notice(`Session linked: ${path}`, 3000),
      () => new Notice('New session creation not yet implemented', 3000),
    ).open();
  }

  private toggleDiffView() {
    // TODO: implement diff toggle ribbon state + diff overlay
    new Notice('Erupt: diff view not yet implemented', 3000);
  }

  private splitArticle(_file: TFile): void {
    // TODO: wire final-pass sub-pass 1 decompose for single article (Phase 10)
    new Notice('Erupt: article split from Explorer coming soon', 3000);
  }

  // ---- Vault listeners ------------------------------------------------------

  private registerVaultListeners() {
    this.registerEvent(
      this.app.vault.on('modify', (file: TFile) => this.handleVaultModify(file))
    );
  }

  private handleVaultModify(file: TFile) {
    if (!file.path.startsWith(MAGMA_WIKI_ROOT + '/')) return;

    if (this.extractionActive && this.runState) {
      // Revert external edit — Magma is locked during extraction
      const lastGood = this.runState.lastGoodContent.get(file.path);
      if (lastGood !== undefined) {
        this.app.vault.modify(file, lastGood);
      }
      new Notice('Magma is locked during extraction — external edits are blocked.', 3000);
      return;
    }

    // Length compliance check (debounced 3s)
    this.debounceLengthCheck(file);
  }

  private debounceLengthCheck(file: TFile) {
    const existing = this.lengthCheckTimers.get(file.path);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.lengthCheckTimers.delete(file.path);
      if (this.extractionActive) return;
      if (this.settings.suppressedLengthCheck.includes(file.path)) return;

      const content = await this.app.vault.read(file);
      if (content.length > 8000) {
        new LengthComplianceModal(this.app, {
          file,
          charCount: content.length,
          onSplit: () => this.splitArticle(file),
          onSuppress: async (path) => {
            this.settings.suppressedLengthCheck.push(path);
            await this.saveSettings();
          },
        }).open();
      }
    }, 3000);

    this.lengthCheckTimers.set(file.path, timer);
  }

  // ---- Helpers --------------------------------------------------------------

  private async pingOllama(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      const resp = await fetch(`${this.settings.ollamaBaseUrl}/api/tags`, {
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }

  private checkJwtExpiry() {
    const { authToken, plan } = this.settings;
    if (plan === 'local' || !authToken) return;
    const exp = parseJwtExp(authToken);
    if (exp !== null && exp * 1000 < Date.now()) {
      new Notice(
        'Your Slipstream session expired — reconnect your account in Settings for future extractions.',
        6000,
      );
    }
  }

  async checkWikiGameUnlock() {
    if (this.settings.wikigameUnlocked) return;

    const vaultNoteCount = this.app.vault.getMarkdownFiles().length;
    const magmaCount = this.app.vault
      .getFiles()
      .filter(f => f.path.startsWith(MAGMA_WIKI_ROOT + '/')).length;

    if (vaultNoteCount >= 100 && magmaCount >= 25) {
      this.settings.wikigameUnlocked = true;
      await this.saveSettings();
      this.registerWikiGameCommand();
      new Notice('🌋 Something unlocked in Erupt...', 3000);
    }
  }
}

// ---- Settings tab -----------------------------------------------------------

class EruptSettingTab extends PluginSettingTab {
  plugin: EruptPlugin;

  constructor(app: App, plugin: EruptPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Erupt' });

    // Plan selector
    new Setting(containerEl)
      .setName('Plan')
      .setDesc('Your Erupt plan determines which AI provider is used.')
      .addDropdown(drop =>
        drop
          .addOption('free', 'Free (3 lifetime extractions)')
          .addOption('local', 'Local — Ollama ($5/mo)')
          .addOption('cloud', 'Cloud ($15–20/mo)')
          .setValue(this.plugin.settings.plan)
          .onChange(async (value: string) => {
            this.plugin.settings.plan = value as EruptSettings['plan'];
            await this.plugin.saveSettings();
            this.display();
          })
      );

    const { plan, authToken } = this.plugin.settings;

    // Auth section (Free + Cloud)
    if (plan === 'free' || plan === 'cloud') {
      if (authToken) {
        new Setting(containerEl)
          .setName('Slipstream account')
          .setDesc('● Connected — ' + (parseJwtEmail(authToken) ?? 'connected'))
          .addButton(btn =>
            btn
              .setButtonText('Disconnect')
              .setWarning()
              .onClick(async () => {
                this.plugin.settings.authToken = '';
                await this.plugin.saveSettings();
                this.display();
              })
          );
      } else {
        new Setting(containerEl)
          .setName('Slipstream account')
          .setDesc('Connect your account to start extracting.')
          .addButton(btn =>
            btn
              .setButtonText('Connect Slipstream account')
              .setCta()
              .onClick(() => {
                window.open(
                  'https://slipstream.now/connect/obsidian?callback=obsidian%3A%2F%2Ferupt%2Fauth',
                  '_blank',
                );
              })
          );
      }
    }

    // Local plan settings
    if (plan === 'local') {
      new Setting(containerEl)
        .setName('Ollama URL')
        .setDesc('Base URL of your local Ollama instance.')
        .addText(text =>
          text
            .setPlaceholder('http://localhost:11434')
            .setValue(this.plugin.settings.ollamaBaseUrl)
            .onChange(async value => {
              this.plugin.settings.ollamaBaseUrl = value.trim() || 'http://localhost:11434';
              await this.plugin.saveSettings();
            })
        );

      const modelSetting = new Setting(containerEl)
        .setName('Ollama model')
        .setDesc('Model for extraction. Fetching available models...');

      loadOllamaModels(this.plugin.settings.ollamaBaseUrl).then(models => {
        modelSetting.setDesc('Model for extraction. Recommended: llama3.2, mistral:7b.');
        if (models && models.length > 0) {
          modelSetting.addDropdown(drop => {
            for (const m of models) {
              const label = RECOMMENDED_OLLAMA_MODELS.has(m.split(':')[0]) ? `${m} ★` : m;
              drop.addOption(m, label);
            }
            if (
              this.plugin.settings.ollamaModel &&
              !models.includes(this.plugin.settings.ollamaModel)
            ) {
              drop.addOption(
                this.plugin.settings.ollamaModel,
                this.plugin.settings.ollamaModel + ' (custom)',
              );
            }
            drop.setValue(this.plugin.settings.ollamaModel || models[0] || '');
            drop.onChange(async value => {
              this.plugin.settings.ollamaModel = value;
              await this.plugin.saveSettings();
            });
          });
        } else {
          modelSetting.setDesc('Ollama not reachable. Enter model name manually.');
          modelSetting.addText(text =>
            text
              .setPlaceholder('llama3.2')
              .setValue(this.plugin.settings.ollamaModel)
              .onChange(async value => {
                this.plugin.settings.ollamaModel = value.trim();
                await this.plugin.saveSettings();
              })
          );
        }
      });
    }

    // "by Slipstream" shimmer-brand byline — always at bottom of settings panel
    const bylineEl = containerEl.createEl('div', {
      cls: 'slipstream-byline erupt-settings-byline',
      text: 'by Slipstream',
    });
    containerEl.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = containerEl.getBoundingClientRect();
      bylineEl.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width).toFixed(3));
      bylineEl.style.setProperty('--my', ((e.clientY - rect.top) / rect.height).toFixed(3));
    });
  }
}

// ---- Utilities --------------------------------------------------------------

function buildClient(settings: EruptSettings): Anthropic {
  if (settings.byokApiKey) {
    return new Anthropic({ apiKey: settings.byokApiKey });
  }
  return new Anthropic({
    baseURL: 'https://api.slipstream.now/proxy/claude',
    apiKey: settings.authToken,
  });
}

function getModel(settings: EruptSettings): string {
  if (settings.plan === 'local') return settings.ollamaModel || 'llama3.2';
  return 'claude-haiku-4-5-20251001';
}

function getCapability(settings: EruptSettings): ModelCapability {
  if (settings.plan !== 'local') return 'agentic';
  const known = getCachedCapability(settings.ollamaModel) ?? getKnownCapability(settings.ollamaModel);
  return known ?? '3pass';
}

async function acquireLock(vault: Vault, magmaRoot: string): Promise<boolean> {
  const lockPath = magmaRoot.replace(/\/wiki$/, '') + '/.lock';
  if (vault.getFileByPath(lockPath)) return false;
  await ensureDir(vault, lockPath);
  await vault.create(lockPath, JSON.stringify({ ts: Date.now() }));
  return true;
}

async function releaseLock(vault: Vault, magmaRoot: string): Promise<void> {
  const lockPath = magmaRoot.replace(/\/wiki$/, '') + '/.lock';
  const f = vault.getFileByPath(lockPath);
  if (f) await vault.delete(f);
}

const RECOMMENDED_OLLAMA_MODELS = new Set(['llama3.2', 'mistral:7b', 'mistral', 'phi3']);

async function loadOllamaModels(baseUrl: string): Promise<string[] | null> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json() as { models?: Array<{ name: string }> };
    return data.models?.map(m => m.name) ?? null;
  } catch {
    return null;
  }
}

function parseJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function parseJwtEmail(token: string): string | undefined {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email as string | undefined;
  } catch {
    return undefined;
  }
}

// Re-export for test access
export { DEFAULT_SETTINGS, MAGMA_WIKI_ROOT };
export type { EruptSettings };
