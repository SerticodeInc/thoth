import { randomUUID } from 'node:crypto';
import type { SeriesRepository } from '../../domain/repositories/series-repository.ts';
import type { Series } from '../../domain/entities/series.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { LoggerPort } from '../ports/logger.ts';

export class SeriesUseCase {
  constructor(
    private readonly seriesRepo: SeriesRepository,
    private readonly logger: LoggerPort,
  ) {}

  async create(name: string, description?: string): Promise<Result<Series>> {
    const series: Series = {
      id: randomUUID(),
      name,
      description: description ?? null,
      articleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.seriesRepo.save(series);
    if (!result.ok) return result;

    this.logger.info({ seriesId: series.id, name }, 'Series created');
    return { ok: true, value: series };
  }

  async list(): Promise<Result<Series[]>> {
    return this.seriesRepo.list();
  }

  async get(id: string): Promise<Result<Series | null>> {
    return this.seriesRepo.get(id);
  }

  async addArticle(seriesId: string, articleId: string): Promise<Result<void>> {
    const seriesResult = await this.seriesRepo.get(seriesId);
    if (!seriesResult.ok) return { ok: false, error: seriesResult.error };
    if (!seriesResult.value) return { ok: false, error: `Series not found: ${seriesId}` };

    const result = await this.seriesRepo.addArticle(seriesId, articleId);
    if (!result.ok) return result;

    this.logger.info({ seriesId, articleId }, 'Article added to series');
    return { ok: true, value: undefined };
  }
}
