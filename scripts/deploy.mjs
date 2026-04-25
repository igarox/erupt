#!/usr/bin/env node
/**
 * deploy.mjs — copy built plugin files into an Obsidian vault
 *
 * Usage:
 *   node scripts/deploy.mjs                   # interactive vault picker
 *   node scripts/deploy.mjs /path/to/vault    # deploy to specific vault
 *   npm run deploy                             # same as first form
 *   npm run deploy -- /path/to/vault          # same as second form
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

const PLUGIN_ID   = 'erupt';
const BUILD_FILES = ['main.js', 'manifest.json', 'styles.css'];

// ── Obsidian vault discovery ────────────────────────────────────────────────

function obsidianConfigPath() {
  switch (process.platform) {
    case 'win32':  return join(process.env.APPDATA ?? '', 'Obsidian', 'obsidian.json');
    case 'darwin': return join(homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json');
    default:       return join(homedir(), '.config', 'obsidian', 'obsidian.json');
  }
}

function discoverVaults() {
  const cfgPath = obsidianConfigPath();
  if (!existsSync(cfgPath)) return [];
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    return Object.values(cfg.vaults ?? {})
      .map(v => v.path)
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

// ── Interactive picker ──────────────────────────────────────────────────────

function ask(rl, prompt) {
  return new Promise(res => rl.question(prompt, res));
}

async function pickVault(vaults) {
  if (vaults.length === 0) {
    console.error('No Obsidian vaults found in Obsidian config.');
    console.error('Pass the vault path directly:  npm run deploy -- /path/to/vault');
    process.exit(1);
  }

  if (vaults.length === 1) {
    console.log(`Single vault found: ${vaults[0]}`);
    return vaults[0];
  }

  console.log('\nObsidian vaults:');
  vaults.forEach((v, i) => console.log(`  ${i + 1}.  ${v}`));
  console.log();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let chosen;
  while (!chosen) {
    const raw = (await ask(rl, `Pick a vault [1–${vaults.length}]: `)).trim();
    const n   = parseInt(raw, 10);
    if (n >= 1 && n <= vaults.length) {
      chosen = vaults[n - 1];
    } else {
      console.log(`  Enter a number between 1 and ${vaults.length}.`);
    }
  }

  rl.close();
  return chosen;
}

// ── .env → data.json injection ─────────────────────────────────────────────

function parseEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (val) result[key] = val;
  }
  return result;
}

function injectDevSettings(pluginDir) {
  const env = parseEnv();
  const mapping = {
    ERUPT_BYOK_API_KEY: 'byokApiKey',
    ERUPT_AUTH_TOKEN:   'authToken',
    ERUPT_PLAN:         'plan',
  };

  const injected = {};
  for (const [envKey, settingKey] of Object.entries(mapping)) {
    if (env[envKey]) injected[settingKey] = env[envKey];
  }

  if (Object.keys(injected).length === 0) return;

  const dataPath = join(pluginDir, 'data.json');
  let existing = {};
  if (existsSync(dataPath)) {
    try { existing = JSON.parse(readFileSync(dataPath, 'utf8')); } catch { /* start fresh */ }
  }

  const merged = { ...existing, ...injected };
  writeFileSync(dataPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`\nInjected dev settings into data.json: ${Object.keys(injected).join(', ')}`);
}

// ── Deploy ──────────────────────────────────────────────────────────────────

function deploy(vaultPath) {
  const absVault   = resolve(vaultPath);
  const pluginDir  = join(absVault, '.obsidian', 'plugins', PLUGIN_ID);

  if (!existsSync(absVault)) {
    console.error(`\nVault not found: ${absVault}`);
    process.exit(1);
  }

  mkdirSync(pluginDir, { recursive: true });

  const missing = [];
  let   copied  = 0;

  for (const file of BUILD_FILES) {
    const src  = resolve(file);
    const dest = join(pluginDir, file);

    // Remove stale copy
    if (existsSync(dest)) rmSync(dest);

    if (!existsSync(src)) {
      missing.push(file);
      continue;
    }

    copyFileSync(src, dest);
    copied++;
  }

  injectDevSettings(pluginDir);
  console.log(`\nDeployed ${copied}/${BUILD_FILES.length} files → ${pluginDir}`);

  if (missing.length > 0) {
    console.log(`\nMissing (run npm run build first):`);
    missing.forEach(f => console.log(`  · ${f}`));
  } else {
    console.log('\nReload in Obsidian: ⌘P / Ctrl+P → "Reload app without saving"');
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const argVault = process.argv[2];

if (argVault) {
  deploy(argVault);
} else {
  const vaults = discoverVaults();
  const chosen = await pickVault(vaults);
  deploy(chosen);
}
