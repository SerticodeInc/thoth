import type Database from 'better-sqlite3';
import type { Article } from '../../../domain/entities/article.ts';
import type { ArticleRepository } from '../../../domain/repositories/article-repository.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { z } from 'zod';

const articleRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  voice_profile_id: z.string(),
  research_id: z.string().nullable(),
  word_count: z.number(),
  status: z.enum(['draft', 'published', 'archived']),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  voiceProfileId: row.voice_profile_id,
  researchId: row.research_id,
  wordCount: row.word_count,
  status: row.status,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
}));

export class SqliteArticleRepository implements ArticleRepository {
  constructor(private readonly db: Database.Database) {}

  save(article: Article): Promise<Result<Article>> {
    this.db
      .prepare(
        `INSERT INTO articles (id, title, content, voice_profile_id, research_id, word_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           word_count = excluded.word_count,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .run(
        article.id,
        article.title,
        article.content,
        article.voiceProfileId,
        article.researchId,
        article.wordCount,
        article.status,
        article.createdAt.toISOString(),
        article.updatedAt.toISOString(),
      );
    return Promise.resolve({ ok: true, value: article });
  }

  get(id: string): Promise<Result<Article | null>> {
    const row = this.db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve({ ok: true, value: null });

    const parsed = articleRowSchema.safeParse(row);
    if (!parsed.success) return Promise.resolve({ ok: false, error: `Invalid article row: ${parsed.error.message}` });
    return Promise.resolve({ ok: true, value: parsed.data });
  }

  list(): Promise<Result<Article[]>> {
    const rows = this.db
      .prepare('SELECT * FROM articles ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;

    const articles: Article[] = [];
    for (const row of rows) {
      const parsed = articleRowSchema.safeParse(row);
      if (!parsed.success) continue;
      articles.push(parsed.data);
    }
    return Promise.resolve({ ok: true, value: articles });
  }
}
