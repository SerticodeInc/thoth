import type { Article } from '../../domain/entities/article.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { ArticleRepository } from '../../domain/repositories/article-repository.ts';
import type { MediumAdapter } from '../../domain/repositories/medium-adapter.ts';
import type { LoggerPort } from '../ports/logger.ts';

export class PublishArticleUseCase {
  constructor(
    private readonly articleRepository: ArticleRepository,
    private readonly mediumAdapter: MediumAdapter,
    private readonly logger: LoggerPort,
  ) {}

  async execute(articleId: string): Promise<Result<Article>> {
    const articleResult = await this.articleRepository.get(articleId);
    if (!articleResult.ok) return articleResult;
    if (!articleResult.value) {
      return { ok: false, error: `Article not found: ${articleId}` };
    }

    const article = articleResult.value;

    this.logger.info(
      { articleId, title: article.title },
      'Publishing article to Medium...',
    );

    const publishResult = await this.mediumAdapter.publish({
      title: article.title,
      content: article.content,
    });

    if (!publishResult.ok) return publishResult;

    const { mediumUrl } = publishResult.value;

    const updatedArticle: Article = {
      ...article,
      mediumUrl,
      status: 'published',
      updatedAt: new Date(),
    };

    this.logger.info({ articleId, mediumUrl }, 'Article published to Medium.');

    return this.articleRepository.save(updatedArticle);
  }
}
