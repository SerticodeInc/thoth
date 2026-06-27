import type { VoiceProfile } from '../entities/voice-profile.ts';
import type { KnowledgeProfile } from '../entities/knowledge-profile.ts';
import type { PublicationProfile } from '../entities/publication-profile.ts';
import type { Result } from '../entities/result.ts';

export type ProfileType = 'voice' | 'knowledge' | 'publication';

export interface ProfileStatus {
  voice: { exists: true; id: string; summary: string } | { exists: false };
  knowledge: { exists: true; id: string; domains: string } | { exists: false };
  publication: { exists: true; id: string; themes: string } | { exists: false };
}

export interface ProfileRepository {
  saveVoiceProfile(profile: VoiceProfile): Promise<Result<VoiceProfile>>;
  getVoiceProfile(id: string): Promise<Result<VoiceProfile | null>>;
  getLatestVoiceProfile(): Promise<Result<VoiceProfile | null>>;

  saveKnowledgeProfile(profile: KnowledgeProfile): Promise<Result<KnowledgeProfile>>;
  getKnowledgeProfile(id: string): Promise<Result<KnowledgeProfile | null>>;
  getLatestKnowledgeProfile(): Promise<Result<KnowledgeProfile | null>>;

  savePublicationProfile(profile: PublicationProfile): Promise<Result<PublicationProfile>>;
  getPublicationProfile(id: string): Promise<Result<PublicationProfile | null>>;
  getLatestPublicationProfile(): Promise<Result<PublicationProfile | null>>;

  saveProfileEmbedding(profileId: string, type: ProfileType, embedding: number[]): Promise<Result<void>>;

  getProfileStatus(): Promise<Result<ProfileStatus>>;
}
