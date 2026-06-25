export type SourceType = 'voice' | 'knowledge' | 'publication';

export interface SourceReference {
  readonly id: string;
  readonly type: SourceType;
  readonly sourcePath: string;
  readonly content: string;
  readonly checksum: string;
  readonly chunkIndex: number;
  readonly createdAt: Date;
}
