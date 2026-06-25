import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { mkdirSync, chmodSync } from 'fs';
import { logger } from '../logging/logger.ts';
import { sanitizePath } from '../logging/path-utils.ts';
import { MIGRATION_001 } from './migrations/001_initial.ts';

const DB_PATH = process.env.THOTH_DB_PATH ?? join(homedir(), '.thoth', 'thoth.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbDir = dirname(DB_PATH);
  mkdirSync(dbDir, { recursive: true });

  logger.info({ path: sanitizePath(DB_PATH) }, 'Opening database');

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    chmodSync(DB_PATH, 0o600);
  } catch {
    logger.warn({ path: sanitizePath(DB_PATH) }, 'Could not set database file permissions');
  }

  sqliteVec.load(db);

  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );

  const migrations: Array<{ name: string; sql: string }> = [{ name: '001_initial.sql', sql: MIGRATION_001 }];

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
