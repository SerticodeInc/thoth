import type Database from 'better-sqlite3';
import type { Series } from '../../../domain/entities/series.ts';
import type { SeriesRepository } from '../../../domain/repositories/series-repository.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { z } from 'zod';

const seriesRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  articleIds: [] as string[],
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
}));

export class SqliteSeriesRepository implements SeriesRepository {
  constructor(private readonly db: Database.Database) {}

  save(series: Series): Promise<Result<Series>> {
    this.db
      .prepare(
        `INSERT INTO series (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           updated_at = excluded.updated_at`,
      )
      .run(
        series.id,
        series.name,
        series.description,
        series.createdAt.toISOString(),
        series.updatedAt.toISOString(),
      );
    return Promise.resolve({ ok: true, value: series });
  }

  get(id: string): Promise<Result<Series | null>> {
    const row = this.db.prepare('SELECT * FROM series WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve({ ok: true, value: null });

    const parsed = seriesRowSchema.safeParse(row);
    if (!parsed.success) return Promise.resolve({ ok: false, error: `Invalid series row: ${parsed.error.message}` });

    const articleRows = this.db
      .prepare('SELECT article_id FROM series_articles WHERE series_id = ? ORDER BY position')
      .all(id) as Array<{ article_id: string }>;

    return Promise.resolve({
      ok: true,
      value: { ...parsed.data, articleIds: articleRows.map((r) => r.article_id) },
    });
  }

  list(): Promise<Result<Series[]>> {
    const rows = this.db
      .prepare('SELECT * FROM series ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;

    const seriesList: Series[] = [];
    for (const row of rows) {
      const parsed = seriesRowSchema.safeParse(row);
      if (!parsed.success) continue;

      const articleRows = this.db
        .prepare('SELECT article_id FROM series_articles WHERE series_id = ? ORDER BY position')
        .all(parsed.data.id) as Array<{ article_id: string }>;

      seriesList.push({ ...parsed.data, articleIds: articleRows.map((r) => r.article_id) });
    }
    return Promise.resolve({ ok: true, value: seriesList });
  }

  addArticle(seriesId: string, articleId: string): Promise<Result<void>> {
    const maxPos = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM series_articles WHERE series_id = ?')
      .get(seriesId) as { next_pos: number };

    this.db
      .prepare(
        'INSERT OR IGNORE INTO series_articles (series_id, article_id, position) VALUES (?, ?, ?)',
      )
      .run(seriesId, articleId, maxPos.next_pos);

    this.db.prepare(
      "UPDATE series SET updated_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), seriesId);

    return Promise.resolve({ ok: true, value: undefined });
  }

  removeArticle(seriesId: string, articleId: string): Promise<Result<void>> {
    this.db
      .prepare('DELETE FROM series_articles WHERE series_id = ? AND article_id = ?')
      .run(seriesId, articleId);

    this.db.prepare(
      "UPDATE series SET updated_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), seriesId);

    return Promise.resolve({ ok: true, value: undefined });
  }
}
