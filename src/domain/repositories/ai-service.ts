import type { Result } from '../entities/result.ts';

export interface ChatParams {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature?: number;
  readonly responseFormat?: 'json';
  readonly maxTokens?: number;
}

export interface AiService {
  chat(params: ChatParams): Promise<Result<string>>;
  generateEmbedding(text: string): Promise<Result<number[]>>;
  getActiveEmbeddingModel(): string;
}
