import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { ZodError } from 'zod';
import type { VoiceProfile } from '../../domain/entities/voice-profile.ts';
import type { KnowledgeProfile } from '../../domain/entities/knowledge-profile.ts';
import type { PublicationProfile } from '../../domain/entities/publication-profile.ts';
import { getSourcesByType } from '../../infrastructure/persistence/repositories/source-repository.ts';
import { SqliteProfileRepository } from '../../infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { chat, generateEmbedding } from '../../infrastructure/ai/ai.service.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import {
  voiceProfileResponseSchema,
  knowledgeProfileResponseSchema,
  publicationProfileResponseSchema,
} from './profile-schemas.ts';

const VOICE_PROMPT = `You are analyzing a person's writing to build a Voice Profile.

Extract the following traits from the provided text samples. Be specific and evidence-based.

Return ONLY valid JSON with this exact structure:
{
  "traits": {
    "tone": ["descriptive adjectives"],
    "pacing": ["sentence-level observations"],
    "storytelling": ["narrative patterns"],
    "vocabulary": ["vocabulary characteristics"],
    "sentenceStructure": ["structural patterns"],
    "transitions": ["transition patterns"],
    "humor": ["humor characteristics or empty array"],
    "readerEngagement": ["engagement techniques"]
  },
  "summary": "A 2-3 sentence summary of their voice"
}`;

const KNOWLEDGE_PROMPT = `You are analyzing technical writing to build a Knowledge Profile.

Extract the domains, topics, and depth of knowledge from the provided text samples.

Return ONLY valid JSON with this exact structure:
{
  "domains": ["broad technical domains"],
  "topics": ["specific topics covered"],
  "summary": "A 2-3 sentence summary of their knowledge areas and depth"
}`;

const PUBLICATION_PROMPT = `You are analyzing a person's published work to build a Publication Profile.

Extract recurring themes, series, and writing evolution from the provided text samples.

Return ONLY valid JSON with this exact structure:
{
  "themes": ["recurring themes"],
  "summary": "A 2-3 sentence summary of their publication patterns"
}`;

export class GenerateProfilesUseCase {
  constructor(private readonly db: Database.Database) {}

  async generateVoiceProfile(): Promise<VoiceProfile> {
    const sources = getSourcesByType(this.db, 'voice');
    if (sources.length === 0) {
      throw new Error('No voice sources imported. Run `thoth import voice <path>` first.');
    }

    const combined = sources.map((s) => s.content).join('\n\n---\n\n');
    const truncated = combined.length > 32000 ? combined.slice(0, 32000) : combined;

    logger.info(
      { sampleCount: sources.length, totalChars: combined.length },
      'Generating voice profile',
    );

    const response = await chat({
      systemPrompt: VOICE_PROMPT,
      userPrompt: `Here are the writing samples:\n\n${truncated}`,
      temperature: 0.3,
    });

    let parsed: { traits: VoiceProfile['traits']; summary: string };
    try {
      parsed = voiceProfileResponseSchema.parse(JSON.parse(response));
    } catch (error) {
      const message = error instanceof ZodError ? error.message : 'Failed to parse AI response';
      logger.error({ error: message }, 'Voice profile AI response validation failed');
      throw new Error(`Invalid AI response for voice profile: ${message}`);
    }

    const profile: VoiceProfile = {
      id: randomUUID(),
      name: null,
      traits: parsed.traits,
      summary: parsed.summary,
      createdAt: new Date(),
    };

    const repo = new SqliteProfileRepository(this.db);
    await repo.saveVoiceProfile(profile);

    await this.storeProfileEmbedding(profile.id, 'voice', JSON.stringify(parsed.traits));

    logger.info({ profileId: profile.id }, 'Voice profile generated');
    return profile;
  }

  async generateKnowledgeProfile(): Promise<KnowledgeProfile> {
    const sources = getSourcesByType(this.db, 'knowledge');
    if (sources.length === 0) {
      throw new Error(
        'No knowledge sources imported. Run `thoth import knowledge <path>` first.',
      );
    }

    const combined = sources.map((s) => s.content).join('\n\n---\n\n');
    const truncated = combined.length > 32000 ? combined.slice(0, 32000) : combined;

    logger.info({ sampleCount: sources.length }, 'Generating knowledge profile');

    const response = await chat({
      systemPrompt: KNOWLEDGE_PROMPT,
      userPrompt: `Here are the knowledge samples:\n\n${truncated}`,
      temperature: 0.3,
    });

    let parsed: { domains: string[]; topics: string[]; summary: string };
    try {
      parsed = knowledgeProfileResponseSchema.parse(JSON.parse(response));
    } catch (error) {
      const message = error instanceof ZodError ? error.message : 'Failed to parse AI response';
      logger.error({ error: message }, 'Knowledge profile AI response validation failed');
      throw new Error(`Invalid AI response for knowledge profile: ${message}`);
    }

    const profile: KnowledgeProfile = {
      id: randomUUID(),
      domains: parsed.domains,
      topics: parsed.topics,
      summary: parsed.summary,
      createdAt: new Date(),
    };

    const repo = new SqliteProfileRepository(this.db);
    await repo.saveKnowledgeProfile(profile);

    await this.storeProfileEmbedding(
      profile.id,
      'knowledge',
      JSON.stringify({ domains: parsed.domains, topics: parsed.topics }),
    );

    logger.info({ profileId: profile.id }, 'Knowledge profile generated');
    return profile;
  }

  async generatePublicationProfile(): Promise<PublicationProfile> {
    const sources = getSourcesByType(this.db, 'publication');
    if (sources.length === 0) {
      throw new Error(
        'No publication sources imported. Run `thoth import publications <path>` first.',
      );
    }

    const combined = sources.map((s) => s.content).join('\n\n---\n\n');
    const truncated = combined.length > 32000 ? combined.slice(0, 32000) : combined;

    logger.info({ sampleCount: sources.length }, 'Generating publication profile');

    const response = await chat({
      systemPrompt: PUBLICATION_PROMPT,
      userPrompt: `Here are the publication samples:\n\n${truncated}`,
      temperature: 0.3,
    });

    let parsed: { themes: string[]; summary: string };
    try {
      parsed = publicationProfileResponseSchema.parse(JSON.parse(response));
    } catch (error) {
      const message = error instanceof ZodError ? error.message : 'Failed to parse AI response';
      logger.error({ error: message }, 'Publication profile AI response validation failed');
      throw new Error(`Invalid AI response for publication profile: ${message}`);
    }

    const profile: PublicationProfile = {
      id: randomUUID(),
      themes: parsed.themes,
      series: null,
      summary: parsed.summary,
      createdAt: new Date(),
    };

    const repo = new SqliteProfileRepository(this.db);
    await repo.savePublicationProfile(profile);

    await this.storeProfileEmbedding(
      profile.id,
      'publication',
      JSON.stringify({ themes: parsed.themes }),
    );

    logger.info({ profileId: profile.id }, 'Publication profile generated');
    return profile;
  }

  private async storeProfileEmbedding(
    profileId: string,
    profileType: string,
    text: string,
  ): Promise<void> {
    const embedding = await generateEmbedding(text);
    this.db
      .prepare('INSERT INTO vec_profiles (embedding) VALUES (?)')
      .run(new Float32Array(embedding));
    const rowId = (this.db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
    this.db
      .prepare(
        'INSERT INTO profile_embeddings (id, profile_id, profile_type, model) VALUES (?, ?, ?, ?)',
      )
      .run(rowId, profileId, profileType, 'text-embedding-3-small');
  }
}
