import { getDatabase } from './persistence/database.ts';
import { closeDatabase } from './persistence/database.ts';
import { OpenAiAiService } from './ai/ai.service.ts';
import { getActiveEmbeddingProviderKey } from './ai/provider.ts';
import { logger } from './logging/logger.ts';
import { FileSourceAdapter } from './adapters/file-source.adapter.ts';

import { ResearchUseCase } from '../application/use-cases/research.usecase.ts';
import { GenerateArticleUseCase } from '../application/use-cases/generate-article.usecase.ts';
import { GenerateProfilesUseCase } from '../application/use-cases/generate-profiles.usecase.ts';
import { ImportSourcesUseCase } from '../application/use-cases/import-sources.usecase.ts';
import { ExportArticleUseCase } from '../application/use-cases/export-article.usecase.ts';
import { ExportSeriesUseCase } from '../application/use-cases/export-series.usecase.ts';
import { SeriesUseCase } from '../application/use-cases/series.usecase.ts';
import { PublishArticleUseCase } from '../application/use-cases/publish-article.usecase.ts';
import { MediumHttpAdapter } from './publishing/medium-http.adapter.ts';

import { SqliteResearchRepository } from './persistence/repositories/sqlite-research-repository.ts';
import { SqliteArticleRepository } from './persistence/repositories/sqlite-article-repository.ts';
import { SqliteProfileRepository } from './persistence/repositories/sqlite-profile-repository.ts';
import { SqliteSourceRepository } from './persistence/repositories/sqlite-source-repository.ts';
import { SqliteSeriesRepository } from './persistence/repositories/sqlite-series-repository.ts';

function providerKey(): string {
  return getActiveEmbeddingProviderKey();
}

function db() {
  return getDatabase();
}

function ai() {
  return new OpenAiAiService();
}

export function createResearchUseCase() {
  const key = providerKey();
  return new ResearchUseCase(
    ai(),
    new SqliteResearchRepository(db(), key),
    new SqliteSourceRepository(db(), key),
    logger,
  );
}

export function createGenerateArticleUseCase() {
  return new GenerateArticleUseCase(
    ai(),
    new SqliteArticleRepository(db()),
    new SqliteProfileRepository(db()),
    new SqliteResearchRepository(db()),
    logger,
  );
}

export function createGenerateProfilesUseCase() {
  const key = providerKey();
  return new GenerateProfilesUseCase(
    ai(),
    new SqliteProfileRepository(db(), key),
    new SqliteSourceRepository(db(), key),
    logger,
  );
}

export function createImportSourcesUseCase() {
  const key = providerKey();
  return new ImportSourcesUseCase(
    new SqliteSourceRepository(db(), key),
    new FileSourceAdapter(),
    ai(),
    logger,
  );
}

export function createExportArticleUseCase() {
  return new ExportArticleUseCase(new SqliteArticleRepository(db()));
}

export function createExportSeriesUseCase() {
  return new ExportSeriesUseCase(
    new SqliteSeriesRepository(db()),
    new SqliteArticleRepository(db()),
  );
}

export function createSeriesUseCase() {
  return new SeriesUseCase(new SqliteSeriesRepository(db()), logger);
}

export function createArticleRepository() {
  return new SqliteArticleRepository(db());
}

export function createSeriesRepository() {
  return new SqliteSeriesRepository(db());
}

export function createProfileRepository() {
  const key = providerKey();
  return new SqliteProfileRepository(db(), key);
}

export function createSourceRepository() {
  const key = providerKey();
  return new SqliteSourceRepository(db(), key);
}

export function createResearchRepository() {
  const key = providerKey();
  return new SqliteResearchRepository(db(), key);
}

export function createPublishArticleUseCase(): PublishArticleUseCase {
  return new PublishArticleUseCase(
    new SqliteArticleRepository(db()),
    new MediumHttpAdapter(logger),
    logger,
  );
}

export function createMediumAdapter(): MediumHttpAdapter {
  return new MediumHttpAdapter(logger);
}

export { closeDatabase as closeDb };
