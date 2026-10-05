import { randomUUID } from 'node:crypto';
import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { ResearchRepository } from '../../domain/repositories/research-repository.ts';
import type { SourceRepository } from '../../domain/repositories/source-repository.ts';
import type { WebSearchService } from '../../domain/repositories/web-search-service.ts';
import type { WebContentFetcher } from '../../domain/repositories/web-content-fetcher.ts';
import type { ResearchNote, ResearchCitation } from '../../domain/entities/research-note.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { LoggerPort } from '../ports/logger.ts';
import { sanitizeText, checkOxfordCommas } from '../services/style-sanitizer.ts';

const RESEARCH_COMPILATION_PROMPT = `You are a research compiler. Your ONLY task is to organize raw source material into a comprehensive research document suitable for MSc/PhD-level academic work.

CRITICAL RULES:
1. You MUST ONLY use information explicitly present in the source material provided below
2. NEVER synthesize, summarize, or interpret — only compile, organize, and present the raw data
3. NEVER add information not found in the sources — no outside knowledge, no training data
4. Every factual claim MUST be traceable to a specific source in the material
5. If sources contradict each other, present both viewpoints without resolving the contradiction
6. Organize content into logical thematic sections with clear markdown headers
7. Include ALL relevant data points, statistics, findings, and quotes from the sources
8. Write 10-15 pages worth of compiled research material — be exhaustive, not concise
9. Use inline source attributions like [Source: title or URL] after each major claim

STYLE RULES:
- NEVER use em dashes (—). Use commas, periods, or semicolons instead
- NEVER use Oxford commas (no comma before "and" or "or" in a list of three or more items)
- Preserve the original language, terminology, and detail level of each source
- Use academic tone appropriate for MSc/PhD research

OUTPUT FORMAT:
A comprehensive markdown research document organized by thematic sections. Start with a "Research Scope" section listing all sources consulted. Follow with thematic sections covering all aspects of the topic found in the sources. End with a "Source Index" listing all sources with URLs.`;

const QUERY_REFINEMENT_PROMPT = `You are a research strategist. Given a research topic and the initial sources found, generate 3-5 refined search queries that will fill gaps and find additional perspectives.

Return ONLY valid JSON:
{
  "queries": ["query 1", "query 2", "query 3"]
}`;

export class ResearchUseCase {
  constructor(
    private readonly ai: AiService,
    private readonly researchRepo: ResearchRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly webSearch: WebSearchService,
    private readonly webFetcher: WebContentFetcher,
    private readonly logger: LoggerPort,
  ) {}

