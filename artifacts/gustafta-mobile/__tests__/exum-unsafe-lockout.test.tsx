/**
 * Unsafe Exum failure lockout (Task #206)
 *
 * When generate-exum fails WITHOUT a server-confirmed refund (no retrySafe
 * flag), the credit state is ambiguous. Closing the modal must NOT return the
 * user to a working generation entry point — otherwise they could immediately
 * start another chargeable generation. These tests mount the REAL ChatScreen
 * in the synthesis phase (no prior Exum) and prove:
 *   1. Unsafe failure → close modal → the "Buat Ringkasan PKB (Exum)" entry is
 *      gone, replaced by a lockout banner with admin guidance.
 *   2. The lockout clears only via the explicit "Muat ulang status kredit"
 *      action, which refetches credit/conversation state.
 *
 * Uses react-test-renderer directly (see react-native-jest-setup memory).
 */

// Node has no requestAnimationFrame; the chat screen uses it for scroll timing.
(global as Record<string, unknown>).requestAnimationFrame =
  (cb: () => void) => setTimeout(cb, 0) as unknown as number;
(global as Record<string, unknown>).cancelAnimationFrame = (h: number) => clearTimeout(h);

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock native/expo modules that cannot load under Node ─────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '1' }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-av', () => ({ Audio: { Recording: class {}, requestPermissionsAsync: jest.fn() } }));
jest.mock('@clerk/expo', () => ({ useAuth: () => ({ getToken: jest.fn().mockResolvedValue('tok') }) }));
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff', card: '#fff', border: '#ccc', foreground: '#000',
    mutedForeground: '#888', muted: '#f5f5f5', primary: '#0B70C1',
    primaryForeground: '#fff', destructive: '#DC2626', accent: '#F59E0B',
    secondary: '#EEF2FF',
  }),
}));
jest.mock('@/hooks/useNetworkState', () => ({ useNetworkState: () => ({ isOnline: true }) }));
jest.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@/components/QuizSummaryPanel', () => ({ QuizSummaryPanel: () => null }));
jest.mock('@/lib/project-brain-usage', () => ({ saveProjectBrainUsage: jest.fn() }));
jest.mock('@/lib/api'); // auto-mock: every export becomes jest.fn()

import ChatScreen from '@/app/(home)/chat/[id]';
import {
  getConversation,
  generateExum,
  getQuizCoverage,
  getMyUsage,
  getMyPlan,
  checkCompetencyAnalysisForJabker,
} from '@/lib/api';

const getConversationMock = getConversation as jest.Mock;
const generateMock = generateExum as jest.Mock;
const coverageMock = getQuizCoverage as jest.Mock;
const usageMock = getMyUsage as jest.Mock;
const planMock = getMyPlan as jest.Mock;
const analysisCheckMock = checkCompetencyAnalysisForJabker as jest.Mock;

/** Synthesis-phase conversation with NO prior Exum. */
const CONV = {
  id: 1,
  title: 'Sesi PKB',
  phase: 'synthesis',
  jabker: null,
  exumContent: null,
  messages: [
    { id: 1, role: 'user', content: 'Halo', createdAt: '2026-08-01T00:00:00Z' },
    { id: 2, role: 'assistant', content: 'Halo!', createdAt: '2026-08-01T00:00:01Z' },
  ],
};

const rendered = (root: ReactTestRenderer) => JSON.stringify(root.toJSON());
const findAllByTestID = (root: ReactTestRenderer, testID: string) =>
  root.root.findAllByProps({ testID });

async function settle(ms = 150) {
  await act(async () => { await new Promise<void>((r) => setTimeout(r, ms)); });
}

async function mountScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <ChatScreen />
      </QueryClientProvider>,
    );
    await new Promise<void>((r) => setTimeout(r, 100));
  });
  await settle(300);
  return { root, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  getConversationMock.mockResolvedValue(CONV);
  coverageMock.mockResolvedValue({ gaps: [], claimsCount: 3 });
  usageMock.mockResolvedValue({ exum: { remaining: 2, limit: 3 } });
  planMock.mockResolvedValue({ plan: 'free', exumCredits: 2, freeExumUsed: false, canGenerate: true });
  analysisCheckMock.mockResolvedValue(true);
});

