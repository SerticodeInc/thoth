import { randomUUID } from 'node:crypto';
import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { VoiceProfile } from '../../domain/entities/voice-profile.ts';
import type { KnowledgeProfile } from '../../domain/entities/knowledge-profile.ts';
import type { PublicationProfile } from '../../domain/entities/publication-profile.ts';
import type { SourceType } from '../../domain/entities/source-reference.ts';
import type { ProfileRepository } from '../../domain/repositories/profile-repository.ts';
import type { SourceRepository } from '../../domain/repositories/source-repository.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { LoggerPort } from '../ports/logger.ts';
import {
  voiceProfileResponseSchema,
  knowledgeProfileResponseSchema,
  publicationProfileResponseSchema,
} from './profile-schemas.ts';
import { parseJsonRecord } from './parse-ai-json.ts';

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
  constructor(
    private readonly ai: AiService,
    private readonly profileRepo: ProfileRepository,
    private readonly sourceRepo: SourceRepository,
    private readonly logger: LoggerPort,
  ) {}

  generateVoiceProfile(): Promise<Result<VoiceProfile>> {
    return this.generateProfile('voice', VOICE_PROMPT, 'voice profile');
  }

  generateKnowledgeProfile(): Promise<Result<KnowledgeProfile>> {
    return this.generateProfile('knowledge', KNOWLEDGE_PROMPT, 'knowledge profile');
  }

  generatePublicationProfile(): Promise<Result<PublicationProfile>> {
    return this.generateProfile('publication', PUBLICATION_PROMPT, 'publication profile');
  }

  private async generateProfile<T extends VoiceProfile | KnowledgeProfile | PublicationProfile>(
    type: SourceType,
    systemPrompt: string,
    label: string,
  ): Promise<Result<T>> {
    const typeLabel = type === 'publication' ? 'publication' : type;

    const sourcesResult = this.sourceRepo.getSourcesByType(type);
    if (!sourcesResult.ok) return { ok: false, error: sourcesResult.error };
    const sources = sourcesResult.value;

    if (sources.length === 0) {
      return {
        ok: false,
        error: `No ${typeLabel} sources imported. Run \`thoth import ${typeLabel} <path>\` first.`,
      };
    }

    const combined = sources.map((s) => s.content).join('\n\n---\n\n');
    const truncated = combined.length > 32000 ? combined.slice(0, 32000) : combined;

    this.logger.info(
      { sampleCount: sources.length, totalChars: combined.length },
      `Generating ${typeLabel} profile`,
    );

    const chatResult = await this.ai.chat({
      systemPrompt: `${systemPrompt}\n\nDo not include markdown fences, commentary, or any text outside the JSON object.`,
      userPrompt: `Here are the ${typeLabel} samples:\n\n${truncated}`,
      responseFormat: 'json',
      temperature: 0.3,
    });

    if (!chatResult.ok) return { ok: false, error: chatResult.error };

    const parsed = parseJsonRecord(chatResult.value);
    if (!parsed.ok) return { ok: false, error: `Invalid JSON response for ${label}: ${parsed.error}` };

    const schema = this.getSchema(type);
    const validated = schema.safeParse(parsed.value);
    if (!validated.success) {
      this.logger.error({ error: validated.error.message }, `${label} AI response validation failed`);
      return { ok: false, error: `Invalid AI response for ${label}: ${validated.error.message}` };
    }

    const profile = this.buildProfile(type, validated.data);
    const saveResult = await this.saveProfile(type, profile);
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error };
    }

    const embedResult = await this.ai.generateEmbedding(JSON.stringify(validated.data));
    if (embedResult.ok) {
      const embResult = await this.profileRepo.saveProfileEmbedding(
        profile.id,
        type,
        embedResult.value,
      );
      if (!embResult.ok) {
        this.logger.warn({ error: embResult.error }, 'Embedding save failed for profile');
      }
    } else {
      this.logger.warn({ error: embedResult.error }, 'Embedding generation failed for profile');
    }

    this.logger.info({ profileId: profile.id }, `${label} generated`);
    return { ok: true, value: profile as T };
  }

  private getSchema(type: SourceType) {
    switch (type) {
      case 'voice': return voiceProfileResponseSchema;
      case 'knowledge': return knowledgeProfileResponseSchema;
      case 'publication': return publicationProfileResponseSchema;
    }
  }

  private buildProfile(
    type: SourceType,
    data: Record<string, unknown>,
  ): VoiceProfile | KnowledgeProfile | PublicationProfile {
    const id = randomUUID();
    const createdAt = new Date();
    switch (type) {
      case 'voice': {
        const { traits, summary } = voiceProfileResponseSchema.parse(data);
        return { id, name: null, traits, summary, createdAt };
      }
      case 'knowledge': {
        const { domains, topics, summary } = knowledgeProfileResponseSchema.parse(data);
        return { id, domains, topics, summary, createdAt };
      }
      case 'publication': {
        const { themes, summary } = publicationProfileResponseSchema.parse(data);
        return { id, themes, series: null, summary, createdAt };
      }
    }
  }

  private async saveProfile(
    type: SourceType,
    profile: VoiceProfile | KnowledgeProfile | PublicationProfile,
  ): Promise<Result<VoiceProfile | KnowledgeProfile | PublicationProfile>> {
    switch (type) {
      case 'voice':
        return this.profileRepo.saveVoiceProfile(profile as VoiceProfile);
      case 'knowledge':
        return this.profileRepo.saveKnowledgeProfile(profile as KnowledgeProfile);
      case 'publication':
        return this.profileRepo.savePublicationProfile(profile as PublicationProfile);
    }
  }
}
