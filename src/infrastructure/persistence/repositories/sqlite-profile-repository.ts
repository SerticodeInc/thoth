import type Database from 'better-sqlite3';
import type { VoiceProfile } from '../../../domain/entities/voice-profile.ts';
import type { KnowledgeProfile } from '../../../domain/entities/knowledge-profile.ts';
import type { PublicationProfile } from '../../../domain/entities/publication-profile.ts';
import type {
  ProfileRepository,
  ProfileType,
} from '../../../domain/repositories/profile-repository.ts';
import type { Result } from '../../../domain/entities/result.ts';
import {
  voiceProfileRowSchema,
  knowledgeProfileRowSchema,
  publicationProfileRowSchema,
} from './profile-schemas.ts';

function parseRow(
  schema: { parse: (row: unknown) => unknown },
  row: Record<string, unknown>,
  label: string,
): Result<unknown> {
  try {
    return { ok: true, value: schema.parse(row) };
  } catch (error) {
    return { ok: false, error: `Invalid ${label} row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export class SqliteProfileRepository implements ProfileRepository {
  constructor(private readonly db: Database.Database) {}

  saveVoiceProfile(profile: VoiceProfile): Promise<Result<VoiceProfile>> {
    return Promise.resolve(this.saveVoiceProfileSync(profile));
  }

  getVoiceProfile(id: string): Promise<Result<VoiceProfile | null>> {
    return Promise.resolve(this.getProfileByTypeAndId('voice', id) as Result<VoiceProfile | null>);
  }

  getLatestVoiceProfile(): Promise<Result<VoiceProfile | null>> {
    return Promise.resolve(this.getLatestProfileByType('voice') as Result<VoiceProfile | null>);
  }

  saveKnowledgeProfile(profile: KnowledgeProfile): Promise<Result<KnowledgeProfile>> {
    return Promise.resolve(this.saveKnowledgeProfileSync(profile));
  }

  getKnowledgeProfile(id: string): Promise<Result<KnowledgeProfile | null>> {
    return Promise.resolve(this.getProfileByTypeAndId('knowledge', id) as Result<KnowledgeProfile | null>);
  }

  getLatestKnowledgeProfile(): Promise<Result<KnowledgeProfile | null>> {
    return Promise.resolve(this.getLatestProfileByType('knowledge') as Result<KnowledgeProfile | null>);
  }

  savePublicationProfile(profile: PublicationProfile): Promise<Result<PublicationProfile>> {
    return Promise.resolve(this.savePublicationProfileSync(profile));
  }

  getPublicationProfile(id: string): Promise<Result<PublicationProfile | null>> {
    return Promise.resolve(this.getProfileByTypeAndId('publication', id) as Result<PublicationProfile | null>);
  }

  getLatestPublicationProfile(): Promise<Result<PublicationProfile | null>> {
    return Promise.resolve(this.getLatestProfileByType('publication') as Result<PublicationProfile | null>);
  }

  saveProfileEmbedding(profileId: string, type: ProfileType, embedding: number[]): Promise<Result<void>> {
    try {
      const insertEmb = this.db.prepare(
        'INSERT INTO profile_embeddings (profile_id, profile_type, model) VALUES (?, ?, ?)',
      );
      const insertVec = this.db.prepare('INSERT INTO vec_profiles (embedding) VALUES (?)');

      const doInsert = this.db.transaction(() => {
        insertVec.run(new Float32Array(embedding));
        insertEmb.run(profileId, type, 'text-embedding-3-small');
      });

      doInsert();
      return Promise.resolve({ ok: true, value: undefined });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private saveVoiceProfileSync(profile: VoiceProfile): Result<VoiceProfile> {
    this.db
      .prepare(
        `INSERT INTO voice_profiles (id, name, traits, summary, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           traits = excluded.traits,
           summary = excluded.summary`,
      )
      .run(
        profile.id,
        profile.name,
        JSON.stringify(profile.traits),
        profile.summary,
        profile.createdAt.toISOString(),
      );
    return { ok: true, value: profile };
  }

  private saveKnowledgeProfileSync(profile: KnowledgeProfile): Result<KnowledgeProfile> {
    this.db
      .prepare(
        `INSERT INTO knowledge_profiles (id, domains, topics, summary, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           domains = excluded.domains,
           topics = excluded.topics,
           summary = excluded.summary`,
      )
      .run(
        profile.id,
        JSON.stringify(profile.domains),
        JSON.stringify(profile.topics),
        profile.summary,
        profile.createdAt.toISOString(),
      );
    return { ok: true, value: profile };
  }

  private savePublicationProfileSync(profile: PublicationProfile): Result<PublicationProfile> {
    this.db
      .prepare(
        `INSERT INTO publication_profiles (id, themes, series, summary, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           themes = excluded.themes,
           series = excluded.series,
           summary = excluded.summary`,
      )
      .run(
        profile.id,
        JSON.stringify(profile.themes),
        profile.series ? JSON.stringify(profile.series) : null,
        profile.summary,
        profile.createdAt.toISOString(),
      );
    return { ok: true, value: profile };
  }

  private getProfileByTypeAndId(type: ProfileType, id: string): Result<unknown> {
    const table = this.tableForType(type);
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return { ok: true, value: null };

    const schema = this.schemaForType(type);
    return parseRow(schema, row, `${type} profile`);
  }

  private getLatestProfileByType(type: ProfileType): Result<unknown> {
    const table = this.tableForType(type);
    const row = this.db
      .prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    if (!row) return { ok: true, value: null };

    const schema = this.schemaForType(type);
    return parseRow(schema, row, `${type} profile`);
  }

  private tableForType(type: ProfileType): string {
    switch (type) {
      case 'voice': return 'voice_profiles';
      case 'knowledge': return 'knowledge_profiles';
      case 'publication': return 'publication_profiles';
    }
  }

  private schemaForType(type: ProfileType) {
    switch (type) {
      case 'voice': return voiceProfileRowSchema;
      case 'knowledge': return knowledgeProfileRowSchema;
      case 'publication': return publicationProfileRowSchema;
    }
  }
}
