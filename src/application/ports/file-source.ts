import type { SourceReference, SourceType } from '../../domain/entities/source-reference.ts';

export interface FileSourcePort {
  importFromPath(sourcePath: string, type: SourceType): Promise<SourceReference[]>;
}
