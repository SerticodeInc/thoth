export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly voiceProfileId: string;
  readonly researchId: string | null;
  readonly wordCount: number;
  readonly status: ArticleStatus;
  readonly mediumUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
