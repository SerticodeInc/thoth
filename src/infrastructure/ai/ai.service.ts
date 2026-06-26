import OpenAI from 'openai';
import { getChatProviders, getEmbeddingProviders } from './provider.ts';
import type { ProviderConfig } from './provider.ts';
import type { AiService, ChatParams } from '../../domain/repositories/ai-service.ts';
import type { Result } from '../../domain/entities/result.ts';
import { logger } from '../logging/logger.ts';

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

function buildProviderListError(operation: string): string {
  return `No AI provider available for ${operation}. Set OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or start Ollama on localhost:11434.`;
}

export class OpenAiAiService implements AiService {
  async chat(params: ChatParams): Promise<Result<string>> {
    const providers = getChatProviders();

    if (providers.length === 0) {
      return { ok: false, error: buildProviderListError('chat') };
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
          return { ok: true, value: content };
        }
      } catch (error) {
        logger.warn(
          { provider: provider.name, error: error instanceof Error ? error.message : error },
          'Provider failed, trying next',
        );
      }
    }

    return { ok: false, error: 'All AI providers failed to complete the chat request.' };
  }

  async generateEmbedding(text: string): Promise<Result<number[]>> {
    const providers = getEmbeddingProviders();

    if (providers.length === 0) {
      return { ok: false, error: buildProviderListError('embeddings') };
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
          return { ok: true, value: embedding };
        }
      } catch (error) {
        logger.warn(
          { provider: provider.name, error: error instanceof Error ? error.message : error },
          'Provider failed, trying next',
        );
      }
    }

    return { ok: false, error: 'All embedding providers failed.' };
  }
}
