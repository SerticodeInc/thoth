/**
 * Post-processes AI-generated text to enforce style rules.
 * - Replaces em dashes with commas (or semicolons where appropriate)
 * - Logs warnings for potential Oxford comma usage (best-effort detection)
 */
export function sanitizeText(text: string): string {
  let sanitized = text
    // Replace em dash unicode character
    .replace(/—/g, ', ')
    // Replace en dash unicode character
    .replace(/–/g, '-')
    // Replace triple-hyphen em dash stand-in
    .replace(/---/g, ', ')
    // Replace double-hyphen em dash stand-in (but not in markdown frontmatter)
    .replace(/(?<!-)--(?!-)/g, ', ')
    // Clean up double commas that might result from replacement
    .replace(/,\s*,/g, ',')
    // Clean up space before comma
    .replace(/\s+,/g, ',')
    // Normalize multiple spaces
    .replace(/ {2,}/g, ' ');

  return sanitized;
}

const OXFORD_COMMA_PATTERN = /\b\w+,\s(?:and|or)\s\w+/gi;

export function checkOxfordCommas(text: string): string[] {
  const warnings: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(new RegExp(OXFORD_COMMA_PATTERN.source, 'gi'));
    for (const match of matches) {
      warnings.push(`line ${i + 1}: "${match[0].trim()}"`);
    }
  }
  return warnings;
}
