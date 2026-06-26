import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
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
  return `No AI provider available for ${operation}. Set OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or start Ollama on localhost:11434.`;
}

async function chatWithOpenAiCompatible(
  config: ProviderConfig,
  params: ChatParams,
  signal: AbortSignal,
): Promise<string | null> {
  const client = createClient(config);
  const response = await client.chat.completions.create(
    {
      model: config.chatModel,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.7,
    },
    { signal },
  );
  return response.choices[0]?.message?.content ?? null;
}

async function chatWithAnthropic(
  config: ProviderConfig,
  params: ChatParams,
  signal: AbortSignal,
): Promise<string | null> {
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
  });

  const response = await anthropic.messages.create(
    {
      model: config.chatModel,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
      max_tokens: 4096,
      temperature: params.temperature ?? 0.7,
    },
    { signal },
  );

  const contentBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
  const content = contentBlock?.text ?? null;

  return content || null;
}

export class OpenAiAiService implements AiService {
  async chat(params: ChatParams): Promise<Result<string>> {
    const providers = getChatProviders();

    if (providers.length === 0) {
      return { ok: false, error: buildProviderListError('chat') };
    }

    const MAX_RETRIES = 3;

    for (const provider of providers) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.debug({ provider: provider.name, attempt }, 'Attempting chat completion');

          const content = await withTimeout(async (signal) => {
            if (provider.kind === 'anthropic') {
              return chatWithAnthropic(provider, params, signal);
            }
            return chatWithOpenAiCompatible(provider, params, signal);
          }, 30_000);

          if (content) {
            logger.info({ provider: provider.name }, 'Chat completed');
            return { ok: true, value: content };
          }
        } catch (error) {
          const isLastAttempt = attempt === MAX_RETRIES;
          logger.warn(
            {
              provider: provider.name,
              attempt,
              error: error instanceof Error ? error.message : error,
            },
            isLastAttempt ? 'Provider failed, trying next' : 'Retrying...',
          );

          if (!isLastAttempt) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }

    return { ok: false, error: 'All AI providers failed to complete the chat request.' };
  }

  async generateEmbedding(text: string): Promise<Result<number[]>> {
    const providers = getEmbeddingProviders();

    if (providers.length === 0) {
      return { ok: false, error: buildProviderListError('embeddings') };
    }

    const MAX_RETRIES = 3;

    for (const provider of providers) {
      if (!provider.embeddingModel) continue;
      const model = provider.embeddingModel;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.debug({ provider: provider.name, attempt, textLength: text.length }, 'Attempting embedding');

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
          const isLastAttempt = attempt === MAX_RETRIES;
          logger.warn(
            {
              provider: provider.name,
              attempt,
              error: error instanceof Error ? error.message : error,
            },
            isLastAttempt ? 'Provider failed, trying next' : 'Retrying...',
          );

          if (!isLastAttempt) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }

    return { ok: false, error: 'All embedding providers failed.' };
  }
}
