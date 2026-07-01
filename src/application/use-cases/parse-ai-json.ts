import type { Result } from '../../domain/entities/result.ts';

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractJsonObject(value: string): string | null {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(value);
  const candidate = fencedMatch?.[1]?.trim() ?? value.trim();
  const start = candidate.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return candidate.slice(start, index + 1);
    }
  }

  return null;
}

export function parseJsonRecord(value: string): Result<Record<string, unknown>> {
  const json = extractJsonObject(value);
  if (json === null) return { ok: false, error: 'No JSON object found in AI response' };

  try {
    const parsed: unknown = JSON.parse(json);
    if (!isJsonRecord(parsed)) {
      return { ok: false, error: 'AI response JSON was not an object' };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'AI response JSON could not be parsed',
    };
  }
}
