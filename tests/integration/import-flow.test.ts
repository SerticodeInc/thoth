import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/infrastructure/ai/ai.service.ts', () => ({
  OpenAiAiService: vi.fn().mockImplementation(() => ({
    generateEmbedding: vi.fn().mockResolvedValue({ ok: true, value: new Array(1536).fill(0.1) }),
    chat: vi.fn().mockImplementation(async (_params: { systemPrompt: string }) => {
      return { ok: true, value: JSON.stringify({
        traits: {
          tone: ['conversational'],
          pacing: ['varied'],
          storytelling: ['anecdotal'],
          vocabulary: ['technical'],
          sentenceStructure: ['declarative'],
          transitions: ['logical'],
          humor: [],
          readerEngagement: ['questions'],
        },
        summary: 'Test voice summary',
        domains: ['Mobile Development', 'Flutter'],
        topics: ['State Management', 'Riverpod', 'Clean Architecture'],
        themes: ['Offline First', 'State Management'],
      }) };
    }),
  })),
}));

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { ImportSourcesUseCase } from '../../src/application/use-cases/import-sources.usecase.ts';
import { GenerateProfilesUseCase } from '../../src/application/use-cases/generate-profiles.usecase.ts';
import { SqliteProfileRepository } from '../../src/infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteSourceRepository } from '../../src/infrastructure/persistence/repositories/sqlite-source-repository.ts';
import { FileSourceAdapter } from '../../src/infrastructure/adapters/file-source.adapter.ts';
import { OpenAiAiService } from '../../src/infrastructure/ai/ai.service.ts';
import { logger } from '../../src/infrastructure/logging/logger.ts';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);

  const migration = readFileSync(
    join(import.meta.dirname, '../../src/infrastructure/persistence/migrations/001_initial.sql'),
    'utf-8',
  );
  db.exec(migration);

  return db;
}

function createTestFile(content: string): string {
  const dir = join(tmpdir(), 'thoth-test', randomUUID());
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'test.md');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('ImportSourcesUseCase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('imports a file and stores chunks', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const useCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const filePath = createTestFile('# My Journal\n\nTest content here.');

    const count = await useCase.execute(filePath, 'voice');

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('assigns correct source type', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const useCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const filePath = createTestFile('# Tech Notes\n\nFlutter architecture notes.');

    await useCase.execute(filePath, 'knowledge');

    const sources = sourceRepo.getSourcesByType('knowledge');
    expect(sources.ok).toBe(true);
    if (!sources.ok) return;
    expect(sources.value[0].type).toBe('knowledge');
  });

  it('checks file size limit skips large files', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const useCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const largeContent = 'x'.repeat(11 * 1024 * 1024);
    const filePath = createTestFile(largeContent);

    const count = await useCase.execute(filePath, 'voice');

    expect(count).toBe(0);
  });

  it('generates embeddings for imported sources', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const useCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const filePath = createTestFile('# Test\n\nSome content for embedding.');

    await useCase.execute(filePath, 'voice');
    await useCase.generateEmbeddingsForType('voice');

    const embRows = db.prepare('SELECT COUNT(*) as count FROM source_embeddings').get() as { count: number };
    expect(embRows.count).toBeGreaterThanOrEqual(1);
  });
});

describe('GenerateProfilesUseCase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('generates a voice profile from imported sources', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const importUseCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const genUseCase = new GenerateProfilesUseCase(ai, new SqliteProfileRepository(db), sourceRepo, logger);

    const filePath = createTestFile('# My Writing\n\nI believe in clean architecture.');
    await importUseCase.execute(filePath, 'voice');

    const result = await genUseCase.generateVoiceProfile();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBeTruthy();
    expect(result.value.traits).toBeDefined();
    expect(result.value.summary).toBeTruthy();
  });

  it('returns error when no voice sources exist', async () => {
    const ai = new OpenAiAiService();
    const genUseCase = new GenerateProfilesUseCase(ai, new SqliteProfileRepository(db), new SqliteSourceRepository(db), logger);

    const result = await genUseCase.generateVoiceProfile();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No voice sources imported');
  });

  it('generates a knowledge profile', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const importUseCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const genUseCase = new GenerateProfilesUseCase(ai, new SqliteProfileRepository(db), sourceRepo, logger);

    const filePath = createTestFile('# Architecture\n\nFlutter uses a widget tree. Riverpod providers are scoped.');
    await importUseCase.execute(filePath, 'knowledge');

    const result = await genUseCase.generateKnowledgeProfile();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBeTruthy();
    expect(result.value.domains).toBeDefined();
  });

  it('stores profile embedding in vec_profiles', async () => {
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const importUseCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);
    const genUseCase = new GenerateProfilesUseCase(ai, new SqliteProfileRepository(db), sourceRepo, logger);

    const filePath = createTestFile('# Journal\n\nPersonal reflections on coding.');
    await importUseCase.execute(filePath, 'voice');
    await genUseCase.generateVoiceProfile();

    const vecRow = db.prepare('SELECT COUNT(*) as count FROM vec_profiles').get() as { count: number };
    expect(vecRow.count).toBeGreaterThanOrEqual(1);

    const embRow = db.prepare('SELECT COUNT(*) as count FROM profile_embeddings').get() as { count: number };
    expect(embRow.count).toBeGreaterThanOrEqual(1);
  });
});
