import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatProviders, getEmbeddingProviders } from '../../../src/infrastructure/ai/provider.ts';

describe('AI provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses generic chat and embedding models for local Ollama', () => {
    vi.stubEnv('THOTH_LOCAL', 'true');
    vi.stubEnv('THOTH_CHAT_MODEL', 'llama3.2:1b');
    vi.stubEnv('THOTH_EMBEDDING_MODEL', 'nomic-embed-text:v1');

    const chatProviders = getChatProviders();
    const embeddingProviders = getEmbeddingProviders();

    expect(chatProviders).toHaveLength(1);
    expect(chatProviders[0]).toMatchObject({
      name: 'Ollama',
      chatModel: 'llama3.2:1b',
    });
    expect(embeddingProviders[0]?.embeddingModel).toBe('nomic-embed-text:v1');
  });

  it('does not apply a generic model to non-selected fallback providers', () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('THOTH_CHAT_MODEL', 'custom-local-model');

    const providers = getChatProviders();

    expect(providers.find((provider) => provider.name === 'OpenAI')?.chatModel).toBe('gpt-4o-mini');
    expect(providers.find((provider) => provider.name === 'Ollama')?.chatModel).toBe('llama3.2:1b');
  });
});
