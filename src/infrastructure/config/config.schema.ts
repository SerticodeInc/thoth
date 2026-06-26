import { z } from 'zod';

export const thothConfigSchema = z.object({
  provider: z.enum(['openai', 'groq', 'gemini', 'ollama', 'anthropic']).optional(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
  local: z.boolean().optional(),
  dbPath: z.string().optional(),
  logLevel: z.string().optional(),
  export: z
    .object({
      format: z.enum(['md', 'html', 'txt', 'rss']).optional(),
      outputDir: z.string().optional(),
    })
    .optional(),
});

export type ThothConfig = z.infer<typeof thothConfigSchema>;
