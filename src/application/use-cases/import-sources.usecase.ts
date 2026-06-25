import type Database from 'better-sqlite3';
import type { SourceReference, SourceType } from '../../domain/entities/source-reference.ts';
import { generateEmbedding } from '../../infrastructure/ai/ai.service.ts';
import {
  saveSources,
  getSourcesByType,
  getSourceCountByType,
} from '../../infrastructure/persistence/repositories/source-repository.ts';
import { importFromPath } from '../../infrastructure/adapters/file-source.adapter.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { sanitizePath } from '../../infrastructure/logging/path-utils.ts';

export class ImportSourcesUseCase {
  constructor(private readonly db: Database.Database) {}

  async execute(sourcePath: string, type: SourceType): Promise<SourceReference[]> {
    logger.info({ sourcePath: sanitizePath(sourcePath), type }, 'Starting import');

    const sources = await importFromPath(sourcePath, type);

    saveSources(this.db, sources);

    logger.info({ type, count: sources.length, path: sanitizePath(sourcePath) }, 'Import complete');

    return sources;
  }

  async generateEmbeddingsForType(type: SourceType): Promise<void> {
    const sources = getSourcesByType(this.db, type);
    const insertVec = this.db.prepare(
      'INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)',
    );
    const insertEmbedding = this.db.prepare('INSERT INTO vec_sources (embedding) VALUES (?)');

    const batchSize = 10;
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);

      const embeddings = await Promise.all(
        batch.map((source) => generateEmbedding(source.content)),
      );

      const insertAll = this.db.transaction(() => {
        for (let j = 0; j < batch.length; j++) {
          insertEmbedding.run(new Float32Array(embeddings[j]));
          insertVec.run(batch[j].id, 'text-embedding-3-small');
        }
      });

      insertAll();

      logger.info(
        { type, progress: `${Math.min(i + batchSize, sources.length)}/${sources.length}` },
        'Embedding progress',
      );
    }

    logger.info({ type, total: sources.length }, 'Embeddings complete');
  }

  getImportStatus(type: SourceType): { sources: number } {
    const count = getSourceCountByType(this.db, type);
    return { sources: count };
  }
}
