export interface KnowledgeProfile {
  readonly id: string;
  readonly domains: string[];
  readonly topics: string[];
  readonly summary: string | null;
  readonly createdAt: Date;
}
