/**
 * Component tests: ClaimCard
 *
 * Uses react-test-renderer (legacy root) instead of @testing-library/react-native
 * to avoid the act()-scope leakage that ConcurrentRoot + React Query triggers in
 * React 19. Each test creates an isolated renderer instance and tears it down
 * synchronously.
 *
 * Acceptance criteria (Task #83):
 *   1. Valid orderId + matching email → green success banner appears; the
 *      creditsGranted count is shown; onSuccess (balance-refresh) fires.
 *   2. Wrong email → 404 → red error banner shows the Indonesian error message;
 *      onSuccess is NOT called.
 *   3. Already-claimed order → blue "sudah dikreditkan" banner.
 *   4. Submit guard: claimPayment is NOT called when either field is blank.
 *   5. Fields clear after a successful claim.
 *   6. The error banner disappears when a subsequent submission succeeds.
 *
 * Isolation note
 * ──────────────
 * The button press and the async mutation wait MUST be in the same act() scope
 * so React commits the state update from onSuccess/onError before we query the
 * tree. Separate act() calls leave a gap that loses the commit.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the API module (network boundary) ────────────────────────────────────
jest.mock('@/lib/api', () => ({
  claimPayment: jest.fn(),
  // Mirror the real heuristic: connectivity failures carry no HTTP status.
  isNetworkError: jest.fn((err: unknown) =>
    err instanceof Error &&
    (err as Error & { status?: number }).status == null &&
    /network request failed/i.test(err.message)),
}));

// ── Mock useNetworkState (native expo-network won't load under Node) ─────────
// Tests flip `mockIsOnline` and re-render to simulate connectivity changes.
let mockIsOnline = true;
jest.mock('@/hooks/useNetworkState', () => ({
  useNetworkState: () => ({ isOnline: mockIsOnline, isChecking: false }),
}));

// ── Mock useColors to return a minimal palette ────────────────────────────────
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    card: '#fff',
    border: '#ccc',
    foreground: '#000',
    mutedForeground: '#888',
    muted: '#f5f5f5',
    primary: '#0B70C1',
    primaryForeground: '#fff',
  }),
}));

import { ClaimCard } from '@/components/ClaimCard';
import { claimPayment } from '@/lib/api';

const mockClaimPayment = claimPayment as jest.MockedFunction<typeof claimPayment>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a single element by testID in the rendered tree (throws if absent). */
function byTestId(root: ReactTestRenderer, testId: string) {
  return root.root.findByProps({ testID: testId });
}

/** Try to find a testID element; returns null if absent. */
function queryByTestId(root: ReactTestRenderer, testId: string) {
  try {
    return root.root.findByProps({ testID: testId });
  } catch {
    return null;
  }
}

/**
 * Fill both fields and press submit, waiting for the async mutation to settle.
 *
 * The two-phase approach is required:
 *   Phase 1 — commit the input state before the button is pressed.
 *              React's state update for onChangeText must be committed so the
 *              mutationFn closure captures the non-empty values.
 *   Phase 2 — press the button and wait 200ms inside the same act() scope so
 *              React commits the onSuccess/onError state update before we query.
 */
async function submitForm(
  root: ReactTestRenderer,
  orderId: string,
  email: string,
) {
  // Phase 1: commit input state
  await act(async () => {
    byTestId(root, 'input-order-id').props.onChangeText?.(orderId);
    byTestId(root, 'input-email').props.onChangeText?.(email);
  });
  // Phase 2: press + wait for mutation
  await act(async () => {
    byTestId(root, 'btn-klaim').props.onPress?.();
    await new Promise<void>((r) => setTimeout(r, 200));
  });
}

/**
 * Render ClaimCard inside a fresh QueryClient, run `cb`, then tear down.
 * client.clear() before unmount cancels any remaining React Query subscriptions.
 */
