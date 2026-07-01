import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/infrastructure/ai/ai.service.ts', () => ({
  OpenAiAiService: vi.fn().mockImplementation(() => ({
    getActiveEmbeddingModel: vi.fn().mockReturnValue('text-embedding-3-small'),
    generateEmbedding: vi.fn().mockResolvedValue({ ok: true, value: new Array(1536).fill(0.1) }),
    chat: vi.fn().mockResolvedValue({
      ok: true,
      value: JSON.stringify({
        content: 'Research findings about Flutter state management.',
        citations: [
          {
            sourceId: 'test-source-1',
            sourcePath: '/test/path.md',
            excerpt: 'State management is critical in Flutter.',
            relevanceScore: 0.95,
          },
        ],
      }),
    }),
  })),
}));

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { ResearchUseCase } from '../../src/application/use-cases/research.usecase.ts';
import { SqliteResearchRepository } from '../../src/infrastructure/persistence/repositories/sqlite-research-repository.ts';
import { SqliteSourceRepository } from '../../src/infrastructure/persistence/repositories/sqlite-source-repository.ts';
import { OpenAiAiService } from '../../src/infrastructure/ai/ai.service.ts';
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

  it('returns error when no sources exist', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, logger);

    const result = await useCase.execute('Flutter state management');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('No relevant sources found');
  });

  it('stores research note with citations', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, logger);

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
    expect(result.value.citations.length).toBeGreaterThanOrEqual(1);
    expect(result.value.citations[0].sourceId).toBe('test-source-1');

    const stored = await repo.get(result.value.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value).not.toBeNull();
    expect(stored.value!.topic).toBe('Flutter state management');
  });

  it('stores research embedding in vec_research', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, logger);

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

    const vecRow = db.prepare('SELECT COUNT(*) as count FROM vec_research_openai').get() as { count: number };
    expect(vecRow.count).toBeGreaterThanOrEqual(1);
  });

  it('searches research notes by topic', async () => {
    const ai = new OpenAiAiService();
    const repo = new SqliteResearchRepository(db);
    const sourceRepo = new SqliteSourceRepository(db);
    const useCase = new ResearchUseCase(ai, repo, sourceRepo, logger);

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
