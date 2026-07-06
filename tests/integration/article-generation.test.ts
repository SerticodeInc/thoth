import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/infrastructure/ai/ai.service.ts', () => ({
  OpenAiAiService: vi.fn().mockImplementation(() => ({
    getActiveEmbeddingModel: vi.fn().mockReturnValue('text-embedding-3-small'),
    generateEmbedding: vi.fn().mockResolvedValue({ ok: true, value: new Array(1536).fill(0.1) }),
    chat: vi.fn().mockResolvedValue({
      ok: true,
      value: JSON.stringify({
        title: 'Clean Architecture in Flutter',
        content: '# Clean Architecture\n\nThis is the article content about clean architecture in Flutter applications.',
      }),
    }),
  })),
}));

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { GenerateArticleUseCase } from '../../src/application/use-cases/generate-article.usecase.ts';
import { SqliteArticleRepository } from '../../src/infrastructure/persistence/repositories/sqlite-article-repository.ts';
import { SqliteProfileRepository } from '../../src/infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteResearchRepository } from '../../src/infrastructure/persistence/repositories/sqlite-research-repository.ts';
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
    '003_articles.sql',
    '004_series.sql',
    '005_import_log.sql',
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

describe('GenerateArticleUseCase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns error when no voice profile exists', async () => {
    const ai = new OpenAiAiService();
    const articleRepo = new SqliteArticleRepository(db);
    const profileRepo = new SqliteProfileRepository(db);
    const researchRepo = new SqliteResearchRepository(db);
    const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

    const result = await useCase.execute({ topic: 'Clean Architecture' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('No voice profile found');
  });

  it('generates an article from voice profile and topic', async () => {
    const ai = new OpenAiAiService();
    const articleRepo = new SqliteArticleRepository(db);
    const profileRepo = new SqliteProfileRepository(db);
    const researchRepo = new SqliteResearchRepository(db);
    const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

    db.prepare(
      `INSERT INTO voice_profiles (id, name, traits, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'test-voice-1',
      null,
      JSON.stringify({
        tone: ['conversational', 'technical'],
        pacing: ['varied'],
        storytelling: ['anecdotal'],
        vocabulary: ['precise', 'technical'],
        sentenceStructure: ['declarative'],
        transitions: ['logical'],
        humor: [],
        readerEngagement: ['examples'],
      }),
      'A technical writer focused on software architecture.',
      new Date().toISOString(),
    );

    const result = await useCase.execute({ topic: 'Clean Architecture' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Clean Architecture in Flutter');
    expect(result.value.content).toBeTruthy();
    expect(result.value.voiceProfileId).toBe('test-voice-1');
    expect(result.value.wordCount).toBeGreaterThan(0);
    expect(result.value.status).toBe('draft');
  });

  it('stores generated article in the database', async () => {
    const ai = new OpenAiAiService();
    const articleRepo = new SqliteArticleRepository(db);
    const profileRepo = new SqliteProfileRepository(db);
    const researchRepo = new SqliteResearchRepository(db);
    const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

    db.prepare(
      `INSERT INTO voice_profiles (id, name, traits, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'test-voice-2',
      null,
      JSON.stringify({
        tone: ['analytical'],
        pacing: ['deliberate'],
        storytelling: ['case-study'],
        vocabulary: ['domain-specific'],
        sentenceStructure: ['complex'],
        transitions: ['structured'],
        humor: [],
        readerEngagement: ['data'],
      }),
      null,
      new Date().toISOString(),
    );

    const result = await useCase.execute({ topic: 'Flutter state management' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await articleRepo.get(result.value.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value).not.toBeNull();
    expect(stored.value!.title).toBe('Clean Architecture in Flutter');
    expect(stored.value!.wordCount).toBeGreaterThan(0);
  });

  it('lists generated articles', async () => {
    const ai = new OpenAiAiService();
    const articleRepo = new SqliteArticleRepository(db);
    const profileRepo = new SqliteProfileRepository(db);
    const researchRepo = new SqliteResearchRepository(db);
    const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

    db.prepare(
      `INSERT INTO voice_profiles (id, name, traits, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'test-voice-3',
      null,
      JSON.stringify({
        tone: ['practical'],
        pacing: ['steady'],
        storytelling: ['tutorial'],
        vocabulary: ['accessible'],
        sentenceStructure: ['straightforward'],
        transitions: ['clear'],
        humor: ['dry'],
        readerEngagement: ['code-snippets'],
      }),
      null,
      new Date().toISOString(),
    );

    await useCase.execute({ topic: 'Riverpod' });
    await useCase.execute({ topic: 'Widget testing' });

    const listResult = await articleRepo.list();
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.value.length).toBe(2);
  });
});
