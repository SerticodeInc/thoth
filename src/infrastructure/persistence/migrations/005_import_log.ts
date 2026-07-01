export const MIGRATION_005 = `-- Import checkpoint log for resume/dedup

CREATE TABLE IF NOT EXISTS import_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  type TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_import_log_path ON import_log(source_path);
CREATE INDEX IF NOT EXISTS idx_import_log_checksum ON import_log(checksum);
`;