it('unsafe failure locks out generation entry after closing the modal; explicit reload restores it', async () => {
  generateMock.mockRejectedValue(
    Object.assign(new Error('Gagal membuat Executive Summary. Jika kredit Anda terpotong, hubungi admin.'), {
      status: 500,
      retrySafe: false,
    }),
  );

  const { root, client } = await mountScreen();

  // Synthesis phase shows the generation entry point.
  const entry = findAllByTestID(root, 'exum-generate-entry');
  expect(entry.length).toBeGreaterThan(0);

  // Open the modal → coverage passes → generation runs and fails UNSAFELY.
  await act(async () => {
    entry[0].props.onPress();
    await new Promise<void>((r) => setTimeout(r, 100));
  });
  await settle(200);

  // Modal shows only the close action — no retry button.
  expect(findAllByTestID(root, 'exum-retry-btn')).toHaveLength(0);
  const closeBtns = findAllByTestID(root, 'exum-error-close-btn');
  expect(closeBtns.length).toBeGreaterThan(0);
  expect(rendered(root)).not.toContain('tidak terpotong — aman');

  // Close the modal.
  await act(async () => { closeBtns[0].props.onPress(); });
  await settle(100);

  // ALL generation entry points must be GONE — the synthesis banner AND the
  // persistent header "Ringkasan" button (which would auto-start generation).
  expect(findAllByTestID(root, 'exum-generate-entry')).toHaveLength(0);
  expect(findAllByTestID(root, 'exum-header-btn')).toHaveLength(0);
  expect(findAllByTestID(root, 'exum-unsafe-banner').length).toBeGreaterThan(0);
  expect(rendered(root)).toContain('hubungi admin');

  // Reconciliation FAILURE keeps the lock: the authoritative PLAN (credit)
  // fetch rejects → banner stays, error shown, entry points still suppressed.
  // Usage fetches succeeding is NOT enough — only the plan endpoint carries
  // the Exum credit state (exumCredits / freeExumUsed).
  planMock.mockRejectedValueOnce(new Error('network down'));
  const reloadBtn = findAllByTestID(root, 'exum-unsafe-reload-btn')[0];
  await act(async () => { reloadBtn.props.onPress(); });
  await settle(300);
  expect(findAllByTestID(root, 'exum-unsafe-banner').length).toBeGreaterThan(0);
  expect(findAllByTestID(root, 'exum-reconcile-error').length).toBeGreaterThan(0);
  expect(findAllByTestID(root, 'exum-generate-entry')).toHaveLength(0);
  expect(findAllByTestID(root, 'exum-header-btn')).toHaveLength(0);

  // Successful reconciliation (PLAN fetch resolves with credit state) clears
  // the lock and restores the entry points.
  const planCallsBefore = planMock.mock.calls.length;
  const reloadBtn2 = findAllByTestID(root, 'exum-unsafe-reload-btn')[0];
  await act(async () => { reloadBtn2.props.onPress(); });
  await settle(300);
  expect(planMock.mock.calls.length).toBeGreaterThan(planCallsBefore);
  expect(findAllByTestID(root, 'exum-unsafe-banner')).toHaveLength(0);
  expect(findAllByTestID(root, 'exum-generate-entry').length).toBeGreaterThan(0);
  expect(findAllByTestID(root, 'exum-header-btn').length).toBeGreaterThan(0);

  client.clear();
  await act(async () => { root.unmount(); });
});

it('safe failure does NOT lock out the generation entry point', async () => {
  generateMock.mockRejectedValue(
    Object.assign(new Error('Gagal membuat Executive Summary. Kredit Anda tidak terpotong — silakan coba lagi.'), {
      status: 500,
      retrySafe: true,
    }),
  );

  const { root, client } = await mountScreen();
  const entry = findAllByTestID(root, 'exum-generate-entry');
  await act(async () => {
    entry[0].props.onPress();
    await new Promise<void>((r) => setTimeout(r, 100));
  });
  await settle(200);

  // Retry-safe failure → retry button is offered in the modal.
  const retryBtns = findAllByTestID(root, 'exum-retry-btn');
  expect(retryBtns.length).toBeGreaterThan(0);

  client.clear();
  await act(async () => { root.unmount(); });
});
