import { readFileSync, readdirSync, statSync, realpathSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { SourceReference, SourceType } from '../../domain/entities/source-reference.ts';
import { chunkText } from '../../application/services/embedding.service.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { sanitizePath } from '../logging/path-utils.ts';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function importFromPath(
  sourcePath: string,
  type: SourceType,
): Promise<SourceReference[]> {
  const resolvedPath = realpathSync(sourcePath);
  const stat = statSync(resolvedPath);

  if (stat.isDirectory()) {
    return importFromDirectory(resolvedPath, type);
  }

  return importFile(resolvedPath, type);
}

async function importFromDirectory(dirPath: string, type: SourceType, visited?: Set<string>): Promise<SourceReference[]> {
  const resolvedDir = realpathSync(dirPath);
  if (!visited) visited = new Set<string>();
  if (visited.has(resolvedDir)) return [];
  visited.add(resolvedDir);

  const entries = readdirSync(resolvedDir);
  const results: SourceReference[] = [];

  for (const entry of entries) {
    const entryPath = join(resolvedDir, entry);
    let resolvedPath: string;
    try {
      resolvedPath = realpathSync(entryPath);
    } catch {
      continue;
    }

    const stat = statSync(resolvedPath);

    if (stat.isDirectory()) {
      const nested = await importFromDirectory(resolvedPath, type, visited);
      results.push(...nested);
      continue;
    }

    const ext = extname(resolvedPath).toLowerCase();
    if (ext !== '.md' && ext !== '.txt') continue;

    const sources = importFile(resolvedPath, type);
    results.push(...sources);
  }

  return results;
}

function importFile(filePath: string, type: SourceType): SourceReference[] {
  const stat = statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    logger.warn({ file: sanitizePath(filePath), size: stat.size }, 'File exceeds maximum size, skipping');
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const checksum = createHash('sha256').update(content).digest('hex');
  const chunks = chunkText(content);

  logger.info(
    {
      file: sanitizePath(filePath),
      chunks: chunks.length,
      totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
    },
    'Importing file',
  );

  return chunks.map((chunk) => ({
    id: randomUUID(),
    type,
    sourcePath: filePath,
    content: chunk.content,
    checksum: `${checksum}:${chunk.index}`,
    chunkIndex: chunk.index,
    createdAt: new Date(),
  }));
}
