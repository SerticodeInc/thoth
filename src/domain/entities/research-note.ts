export interface ResearchCitation {
  readonly sourceId: string;
  readonly sourcePath: string;
  readonly excerpt: string;
  readonly relevanceScore: number;
}

export interface ResearchNote {
  readonly id: string;
  readonly topic: string;
  readonly content: string;
  readonly citations: readonly ResearchCitation[];
  readonly sourceCount: number;
  readonly searchQueries: readonly string[];
  readonly createdAt: Date;
}
