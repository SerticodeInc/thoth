import { describe, it, expect } from 'vitest';
import type { VoiceProfile, VoiceTraits } from '../../src/domain/entities/voice-profile.ts';
import type { KnowledgeProfile } from '../../src/domain/entities/knowledge-profile.ts';
import type { PublicationProfile } from '../../src/domain/entities/publication-profile.ts';
import type { SourceReference } from '../../src/domain/entities/source-reference.ts';

describe('VoiceProfile', () => {
  it('can be constructed with required fields', () => {
    const traits: VoiceTraits = {
      tone: ['conversational', 'authoritative'],
      pacing: ['varied sentence length'],
      storytelling: ['anecdotal openings'],
      vocabulary: ['technical but accessible'],
      sentenceStructure: ['short declarative sentences'],
      transitions: ['logical flow between sections'],
      humor: ['dry wit'],
      readerEngagement: ['rhetorical questions'],
    };

    const profile: VoiceProfile = {
      id: 'test-id',
      name: 'Test Author',
      traits,
      summary: 'A conversational technical writer',
      createdAt: new Date('2024-01-01'),
    };

    expect(profile.id).toBe('test-id');
    expect(profile.traits.tone).toContain('conversational');
    expect(profile.summary).toBeTruthy();
  });
});

describe('KnowledgeProfile', () => {
  it('can be constructed with domains and topics', () => {
    const profile: KnowledgeProfile = {
      id: 'test-id',
      domains: ['Mobile Development', 'Backend Systems'],
      topics: ['Flutter', 'Riverpod', 'Clean Architecture'],
      summary: 'Expert in Flutter and mobile architecture',
      createdAt: new Date('2024-01-01'),
    };

    expect(profile.domains).toHaveLength(2);
    expect(profile.topics).toContain('Flutter');
  });
});

describe('PublicationProfile', () => {
  it('can be constructed with themes', () => {
    const profile: PublicationProfile = {
      id: 'test-id',
      themes: ['Offline First', 'State Management'],
      series: [
        {
          name: 'Building Offline Apps',
          articles: [{ title: 'Part 1', url: 'https://example.com/1', publishedAt: '2024-01-01' }],
        },
      ],
      summary: 'Focuses on practical architecture patterns',
      createdAt: new Date('2024-01-01'),
    };

    expect(profile.themes).toContain('Offline First');
    expect(profile.series).toHaveLength(1);
    expect(profile.series![0].articles[0].title).toBe('Part 1');
  });

  it('allows null series', () => {
    const profile: PublicationProfile = {
      id: 'test-id',
      themes: [],
      series: null,
      summary: null,
      createdAt: new Date(),
    };

    expect(profile.series).toBeNull();
  });
});

describe('SourceReference', () => {
  it('can be constructed with all field types', () => {
    const source: SourceReference = {
      id: 'source-1',
      type: 'voice',
      sourcePath: '/tmp/test.md',
      content: '# Hello',
      checksum: 'abc123:0',
      chunkIndex: 0,
      createdAt: new Date(),
    };

    expect(source.type).toBe('voice');
    expect(source.checksum).toContain(':');
  });
});
