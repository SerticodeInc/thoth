import type Database from 'better-sqlite3';
import type { SourceRepository, VectorSearchResult } from '../../../domain/repositories/source-repository.ts';
import type { SourceReference, SourceType } from '../../../domain/entities/source-reference.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { saveSources, getSourcesByType, getSourceCountByType } from './source-repository.ts';

export class SqliteSourceRepository implements SourceRepository {
  private readonly vecTable: string;

  constructor(
    private readonly db: Database.Database,
    embeddingTableSuffix: string = 'openai',
  ) {
    this.vecTable = `vec_sources_${embeddingTableSuffix}`;
  }

  saveSources(sources: SourceReference[]): Promise<Result<void>> {
    saveSources(this.db, sources);
    return Promise.resolve({ ok: true, value: undefined });
  }

  getSourcesByType(type: SourceType): Promise<Result<SourceReference[]>> {
    return Promise.resolve(getSourcesByType(this.db, type));
  }

  getSourceCountByType(type: SourceType): Promise<Result<number>> {
    return Promise.resolve({ ok: true, value: getSourceCountByType(this.db, type) });
  }

  searchByVector(embedding: number[], k: number): Promise<Result<VectorSearchResult[]>> {
    try {
      const rows = this.db
        .prepare(
          `SELECT v.rowid, s.id, s.source_path, s.content, v.distance
           FROM ${this.vecTable} v
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

      return Promise.resolve({ ok: true, value: results });
    } catch (error) {
      return Promise.resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  isAlreadyImported(sourcePath: string, checksum: string): Promise<Result<boolean>> {
    try {
      const row = this.db
        .prepare('SELECT 1 FROM import_log WHERE source_path = ? AND checksum = ?')
        .get(sourcePath, checksum);
      return Promise.resolve({ ok: true, value: !!row });
    } catch {
      return Promise.resolve({ ok: true, value: false });
    }
  }

  logImport(sourcePath: string, checksum: string, type: SourceType): Promise<Result<void>> {
    try {
      this.db
        .prepare('INSERT OR IGNORE INTO import_log (source_path, checksum, type) VALUES (?, ?, ?)')
        .run(sourcePath, checksum, type);
      return Promise.resolve({ ok: true, value: undefined });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: `Failed to log import: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  saveSourceEmbedding(sourceId: string, embedding: number[], model: string): Promise<Result<void>> {
    try {
      const insertVec = this.db.prepare(`INSERT INTO ${this.vecTable} (embedding) VALUES (?)`);
      const insertEmb = this.db.prepare(
        'INSERT INTO source_embeddings (source_id, model) VALUES (?, ?)',
      );

      const doInsert = this.db.transaction(() => {
        insertVec.run(new Float32Array(embedding));
        insertEmb.run(sourceId, model);
      });

      doInsert();
      return Promise.resolve({ ok: true, value: undefined });
    } catch (error) {
      return Promise.resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
