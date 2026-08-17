/**
 * Component tests: QuizSummaryPanel ("Data Quiz Saya", mobile)
 *
 * Covers the pass/fail badge logic (badge must come from the POST attempt,
 * never the pre), delta display, pre-only state, proficiency rows, jabker
 * filtering, the empty state with its marketplace link, and the error state.
 *
 * Uses react-test-renderer directly (see .agents/memory/react-native-jest-setup.md).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/lib/api', () => ({ getMyQuizSummary: jest.fn() }));

// Controlled useQuery: each test sets mockQueryState before rendering.
let mockQueryState: { data?: unknown; isLoading: boolean; isError: boolean } = {
  data: undefined,
  isLoading: false,
  isError: false,
};
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryState,
}));

import { QuizSummaryPanel } from '@/components/QuizSummaryPanel';
import type { MyQuizSummaryEntry } from '@/lib/api';

const colors = {
  card: '#fff',
  border: '#ccc',
  background: '#fff',
  foreground: '#000',
  mutedForeground: '#888',
  primary: '#0B70C1',
} as never;

function makeEntry(overrides: Partial<MyQuizSummaryEntry> = {}): MyQuizSummaryEntry {
  return {
    quizId: 1,
    quizTitle: 'Quiz Struktur Baja',
    jabker: null,
    skkUnitCode: 'SKK.01',
    quizType: 'learning',
    passingScore: 70,
    ...overrides,
  };
}

function renderPanel(jabker?: string | null): ReactTestRenderer {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(<QuizSummaryPanel jabker={jabker} colors={colors} />);
  });
  return root;
}

function openPanel(root: ReactTestRenderer) {
  const header = root.root.find(
    (n) => n.props.accessibilityLabel === 'Tampilkan data quiz saya',
  );
  act(() => {
    header.props.onPress();
  });
}

/** Collect the string contents of every Text node, joining fragments within a node. */
function texts(root: ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: ReactTestInstance) => {
    const strings = node.children.filter((c): c is string => typeof c === 'string');
    if (strings.length > 0) out.push(strings.join(''));
    for (const child of node.children) {
      if (typeof child !== 'string') walk(child);
    }
  };
  walk(root.root);
  return out;
}

/** All rendered text joined with a separator, fragments within a node merged. */
function allText(root: ReactTestRenderer): string {
  return texts(root).join('|');
}

afterEach(() => {
  jest.clearAllMocks();
  mockQueryState = { data: undefined, isLoading: false, isError: false };
});

