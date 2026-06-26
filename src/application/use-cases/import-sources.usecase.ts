import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { SourceType } from '../../domain/entities/source-reference.ts';
import type { SourceRepository } from '../../domain/repositories/source-repository.ts';
import type { FileSourcePort } from '../ports/file-source.ts';
import type { LoggerPort } from '../ports/logger.ts';

export type ProgressCallback = (current: number, total: number, message: string) => void;

const DEFAULT_CONCURRENCY = 5;

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

    const newSources = sources.filter(
      (s) => !this.sourceRepo.isAlreadyImported(s.sourcePath, s.checksum).ok !== true,
    );

    const skipped = sources.length - newSources.length;
    if (skipped > 0) {
      this.logger.info({ skipped }, 'Skipped previously imported chunks');
    }

    if (newSources.length === 0) {
      this.logger.info({ type }, 'All sources already imported');
      return 0;
    }

    const saveResult = this.sourceRepo.saveSources(newSources);
    if (!saveResult.ok) {
      this.logger.error({ error: saveResult.error }, 'Failed to save sources');
      return 0;
    }

    const seen = new Set<string>();
    for (const s of newSources) {
      const key = `${s.sourcePath}:${s.checksum}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.sourceRepo.logImport(s.sourcePath, s.checksum, type);
    }

    this.logger.info({ type, count: newSources.length, skipped }, 'Import complete');

    return newSources.length;
  }

  async generateEmbeddingsForType(
    type: SourceType,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const sourcesResult = this.sourceRepo.getSourcesByType(type);
    if (!sourcesResult.ok) {
      this.logger.error({ error: sourcesResult.error }, 'Failed to load sources for embedding');
      return;
    }

    const sources = sourcesResult.value;
    const total = sources.length;

    if (total === 0) {
      onProgress?.(0, 0, 'No sources to embed');
      return;
    }

    let completed = 0;

    const processChunk = async (chunk: typeof sources) => {
      const results = await Promise.allSettled(
        chunk.map((source) => this.ai.generateEmbedding(source.content)),
      );

      for (let j = 0; j < chunk.length; j++) {
        const result = results[j];
        if (result.status === 'rejected') {
          this.logger.warn({ sourceId: chunk[j].id }, 'Embedding rejected');
          completed++;
          continue;
        }

        if (!result.value.ok) {
          this.logger.warn({ sourceId: chunk[j].id, error: result.value.error }, 'Embedding failed');
          completed++;
          continue;
        }

        const storeResult = this.sourceRepo.saveSourceEmbedding(
          chunk[j].id,
          result.value.value,
          'text-embedding-3-small',
        );
        if (!storeResult.ok) {
          this.logger.warn({ sourceId: chunk[j].id, error: storeResult.error }, 'Failed to store embedding');
        }
        completed++;
      }
    };

    onProgress?.(0, total, 'Generating embeddings...');

    for (let i = 0; i < sources.length; i += DEFAULT_CONCURRENCY) {
      const chunk = sources.slice(i, i + DEFAULT_CONCURRENCY);
      await processChunk(chunk);
      onProgress?.(completed, total, `Embedded ${completed}/${total}`);
    }

    this.logger.info({ type, total: sources.length }, 'Embeddings complete');
  }

  getImportStatus(type: SourceType): number {
    const count = this.sourceRepo.getSourceCountByType(type);
    return count.ok ? count.value : 0;
  }
}
