import { describe, it, expect } from 'vitest';
import { chunkText } from '../../../src/application/services/embedding.service.ts';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const text = 'Hello, world!';
    const chunks = chunkText(text, 512);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      content: 'Hello, world!',
    });
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into multiple chunks', () => {
    const text = 'word '.repeat(2000);
    const chunks = chunkText(text, 512);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
  });

  it('respects the overlap parameter', () => {
    const text = 'word '.repeat(2000);
    const chunks = chunkText(text, 512, 50);

    const totalNoOverlap = Math.ceil(2000 / 512);
    expect(chunks.length).toBeGreaterThanOrEqual(totalNoOverlap);
  });

  it('handles empty text by returning a single empty chunk', () => {
    const chunks = chunkText('', 512);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('');
  });
});
