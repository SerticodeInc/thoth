import { z } from 'zod';

export const voiceProfileRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  traits: z.string(),
  summary: z.string().nullable(),
  created_at: z.string(),
}).transform((row) => ({
  id: row.id,
  name: row.name,
  traits: JSON.parse(row.traits) as {
    tone: string[];
    pacing: string[];
    storytelling: string[];
    vocabulary: string[];
    sentenceStructure: string[];
    transitions: string[];
    humor: string[];
    readerEngagement: string[];
  },
  summary: row.summary,
  createdAt: new Date(row.created_at),
}));

export const knowledgeProfileRowSchema = z.object({
  id: z.string(),
  domains: z.string(),
  topics: z.string(),
  summary: z.string().nullable(),
  created_at: z.string(),
}).transform((row) => ({
  id: row.id,
  domains: JSON.parse(row.domains) as string[],
  topics: JSON.parse(row.topics) as string[],
  summary: row.summary,
  createdAt: new Date(row.created_at),
}));

export const publicationProfileRowSchema = z.object({
  id: z.string(),
  themes: z.string(),
  series: z.string().nullable(),
  summary: z.string().nullable(),
  created_at: z.string(),
}).transform((row) => ({
  id: row.id,
  themes: JSON.parse(row.themes) as string[],
  series: row.series ? (JSON.parse(row.series) as Array<{ name: string; articles: Array<{ title: string; url: string | null; publishedAt: string | null }> }>) : null,
  summary: row.summary,
  createdAt: new Date(row.created_at),
}));
