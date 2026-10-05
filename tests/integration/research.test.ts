import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/infrastructure/ai/ai.service.ts', () => ({
  OpenAiAiService: vi.fn().mockImplementation(() => ({
    getActiveEmbeddingModel: vi.fn().mockReturnValue('text-embedding-3-small'),
    generateEmbedding: vi.fn().mockResolvedValue({ ok: true, value: new Array(1536).fill(0.1) }),
    chat: vi.fn().mockResolvedValue({
      ok: true,
      value: '# Research Findings\n\nCompiled data about Flutter state management.\n\n## Sources\n\n- Source 1: test data',
    }),
  })),
}));

vi.mock('../../src/infrastructure/search/tavily-search.service.ts', () => ({
  TavilySearchService: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        results: [],
        query: 'test query',
        totalResults: 0,
      },
    }),
  })),
}));

vi.mock('../../src/infrastructure/search/web-content-fetcher.ts', () => ({
  NodeWebContentFetcher: vi.fn().mockImplementation(() => ({
    fetchPage: vi.fn(),
    fetchPages: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  })),
}));

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { ResearchUseCase } from '../../src/application/use-cases/research.usecase.ts';
import { SqliteResearchRepository } from '../../src/infrastructure/persistence/repositories/sqlite-research-repository.ts';
import { SqliteSourceRepository } from '../../src/infrastructure/persistence/repositories/sqlite-source-repository.ts';
import { OpenAiAiService } from '../../src/infrastructure/ai/ai.service.ts';
import { TavilySearchService } from '../../src/infrastructure/search/tavily-search.service.ts';
import { NodeWebContentFetcher } from '../../src/infrastructure/search/web-content-fetcher.ts';
import { logger } from '../../src/infrastructure/logging/logger.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);

  const migrations = [
    '001_initial.sql',
    '002_research.sql',
    '006_vectors_per_provider.sql',
    '007_research_metadata.sql',
  ];

  for (const m of migrations) {
    const sql = readFileSync(
      join(import.meta.dirname, `../../src/infrastructure/persistence/migrations/${m}`),
      'utf-8',
    );
    db.exec(sql);
  }

  return db;
}

describe('ResearchUseCase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('stores research note with compiled content', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const webSearch = new TavilySearchService();
    const webFetcher = new NodeWebContentFetcher();
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, webSearch, webFetcher, logger);

    db.prepare(
      `INSERT INTO vec_sources_openai (embedding) VALUES (?)`,
    ).run(new Float32Array(new Array(1536).fill(0.1)));

    db.prepare(
      `INSERT INTO sources (id, type, source_path, content, checksum, chunk_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('test-source-1', 'knowledge', '/test/path.md', 'State management is critical in Flutter for building scalable apps.', 'abc', 0, new Date().toISOString());

    db.prepare(
      `INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)`,
    ).run('test-source-1', 'text-embedding-3-small');

    const result = await useCase.execute('Flutter state management');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.topic).toBe('Flutter state management');
    expect(result.value.content).toBeTruthy();
    expect(result.value.sourceCount).toBeGreaterThanOrEqual(1);
    expect(result.value.searchQueries).toBeDefined();

    const stored = await repo.get(result.value.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value).not.toBeNull();
    expect(stored.value!.topic).toBe('Flutter state management');
  });

  it('returns error when no sources exist anywhere', async () => {
    // Override the default chat mock for this test to return an error
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const webSearch = new TavilySearchService();
    const webFetcher = new NodeWebContentFetcher();
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, webSearch, webFetcher, logger);

    // No sources in DB, web search returns empty
    const result = await useCase.execute('No sources anywhere');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('No sources found');
  });

  it('stores research embedding in vec_research', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const webSearch = new TavilySearchService();
    const webFetcher = new NodeWebContentFetcher();
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, webSearch, webFetcher, logger);

    db.prepare(
      `INSERT INTO vec_sources_openai (embedding) VALUES (?)`,
    ).run(new Float32Array(new Array(1536).fill(0.1)));

    db.prepare(
      `INSERT INTO sources (id, type, source_path, content, checksum, chunk_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('test-source-2', 'knowledge', '/test/path.md', 'Flutter state management with Riverpod.', 'def', 0, new Date().toISOString());

    db.prepare(
      `INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)`,
    ).run('test-source-2', 'text-embedding-3-small');

    const result = await useCase.execute('Flutter state management');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const embRow = db.prepare('SELECT COUNT(*) as count FROM research_embeddings').get() as { count: number };
    expect(embRow.count).toBeGreaterThanOrEqual(1);
  });

  it('searches research notes by topic', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const webSearch = new TavilySearchService();
    const webFetcher = new NodeWebContentFetcher();
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, webSearch, webFetcher, logger);

    db.prepare(
      `INSERT INTO vec_sources_openai (embedding) VALUES (?)`,
    ).run(new Float32Array(new Array(1536).fill(0.1)));

    db.prepare(
      `INSERT INTO sources (id, type, source_path, content, checksum, chunk_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('test-source-3', 'knowledge', '/test/path.md', 'Riverpod providers are scoped.', 'ghi', 0, new Date().toISOString());

    db.prepare(
      `INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)`,
    ).run('test-source-3', 'text-embedding-3-small');

    await useCase.execute('Riverpod providers');

    const searchResult = await repo.searchByTopic('Riverpod');
    expect(searchResult.ok).toBe(true);
    if (!searchResult.ok) return;
    expect(searchResult.value.length).toBeGreaterThanOrEqual(1);
    expect(searchResult.value[0].topic).toBe('Riverpod providers');
  });
});
