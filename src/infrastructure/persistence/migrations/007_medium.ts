export const MIGRATION_007 = `-- Medium publishing support

ALTER TABLE articles ADD COLUMN medium_url TEXT;
`;
