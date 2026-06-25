import { get_encoding } from 'tiktoken';

const enc = get_encoding('cl100k_base');

export interface Chunk {
  readonly content: string;
  readonly index: number;
  readonly tokenCount: number;
}

export function chunkText(text: string, maxTokens = 512, overlap = 50): Chunk[] {
  if (overlap >= maxTokens) overlap = maxTokens - 1;
  const tokens = enc.encode(text);
  const chunks: Chunk[] = [];

  if (tokens.length <= maxTokens) {
    chunks.push({ content: text, index: 0, tokenCount: tokens.length });
    return chunks;
  }

  let start = 0;
  let chunkIndex = 0;

  while (start < tokens.length) {
    const end = Math.min(start + maxTokens, tokens.length);
    const chunkTokens = tokens.slice(start, end);
    const content = new TextDecoder().decode(enc.decode(chunkTokens));

    chunks.push({
      content,
      index: chunkIndex,
      tokenCount: chunkTokens.length,
    });

    chunkIndex++;
    start += maxTokens - overlap;

    if (start >= tokens.length) break;
  }

  return chunks;
}
