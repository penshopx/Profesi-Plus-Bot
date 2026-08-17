/**
 * Inline attempt-stats line on Kelola Quiz rows.
 *
 * Covers the reviewer-flagged gap: once the bulk stats query has resolved,
 * every row must show a stats line — including a freshly created quiz that
 * has no matching aggregate entry yet (treated as zero attempts).
 */
import { formatQuizStatsLine } from '../lib/quizStats';

describe('formatQuizStatsLine', () => {
  it('returns null while stats are still loading', () => {
    expect(formatQuizStatsLine(undefined, false)).toBeNull();
  });

  it('shows zero-attempt text for a quiz missing from the loaded stats list (newly created quiz)', () => {
    expect(formatQuizStatsLine(undefined, true)).toEqual({
      text: 'Belum ada percobaan',
      hasActivity: false,
    });
  });

  it('shows zero-attempt text for an explicit zero aggregate', () => {
    expect(
      formatQuizStatsLine({ quizId: 1, totalAttempts: 0, avgScore: 0, passRate: 0 }, true),
    ).toEqual({ text: 'Belum ada percobaan', hasActivity: false });
  });

  it('shows attempts and pass rate when there is activity', () => {
    expect(
      formatQuizStatsLine({ quizId: 2, totalAttempts: 7, avgScore: 61, passRate: 43 }, true),
    ).toEqual({ text: '7 percobaan · 43% lulus', hasActivity: true });
  });

  it('shows a stale cached entry even before the fresh fetch resolves', () => {
    expect(
      formatQuizStatsLine({ quizId: 3, totalAttempts: 1, avgScore: 100, passRate: 100 }, false),
    ).toEqual({ text: '1 percobaan · 100% lulus', hasActivity: true });
  });
});
