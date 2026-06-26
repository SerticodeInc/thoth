import { randomUUID } from 'node:crypto';
import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { ResearchRepository } from '../../domain/repositories/research-repository.ts';
import type { SourceRepository } from '../../domain/repositories/source-repository.ts';
import type { ResearchNote, ResearchCitation } from '../../domain/entities/research-note.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { LoggerPort } from '../ports/logger.ts';

const RESEARCH_PROMPT = `You are a research assistant synthesizing information from a person's own writing.

Given the topic and the provided source excerpts from their knowledge base, produce a well-structured research note that:

1. Summarizes the key findings relevant to the topic
2. Identifies patterns, contradictions, or gaps in the source material
3. Cites specific excerpts that support each claim
4. Suggests angles or directions for further exploration

Return ONLY valid JSON with this exact structure:
{
  "content": "The full research note text with inline citations referencing source IDs",
  "citations": [
    {
      "sourceId": "uuid-of-the-source",
      "sourcePath": "path-to-source",
      "excerpt": "the relevant excerpt",
      "relevanceScore": 0.0 to 1.0
    }
  ]
}`;

export class ResearchUseCase {
  constructor(
    private readonly ai: AiService,
    private readonly researchRepo: ResearchRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly logger: LoggerPort,
  ) {}

  async execute(topic: string): Promise<Result<ResearchNote>> {
    this.logger.info({ topic }, 'Starting research');

    const embedResult = await this.ai.generateEmbedding(topic);
    if (!embedResult.ok) return { ok: false, error: `Embedding failed: ${embedResult.error}` };

    const nearChunks = this.sourceRepo.searchByVector(embedResult.value, 15);
    if (!nearChunks.ok) return { ok: false, error: nearChunks.error };

    if (nearChunks.value.length === 0) {
      return {
        ok: false,
        error: 'No relevant sources found. Import knowledge sources with `thoth import knowledge <path>` first.',
      };
    }

    const excerpts = nearChunks.value
      .map((chunk) => `[${chunk.id}] ${chunk.content.slice(0, 500)}`)
      .join('\n\n---\n\n');

    const chatResult = await this.ai.chat({
      systemPrompt: RESEARCH_PROMPT,
      userPrompt: `Topic: ${topic}\n\nRelevant source excerpts:\n\n${excerpts}`,
      temperature: 0.4,
    });

    if (!chatResult.ok) return { ok: false, error: chatResult.error };

    const parsed = JSON.parse(chatResult.value) as Record<string, unknown>;

    const content = parsed.content;
    const rawCitations = parsed.citations;

    if (typeof content !== 'string' || !Array.isArray(rawCitations)) {
      return { ok: false, error: 'Research response missing content or citations' };
    }

    const citations: ResearchCitation[] = rawCitations.map((c: Record<string, unknown>) => ({
      sourceId: String(c.sourceId),
      sourcePath: String(c.sourcePath),
      excerpt: String(c.excerpt),
      relevanceScore: Number(c.relevanceScore),
    }));

    const note: ResearchNote = {
      id: randomUUID(),
      topic,
      content,
      citations,
      createdAt: new Date(),
    };

    const saveResult = await this.researchRepo.save(note);
    if (!saveResult.ok) return saveResult;

    const noteEmbedResult = await this.ai.generateEmbedding(note.content);
    if (noteEmbedResult.ok) {
      const embResult = await this.researchRepo.saveResearchEmbedding(
        note.id,
        noteEmbedResult.value,
        'text-embedding-3-small',
      );
      if (!embResult.ok) {
        this.logger.warn({ error: embResult.error }, 'Failed to save research embedding');
      }
    } else {
      this.logger.warn({ error: noteEmbedResult.error }, 'Research note embedding failed');
    }

    this.logger.info({ topic, citationCount: citations.length, id: note.id }, 'Research complete');
    return { ok: true, value: note };
  }
}
