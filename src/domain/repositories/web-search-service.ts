import type { Result } from '../entities/result.ts';

export interface WebSearchResult {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly rawContent?: string;
}

export interface WebSearchResponse {
  readonly results: WebSearchResult[];
  readonly query: string;
  readonly totalResults: number;
}

export interface WebSearchService {
  search(query: string, maxResults?: number): Promise<Result<WebSearchResponse>>;
}
