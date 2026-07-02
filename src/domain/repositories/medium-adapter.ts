import type { Result } from '../entities/result.ts';

export interface MediumPublishParams {
  readonly title: string;
  readonly content: string;
  readonly subtitle?: string;
}

export interface MediumPublishResult {
  readonly mediumPostId: string;
  readonly mediumUrl: string;
}

export interface MediumConnectParams {
  readonly sid: string;
  readonly uid: string;
}

export interface MediumAdapter {
  connect(params: MediumConnectParams): Promise<Result<void>>;
  isAuthenticated(): Promise<boolean>;
  publish(params: MediumPublishParams): Promise<Result<MediumPublishResult>>;
}
