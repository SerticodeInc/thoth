import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/infrastructure/ai/ai.service.ts', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  chat: vi.fn().mockImplementation(async (params: { systemPrompt: string }) => {
    if (params.systemPrompt.includes('Voice Profile')) {
      return JSON.stringify({
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
      });
    }
    if (params.systemPrompt.includes('Knowledge Profile')) {
      return JSON.stringify({
        domains: ['Mobile Development', 'Flutter'],
        topics: ['State Management', 'Riverpod', 'Clean Architecture'],
        summary: 'Expert in Flutter architecture',
      });
    }
    if (params.systemPrompt.includes('Publication Profile')) {
      return JSON.stringify({
        themes: ['Offline First', 'State Management'],
        summary: 'Focuses on practical architecture',
      });
    }
    return JSON.stringify({});
  }),
}));

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { ImportSourcesUseCase } from '../../src/application/use-cases/import-sources.usecase.ts';
import { GenerateProfilesUseCase } from '../../src/application/use-cases/generate-profiles.usecase.ts';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

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
    const useCase = new ImportSourcesUseCase(db);
    const filePath = createTestFile('# My Journal\n\nTest content here.');

    const sources = await useCase.execute(filePath, 'voice');

    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0].type).toBe('voice');
    expect(sources[0].sourcePath).toBe(realpathSync(filePath));
  });

  it('assigns correct source type', async () => {
    const useCase = new ImportSourcesUseCase(db);
    const filePath = createTestFile('# Tech Notes\n\nFlutter architecture notes.');

    const sources = await useCase.execute(filePath, 'knowledge');

    expect(sources[0].type).toBe('knowledge');
  });

  it('checks file size limit skips large files', async () => {
    const useCase = new ImportSourcesUseCase(db);
    const largeContent = 'x'.repeat(11 * 1024 * 1024);
    const filePath = createTestFile(largeContent);

    const sources = await useCase.execute(filePath, 'voice');

    expect(sources).toHaveLength(0);
  });

  it('generates embeddings for imported sources', async () => {
    const useCase = new ImportSourcesUseCase(db);
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
    const importUseCase = new ImportSourcesUseCase(db);
    const genUseCase = new GenerateProfilesUseCase(db);

    const filePath = createTestFile('# My Writing\n\nI believe in clean architecture. It separates concerns effectively and makes testing straightforward.');
    await importUseCase.execute(filePath, 'voice');

    const profile = await genUseCase.generateVoiceProfile();

    expect(profile.id).toBeTruthy();
    expect(profile.traits).toBeDefined();
    expect(profile.summary).toBeTruthy();
  });

  it('throws when no voice sources exist', async () => {
    const genUseCase = new GenerateProfilesUseCase(db);

    await expect(genUseCase.generateVoiceProfile()).rejects.toThrow(
      'No voice sources imported',
    );
  });

  it('generates a knowledge profile', async () => {
    const importUseCase = new ImportSourcesUseCase(db);
    const genUseCase = new GenerateProfilesUseCase(db);

    const filePath = createTestFile('# Architecture\n\nFlutter uses a widget tree. Riverpod providers are scoped.');
    await importUseCase.execute(filePath, 'knowledge');

    const profile = await genUseCase.generateKnowledgeProfile();

    expect(profile.id).toBeTruthy();
    expect(profile.domains).toBeDefined();
  });

  it('stores profile embedding in vec_profiles', async () => {
    const importUseCase = new ImportSourcesUseCase(db);
    const genUseCase = new GenerateProfilesUseCase(db);

    const filePath = createTestFile('# Journal\n\nPersonal reflections on coding.');
    await importUseCase.execute(filePath, 'voice');
    await genUseCase.generateVoiceProfile();

    const vecRow = db.prepare('SELECT COUNT(*) as count FROM vec_profiles').get() as { count: number };
    expect(vecRow.count).toBeGreaterThanOrEqual(1);

    const embRow = db.prepare('SELECT COUNT(*) as count FROM profile_embeddings').get() as { count: number };
    expect(embRow.count).toBeGreaterThanOrEqual(1);
  });
});