describe('QuizSummaryPanel', () => {
  it('learning row with pre+post: shows delta and takes the badge from the POST result', () => {
    // Pre passed but post failed — badge must be "Belum lulus" (from post).
    mockQueryState = {
      data: [
        makeEntry({
          pre: { score: 80, passed: true, completedAt: '2026-01-01' },
          post: { score: 60, passed: false, completedAt: '2026-01-02' },
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('80%');
    expect(t).toContain('60%');
    expect(t).toContain('(-20%)');
    expect(t).toContain('Belum lulus');
    // Header count: passed counts post OR pre pass → 1/1 lulus here by design,
    // but the badge itself must reflect the post failure.
    expect(t).not.toContain('Post belum dikerjakan');
  });

  it('learning row with improving pre+post shows +delta and Lulus badge from post', () => {
    mockQueryState = {
      data: [
        makeEntry({
          pre: { score: 50, passed: false, completedAt: '2026-01-01' },
          post: { score: 90, passed: true, completedAt: '2026-01-02' },
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('(+40%)');
    expect(texts(root)).toContain('Lulus');
    expect(t).toContain('1/1 lulus');
  });

  it('pre-only learning row shows "Post belum dikerjakan" and no badge', () => {
    mockQueryState = {
      data: [
        makeEntry({
          pre: { score: 55, passed: false, completedAt: '2026-01-01' },
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('Post belum dikerjakan');
    expect(t).toContain('55%');
    expect(texts(root)).not.toContain('Lulus');
    expect(t).not.toContain('Belum lulus');
    expect(t).not.toContain('(+'); // no delta without post
    expect(t).toContain('min. 70%');
  });

  it('proficiency row shows score and badge from the proficiency attempt', () => {
    mockQueryState = {
      data: [
        makeEntry({
          quizType: 'proficiency',
          passingScore: 80,
          proficiency: { score: 85, passed: true, completedAt: '2026-01-03' },
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('85%');
    expect(texts(root)).toContain('Lulus');
    expect(t).toContain('min. 80%');
    expect(t).toContain('1/1 lulus');
  });

  it('filters by jabker: keeps matching and jabker-less entries, drops others', () => {
    mockQueryState = {
      data: [
        makeEntry({
          quizId: 1,
          quizTitle: 'Quiz Ahli Jalan',
          jabker: 'Ahli Teknik Jalan',
          post: { score: 90, passed: true, completedAt: '2026-01-01' },
        }),
        makeEntry({
          quizId: 2,
          quizTitle: 'Quiz Ahli Gedung',
          jabker: 'Ahli Teknik Gedung',
          post: { score: 90, passed: true, completedAt: '2026-01-01' },
        }),
        makeEntry({
          quizId: 3,
          quizTitle: 'Quiz Umum',
          jabker: null,
          post: { score: 40, passed: false, completedAt: '2026-01-01' },
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel('Ahli Teknik Jalan');
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('Quiz Ahli Jalan');
    expect(t).toContain('Quiz Umum');
    expect(t).not.toContain('Quiz Ahli Gedung');
    expect(t).toContain('1/2 lulus');
  });

  it('without a jabker filter shows all entries', () => {
    mockQueryState = {
      data: [
        makeEntry({ quizId: 1, quizTitle: 'A', jabker: 'X', post: { score: 90, passed: true, completedAt: '' } }),
        makeEntry({ quizId: 2, quizTitle: 'B', jabker: 'Y', post: { score: 90, passed: true, completedAt: '' } }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel(null);
    openPanel(root);
    expect(allText(root)).toContain('2/2 lulus');
  });

  it('empty state shows hint text, "Belum ada quiz" count, and marketplace link', () => {
    mockQueryState = { data: [], isLoading: false, isError: false };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('Belum ada quiz');
    expect(t).toContain('Kamu belum mengerjakan quiz apapun');
    expect(t).toContain('Kerjakan quiz di Marketplace');

    const link = root.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === undefined,
    );
    act(() => {
      link.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(home)/(tabs)/marketplace');
  });

  it('jabker filter that removes everything also shows the empty state', () => {
    mockQueryState = {
      data: [
        makeEntry({ jabker: 'Ahli Teknik Gedung', post: { score: 90, passed: true, completedAt: '' } }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel('Ahli Teknik Jalan');
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('Belum ada quiz');
    expect(t).toContain('Kerjakan quiz di Marketplace');
  });

  it('error state shows the failure message and no empty-state link', () => {
    mockQueryState = { data: undefined, isLoading: false, isError: true };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    expect(t).toContain('Gagal memuat data quiz');
    expect(t).not.toContain('Kerjakan quiz di Marketplace');
    // No count in the header while there's no data
    expect(t).not.toContain('lulus');
  });

  it('loading state shows the loading hint', () => {
    mockQueryState = { data: undefined, isLoading: true, isError: false };
    const root = renderPanel();
    openPanel(root);
    expect(allText(root)).toContain('Memuat data quiz…');
  });

  it('skips cards with no attempt data at all', () => {
    mockQueryState = {
      data: [
        makeEntry({ quizId: 1, quizTitle: 'Kosong' }), // learning, no pre/post
        makeEntry({ quizId: 2, quizTitle: 'Prof Kosong', quizType: 'proficiency' }),
      ],
      isLoading: false,
      isError: false,
    };
    const root = renderPanel();
    openPanel(root);
    const t = allText(root);
    // Entries count in header, but cards render nothing without data
    expect(t).toContain('0/2 lulus');
    expect(t).not.toContain('Kosong');
  });
});
