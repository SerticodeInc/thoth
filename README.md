# Thoth

Identity Preserving Publishing Engine: a CLI that builds voice, knowledge, and publication profiles from your writing, then generates articles that sound like you.

## Quick Start

```bash
# 1. Initialize
thoth init

# 2. Import your writing
thoth import voice ~/notes ~/essays
thoth import knowledge ~/architecture ~/repos
thoth import publications ~/articles

# 3. Generate identity profiles
thoth generate_profile
thoth profile_status

# 4. Research a topic
thoth research "offline first mobile architecture"

# 5. Generate an article in your voice
thoth generate_article --topic "offline first mobile architecture"

# 6. Export
thoth export_article <id>
```

---

## Installation

```bash
npm install -g @serticode/thoth
```

### Prerequisites

- **Node.js 22+**
- **C++ build tools** — `better-sqlite3` and `sqlite-vec` are native C++ modules:
  - **macOS:** Xcode CLI tools (`xcode-select --install`)
  - **Linux:** `build-essential` (or equivalent)
  - **Windows:** Visual Studio Build Tools with C++ workload

If you don't have a C++ compiler, the install will fail with a `node-gyp` error. Install your platform's build tools and try again.

### Optional: Ollama (no API key needed)

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

With Ollama running locally, Thoth works with zero API keys.

---

## Configuration

API keys are read from environment variables. Set at least one:

```bash
export OPENAI_API_KEY=sk-...       # best quality, tried first
export GROQ_API_KEY=gsk_...        # fast inference
export GEMINI_API_KEY=AIza...      # free tier available
export ANTHROPIC_API_KEY=sk-ant-... # Claude models
```

No keys? Ollama is always available as a local fallback.

All models are overridable:

```bash
export OPENAI_CHAT_MODEL=gpt-4o
export OLLAMA_CHAT_MODEL=qwen2.5:7b
export OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

See `thoth.json` for project level overrides and the [full config docs](https://thoth.serticode.com/docs).

---

## Commands

| Command                                    | Description                                          |
| ------------------------------------------ | ---------------------------------------------------- |
| `thoth init`                               | Create database and run migrations                   |
| `thoth import voice <path>`                | Import voice sources (journals, essays, notes)       |
| `thoth import knowledge <path>`            | Import knowledge sources (architecture, repos, docs) |
| `thoth import publications <path>`         | Import publication sources (articles, blog posts)    |
| `thoth generate_profile`                   | Generate all identity profiles via AI                |
| `thoth profile_status`                     | Show ready/missing status for each profile           |
| `thoth research "<topic>"`                 | Research a topic with vector-search + AI synthesis   |
| `thoth generate_article --topic "<topic>"` | Generate an article in your voice                    |
| `thoth list_articles`                      | List all generated articles                          |
| `thoth get_article <id>`                   | Show article content                                 |
| `thoth create_series <name>`               | Create a new article series                          |
| `thoth list_series`                        | List all series                                      |
| `thoth add_to_series <series> <article>`   | Add an article to a series                           |
| `thoth get_series <id>`                    | Show series with all articles                        |
| `thoth export_article <id>`                | Export article (md, html, txt, rss)                  |
| `thoth export_series <id>`                 | Export entire series                                 |

Output goes to `~/Documents/Thoth/singles/` and `~/Documents/Thoth/series/`.

---

## AI Provider Chain

Thoth chains through AI providers in quality priority order. Each provider is gated by its API key; if the key isn't set, it's skipped.

| Provider      | Chat Model           | Embedding Model          | Key Required        |
| ------------- | -------------------- | ------------------------ | ------------------- |
| **OpenAI**    | `gpt-4o-mini`        | `text-embedding-3-small` | `OPENAI_API_KEY`    |
| **Groq**      | `mixtral-8x7b-32768` | —                        | `GROQ_API_KEY`      |
| **Gemini**    | `gemini-1.5-flash`   | `text-embedding-004`     | `GEMINI_API_KEY`    |
| **Anthropic** | `claude-3-haiku`     | —                        | `ANTHROPIC_API_KEY` |
| **Ollama**    | `qwen2.5:7b`         | `nomic-embed-text`       | none (local)        |

Each provider has a 15 second timeout. If one fails, the next is tried automatically.

---

## Architecture

```text
src/
├── domain/          # Pure TypeScript — entities, repository interfaces, Result<T>
├── application/     # Use cases — import, generate profiles, research, articles, series
├── infrastructure/  # Adapters — SQLite, OpenAI SDK, file system, logging
└── cli/             # Commander.js — thin delegation to use cases
```

Clean Architecture with strict layer separation. Domain has zero external dependencies. Infrastructure implements domain interfaces. CLI depends on application use cases.

---

## Privacy

All data stays local. Voice profiles, knowledge profiles, embeddings, research notes, and generated articles are stored in `~/.thoth/thoth.db` (SQLite). Nothing is sent to any server except the AI provider you configure. Medium publishing is draft-only and requires explicit user action.

---

## Links

- [Full CLI Reference](https://thoth.serticode.com/docs)
- [Changelog](https://github.com/SerticodeInc/thoth/blob/master/CHANGELOG.md)
