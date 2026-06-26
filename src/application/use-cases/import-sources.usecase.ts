import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { SourceType } from '../../domain/entities/source-reference.ts';
import type { SourceRepository } from '../../domain/repositories/source-repository.ts';
import type { FileSourcePort } from '../ports/file-source.ts';
import type { LoggerPort } from '../ports/logger.ts';

export class ImportSourcesUseCase {
  constructor(
    private readonly sourceRepo: SourceRepository,
    private readonly fileSource: FileSourcePort,
    private readonly ai: AiService,
    private readonly logger: LoggerPort,
  ) {}

  async execute(sourcePath: string, type: SourceType): Promise<number> {
    this.logger.info({ sourcePath, type }, 'Starting import');

    const sources = await this.fileSource.importFromPath(sourcePath, type);

    const saveResult = this.sourceRepo.saveSources(sources);
    if (!saveResult.ok) {
      this.logger.error({ error: saveResult.error }, 'Failed to save sources');
      return 0;
    }

    this.logger.info({ type, count: sources.length }, 'Import complete');

    return sources.length;
  }

  async generateEmbeddingsForType(type: SourceType): Promise<void> {
    const sourcesResult = this.sourceRepo.getSourcesByType(type);
    if (!sourcesResult.ok) {
      this.logger.error({ error: sourcesResult.error }, 'Failed to load sources for embedding');
      return;
    }

    const sources = sourcesResult.value;

    const batchSize = 10;
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);

      const embeddingsResults = await Promise.all(
        batch.map((source) => this.ai.generateEmbedding(source.content)),
      );

      for (let j = 0; j < batch.length; j++) {
        const result = embeddingsResults[j];
        if (!result.ok) {
          this.logger.warn({ sourceId: batch[j].id, error: result.error }, 'Embedding failed for source');
          continue;
        }

        const storeResult = this.sourceRepo.saveSourceEmbedding(
          batch[j].id,
          result.value,
          'text-embedding-3-small',
        );
        if (!storeResult.ok) {
          this.logger.warn({ sourceId: batch[j].id, error: storeResult.error }, 'Failed to store embedding');
        }
      }

      this.logger.info(
        { type, progress: `${Math.min(i + batchSize, sources.length)}/${sources.length}` },
        'Embedding progress',
      );
    }

    this.logger.info({ type, total: sources.length }, 'Embeddings complete');
  }

  getImportStatus(type: SourceType): number {
    const count = this.sourceRepo.getSourceCountByType(type);
    return count.ok ? count.value : 0;
  }
}
