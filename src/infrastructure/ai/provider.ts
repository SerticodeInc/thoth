export interface ProviderConfig {
  readonly name: string;
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly chatModel: string;
  readonly embeddingModel?: string;
  readonly supportsEmbeddings: boolean;
}

const DEFAULTS = {
  ollamaBaseURL: 'http://localhost:11434/v1',
  ollamaChat: 'llama3.2',
  ollamaEmbed: 'nomic-embed-text',
  geminiChat: 'gemini-1.5-flash',
  geminiEmbed: 'text-embedding-004',
  groqChat: 'mixtral-8x7b-32768',
  openaiChat: 'gpt-4o-mini',
  openaiEmbed: 'text-embedding-3-small',
};

export function getChatProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const localOnly = process.env.THOTH_LOCAL === 'true';

  if (!localOnly && process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      chatModel: process.env.OPENAI_CHAT_MODEL ?? DEFAULTS.openaiChat,
      supportsEmbeddings: true,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULTS.openaiEmbed,
    });
  }

  if (!localOnly && process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      chatModel: process.env.GROQ_CHAT_MODEL ?? DEFAULTS.groqChat,
      supportsEmbeddings: false,
    });
  }

  if (!localOnly && process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: process.env.GEMINI_API_KEY,
      chatModel: process.env.GEMINI_CHAT_MODEL ?? DEFAULTS.geminiChat,
      supportsEmbeddings: true,
      embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULTS.geminiEmbed,
    });
  }

  providers.push({
    name: 'Ollama',
    baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULTS.ollamaBaseURL,
    chatModel: process.env.OLLAMA_CHAT_MODEL ?? DEFAULTS.ollamaChat,
    supportsEmbeddings: true,
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULTS.ollamaEmbed,
  });

  return providers;
}

export function getEmbeddingProviders(): ProviderConfig[] {
  return getChatProviders().filter((p) => p.supportsEmbeddings);
}
