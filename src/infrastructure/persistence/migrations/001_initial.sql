-- 001_initial.sql
-- Thoth initial schema: sources, profiles, and vector indexes

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('voice', 'knowledge', 'publication')),
  source_path TEXT NOT NULL,
  content TEXT NOT NULL,
  checksum TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_checksum ON sources(checksum);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_sources USING vec0(
  embedding float[1536]
);

CREATE TABLE IF NOT EXISTS source_embeddings (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_source_embeddings_source_id ON source_embeddings(source_id);

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  traits TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_profiles (
  id TEXT PRIMARY KEY,
  domains TEXT NOT NULL,
  topics TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publication_profiles (
  id TEXT PRIMARY KEY,
  themes TEXT NOT NULL,
  series TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_profiles USING vec0(
  embedding float[1536]
);

CREATE TABLE IF NOT EXISTS profile_embeddings (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK(profile_type IN ('voice', 'knowledge', 'publication')),
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_embeddings_profile_id ON profile_embeddings(profile_id);
