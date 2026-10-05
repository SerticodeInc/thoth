-- 007_research_metadata.sql
-- Add source tracking and search query columns to research_notes

ALTER TABLE research_notes ADD COLUMN source_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE research_notes ADD COLUMN search_queries TEXT NOT NULL DEFAULT '[]';
