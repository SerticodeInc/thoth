import type { VoiceProfile } from '../entities/voice-profile.ts';
import type { KnowledgeProfile } from '../entities/knowledge-profile.ts';
import type { PublicationProfile } from '../entities/publication-profile.ts';

export type ProfileType = 'voice' | 'knowledge' | 'publication';
export type ProfileEntity = VoiceProfile | KnowledgeProfile | PublicationProfile;

export interface ScoredProfile {
  readonly profile: ProfileEntity;
  readonly distance: number;
}

export interface ProfileRepository {
  saveVoiceProfile(profile: VoiceProfile): Promise<VoiceProfile>;
  getVoiceProfile(id: string): Promise<VoiceProfile | null>;
  getLatestVoiceProfile(): Promise<VoiceProfile | null>;

  saveKnowledgeProfile(profile: KnowledgeProfile): Promise<KnowledgeProfile>;
  getKnowledgeProfile(id: string): Promise<KnowledgeProfile | null>;
  getLatestKnowledgeProfile(): Promise<KnowledgeProfile | null>;

  savePublicationProfile(profile: PublicationProfile): Promise<PublicationProfile>;
  getPublicationProfile(id: string): Promise<PublicationProfile | null>;
  getLatestPublicationProfile(): Promise<PublicationProfile | null>;

  searchSimilarProfiles(
    embedding: number[],
    type: ProfileType,
    limit?: number,
  ): Promise<ScoredProfile[]>;
}
