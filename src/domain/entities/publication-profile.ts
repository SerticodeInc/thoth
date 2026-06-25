export interface ArticleReference {
  readonly title: string;
  readonly url: string | null;
  readonly publishedAt: string | null;
}

export interface SeriesReference {
  readonly name: string;
  readonly articles: ArticleReference[];
}

export interface PublicationProfile {
  readonly id: string;
  readonly themes: string[];
  readonly series: SeriesReference[] | null;
  readonly summary: string | null;
  readonly createdAt: Date;
}
