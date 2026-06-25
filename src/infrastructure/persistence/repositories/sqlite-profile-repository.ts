import type Database from 'better-sqlite3';
import type { VoiceProfile, VoiceTraits } from '../../../domain/entities/voice-profile.ts';
import type { KnowledgeProfile } from '../../../domain/entities/knowledge-profile.ts';
import type {
  PublicationProfile,
  SeriesReference,
} from '../../../domain/entities/publication-profile.ts';
import type {
  ProfileRepository,
  ProfileType,
  ProfileEntity,
  ScoredProfile,
} from '../../../domain/repositories/profile-repository.ts';

function parseTraits(json: string): VoiceTraits {
  const raw = JSON.parse(json) as Record<string, string[]>;
  return {
    tone: raw.tone ?? [],
    pacing: raw.pacing ?? [],
    storytelling: raw.storytelling ?? [],
    vocabulary: raw.vocabulary ?? [],
    sentenceStructure: raw.sentenceStructure ?? [],
    transitions: raw.transitions ?? [],
    humor: raw.humor ?? [],
    readerEngagement: raw.readerEngagement ?? [],
  };
}

export class SqliteProfileRepository implements ProfileRepository {
  constructor(private readonly db: Database.Database) {}

  saveVoiceProfile(profile: VoiceProfile): Promise<VoiceProfile> {
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
    return Promise.resolve(profile);
  }

  getVoiceProfile(id: string): Promise<VoiceProfile | null> {
    const row = this.db.prepare('SELECT * FROM voice_profiles WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapVoiceRow(row));
  }

  getLatestVoiceProfile(): Promise<VoiceProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM voice_profiles ORDER BY created_at DESC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapVoiceRow(row));
  }

  saveKnowledgeProfile(profile: KnowledgeProfile): Promise<KnowledgeProfile> {
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
    return Promise.resolve(profile);
  }

  getKnowledgeProfile(id: string): Promise<KnowledgeProfile | null> {
    const row = this.db.prepare('SELECT * FROM knowledge_profiles WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapKnowledgeRow(row));
  }

  getLatestKnowledgeProfile(): Promise<KnowledgeProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM knowledge_profiles ORDER BY created_at DESC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapKnowledgeRow(row));
  }

  savePublicationProfile(profile: PublicationProfile): Promise<PublicationProfile> {
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
    return Promise.resolve(profile);
  }

  getPublicationProfile(id: string): Promise<PublicationProfile | null> {
    const row = this.db.prepare('SELECT * FROM publication_profiles WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapPublicationRow(row));
  }

  getLatestPublicationProfile(): Promise<PublicationProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM publication_profiles ORDER BY created_at DESC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapPublicationRow(row));
  }

  async searchSimilarProfiles(
    embedding: number[],
    type: ProfileType,
    limit = 5,
  ): Promise<ScoredProfile[]> {
    const vecTable = 'vec_profiles';
    const embTable = 'profile_embeddings';

    const rows = this.db
      .prepare(
        `SELECT v.rowid, e.profile_id, e.profile_type, v.distance
         FROM ${vecTable} v
         JOIN ${embTable} e ON v.rowid = e.id
         WHERE e.profile_type = ? AND v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`,
      )
      .all(type, new Float32Array(embedding), limit) as Array<{
      rowid: number;
      profile_id: string;
      profile_type: string;
      distance: number;
    }>;

    const results: ScoredProfile[] = [];
    for (const row of rows) {
      const profile = await this.getProfileById(row.profile_id, row.profile_type as ProfileType);
      if (profile) {
        results.push({ profile, distance: row.distance });
      }
    }
    return results;
  }

  private async getProfileById(id: string, type: ProfileType): Promise<ProfileEntity | null> {
    switch (type) {
      case 'voice':
        return this.getVoiceProfile(id);
      case 'knowledge':
        return this.getKnowledgeProfile(id);
      case 'publication':
        return this.getPublicationProfile(id);
    }
  }

  private mapVoiceRow(row: Record<string, unknown>): VoiceProfile {
    return {
      id: row.id as string,
      name: (row.name as string) ?? null,
      traits: parseTraits(row.traits as string),
      summary: (row.summary as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapKnowledgeRow(row: Record<string, unknown>): KnowledgeProfile {
    return {
      id: row.id as string,
      domains: JSON.parse(row.domains as string) as string[],
      topics: JSON.parse(row.topics as string) as string[],
      summary: (row.summary as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapPublicationRow(row: Record<string, unknown>): PublicationProfile {
    return {
      id: row.id as string,
      themes: JSON.parse(row.themes as string) as string[],
      series: row.series ? (JSON.parse(row.series as string) as SeriesReference[]) : null,
      summary: (row.summary as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
