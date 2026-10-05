# Changelog

All notable changes to Thoth will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-05

### Added

- Web research via Tavily, page fetching and refined search queries.
- Research source counts, search query metadata and Markdown research exports.
- Writing style sanitization for research and article generation.
- Lint and TypeScript checks before automated npm publishing.

### Fixed

- CI now runs for pushes and pull requests targeting master.
- CLI version updated to match the package release.
- Style sanitizer lint error.

## [1.1.0] - 2026-07-06

### Removed

- **Medium publishing** — Full pipeline removed (Medium no longer provides an open API). Removed `PublishArticleUseCase`, `MediumHttpAdapter`, `MediumAdapter` interface, `medium_url` column from articles, and `publish`/`connect_medium` CLI commands.

### Added

- **`export_article --stdout`** — Print article content to stdout instead of writing to a file.

### Changed

- Bumped minor version to 1.1.0

## [1.0.0] - 2026-07-01

### Added

- **Identity engine** — Voice, Knowledge, and Publication profiles generated via AI from imported sources
- **Import system** — `import_voice`, `import_knowledge`, `import_publications` commands supporting Markdown and text files with 512-token chunking and vector embeddings
- **Research engine** — `research "<topic>"` command with vector-search + AI synthesis across imported knowledge
- **Article generation** — `generate_article --topic` command that writes in your voice using identity profiles
- **Series management** — `create_series`, `list_series`, `add_to_series`, `get_series` commands
- **Export** — `export_article`, `export_series` with md, html, txt, and RSS formats, output to `~/Documents/Thoth/`
- **Multi-provider AI chain** — OpenAI, Groq, Gemini, Anthropic, and Ollama with automatic quality-priority fallback (OpenAI → Groq → Gemini → Anthropic → Ollama)
- **Configuration system** — `thoth.json` (project + user), environment variables, CLI flags, configurable model overrides per provider
- **CLI UX** — Spinners, timers, summary blocks, stderr/stdout split, structured error handling
- **Composition root** — Constructor-based dependency injection, `src/infrastructure/composition-root.ts`
- **Result\<T\> discriminated union** — Errors as values throughout the domain, no throws for recoverable errors
- **Zod schemas at DB boundary** — Validated reads on every persistence layer, no raw `as` casts
- **37 tests** — Unit, integration, and e2e across 8 test files, all passing

### Changed

- SourceRepository made async to match other repository contracts
- ImportSourcesUseCase returns `Result<T>`
- CLI output split: operational output to stderr, data output to stdout

### Fixed

- ResearchUseCase uses `parseJsonRecord()` for robust JSON parsing across all providers
- E2E tests isolated to `thoth-test.db` (was writing to production database)
- Security: symlink boundary checks, input length limits, no path traversal
- Article generation fixed for Ollama provider (JSON parsing compatibility)

[1.0.0]: https://github.com/SerticodeInc/thoth/releases/tag/v1.0.0
