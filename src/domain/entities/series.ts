export interface Series {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly articleIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
