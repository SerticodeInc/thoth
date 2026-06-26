export const MIGRATION_002 = `-- Research notes and vector index

CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  citations TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_notes_topic ON research_notes(topic);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_research USING vec0(
  embedding float[1536]
);

CREATE TABLE IF NOT EXISTS research_embeddings (
  id INTEGER PRIMARY KEY,
  research_id TEXT NOT NULL REFERENCES research_notes(id),
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
