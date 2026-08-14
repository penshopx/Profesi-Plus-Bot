/**
 * Component test: QuestionStatCard (quiz-stats screen)
 *
 * Verifies that answers referencing options that were edited/deleted after
 * users submitted attempts (staleAnswerCount / staleAnswerNote from the
 * stats endpoint) are surfaced to admins instead of silently vanishing.
 *
 * Uses react-test-renderer directly (see ClaimCard.test.tsx isolation note).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    card: '#fff',
    border: '#ccc',
    foreground: '#000',
    mutedForeground: '#888',
    muted: '#f5f5f5',
    primary: '#0B70C1',
    accent: '#F59E0B',
    destructive: '#DC2626',
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));
jest.mock('@/lib/api', () => ({ getAdminQuizStats: jest.fn() }));

import { QuestionStatCard } from '@/app/(home)/quiz-stats/[id]';
import { useColors } from '@/hooks/useColors';

const baseQuestion = {
  id: 'q1',
  text: 'Pertanyaan 1',
  options: [
    { id: 'a', text: 'Opsi A' },
    { id: 'b', text: 'Opsi B' },
  ],
  correctId: 'a',
  failRate: 50,
};

function renderCard(q: Record<string, unknown>): ReactTestRenderer {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <QuestionStatCard
        q={q as never}
        index={0}
        totalAttempts={2}
        colors={useColors()}
      />,
    );
  });
  return root;
}

function allText(root: ReactTestRenderer): string {
  return JSON.stringify(root.toJSON());
}

describe('QuestionStatCard stale answers', () => {
  it('renders the stale-answer row and note when options were edited/deleted', () => {
    const root = renderCard({
      ...baseQuestion,
      optionCounts: { a: 1, b: 0, unknown: 1 },
      staleAnswerCount: 1,
      staleAnswerNote:
        '1 jawaban merujuk opsi yang sudah diubah/dihapus setelah peserta mengerjakan.',
    });
    const text = allText(root);
    expect(text).toContain('Opsi sudah diubah/dihapus');
    expect(text).toContain('diubah/dihapus setelah peserta mengerjakan');
    root.unmount();
  });

  it('hides the stale-answer row and note when all answers map to current options', () => {
    const root = renderCard({
      ...baseQuestion,
      optionCounts: { a: 1, b: 1 },
      staleAnswerCount: 0,
      staleAnswerNote: null,
    });
    const text = allText(root);
    expect(text).not.toContain('Opsi sudah diubah/dihapus');
    root.unmount();
  });

  it('tolerates payloads missing the stale fields (older server versions)', () => {
    const root = renderCard({
      ...baseQuestion,
      optionCounts: { a: 1, b: 1 },
    });
    expect(allText(root)).not.toContain('Opsi sudah diubah/dihapus');
    root.unmount();
  });
});
