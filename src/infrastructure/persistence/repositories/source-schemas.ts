import { z } from 'zod';

export const sourceReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(['voice', 'knowledge', 'publication']),
  source_path: z.string(),
  content: z.string(),
  checksum: z.string(),
  chunk_index: z.number(),
  created_at: z.string(),
}).transform((row) => ({
  id: row.id,
  type: row.type,
  sourcePath: row.source_path,
  content: row.content,
  checksum: row.checksum,
  chunkIndex: row.chunk_index,
  createdAt: new Date(row.created_at),
}));
