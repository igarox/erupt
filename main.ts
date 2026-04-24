import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { DEFAULT_EXTRACTION_CONFIG, createRunState, type ExtractionRunState } from './src/types';
import { VaultScanner } from './src/vault-scanner';

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
      new Notice(
        'Extraction already running — wait for it to complete or restart Obsidian if it\'s stuck.',
        5000
      );
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('Erupt: open a note with a pasted conversation to extract from.', 4000);
      return;
    }

    // Local plan: pre-flight Ollama check
    if (this.settings.plan === 'local') {
      const reachable = await this.pingOllama();
      if (!reachable) {
        new Notice('Ollama not detected — make sure Ollama is running before extracting.', 5000);
        return;
      }
    }

    // TODO: link session if note has no linked session
    // TODO: run model capability detection (Local plan)
    // TODO: show compatibility mode notice for 3-pass models
    // TODO: acquire lock file, build vault scanner index
    // TODO: run runExtractionLoop() or run3PassFallback()
    // TODO: run runFinalPass()
    // TODO: show completion modal
    // TODO: check WikiGame unlock conditions
    // TODO: JWT post-completion check (Free/Cloud plans)

    new Notice('Erupt: extraction pipeline not yet implemented', 3000);
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
