import type { Result } from '../../domain/entities/result.ts';
import type { WebSearchService, WebSearchResponse, WebSearchResult } from '../../domain/repositories/web-search-service.ts';
import { logger } from '../logging/logger.ts';

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  raw_content?: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
  response_time?: number;
}

export class TavilySearchService implements WebSearchService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.THOTH_TAVILY_API_KEY ?? '';
  }

  async search(query: string, maxResults = 20): Promise<Result<WebSearchResponse>> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: 'No Tavily API key configured. Set THOTH_TAVILY_API_KEY environment variable.',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      logger.info({ query, maxResults }, 'Searching Tavily');

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults,
          search_depth: 'advanced',
          include_raw_content: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { ok: false, error: `Tavily API error ${response.status}: ${errorText.slice(0, 200)}` };
      }

      const data = (await response.json()) as TavilyResponse;

      const results: WebSearchResult[] = (data.results ?? []).map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.content,
        rawContent: r.raw_content,
      }));

      logger.info({ query, resultCount: results.length }, 'Tavily search complete');

      return {
        ok: true,
        value: { results, query: data.query, totalResults: results.length },
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, error: 'Tavily search timed out after 30 seconds' };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Tavily search failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
