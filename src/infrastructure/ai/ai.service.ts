import OpenAI from 'openai';
import { getChatProviders, getEmbeddingProviders } from './provider.ts';
import type { ProviderConfig } from './provider.ts';
import { logger } from '../logging/logger.ts';

export interface ChatParams {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature?: number;
}

function createClient(config: ProviderConfig): OpenAI {
  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey ?? 'no-key-required',
  });
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(params: ChatParams): Promise<string> {
  const providers = getChatProviders();

  if (providers.length === 0) {
    throw new Error(
      'No AI provider available. Set OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or start Ollama on localhost:11434.',
    );
  }

  for (const provider of providers) {
    try {
      logger.debug({ provider: provider.name }, 'Attempting chat completion');

      const client = createClient(provider);
      const response = await withTimeout(
        (signal) =>
          client.chat.completions.create(
            {
              model: provider.chatModel,
              messages: [
                { role: 'system', content: params.systemPrompt },
                { role: 'user', content: params.userPrompt },
              ],
              temperature: params.temperature ?? 0.7,
            },
            { signal },
          ),
        15_000,
      );

      const content = response.choices[0]?.message?.content;
      if (content) {
        logger.info({ provider: provider.name }, 'Chat completed');
        return content;
      }
    } catch (error) {
      logger.warn(
        { provider: provider.name, error: error instanceof Error ? error.message : error },
        'Provider failed, trying next',
      );
    }
  }

  throw new Error('All AI providers failed to complete the chat request.');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const providers = getEmbeddingProviders();

  if (providers.length === 0) {
    throw new Error(
      'No embedding provider available. Set OPENAI_API_KEY, GEMINI_API_KEY, or start Ollama on localhost:11434.',
    );
  }

  for (const provider of providers) {
    if (!provider.embeddingModel) continue;
    const model = provider.embeddingModel;

    try {
      logger.debug({ provider: provider.name, textLength: text.length }, 'Attempting embedding');

      const client = createClient(provider);
      const response = await withTimeout(
        (signal) =>
          client.embeddings.create(
            {
              model,
              input: text,
            },
            { signal },
          ),
        15_000,
      );

      const embedding = response.data[0]?.embedding;
      if (embedding) {
        logger.info({ provider: provider.name }, 'Embedding generated');
        return embedding;
      }
    } catch (error) {
      logger.warn(
        { provider: provider.name, error: error instanceof Error ? error.message : error },
        'Provider failed, trying next',
      );
    }
  }

  throw new Error('All embedding providers failed.');
}
