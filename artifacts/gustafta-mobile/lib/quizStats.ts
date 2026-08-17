/**
 * Formats the inline attempt-stats line for a Kelola Quiz row.
 *
 * Returns null while the bulk stats query hasn't resolved yet (row renders
 * without a stats line). Once the stats list is loaded, a quiz with no
 * matching entry (e.g. freshly created before the aggregate refetch lands)
 * is treated as zero attempts rather than showing nothing.
 */
import type { QuizAggregateStats } from './api';

export function formatQuizStatsLine(
  stats: QuizAggregateStats | undefined,
  statsReady: boolean,
): { text: string; hasActivity: boolean } | null {
  if (!statsReady && !stats) return null;
  const total = stats?.totalAttempts ?? 0;
  if (total <= 0) return { text: 'Belum ada percobaan', hasActivity: false };
  return {
    text: `${total} percobaan · ${stats!.passRate}% lulus`,
    hasActivity: true,
  };
}
