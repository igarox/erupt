import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, Vault } from 'obsidian';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_EXTRACTION_CONFIG, createRunState, type ExtractionRunState } from './src/types';
import { VaultScanner } from './src/vault-scanner';
import { runExtractionLoop } from './src/extraction/loop';
import { run3PassFallback } from './src/extraction/fallback';
import { runFinalPass } from './src/extraction/final-pass';
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

// ---- Plugin -----------------------------------------------------------------

export default class EruptPlugin extends Plugin {
  settings!: EruptSettings;
  private statusBarItem!: HTMLElement;

  private extractionActive = false;
  private runState: ExtractionRunState | null = null;
  private vaultScanner = new VaultScanner();
  private lengthCheckTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async onload() {
    await this.loadSettings();
    this.buildStatusBar();
    this.registerCommands();
    this.registerVaultListeners();
    this.addSettingTab(new EruptSettingTab(this.app, this));
  }

  onunload() {
    this.runState?.currentController?.abort();
    for (const t of this.lengthCheckTimers.values()) clearTimeout(t);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ---- Status bar -----------------------------------------------------------

  private buildStatusBar() {
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('Erupt');
    this.statusBarItem.setAttribute('aria-live', 'polite');
  }

  setStatus(text: string) {
    this.statusBarItem.setText(text);
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
      name: 'Toggle Diff View',
      callback: () => this.toggleDiffView(),
    });

    if (this.settings.wikigameUnlocked) this.registerWikiGameCommand();
  }

  private registerWikiGameCommand() {
    this.addCommand({
      id: 'erupt-play-wikigame',
      name: 'Play',
      callback: () => new Notice('Erupt: WikiGame not yet implemented', 3000),
    });
  }

  // ---- Core command handlers ------------------------------------------------

  private async extractNotes() {
    if (this.extractionActive) {
      new Notice("Extraction already running — restart Obsidian if it's stuck.", 5000);
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
    this.setStatus('Erupt: starting...');

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
        new Notice(
          `Running in 3-pass mode for "${model}". Quality may be lower than with a tool-use capable model.`,
          6000
        );
      }

      this.setStatus(`Erupt: turn 0/${transcript.length}...`);

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
          this.setStatus(`Erupt: turn ${turn}/${total}...`);
        },
        onWriteMagma: (_path: string) => {
          // Phase 7: flash Magma Explorer row
        },
      };

      if (capability === 'agentic') {
        await runExtractionLoop(loopOpts);
      } else {
        await run3PassFallback({
          client,
          transcript,
          vault: this.app.vault,
          state: this.runState,
          config: DEFAULT_EXTRACTION_CONFIG,
          magmaRoot: MAGMA_WIKI_ROOT,
          onProgress: (label) => this.setStatus(`Erupt: ${label}...`),
        });
      }

      this.setStatus('Erupt: final pass...');
      await runFinalPass({
        client,
        vault: this.app.vault,
        state: this.runState,
        config: DEFAULT_EXTRACTION_CONFIG,
        magmaRoot: MAGMA_WIKI_ROOT,
        onProgress: (label) => this.setStatus(`Erupt: ${label}...`),
      });

      const articleCount = this.runState.runArticles.size;
      const warnings = this.runState.errorCount > 0 ? ` (${this.runState.errorCount} warnings)` : '';
      this.setStatus(`Erupt: done ✓${warnings}`);
      setTimeout(() => this.setStatus('Erupt'), 2000);

      // Phase 7: show CompletionModal
      new Notice(
        `Extraction complete — ${articleCount} article${articleCount !== 1 ? 's' : ''}${warnings} in .magma/wiki/`,
        6000
      );

      if (this.runState.clarifyingQuestions.length > 0) {
        // Phase 7: show QuestionsModal
        new Notice(`${this.runState.clarifyingQuestions.length} clarifying question(s) queued.`, 4000);
      }

      await this.checkWikiGameUnlock();

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.setStatus('Erupt: cancelled');
        setTimeout(() => this.setStatus('Erupt'), 2000);
      } else {
        this.setStatus('Erupt: error');
        setTimeout(() => this.setStatus('Erupt'), 3000);
        new Notice(`Erupt: extraction failed — ${err instanceof Error ? err.message : String(err)}`, 5000);
      }
    } finally {
      this.extractionActive = false;
      this.runState = null;
      await releaseLock(this.app.vault, MAGMA_WIKI_ROOT);
    }
  }

  private async openMagmaExplorer() {
    // TODO: register and activate MagmaExplorerView (ItemView, view type 'magma-explorer')
    new Notice('Erupt: Magma Explorer not yet implemented', 3000);
  }

  private async linkSession() {
    // TODO: open SessionPickerModal
    new Notice('Erupt: session linking not yet implemented', 3000);
  }

  private toggleDiffView() {
    // TODO: implement diff toggle ribbon state + diff overlay
    new Notice('Erupt: diff view not yet implemented', 3000);
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
        // TODO: show LengthComplianceModal with Split/Edit/Suppress options
        new Notice(
          `"${file.basename}" is getting long — Magma articles work best under ~8,000 characters.`,
          5000
        );
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
      new Notice('🌋 A new Erupt feature has unlocked.', 5000);
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
                // TODO: trigger auth deep-link (obsidian://erupt/auth?token=<jwt>)
                new Notice('Auth flow not yet implemented', 3000);
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

      new Setting(containerEl)
        .setName('Ollama model')
        .setDesc('Model for extraction. Recommended: llama3.2, mistral:7b.')
        .addText(text =>
          text
            .setPlaceholder('llama3.2')
            .setValue(this.plugin.settings.ollamaModel)
            .onChange(async value => {
              this.plugin.settings.ollamaModel = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }
  }
}

// ---- Utilities --------------------------------------------------------------

function buildClient(settings: EruptSettings): Anthropic {
  if (settings.byokApiKey) {
    return new Anthropic({ apiKey: settings.byokApiKey });
  }
  return new Anthropic({
    baseURL: 'https://api.slipstream.app/proxy/claude',
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
