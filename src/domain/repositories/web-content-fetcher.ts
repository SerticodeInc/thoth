import type { Result } from '../entities/result.ts';

export interface FetchedPage {
  readonly url: string;
  readonly title: string;
  readonly content: string;
  readonly length: number;
}

export interface WebContentFetcher {
  fetchPage(url: string): Promise<Result<FetchedPage>>;
  fetchPages(urls: string[], concurrency?: number): Promise<Result<FetchedPage[]>>;
}
