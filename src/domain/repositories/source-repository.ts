import type { SourceReference, SourceType } from '../entities/source-reference.ts';
import type { Result } from '../entities/result.ts';

export interface VectorSearchResult {
  readonly id: string;
  readonly sourcePath: string;
  readonly content: string;
  readonly distance: number;
}

export interface ImportLogEntry {
  readonly sourcePath: string;
  readonly checksum: string;
  readonly importedAt: Date;
}

export interface SourceRepository {
  saveSources(sources: SourceReference[]): Promise<Result<void>>;
  getSourcesByType(type: SourceType): Promise<Result<SourceReference[]>>;
  getSourceCountByType(type: SourceType): Promise<Result<number>>;
  searchByVector(embedding: number[], k: number): Promise<Result<VectorSearchResult[]>>;
  saveSourceEmbedding(sourceId: string, embedding: number[], model: string): Promise<Result<void>>;
  isAlreadyImported(sourcePath: string, checksum: string): Promise<Result<boolean>>;
  logImport(sourcePath: string, checksum: string, type: SourceType): Promise<Result<void>>;
}

