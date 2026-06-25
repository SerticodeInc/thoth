export interface VoiceTraits {
  readonly tone: string[];
  readonly pacing: string[];
  readonly storytelling: string[];
  readonly vocabulary: string[];
  readonly sentenceStructure: string[];
  readonly transitions: string[];
  readonly humor: string[];
  readonly readerEngagement: string[];
}

export interface VoiceProfile {
  readonly id: string;
  readonly name: string | null;
  readonly traits: VoiceTraits;
  readonly summary: string | null;
  readonly createdAt: Date;
}
