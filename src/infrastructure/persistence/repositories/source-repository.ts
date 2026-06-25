import type Database from 'better-sqlite3';
import type { SourceReference } from '../../../domain/entities/source-reference.ts';

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

export function getSourcesByType(db: Database.Database, type: string): SourceReference[] {
  const rows = db
    .prepare('SELECT * FROM sources WHERE type = ? ORDER BY created_at')
    .all(type) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as string,
    type: row.type as SourceReference['type'],
    sourcePath: row.source_path as string,
    content: row.content as string,
    checksum: row.checksum as string,
    chunkIndex: row.chunk_index as number,
    createdAt: new Date(row.created_at as string),
  }));
}

export function getSourceCountByType(db: Database.Database, type: string): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sources WHERE type = ?').get(type) as {
    count: number;
  };
  return row.count;
}
