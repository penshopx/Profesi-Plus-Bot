/**
 * Parent/query synchronization for retry-safe Exum failures (Task #206)
 *
 * The server keeps the PREVIOUS Exum document in the conversation row when a
 * regeneration fails (nothing new is persisted). The ChatScreen sync effect
 * normally rehydrates `convData.exumContent` into local state — so after a
 * retry-safe failed regeneration, a conversation refetch could silently
 * resurface exactly the stale content the failure path cleared.
 *
 * This integration test mounts the REAL ChatScreen (default export) with a
 * pre-existing server Exum, triggers a retry-safe failed regeneration, lets
 * the invalidated conversation query refetch (still returning the old Exum),
 * and proves the stale content does not reappear.
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
  // openExum:'true' auto-opens the Exum modal once the conversation loads.
  useLocalSearchParams: () => ({ id: '1', openExum: 'true' }),
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
  checkCompetencyAnalysisForJabker,
} from '@/lib/api';

const getConversationMock = getConversation as jest.Mock;
const generateMock = generateExum as jest.Mock;
const coverageMock = getQuizCoverage as jest.Mock;
const usageMock = getMyUsage as jest.Mock;
const analysisCheckMock = checkCompetencyAnalysisForJabker as jest.Mock;

const STALE = 'OLD-STALE-EXUM-DOCUMENT';

/** Conversation row as the server returns it — the old Exum is ALWAYS present
 * (the server keeps it when a regeneration fails). */
const CONV = {
  id: 1,
  title: 'Sesi PKB',
  phase: 'done',
  jabker: null,
  exumContent: STALE,
  messages: [
    { id: 1, role: 'user', content: 'Halo', createdAt: '2026-08-01T00:00:00Z' },
    { id: 2, role: 'assistant', content: 'Halo!', createdAt: '2026-08-01T00:00:01Z' },
  ],
};

const rendered = (root: ReactTestRenderer) => JSON.stringify(root.toJSON());

async function settle(ms = 100) {
  await act(async () => { await new Promise<void>((r) => setTimeout(r, ms)); });
}

beforeEach(() => {
  jest.clearAllMocks();
  getConversationMock.mockResolvedValue(CONV);
  coverageMock.mockResolvedValue({ gaps: [], claimsCount: 3 });
  usageMock.mockResolvedValue({ exum: { remaining: 2, limit: 3 } });
  analysisCheckMock.mockResolvedValue(true);
});

it('stale Exum does not rehydrate from a conversation refetch after a retry-safe failed regeneration', async () => {
  generateMock.mockRejectedValue(
    Object.assign(new Error('Gagal membuat Executive Summary. Kredit Anda tidak terpotong — silakan coba lagi.'), {
      status: 500,
      retrySafe: true,
    }),
  );

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

  // Modal auto-opened via openExum deep link and shows the existing (old) Exum.
  expect(rendered(root)).toContain(STALE);
  expect(getConversationMock).toHaveBeenCalled();

  // Trigger regeneration from the modal header refresh (no coverage gaps → no Alert).
  const refreshBtn = root.root.findAllByProps({ testID: 'exum-refresh-btn' })[0];
  expect(refreshBtn).toBeDefined();
  const callsBefore = getConversationMock.mock.calls.length;
  await act(async () => {
    refreshBtn.props.onPress();
    await new Promise<void>((r) => setTimeout(r, 100));
  });
  // Let the invalidated conversation query refetch (it still returns STALE).
  await settle(300);
  expect(getConversationMock.mock.calls.length).toBeGreaterThan(callsBefore);

  // The stale Exum must NOT reappear anywhere — neither in the modal nor via
  // the parent sync effect rehydrating convData.exumContent.
  const out = rendered(root);
  expect(out).not.toContain(STALE);
  // Retry-safe failure UI is shown instead.
  expect(out).toContain('tidak terpotong');
  expect(root.root.findAllByProps({ testID: 'exum-retry-btn' }).length).toBeGreaterThan(0);

  // A subsequent SUCCESSFUL retry restores normal sync behaviour.
  generateMock.mockResolvedValue({ content: 'FRESH-EXUM', conversationId: 1 });
  const retryBtn = root.root.findAllByProps({ testID: 'exum-retry-btn' })[0];
  await act(async () => {
    retryBtn.props.onPress();
    await new Promise<void>((r) => setTimeout(r, 100));
  });
  await settle(300);
  const after = rendered(root);
  expect(after).toContain('FRESH-EXUM');
  expect(after).not.toContain(STALE);

  client.clear();
  await act(async () => { root.unmount(); });
});
