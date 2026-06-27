import type Database from 'better-sqlite3';
import type { ResearchNote, ResearchCitation } from '../../../domain/entities/research-note.ts';
import type { ResearchRepository } from '../../../domain/repositories/research-repository.ts';
import type { Result } from '../../../domain/entities/result.ts';
import { z } from 'zod';

const researchNoteRowSchema = z.object({
  id: z.string(),
  topic: z.string(),
  content: z.string(),
  citations: z.string(),
  created_at: z.string(),
}).transform((row) => ({
  id: row.id,
  topic: row.topic,
  content: row.content,
  citations: JSON.parse(row.citations) as ResearchCitation[],
  createdAt: new Date(row.created_at),
}));

export class SqliteResearchRepository implements ResearchRepository {
  constructor(private readonly db: Database.Database) {}

  save(note: ResearchNote): Promise<Result<ResearchNote>> {
    this.db
      .prepare(
        `INSERT INTO research_notes (id, topic, content, citations, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           topic = excluded.topic,
           content = excluded.content,
           citations = excluded.citations`,
      )
      .run(
        note.id,
        note.topic,
        note.content,
        JSON.stringify(note.citations),
        note.createdAt.toISOString(),
      );
    return Promise.resolve({ ok: true, value: note });
  }

  get(id: string): Promise<Result<ResearchNote | null>> {
    const row = this.db.prepare('SELECT * FROM research_notes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return Promise.resolve({ ok: true, value: null });

    const parsed = researchNoteRowSchema.safeParse(row);
    if (!parsed.success) return Promise.resolve({ ok: false, error: `Invalid research note row: ${parsed.error.message}` });
    return Promise.resolve({ ok: true, value: parsed.data });
  }

  searchByTopic(topic: string): Promise<Result<ResearchNote[]>> {
    const rows = this.db
      .prepare('SELECT * FROM research_notes WHERE topic LIKE ? ORDER BY created_at DESC')
      .all(`%${topic}%`) as Array<Record<string, unknown>>;

    const notes: ResearchNote[] = [];
    for (const row of rows) {
      const parsed = researchNoteRowSchema.safeParse(row);
      if (!parsed.success) continue;
      notes.push(parsed.data);
    }
    return Promise.resolve({ ok: true, value: notes });
  }

  saveResearchEmbedding(researchId: string, embedding: number[], model: string): Promise<Result<void>> {
    try {
      const insertVec = this.db.prepare('INSERT INTO vec_research (embedding) VALUES (?)');
      const insertEmb = this.db.prepare(
        'INSERT INTO research_embeddings (research_id, model) VALUES (?, ?)',
      );

      const doInsert = this.db.transaction(() => {
        insertVec.run(new Float32Array(embedding));
        insertEmb.run(researchId, model);
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
}
