import type { Series } from '../entities/series.ts';
import type { Result } from '../entities/result.ts';

export interface SeriesRepository {
  save(series: Series): Promise<Result<Series>>;
  get(id: string): Promise<Result<Series | null>>;
  list(): Promise<Result<Series[]>>;
  addArticle(seriesId: string, articleId: string): Promise<Result<void>>;
  removeArticle(seriesId: string, articleId: string): Promise<Result<void>>;
}
