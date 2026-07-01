import { describe, it, expect, beforeEach } from 'vitest';

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { SeriesUseCase } from '../../src/application/use-cases/series.usecase.ts';
import { SqliteSeriesRepository } from '../../src/infrastructure/persistence/repositories/sqlite-series-repository.ts';
import { logger } from '../../src/infrastructure/logging/logger.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);

  const migrations = [
    '001_initial.sql',
    '003_articles.sql',
    '004_series.sql',
  ];

  for (const m of migrations) {
    const sql = readFileSync(
      join(import.meta.dirname, `../../src/infrastructure/persistence/migrations/${m.replace('.sql', '.ts')}`),
      'utf-8',
    );
    const exportMatch = sql.match(/`([^`]+)`/);
    if (exportMatch) db.exec(exportMatch[1]);
  }

  return db;
}

describe('SeriesUseCase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a series', async () => {
    const repo = new SqliteSeriesRepository(db);
    const useCase = new SeriesUseCase(repo, logger);

    const result = await useCase.create('Clean Architecture Series', 'A deep dive into architectural patterns');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Clean Architecture Series');
    expect(result.value.description).toBe('A deep dive into architectural patterns');
    expect(result.value.articleIds).toEqual([]);
  });

  it('lists created series', async () => {
    const repo = new SqliteSeriesRepository(db);
    const useCase = new SeriesUseCase(repo, logger);

    await useCase.create('Series One');
    await useCase.create('Series Two');

    const result = await useCase.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBe(2);
  });

  it('adds an article to a series', async () => {
    const repo = new SqliteSeriesRepository(db);
    const useCase = new SeriesUseCase(repo, logger);

    db.prepare(
      `INSERT INTO articles (id, title, content, voice_profile_id, word_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('article-1', 'Test Article', 'Content here.', 'vp-1', 10, 'draft', new Date().toISOString(), new Date().toISOString());

    const seriesResult = await useCase.create('Test Series');
    expect(seriesResult.ok).toBe(true);
    if (!seriesResult.ok) return;

    const addResult = await useCase.addArticle(seriesResult.value.id, 'article-1');
    expect(addResult.ok).toBe(true);

    const getResult = await useCase.get(seriesResult.value.id);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value!.articleIds).toContain('article-1');
  });

  it('returns error when adding to non-existent series', async () => {
    const repo = new SqliteSeriesRepository(db);
    const useCase = new SeriesUseCase(repo, logger);

    const result = await useCase.addArticle('nonexistent', 'article-1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not found');
  });

  it('shows series with article count in list', async () => {
    const repo = new SqliteSeriesRepository(db);
    const useCase = new SeriesUseCase(repo, logger);

    db.prepare(
      `INSERT INTO articles (id, title, content, voice_profile_id, word_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('article-a', 'Article A', 'Content.', 'vp-1', 5, 'draft', new Date().toISOString(), new Date().toISOString());

    const seriesResult = await useCase.create('My Series');
    expect(seriesResult.ok).toBe(true);
    if (!seriesResult.ok) return;

    await useCase.addArticle(seriesResult.value.id, 'article-a');

    const listResult = await useCase.list();
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.value[0].articleIds.length).toBe(1);
    expect(listResult.value[0].articleIds[0]).toBe('article-a');
  });
});
