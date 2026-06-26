import type { ResearchNote } from '../entities/research-note.ts';
import type { Result } from '../entities/result.ts';

export interface ResearchRepository {
  save(note: ResearchNote): Promise<Result<ResearchNote>>;
  get(id: string): Promise<Result<ResearchNote | null>>;
  searchByTopic(topic: string): Promise<Result<ResearchNote[]>>;
  saveResearchEmbedding(researchId: string, embedding: number[], model: string): Promise<Result<void>>;
}