async function withCard(
  onSuccess: jest.Mock,
  cb: (root: ReactTestRenderer) => Promise<void>,
) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, gcTime: 0 },
    },
  });

  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <ClaimCard onSuccess={onSuccess} />
      </QueryClientProvider>,
    );
  });

  await cb(root);

  client.clear();
  await act(async () => { root.unmount(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline = true;
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Happy path: valid order ID + matching email
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard — valid orderId + matching email (success scenario)', () => {
  it('shows the green success banner after a successful claim', async () => {
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 3 });

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'INV-20240812-001', 'tono@example.com');

      expect(byTestId(root, 'banner-success')).toBeTruthy();
      expect(queryByTestId(root, 'banner-error')).toBeNull();
    });
  });

  it('success banner text includes the creditsGranted number', async () => {
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 7 });

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-777', 'user@example.com');

      // Stringify the entire tree and search for the credit count
      const json = JSON.stringify(root.toJSON());
      expect(json).toContain('7');
      expect(json).toContain('kredit Exum');
    });
  });

  it('calls the API with the exact orderId and email the user typed', async () => {
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 5 });

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-ABCDE', 'buyer@mail.com');

      expect(mockClaimPayment).toHaveBeenCalledWith('INV-ABCDE', 'buyer@mail.com');
    });
  });

  it('invokes onSuccess (balance-refresh callback) after a successful claim', async () => {
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 2 });

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'ORD-001', 'user@example.com');

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('clears both input fields after a successful claim', async () => {
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 1 });

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'ORD-CLEAR', 'clear@example.com');

      expect(byTestId(root, 'input-order-id').props.value).toBe('');
      expect(byTestId(root, 'input-email').props.value).toBe('');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Wrong email: 404 → red error banner
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard — wrong email (404 error banner scenario)', () => {
  const ERROR_MSG = 'Pesanan tidak ditemukan. Pastikan ID pesanan dan email pembelian benar.';

  it('shows the red error banner with the Indonesian error message when email does not match', async () => {
    mockClaimPayment.mockRejectedValueOnce(new Error(ERROR_MSG));

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-20240812-001', 'wrong@example.com');

      expect(byTestId(root, 'banner-error')).toBeTruthy();
      expect(byTestId(root, 'text-error-msg').props.children).toBe(ERROR_MSG);
      expect(queryByTestId(root, 'banner-success')).toBeNull();
    });
  });

  it('does not call onSuccess when the claim fails with a wrong email', async () => {
    mockClaimPayment.mockRejectedValueOnce(new Error(ERROR_MSG));

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'INV-20240812-001', 'wrong@example.com');

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('shows an error banner for a non-existent order ID', async () => {
    mockClaimPayment.mockRejectedValueOnce(new Error(ERROR_MSG));

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'NONEXISTENT-999', 'user@example.com');

      expect(byTestId(root, 'banner-error')).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Already-claimed order → blue banner
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard — already-claimed order (blue banner)', () => {
  it('shows the blue "sudah dikreditkan" banner when alreadyClaimed is true', async () => {
    mockClaimPayment.mockResolvedValueOnce({
      ok: true,
      creditsGranted: 0,
      alreadyClaimed: true,
    });

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-CLAIMED', 'owner@example.com');

      expect(byTestId(root, 'banner-already-claimed')).toBeTruthy();
      expect(queryByTestId(root, 'banner-success')).toBeNull();
      expect(queryByTestId(root, 'banner-error')).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Submit guard: disabled until both fields are filled
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard — submit guard', () => {
  /** Press the button only when enabled — mirrors what Pressable does with disabled={true}. */
  function pressIfEnabled(root: ReactTestRenderer) {
    const btn = byTestId(root, 'btn-klaim');
    if (!btn.props.disabled) btn.props.onPress?.();
  }

  it('does not call claimPayment when submit is pressed with empty fields', async () => {
    await withCard(jest.fn(), async (root) => {
      await act(async () => { pressIfEnabled(root); });
      expect(mockClaimPayment).not.toHaveBeenCalled();
    });
  });

  it('does not call claimPayment when only orderId is filled', async () => {
    await withCard(jest.fn(), async (root) => {
      await act(async () => {
        byTestId(root, 'input-order-id').props.onChangeText?.('INV-001');
      });
      await act(async () => { pressIfEnabled(root); });
      expect(mockClaimPayment).not.toHaveBeenCalled();
    });
  });

  it('does not call claimPayment when only email is filled', async () => {
    await withCard(jest.fn(), async (root) => {
      await act(async () => {
        byTestId(root, 'input-email').props.onChangeText?.('user@example.com');
      });
      await act(async () => { pressIfEnabled(root); });
      expect(mockClaimPayment).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5 — State transitions between attempts
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6 — Offline handling (Task #167)
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard — offline handling', () => {
  const OFFLINE_MSG = 'Tidak ada koneksi internet. Coba lagi saat online.';

  /**
   * Render ClaimCard and return the root plus a `rerender` that re-commits the
   * same element tree so the component picks up a flipped `mockIsOnline`.
   */
  async function withOfflineCard(
    onSuccess: jest.Mock,
    cb: (root: ReactTestRenderer, rerender: () => Promise<void>) => Promise<void>,
  ) {
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false, gcTime: 0 },
      },
    });
    // Build a FRESH element on every render — passing the same element
    // reference to root.update() makes React bail out without re-rendering,
    // so the component would never observe a flipped mockIsOnline.
    const makeElement = () => (
      <QueryClientProvider client={client}>
        <ClaimCard onSuccess={onSuccess} />
      </QueryClientProvider>
    );
    let root!: ReactTestRenderer;
    await act(async () => { root = create(makeElement()); });
    const rerender = async () => {
      await act(async () => {
        root.update(makeElement());
        await new Promise<void>((r) => setTimeout(r, 200));
      });
    };
    await cb(root, rerender);
    client.clear();
    await act(async () => { root.unmount(); });
  }

  it('known-offline submit shows the Indonesian offline message without calling the API, and keeps inputs filled', async () => {
    mockIsOnline = false;

    await withOfflineCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-OFF-1', 'off@example.com');

      expect(mockClaimPayment).not.toHaveBeenCalled();
      expect(byTestId(root, 'text-error-msg').props.children).toBe(OFFLINE_MSG);
      // Inputs preserved so the user doesn't have to re-type
      expect(byTestId(root, 'input-order-id').props.value).toBe('INV-OFF-1');
      expect(byTestId(root, 'input-email').props.value).toBe('off@example.com');
    });
  });

  it('shows the offline message (not the raw error) when the fetch throws a network error', async () => {
    mockClaimPayment.mockRejectedValueOnce(new Error('Network request failed'));

    await withOfflineCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-OFF-2', 'off2@example.com');

      expect(byTestId(root, 'text-error-msg').props.children).toBe(OFFLINE_MSG);
      expect(byTestId(root, 'input-order-id').props.value).toBe('INV-OFF-2');
    });
  });

  it('retries exactly once when connectivity transitions from offline to online', async () => {
    mockIsOnline = false;
    mockClaimPayment.mockResolvedValueOnce({ ok: true, creditsGranted: 4 });

    const onSuccess = jest.fn();
    await withOfflineCard(onSuccess, async (root, rerender) => {
      // Submit while offline → queued, no API call
      await submitForm(root, 'INV-RETRY', 'retry@example.com');
      expect(mockClaimPayment).not.toHaveBeenCalled();

      // Connectivity restored → single automatic retry
      mockIsOnline = true;
      await rerender();

      expect(mockClaimPayment).toHaveBeenCalledTimes(1);
      expect(mockClaimPayment).toHaveBeenCalledWith('INV-RETRY', 'retry@example.com');
      expect(byTestId(root, 'banner-success')).toBeTruthy();
      expect(onSuccess).toHaveBeenCalledTimes(1);

      // Further re-renders while online do not retry again
      await rerender();
      expect(mockClaimPayment).toHaveBeenCalledTimes(1);
    });
  });

  it('does not retry after a network error while the hook still reports online (no offline→online transition)', async () => {
    mockClaimPayment.mockRejectedValueOnce(new Error('Network request failed'));

    await withOfflineCard(jest.fn(), async (root, rerender) => {
      await submitForm(root, 'INV-NOLOOP', 'noloop@example.com');
      expect(mockClaimPayment).toHaveBeenCalledTimes(1);

      // Still "online" — no transition, so no retry loop
      await rerender();
      await rerender();
      expect(mockClaimPayment).toHaveBeenCalledTimes(1);
      expect(byTestId(root, 'text-error-msg').props.children).toBe(OFFLINE_MSG);
    });
  });
});

describe('ClaimCard — state transitions', () => {
  it('clears the error banner when a subsequent submission succeeds', async () => {
    const ERR = 'Pesanan tidak ditemukan. Pastikan ID pesanan dan email pembelian benar.';
    mockClaimPayment
      .mockRejectedValueOnce(new Error(ERR))
      .mockResolvedValueOnce({ ok: true, creditsGranted: 3 });

    await withCard(jest.fn(), async (root) => {
      // First attempt: wrong email → error banner
      await submitForm(root, 'INV-001', 'wrong@example.com');
      expect(byTestId(root, 'banner-error')).toBeTruthy();

      // Second attempt: correct email → success banner; error banner gone
      await submitForm(root, 'INV-001', 'right@example.com');
      expect(byTestId(root, 'banner-success')).toBeTruthy();
      expect(queryByTestId(root, 'banner-error')).toBeNull();
    });
  });
});
