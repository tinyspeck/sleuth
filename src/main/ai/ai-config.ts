import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_PATH = path.join(os.homedir(), '.config', 'sleuth', 'ai.json');

interface AiConfig {
  fmaRole: string;
  model: string;
}

let loadedConfig: AiConfig | null = null;

/**
 * Read AI configuration from ~/.config/sleuth/ai.json.
 *
 * The config file is expected to contain:
 *   { "fmaRole": "<account>/<role>/<session>", "model": "<bedrock-model-id>" }
 *
 * Values are cached after first read. Environment variables take precedence
 * when set, allowing developers to override without editing the file.
 */
function loadConfig(): AiConfig {
  if (loadedConfig) return loadedConfig;

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === 'object' &&
      'fmaRole' in parsed &&
      'model' in parsed &&
      typeof (parsed as AiConfig).fmaRole === 'string' &&
      typeof (parsed as AiConfig).model === 'string'
    ) {
      loadedConfig = parsed as AiConfig;
      return loadedConfig;
    }
  } catch {
    // Config file missing or malformed — fall through to empty defaults
  }

  loadedConfig = { fmaRole: '', model: '' };
  return loadedConfig;
}

/** FMA role ARN, sourced from env var or config file. */
export function getFmaRole(): string {
  return process.env.SLEUTH_AI_FMA_ROLE ?? loadConfig().fmaRole;
}

/** Bedrock model ID, sourced from env var or config file. */
export function getModel(): string {
  return process.env.SLEUTH_AI_MODEL ?? loadConfig().model;
}

/** AWS region override (env-only, defaults to us-east-1). */
export function getAwsRegion(): string {
  return process.env.SLEUTH_AI_AWS_REGION ?? 'us-east-1';
}
