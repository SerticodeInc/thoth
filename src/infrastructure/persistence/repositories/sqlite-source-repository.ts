import type Database from 'better-sqlite3';
import type { SourceRepository, VectorSearchResult } from '../../../domain/repositories/source-repository.ts';
import type { SourceReference, SourceType } from '../../../domain/entities/source-reference.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { saveSources, getSourcesByType, getSourceCountByType } from './source-repository.ts';

export class SqliteSourceRepository implements SourceRepository {
  constructor(private readonly db: Database.Database) {}

  saveSources(sources: SourceReference[]): Result<void> {
    saveSources(this.db, sources);
    return { ok: true, value: undefined };
  }

  getSourcesByType(type: SourceType): Result<SourceReference[]> {
    return getSourcesByType(this.db, type);
  }

  getSourceCountByType(type: SourceType): Result<number> {
    return { ok: true, value: getSourceCountByType(this.db, type) };
  }

  searchByVector(embedding: number[], k: number): Result<VectorSearchResult[]> {
    const rows = this.db
      .prepare(
        `SELECT v.rowid, s.id, s.source_path, s.content, v.distance
         FROM vec_sources v
         JOIN sources s ON v.rowid = s.rowid
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`,
      )
      .all(new Float32Array(embedding), k) as Array<{
      rowid: number;
      id: string;
      source_path: string;
      content: string;
      distance: number;
    }>;

    const results: VectorSearchResult[] = rows.map((r) => ({
      id: r.id,
      sourcePath: r.source_path,
      content: r.content,
      distance: r.distance,
    }));

    return { ok: true, value: results };
  }

  saveSourceEmbedding(sourceId: string, embedding: number[], model: string): Result<void> {
    const insertVec = this.db.prepare('INSERT INTO vec_sources (embedding) VALUES (?)');
    const insertEmb = this.db.prepare(
      'INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)',
    );

    const doInsert = this.db.transaction(() => {
      insertVec.run(new Float32Array(embedding));
      insertEmb.run(sourceId, model);
    });

    doInsert();
    return { ok: true, value: undefined };
  }
}
