import type { SourceReference, SourceType } from '../entities/source-reference.ts';
import type { Result } from '../entities/result.ts';

export interface VectorSearchResult {
  readonly id: string;
  readonly sourcePath: string;
  readonly content: string;
  readonly distance: number;
}

export interface SourceRepository {
  saveSources(sources: SourceReference[]): Result<void>;
  getSourcesByType(type: SourceType): Result<SourceReference[]>;
  getSourceCountByType(type: SourceType): Result<number>;
  searchByVector(embedding: number[], k: number): Result<VectorSearchResult[]>;
  saveSourceEmbedding(sourceId: string, embedding: number[], model: string): Result<void>;
}

