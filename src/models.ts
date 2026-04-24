export type ModelCapability = 'agentic' | '3pass';

const KNOWN_AGENTIC: string[] = [
  'llama3.1', 'llama3.2', 'llama-3.1', 'llama-3.2',
  'mistral-7b', 'mistral:7b', 'mistral:latest',
  'claude-', 'gpt-',
];

const KNOWN_3PASS: string[] = [
  'phi3', 'phi-3', 'mistral:3b', 'mistral-3b',
];

const capabilityCache = new Map<string, ModelCapability>();

export function getCachedCapability(model: string): ModelCapability | undefined {
  return capabilityCache.get(model);
}

export function setCachedCapability(model: string, cap: ModelCapability): void {
  capabilityCache.set(model, cap);
}

export function getKnownCapability(model: string): ModelCapability | undefined {
  const lower = model.toLowerCase();
  if (KNOWN_3PASS.some(m => lower.includes(m))) return '3pass';
  if (KNOWN_AGENTIC.some(m => lower.includes(m))) return 'agentic';
  return undefined;
}

export function clearCapabilityCache(): void {
  capabilityCache.clear();
}
