import type { ResearchRepository } from '../../domain/repositories/research-repository.ts';
import type { ResearchNote } from '../../domain/entities/research-note.ts';
import type { Result } from '../../domain/entities/result.ts';

export function formatResearchAsMarkdown(note: ResearchNote): string {
  const date = note.createdAt.toISOString().split('T')[0];
  const citations = note.citations
    .map(
      (c) =>
        `- **[${c.sourcePath.length > 80 ? c.sourcePath.slice(0, 77) + '...' : c.sourcePath}]** (relevance: ${(c.relevanceScore * 100).toFixed(0)}%)\n  > ${c.excerpt.slice(0, 300)}`,
    )
    .join('\n\n');

  return [
    '---',
    `topic: "${note.topic}"`,
    `date: ${date}`,
    `sources: ${note.sourceCount}`,
    `citations: ${note.citations.length}`,
    `search_queries: ${note.searchQueries.join('; ')}`,
    `id: ${note.id}`,
    '---',
    '',
    note.content,
    '',
    '## Citations',
    '',
    citations,
  ].join('\n');
}

export interface ExportResearchInput {
  readonly researchId: string;
}

export interface ExportResearchOutput {
  readonly content: string;
  readonly filename: string;
}

export class ExportResearchUseCase {
  constructor(private readonly researchRepo: ResearchRepository) {}

  async execute(input: ExportResearchInput): Promise<Result<ExportResearchOutput>> {
    const researchResult = await this.researchRepo.get(input.researchId);
    if (!researchResult.ok) return researchResult;
    if (!researchResult.value) return { ok: false, error: `Research note not found: ${input.researchId}` };

    const note = researchResult.value;
    const slug =
      note.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'research';

    const content = formatResearchAsMarkdown(note);

    return {
      ok: true,
      value: { content, filename: `${slug}.md` },
    };
  }
}
