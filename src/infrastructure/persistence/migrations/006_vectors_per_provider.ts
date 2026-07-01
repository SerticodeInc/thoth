export const MIGRATION_006 = `-- Per-provider vector tables

DROP TABLE IF EXISTS vec_sources;
DROP TABLE IF EXISTS vec_profiles;
DROP TABLE IF EXISTS vec_research;

CREATE VIRTUAL TABLE IF NOT EXISTS vec_sources_openai USING vec0(
  embedding float[1536]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_sources_ollama USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_sources_gemini USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_profiles_openai USING vec0(
  embedding float[1536]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_profiles_ollama USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_profiles_gemini USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_research_openai USING vec0(
  embedding float[1536]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_research_ollama USING vec0(
  embedding float[768]
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_research_gemini USING vec0(
  embedding float[768]
);
`;
