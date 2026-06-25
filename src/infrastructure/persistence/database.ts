import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, readFileSync, readdirSync, chmodSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { logger } from '../logging/logger.ts';
import { sanitizePath } from '../logging/path-utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  const rows = db.prepare('SELECT name FROM _migrations').all() as Array<Record<string, unknown>>;
  const applied = new Set(rows.map((r) => r.name as string));

  const migrationsDir = resolve(__dirname, 'migrations');
  const files = readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);

    logger.info({ migration: file }, 'Applied migration');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
