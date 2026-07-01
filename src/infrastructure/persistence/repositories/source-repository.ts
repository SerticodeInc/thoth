import type Database from 'better-sqlite3';
import type { SourceReference } from '../../../domain/entities/source-reference.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { sourceReferenceSchema } from './source-schemas.ts';

export function saveSources(db: Database.Database, sources: SourceReference[]): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO sources (id, type, source_path, content, checksum, chunk_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((items: SourceReference[]) => {
    for (const s of items) {
      insert.run(
        s.id,
        s.type,
        s.sourcePath,
        s.content,
        s.checksum,
        s.chunkIndex,
        s.createdAt.toISOString(),
      );
    }
  });

  insertMany(sources);
}

export function getSourcesByType(db: Database.Database, type: string): Result<SourceReference[]> {
  const rows = db
    .prepare('SELECT * FROM sources WHERE type = ? ORDER BY created_at')
    .all(type) as Array<Record<string, unknown>>;

  const mapped: SourceReference[] = [];
  for (const row of rows) {
    const parsed = sourceReferenceSchema.safeParse(row);
    if (!parsed.success) {
      return { ok: false, error: `Invalid source row: ${parsed.error.message}` };
    }
    mapped.push(parsed.data);
  }

  return { ok: true, value: mapped };
}

export function getSourceCountByType(db: Database.Database, type: string): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sources WHERE type = ?').get(type) as {
    count: number;
  };
  return row.count;
}
