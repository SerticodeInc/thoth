import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, chmodSync } from 'node:fs';
import { logger } from '../logging/logger.ts';
import { sanitizePath } from '../logging/path-utils.ts';
import { MIGRATION_001 } from './migrations/001_initial.ts';
import { MIGRATION_002 } from './migrations/002_research.ts';
import { MIGRATION_003 } from './migrations/003_articles.ts';
import { MIGRATION_004 } from './migrations/004_series.ts';
import { MIGRATION_005 } from './migrations/005_import_log.ts';

let db: Database.Database | null = null;
let cachedDbPath: string | null = null;

export function setDbPath(path: string) {
  cachedDbPath = path;
}

function resolveDbPath(): string {
  if (cachedDbPath) return cachedDbPath;
  return process.env.THOTH_DB_PATH ?? join(homedir(), '.thoth', 'thoth.db');
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  const dbDir = dirname(dbPath);
  mkdirSync(dbDir, { recursive: true });

  logger.info({ path: sanitizePath(dbPath) }, 'Opening database');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    chmodSync(dbPath, 0o600);
  } catch {
    logger.warn({ path: sanitizePath(dbPath) }, 'Could not set database file permissions');
  }

  sqliteVec.load(db);

  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );

  const migrations: Array<{ name: string; sql: string }> = [
    { name: '001_initial.sql', sql: MIGRATION_001 },
    { name: '002_research.sql', sql: MIGRATION_002 },
    { name: '003_articles.sql', sql: MIGRATION_003 },
    { name: '004_series.sql', sql: MIGRATION_004 },
    { name: '005_import_log.sql', sql: MIGRATION_005 },
  ];

  for (const migration of migrations) {
    const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(migration.name);
    if (applied) continue;

    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    });

    applyMigration();

    logger.info({ migration: migration.name }, 'Applied migration');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