  async execute(topic: string): Promise<Result<ResearchNote>> {
    this.logger.info({ topic }, 'Starting comprehensive research');

    // Step 1: Local vector search
    const embedResult = await this.ai.generateEmbedding(topic);
    if (!embedResult.ok) return { ok: false, error: `Embedding failed: ${embedResult.error}` };

    const nearChunks = await this.sourceRepo.searchByVector(embedResult.value, 30);

    const localSources = nearChunks.ok
      ? nearChunks.value.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          path: chunk.sourcePath ?? 'unknown',
        }))
      : [];

    this.logger.info({ localSourceCount: localSources.length }, 'Local sources found');

    // Step 2: Web search round 1
    const searchResult = await this.webSearch.search(topic, 20);
    const searchQueries: string[] = [topic];

    if (!searchResult.ok) {
      this.logger.warn({ error: searchResult.error }, 'Web search round 1 failed, continuing with local only');
    }

    const round1Results = searchResult.ok ? searchResult.value.results : [];
    this.logger.info({ webResultCount: round1Results.length }, 'Web search round 1 complete');

    // Step 3: Fetch web pages from round 1 (those with rawContent skip fetching)
    const urlsToFetch1 = round1Results
      .filter((r) => !r.rawContent)
      .map((r) => r.url);

    const fetchedPages1 = urlsToFetch1.length > 0
      ? await this.webFetcher.fetchPages(urlsToFetch1, 5)
      : { ok: true, value: [] };

    // Step 4: Generate refined queries for gap filling
    let refinedQueries: string[] = [];
    if (searchResult.ok && round1Results.length > 0) {
      const sourcesSummary = round1Results
        .slice(0, 10)
        .map((r) => `- ${r.title}: ${r.snippet.slice(0, 200)}`)
        .join('\n');

      const queryResult = await this.ai.chat({
        systemPrompt: QUERY_REFINEMENT_PROMPT,
        userPrompt: `Topic: ${topic}\n\nInitial sources found:\n${sourcesSummary}\n\nGenerate 3-5 refined search queries to fill gaps and find additional perspectives. Return ONLY valid JSON with a "queries" array.`,
        temperature: 0.3,
        responseFormat: 'json',
      });

      if (queryResult.ok) {
        try {
          const match = /"queries"\s*:\s*(\[.*?\])/s.exec(queryResult.value);
          if (match) {
            const parsed = JSON.parse(match[1]) as string[];
            if (Array.isArray(parsed)) {
              refinedQueries = parsed.slice(0, 5);
              searchQueries.push(...refinedQueries);
            }
          }
        } catch {
          this.logger.warn('Failed to parse refined queries from AI response');
        }
      }
    }

    this.logger.info({ refinedQueries }, 'Refined queries generated');

    // Step 5: Web search round 2 with refined queries
    const round2Results: typeof round1Results = [];
    for (const q of refinedQueries) {
      const result = await this.webSearch.search(q, 10);
      if (result.ok) {
        round2Results.push(...result.value.results);
      }
    }

    this.logger.info({ round2ResultCount: round2Results.length }, 'Web search round 2 complete');

    // Step 6: Fetch pages from round 2
    const allWebResults = [...round1Results, ...round2Results];
    const seen = new Set<string>();
    const uniqueResults = allWebResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const urlsToFetch2 = uniqueResults
      .filter((r) => !r.rawContent)
      .map((r) => r.url);

    const fetchedPages2 = urlsToFetch2.length > 0
      ? await this.webFetcher.fetchPages(urlsToFetch2, 5)
      : { ok: true, value: [] };

    // Step 7: Merge all sources
    const allFetchedPages = [
      ...(fetchedPages1.ok ? fetchedPages1.value : []),
      ...(fetchedPages2.ok ? fetchedPages2.value : []),
    ];

    const sourceSections: string[] = [];

    // Local sources
    for (const src of localSources) {
      sourceSections.push(`[Source: ${src.path}]\n${src.content}`);
    }

    // Web sources with raw content (from Tavily)
    for (const r of uniqueResults) {
      if (r.rawContent) {
        sourceSections.push(`[Source: ${r.title} (${r.url})]\n${r.rawContent}`);
      }
    }

    // Fetched page content
    for (const page of allFetchedPages) {
      sourceSections.push(`[Source: ${page.url}]\n${page.content}`);
    }

    const totalSources = sourceSections.length;

    if (totalSources === 0) {
      return {
        ok: false,
        error: 'No sources found. Import knowledge sources with `thoth import knowledge <path>` or ensure web search is configured.',
      };
    }

    this.logger.info({ totalSources, localSources: localSources.length, webSources: totalSources - localSources.length }, 'Sources merged');

    // Step 8: Compilation pass — handle large source sets by batching if needed
    const MAX_SOURCE_CHARS = 80_000;
    let totalChars = 0;
    let batchedSources = '';
    const batches: string[] = [];

    for (const section of sourceSections) {
      if (totalChars + section.length > MAX_SOURCE_CHARS && batchedSources.length > 0) {
        batches.push(batchedSources);
        batchedSources = '';
        totalChars = 0;
      }
      batchedSources += section + '\n\n---\n\n';
      totalChars += section.length + 10;
    }
    if (batchedSources.trim()) {
      batches.push(batchedSources);
    }

    let compiledContent = '';

    if (batches.length === 1) {
      // Single pass
      const chatResult = await this.ai.chat({
        systemPrompt: RESEARCH_COMPILATION_PROMPT,
        userPrompt: `Research Topic: ${topic}\n\nSource Material:\n\n${batches[0]}`,
        temperature: 0.1,
        maxTokens: 16384,
      });

      if (!chatResult.ok) return { ok: false, error: chatResult.error };
      compiledContent = chatResult.value;
    } else {
      // Multi-batch: compile each batch into a section, then merge
      const sectionResults: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        const batchResult = await this.ai.chat({
          systemPrompt: `${RESEARCH_COMPILATION_PROMPT}\n\nThis is batch ${i + 1} of ${batches.length}. Compile this batch into a section of the research document.`,
          userPrompt: `Research Topic: ${topic}\n\nSource Material (Batch ${i + 1}/${batches.length}):\n\n${batches[i]}`,
          temperature: 0.1,
          maxTokens: 16384,
        });

        if (!batchResult.ok) {
          this.logger.warn({ batch: i, error: batchResult.error }, 'Batch compilation failed');
          continue;
        }
        sectionResults.push(batchResult.value);
      }

      if (sectionResults.length === 0) {
        return { ok: false, error: 'All compilation batches failed' };
      }

      // Merge sections
      const mergeResult = await this.ai.chat({
        systemPrompt: `${RESEARCH_COMPILATION_PROMPT}\n\nYou are merging pre-compiled sections into one cohesive research document. Deduplicate overlapping content and ensure logical flow between sections.`,
        userPrompt: `Research Topic: ${topic}\n\nCompiled Sections to Merge:\n\n${sectionResults.join('\n\n===\n\n')}`,
        temperature: 0.1,
        maxTokens: 16384,
      });

      if (!mergeResult.ok) return { ok: false, error: mergeResult.error };
      compiledContent = mergeResult.value;
    }

    // Step 9: Post-process for style rules
    compiledContent = sanitizeText(compiledContent);
    const oxfordWarnings = checkOxfordCommas(compiledContent);
    if (oxfordWarnings.length > 0) {
      this.logger.warn({ count: oxfordWarnings.length }, 'Potential Oxford commas detected in research');
    }

    // Build citations array
    const citations: ResearchCitation[] = [
      ...localSources.map((s) => ({
        sourceId: s.id,
        sourcePath: s.path,
        excerpt: s.content.slice(0, 200),
        relevanceScore: 0.8,
      })),
      ...uniqueResults.map((r) => ({
        sourceId: r.url,
        sourcePath: r.url,
        excerpt: r.snippet.slice(0, 200),
        relevanceScore: 0.7,
      })),
    ];

    const note: ResearchNote = {
      id: randomUUID(),
      topic,
      content: compiledContent,
      citations,
      sourceCount: totalSources,
      searchQueries,
      createdAt: new Date(),
    };

    const saveResult = await this.researchRepo.save(note);
    if (!saveResult.ok) return saveResult;

    // Optional: embed the research for future local search
    const noteEmbedResult = await this.ai.generateEmbedding(note.content.slice(0, 8000));
    if (noteEmbedResult.ok) {
      const embResult = await this.researchRepo.saveResearchEmbedding(
        note.id,
        noteEmbedResult.value,
        this.ai.getActiveEmbeddingModel(),
      );
      if (!embResult.ok) {
        this.logger.warn({ error: embResult.error }, 'Failed to save research embedding');
      }
    }

    this.logger.info(
      { topic, sourceCount: totalSources, citations: citations.length, searchQueries, id: note.id },
      'Comprehensive research complete',
    );
    return { ok: true, value: note };
  }
}
