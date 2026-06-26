import { marked } from 'marked';
import type { SeriesRepository } from '../../domain/repositories/series-repository.ts';
import type { ArticleRepository } from '../../domain/repositories/article-repository.ts';
import type { Series } from '../../domain/entities/series.ts';
import type { Article } from '../../domain/entities/article.ts';
import type { Result } from '../../domain/entities/result.ts';
import { formatArticleAsMarkdown, stripMarkdown } from './export-article.usecase.ts';

export type SeriesExportFormat = 'md' | 'html' | 'rss';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRssFeed(series: Series, articles: Article[]): string {
  const now = new Date().toUTCString();
  const items = articles
    .map(
      (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <guid isPermaLink="false">${escapeXml(a.id)}</guid>
      <pubDate>${a.createdAt.toUTCString()}</pubDate>
      <description>${escapeXml(stripMarkdown(a.content).slice(0, 500))}</description>
      <content:encoded><![CDATA[${a.content}]]></content:encoded>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(series.name)}</title>
    ${series.description ? `<description>${escapeXml(series.description)}</description>` : ''}
    <link>https://thoth.sh</link>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://thoth.sh/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function generateSeriesMarkdown(series: Series, articles: Article[]): string {
  const date = series.createdAt.toISOString().split('T')[0];
  const parts: string[] = [
    '---',
    `title: "${series.name}"`,
    `date: ${date}`,
    `articles: ${articles.length}`,
    `id: ${series.id}`,
    '---',
    '',
    series.description ? `${series.description}\n` : '',
  ];

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    parts.push(`## ${i + 1}. ${a.title}`);
    parts.push('');
    parts.push(formatArticleAsMarkdown(a));
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  return parts.join('\n');
}

function generateSeriesHtml(series: Series, articles: Article[]): string {
  const date = series.createdAt.toISOString().split('T')[0];
  const articleHtml = articles
    .map((a, i) => {
      const body = marked.parse(a.content) as string;
      return `<article>
  <h2>${escapeXml(`${i + 1}. ${a.title}`)}</h2>
  <div>${body}</div>
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeXml(series.name)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; line-height: 1.8; color: #1d1d1f; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 2rem; margin-bottom: .25rem; }
  .meta { color: #6e6e73; font-size: .875rem; margin-bottom: 2rem; }
  .toc { background: #f5f5f7; padding: 1.25rem 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
  .toc h2 { font-size: 1rem; margin-bottom: .5rem; }
  .toc ol { padding-left: 1.25rem; }
  .toc li { margin-bottom: .25rem; }
  .toc a { color: #0066cc; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  article { margin-bottom: 3rem; padding-top: 1rem; border-top: 1px solid #d2d2d7; }
  article h2 { font-size: 1.5rem; margin-bottom: 1rem; }
  article p { margin-bottom: 1.25rem; }
  article a { color: #0066cc; }
  article code { background: #f5f5f7; padding: .15em .4em; border-radius: 3px; font-size: .9em; }
  article pre { background: #f5f5f7; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1.25rem; }
  article pre code { background: none; padding: 0; }
  article blockquote { border-left: 3px solid #d2d2d7; padding-left: 1rem; color: #6e6e73; margin-bottom: 1.25rem; }
  article ul, article ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
  article img { max-width: 100%; height: auto; border-radius: 8px; }
  footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #d2d2d7; font-size: .8125rem; color: #6e6e73; }
</style>
</head>
<body>
<header>
  <h1>${escapeXml(series.name)}</h1>
  ${series.description ? `<p class="meta">${escapeXml(series.description)}</p>` : ''}
  <p class="meta">${articles.length} articles &middot; ${date}</p>
</header>
<nav class="toc">
  <h2>Table of Contents</h2>
  <ol>
    ${articles.map((a, i) => `<li><a href="#article-${i + 1}">${escapeXml(a.title)}</a></li>`).join('\n    ')}
  </ol>
</nav>
<main>
${articleHtml}
</main>
<footer>Generated by Thoth</footer>
</body>
</html>`;
}

export interface ExportSeriesInput {
  readonly seriesId: string;
  readonly format: SeriesExportFormat;
}

export interface ExportSeriesOutput {
  readonly content: string;
  readonly filename: string;
}

export class ExportSeriesUseCase {
  constructor(
    private readonly seriesRepo: SeriesRepository,
    private readonly articleRepo: ArticleRepository,
  ) {}

  async execute(input: ExportSeriesInput): Promise<Result<ExportSeriesOutput>> {
    const seriesResult = await this.seriesRepo.get(input.seriesId);
    if (!seriesResult.ok) return seriesResult;
    if (!seriesResult.value) return { ok: false, error: `Series not found: ${input.seriesId}` };

    const series = seriesResult.value;
    const articles: Article[] = [];

    for (const articleId of series.articleIds) {
      const articleResult = await this.articleRepo.get(articleId);
      if (articleResult.ok && articleResult.value) {
        articles.push(articleResult.value);
      }
    }

    const slug = series.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'series';
    let content: string;
    let ext: string;

    switch (input.format) {
      case 'md':
        content = generateSeriesMarkdown(series, articles);
        ext = 'md';
        break;
      case 'html':
        content = generateSeriesHtml(series, articles);
        ext = 'html';
        break;
      case 'rss':
        content = generateRssFeed(series, articles);
        ext = 'xml';
        break;
    }

    return {
      ok: true,
      value: { content, filename: `${slug}.${ext}` },
    };
  }
}
