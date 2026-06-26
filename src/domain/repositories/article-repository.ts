import type { Article } from '../entities/article.ts';
import type { Result } from '../entities/result.ts';

export interface ArticleRepository {
  save(article: Article): Promise<Result<Article>>;
  get(id: string): Promise<Result<Article | null>>;
  list(): Promise<Result<Article[]>>;
}
