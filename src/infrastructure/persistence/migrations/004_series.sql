-- 004_series.sql
-- Series and series-article relationships

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS series_articles (
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (series_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_series_articles_series ON series_articles(series_id);
CREATE INDEX IF NOT EXISTS idx_series_articles_article ON series_articles(article_id);
