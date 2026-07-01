export type ProviderKind = 'openai-compatible' | 'anthropic';

export interface ProviderConfig {
  readonly name: string;
  readonly key: string;
  readonly kind: ProviderKind;
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly chatModel: string;
  readonly embeddingModel?: string;
  readonly embeddingDimensions?: number;
  readonly supportsEmbeddings: boolean;
}

const DEFAULTS = {
  ollamaBaseURL: 'http://localhost:11434/v1',
  ollamaChat: 'qwen2.5:7b',
  ollamaEmbed: 'nomic-embed-text',
  geminiChat: 'gemini-1.5-flash',
  geminiEmbed: 'text-embedding-004',
  groqChat: 'mixtral-8x7b-32768',
  openaiChat: 'gpt-4o-mini',
  openaiEmbed: 'text-embedding-3-small',
  anthropicChat: 'claude-sonnet-4-20250514',
};

function isSelectedProvider(provider: string): boolean {
  return process.env.THOTH_PROVIDER === provider || (provider === 'ollama' && process.env.THOTH_LOCAL === 'true');
}

function chatModel(provider: string, providerSpecific: string | undefined, fallback: string): string {
  return providerSpecific ?? (isSelectedProvider(provider) ? process.env.THOTH_CHAT_MODEL : undefined) ?? fallback;
}

function embeddingModel(provider: string, providerSpecific: string | undefined, fallback: string): string {
  return providerSpecific ?? (isSelectedProvider(provider) ? process.env.THOTH_EMBEDDING_MODEL : undefined) ?? fallback;
}

export function getChatProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const localOnly = process.env.THOTH_LOCAL === 'true';
  const preferredProvider = process.env.THOTH_PROVIDER;

  if (preferredProvider && preferredProvider !== 'openai') {
    // skip — will be added in preferred position later
  } else if (!localOnly && process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI',
      key: 'openai',
      kind: 'openai-compatible',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      chatModel: chatModel('openai', process.env.OPENAI_CHAT_MODEL, DEFAULTS.openaiChat),
      supportsEmbeddings: true,
      embeddingModel: embeddingModel('openai', process.env.OPENAI_EMBEDDING_MODEL, DEFAULTS.openaiEmbed),
      embeddingDimensions: 1536,
    });
  }

  if (preferredProvider && preferredProvider !== 'groq') {
    // skip
  } else if (!localOnly && process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      key: 'groq',
      kind: 'openai-compatible',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      chatModel: chatModel('groq', process.env.GROQ_CHAT_MODEL, DEFAULTS.groqChat),
      supportsEmbeddings: false,
    });
  }

  if (preferredProvider && preferredProvider !== 'gemini') {
    // skip
  } else if (!localOnly && process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      key: 'gemini',
      kind: 'openai-compatible',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: process.env.GEMINI_API_KEY,
      chatModel: chatModel('gemini', process.env.GEMINI_CHAT_MODEL, DEFAULTS.geminiChat),
      supportsEmbeddings: true,
      embeddingModel: embeddingModel('gemini', process.env.GEMINI_EMBEDDING_MODEL, DEFAULTS.geminiEmbed),
      embeddingDimensions: 768,
    });
  }

  if (preferredProvider && preferredProvider !== 'anthropic') {
    // skip
  } else if (!localOnly && process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: 'Anthropic',
      key: 'anthropic',
      kind: 'anthropic',
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: process.env.ANTHROPIC_API_KEY,
      chatModel: chatModel('anthropic', process.env.ANTHROPIC_CHAT_MODEL, DEFAULTS.anthropicChat),
      supportsEmbeddings: false,
    });
  }

  if (preferredProvider && preferredProvider !== 'ollama') {
    // skip
  } else {
    providers.push({
      name: 'Ollama',
      key: 'ollama',
      kind: 'openai-compatible',
      baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULTS.ollamaBaseURL,
      chatModel: chatModel('ollama', process.env.OLLAMA_CHAT_MODEL, DEFAULTS.ollamaChat),
      supportsEmbeddings: true,
      embeddingModel: embeddingModel('ollama', process.env.OLLAMA_EMBEDDING_MODEL, DEFAULTS.ollamaEmbed),
      embeddingDimensions: 768,
    });
  }

  return providers;
}

export function getEmbeddingProviders(): ProviderConfig[] {
  return getChatProviders().filter((p) => p.supportsEmbeddings);
}

export function getActiveEmbeddingProviderKey(): string {
  const providers = getEmbeddingProviders();
  return providers[0]?.key ?? 'openai';
}
