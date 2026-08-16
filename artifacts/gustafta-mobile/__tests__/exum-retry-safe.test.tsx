/**
 * Exum retry-safe failure handling (Task #206)
 *
 * The server sets `retrySafe: true` on generate-exum failures ONLY when the
 * credit refund was confirmed and no partial Exum was persisted. These tests
 * prove the mobile ExumModal honours that contract:
 *   1. retrySafe failure → clears stale content, shows the "credits not lost"
 *      reassurance + "Coba lagi" retry button, and notifies the parent
 *      (onGenerationFailedSafely) so cached Exum content is dropped.
 *   2. NON-retrySafe failure (refund not confirmed) → NO retry button (only
 *      "Tutup"), no reassurance text, and the parent is NOT notified.
 *
 * Uses react-test-renderer directly (see react-native-jest-setup memory).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

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
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('expo-av', () => ({ Audio: {} }));
jest.mock('@clerk/expo', () => ({ useAuth: () => ({ getToken: jest.fn() }) }));
jest.mock('@/hooks/useColors', () => ({
  useColors: () => COLORS,
}));
jest.mock('@/hooks/useNetworkState', () => ({ useNetworkState: () => ({ isOnline: true }) }));
jest.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@/components/QuizSummaryPanel', () => ({ QuizSummaryPanel: () => null }));
jest.mock('@/lib/project-brain-usage', () => ({ saveProjectBrainUsage: jest.fn() }));
jest.mock('@/lib/api'); // auto-mock: every export becomes jest.fn()

const COLORS = {
  background: '#fff', card: '#fff', border: '#ccc', foreground: '#000',
  mutedForeground: '#888', muted: '#f5f5f5', primary: '#0B70C1',
  primaryForeground: '#fff', destructive: '#DC2626', accent: '#F59E0B',
};

import { ExumModal } from '@/app/(home)/chat/[id]';
import { generateExum, getQuizCoverage } from '@/lib/api';

const generateMock = generateExum as jest.Mock;
const coverageMock = getQuizCoverage as jest.Mock;

function apiError(message: string, status: number, retrySafe: boolean) {
  return Object.assign(new Error(message), { status, retrySafe });
}

async function mountModal(props: Partial<React.ComponentProps<typeof ExumModal>> = {}) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <ExumModal
        visible
        conversationId={1}
        onClose={jest.fn()}
        colors={COLORS as never}
        {...props}
      />,
    );
    await new Promise<void>((r) => setTimeout(r, 50));
  });
  return root;
}

const rendered = (root: ReactTestRenderer) => JSON.stringify(root.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  // Coverage gate passes cleanly → generation starts immediately.
  coverageMock.mockResolvedValue({ gaps: [], claimsCount: 3 });
});

describe('ExumModal retry-safe failure handling', () => {
  it('safe failure (retrySafe:true): shows reassurance + retry, clears stale content, notifies parent', async () => {
    generateMock.mockRejectedValue(
      apiError('Gagal membuat Executive Summary. Kredit Anda tidak terpotong — silakan coba lagi.', 500, true),
    );
    const onGenerationFailedSafely = jest.fn();
    const root = await mountModal({
      existingContent: null,
      onGenerationFailedSafely,
    });

    const out = rendered(root);
    expect(out).toContain('tidak terpotong');
    expect(out).toContain('Coba lagi');
    expect(root.root.findAllByProps({ testID: 'exum-retry-btn' }).length).toBeGreaterThan(0);
    expect(root.root.findAllByProps({ testID: 'exum-error-close-btn' })).toHaveLength(0);
    expect(onGenerationFailedSafely).toHaveBeenCalled();

    // Retry re-invokes generation and resets to a clean generating state.
    generateMock.mockClear();
    generateMock.mockResolvedValue({ content: 'FRESH EXUM', conversationId: 1 });
    const retryBtn = root.root.findAllByProps({ testID: 'exum-retry-btn' })[0];
    await act(async () => {
      retryBtn.props.onPress();
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(generateMock).toHaveBeenCalledTimes(1);
    const after = rendered(root);
    expect(after).toContain('FRESH EXUM');
    expect(after).not.toContain('tidak terpotong');

    await act(async () => { root.unmount(); });
  });

  it('unsafe failure (no retrySafe): offers only Tutup, no reassurance, parent not notified', async () => {
    generateMock.mockRejectedValue(
      apiError('Gagal membuat Executive Summary. Jika kredit Anda terpotong, hubungi admin.', 500, false),
    );
    const onGenerationFailedSafely = jest.fn();
    const onClose = jest.fn();
    const root = await mountModal({ onGenerationFailedSafely, onClose });

    const out = rendered(root);
    expect(out).not.toContain('tidak terpotong — aman');
    expect(root.root.findAllByProps({ testID: 'exum-retry-btn' })).toHaveLength(0);
    const closeBtns = root.root.findAllByProps({ testID: 'exum-error-close-btn' });
    expect(closeBtns.length).toBeGreaterThan(0);
    expect(onGenerationFailedSafely).not.toHaveBeenCalled();

    await act(async () => { closeBtns[0].props.onPress(); });
    expect(onClose).toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });

  it('safe failure during regeneration clears previously displayed content', async () => {
    // Modal opens in done phase with an existing Exum; regeneration fails
    // retry-safe → the stale Exum must no longer be rendered.
    generateMock.mockRejectedValue(apiError('Gagal membuat Executive Summary.', 500, true));
    const onGenerationFailedSafely = jest.fn();
    const root = await mountModal({
      existingContent: 'OLD-STALE-EXUM-CONTENT',
      onGenerationFailedSafely,
    });
    expect(rendered(root)).toContain('OLD-STALE-EXUM-CONTENT');

    const refreshBtn = root.root.findAllByProps({ testID: 'exum-refresh-btn' })[0];
    await act(async () => {
      refreshBtn.props.onPress();
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    const out = rendered(root);
    expect(out).not.toContain('OLD-STALE-EXUM-CONTENT');
    expect(out).toContain('Coba lagi');
    expect(onGenerationFailedSafely).toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });
});
