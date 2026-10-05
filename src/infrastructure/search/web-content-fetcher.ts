import type { Result } from '../../domain/entities/result.ts';
import type { WebContentFetcher, FetchedPage } from '../../domain/repositories/web-content-fetcher.ts';
import { logger } from '../logging/logger.ts';

const MAX_CONTENT_LENGTH = 50_000;
const DEFAULT_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 15_000;

function extractText(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.slice(0, MAX_CONTENT_LENGTH);
  }

  return text;
}

async function fetchSinglePage(url: string): Promise<Result<FetchedPage>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Thoth/1.0 Research Bot' },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} for ${url}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: false, error: `Skipping non-text content type: ${contentType}` };
    }

    const html = await response.text();
    const text = extractText(html);

    return {
      ok: true,
      value: { url, title: url, content: text, length: text.length },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: `Timed out fetching ${url}` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Failed to fetch ${url}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export class NodeWebContentFetcher implements WebContentFetcher {
  async fetchPage(url: string): Promise<Result<FetchedPage>> {
    return fetchSinglePage(url);
  }

  async fetchPages(urls: string[], concurrency = DEFAULT_CONCURRENCY): Promise<Result<FetchedPage[]>> {
    const results: FetchedPage[] = [];
    const errors: string[] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      logger.debug({ batch: i / concurrency + 1, urls: batch.length }, 'Fetching page batch');

      const batchResults = await Promise.all(batch.map((url) => fetchSinglePage(url)));

      for (const result of batchResults) {
        if (result.ok) {
          results.push(result.value);
        } else {
          errors.push(result.error);
        }
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return { ok: false, error: `Failed to fetch any pages: ${errors.slice(0, 3).join('; ')}` };
    }

    logger.info({ fetched: results.length, errors: errors.length }, 'Page fetching complete');
    return { ok: true, value: results };
  }
}
