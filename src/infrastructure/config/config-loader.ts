import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { thothConfigSchema, type ThothConfig } from './config.schema.ts';

const CONFIG_FILENAME = 'thoth.json';

function configWarn(message: string): void {
  process.stderr.write(`\u001b[33m[config]\u001b[0m ${message}\n`);
}

function findConfigFiles(): string[] {
  const paths: string[] = [];

  const cwdConfig = resolve(process.cwd(), CONFIG_FILENAME);
  if (existsSync(cwdConfig)) {
    paths.push(cwdConfig);
  }

  const homeDir = homedir();
  const homeConfig = join(homeDir, '.thoth', CONFIG_FILENAME);
  if (existsSync(homeConfig)) {
    paths.push(homeConfig);
  }

  return paths;
}

function readAndParseConfig(filePath: string): ThothConfig {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const result = thothConfigSchema.safeParse(parsed);
    if (!result.success) {
      configWarn(`Config file ${filePath} has invalid fields: ${result.error.message}`);
      return {};
    }
    return result.data;
  } catch (error) {
    configWarn(`Could not read config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

export function loadConfig(): ThothConfig {
  const configFiles = findConfigFiles();
  let config: ThothConfig = {};

  for (const filePath of configFiles) {
    const partial = readAndParseConfig(filePath);
    config = { ...config, ...partial };
  }

  return config;
}

const DEFAULTS: ThothConfig = {
  logLevel: 'error',
};

export function resolveConfig(cliLocal?: boolean, cliProvider?: string): ThothConfig {
  const fileConfig = loadConfig();

  const envLocal = process.env.THOTH_LOCAL === 'true';

  const logLevel = process.env.LOG_LEVEL ?? fileConfig.logLevel ?? DEFAULTS.logLevel;
  const dbPath = process.env.THOTH_DB_PATH ?? fileConfig.dbPath;
  const local = cliLocal ?? envLocal ?? fileConfig.local ?? false;
  const provider = (cliProvider ?? process.env.THOTH_PROVIDER ?? fileConfig.provider) as ThothConfig['provider'] | undefined;
  const chatModel = process.env.THOTH_CHAT_MODEL ?? fileConfig.chatModel;
  const embeddingModel = process.env.THOTH_EMBEDDING_MODEL ?? fileConfig.embeddingModel;

  return {
    logLevel,
    dbPath,
    local,
    provider,
    chatModel,
    embeddingModel,
    export: fileConfig.export,
  };
}

export function applyConfig(config: ThothConfig): void {
  if (config.logLevel) process.env.LOG_LEVEL = config.logLevel;
  if (config.dbPath) process.env.THOTH_DB_PATH = config.dbPath;
  if (config.provider) process.env.THOTH_PROVIDER = config.provider;
  if (config.chatModel) process.env.THOTH_CHAT_MODEL = config.chatModel;
  if (config.embeddingModel) process.env.THOTH_EMBEDDING_MODEL = config.embeddingModel;
  if (config.local !== undefined) process.env.THOTH_LOCAL = config.local ? 'true' : 'false';
}
