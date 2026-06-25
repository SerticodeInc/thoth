import { z } from 'zod';

export const voiceTraitsSchema = z.object({
  tone: z.array(z.string()),
  pacing: z.array(z.string()),
  storytelling: z.array(z.string()),
  vocabulary: z.array(z.string()),
  sentenceStructure: z.array(z.string()),
  transitions: z.array(z.string()),
  humor: z.array(z.string()),
  readerEngagement: z.array(z.string()),
});

export const voiceProfileResponseSchema = z.object({
  traits: voiceTraitsSchema,
  summary: z.string().min(1),
});

export const knowledgeProfileResponseSchema = z.object({
  domains: z.array(z.string()),
  topics: z.array(z.string()),
  summary: z.string().min(1),
});

export const publicationProfileResponseSchema = z.object({
  themes: z.array(z.string()),
  summary: z.string().min(1),
});
