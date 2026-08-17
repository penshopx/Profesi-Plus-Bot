/**
 * Detects the context-degradation footer the API server appends to an Exum
 * when personalisation data could not be loaded during generation.
 *
 * Server format (see api-server routes/chat):
 *   \n\n---\n*Catatan sistem: <labels> tidak dapat dimuat saat Exum ini dibuat. ...*
 *
 * We split the footer off so the UI can render it as a distinct warning
 * callout instead of ordinary body text.
 */
const DEGRADATION_FOOTER_RE = /\n+---\n\*Catatan sistem:\s*([\s\S]*?)\*\s*$/;

export interface ParsedExum {
  /** Exum content without the degradation footer. */
  body: string;
  /** Human-readable degradation notice (without the "Catatan sistem:" prefix), or null. */
  degradationNote: string | null;
}

export function parseExumDegradation(content: string): ParsedExum {
  const match = content.match(DEGRADATION_FOOTER_RE);
  if (!match) return { body: content, degradationNote: null };
  return {
    body: content.slice(0, match.index).trimEnd(),
    degradationNote: match[1].trim(),
  };
}

/**
 * Human-readable labels for the personalisation blocks the server reports in
 * `unavailableContextBlocks`. Must cover the server's monitored block ids
 * (quiz, profile, competency, kegiatan); unknown ids fall through as-is.
 */
const EXUM_BLOCK_LABELS: Record<string, string> = {
  quiz: 'data skor quiz',
  profile: 'data profil APL 01',
  competency: 'hasil analisis kompetensi (Studio Kompetensi)',
  kegiatan: 'catatan kegiatan PKB',
};

/** "profile, kegiatan" → "Data profil APL 01 dan catatan kegiatan PKB". */
export function formatExumMissingBlocks(blocks: string[]): string {
  const labels = blocks.map((b) => EXUM_BLOCK_LABELS[b] ?? b);
  const joined =
    labels.length <= 1
      ? (labels[0] ?? '')
      : `${labels.slice(0, -1).join(', ')} dan ${labels[labels.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
