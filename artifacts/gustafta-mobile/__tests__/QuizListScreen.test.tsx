/**
 * Component tests: quiz list screen (app/(home)/quiz/index.tsx)
 *
 * Covers: rendering active quizzes with type/unit meta, pass-status badges
 * merged from my-summary, navigation to /(home)/quiz/[id] on tap, and the
 * empty / loading / error states.
 *
 * Uses react-test-renderer directly (see .agents/memory/react-native-jest-setup.md).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    card: '#fff',
    border: '#ccc',
    foreground: '#000',
    mutedForeground: '#888',
    primary: '#0B70C1',
    destructive: '#DC2626',
  }),
}));
jest.mock('@/lib/api', () => ({
  listQuizzes: jest.fn(),
  getMyQuizSummary: jest.fn(),
}));

// Controlled useQuery keyed on queryKey[0]; each test sets these before render.
let mockQuizzesState: Record<string, unknown> = { data: undefined, isLoading: false, isError: false };
let mockSummaryState: Record<string, unknown> = { data: undefined, isLoading: false, isError: false };
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const base = { refetch: jest.fn(), isRefetching: false, error: null };
    return queryKey[0] === 'quizzes' ? { ...base, ...mockQuizzesState } : { ...base, ...mockSummaryState };
  },
}));

import QuizListScreen from '@/app/(home)/quiz/index';

const quiz = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Quiz Struktur Baja',
  quizType: 'learning',
  skkUnitCode: 'SKK.01',
  skkUnitName: 'Struktur Baja',
  passingScore: 70,
  ...over,
});

function render(): ReactTestRenderer {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(<QuizListScreen />);
  });
  return root;
}

function allText(root: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: ReactTestInstance) => {
    const strings = node.children.filter((c): c is string => typeof c === 'string');
    if (strings.length > 0) out.push(strings.join(''));
    for (const child of node.children) {
      if (typeof child !== 'string') walk(child);
    }
  };
  walk(root.root);
  return out.join('|');
}

afterEach(() => {
  jest.clearAllMocks();
  mockQuizzesState = { data: undefined, isLoading: false, isError: false };
  mockSummaryState = { data: undefined, isLoading: false, isError: false };
});

describe('QuizListScreen', () => {
  it('renders quizzes with type, unit, and passing score', () => {
    mockQuizzesState = {
      data: [quiz(), quiz({ id: 2, title: 'Uji Ahli Jalan', quizType: 'proficiency', skkUnitCode: null, skkUnitName: null })],
      isLoading: false,
      isError: false,
    };
    const t = allText(render());
    expect(t).toContain('Quiz Struktur Baja');
    expect(t).toContain('Learning Quiz');
    expect(t).toContain('Unit: SKK.01 — Struktur Baja');
    expect(t).toContain('Uji Ahli Jalan');
    expect(t).toContain('Proficiency Quiz');
    expect(t).toContain('Nilai lulus 70%');
  });

  it('shows pass status badges merged from my-summary', () => {
    mockQuizzesState = {
      data: [quiz({ id: 1 }), quiz({ id: 2, title: 'B' }), quiz({ id: 3, title: 'C' })],
      isLoading: false,
      isError: false,
    };
    mockSummaryState = {
      data: [
        // quiz 1: post passed → Lulus
        { quizId: 1, quizType: 'learning', pre: { score: 50, passed: false }, post: { score: 90, passed: true } },
        // quiz 2: attempted but not passed → Belum lulus
        { quizId: 2, quizType: 'learning', pre: { score: 40, passed: false } },
        // quiz 3: no entry → no badge
      ],
      isLoading: false,
      isError: false,
    };
    const t = allText(render());
    expect(t).toContain('Lulus');
    expect(t).toContain('Belum lulus');
  });

  it('navigates to the quiz screen on tap', () => {
    mockQuizzesState = { data: [quiz({ id: 7, title: 'Kuis Tujuh' })], isLoading: false, isError: false };
    const root = render();
    const card = root.root.find((n) => n.props.accessibilityLabel === 'Buka kuis Kuis Tujuh');
    act(() => {
      card.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(home)/quiz/7');
  });

  it('shows the empty state when no quizzes are active', () => {
    mockQuizzesState = { data: [], isLoading: false, isError: false };
    expect(allText(render())).toContain('Belum ada kuis yang tersedia');
  });

  it('shows the loading state', () => {
    mockQuizzesState = { data: undefined, isLoading: true, isError: false };
    expect(allText(render())).toContain('Memuat kuis…');
  });

  it('shows the error state with the server message', () => {
    mockQuizzesState = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Server mati'),
    };
    expect(allText(render())).toContain('Server mati');
  });
});
