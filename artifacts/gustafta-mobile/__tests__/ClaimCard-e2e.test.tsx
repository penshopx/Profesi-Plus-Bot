/**
 * End-to-end component integration tests: ClaimCard + real claimPayment()
 *
 * These tests connect the ClaimCard component to the REAL claimPayment() HTTP
 * client — the module is NOT mocked.  Instead, global.fetch (the underlying
 * HTTP boundary) is mocked to simulate API server responses.
 *
 * This proves the complete chain:
 *   ClaimCard (UI) → claimPayment() (api client) → apiFetch() → fetch (HTTP)
 *
 * Acceptance criteria (Task #83):
 *   1. Valid orderId + matching email (200) → green success banner appears;
 *      creditsGranted is displayed; onSuccess fires.
 *   2. Wrong email (404) → red error banner shows the EXACT Indonesian error
 *      message from the server JSON body; onSuccess is NOT called.
 *
 * Note: ClaimCard component-only tests live in ClaimCard.test.tsx.
 * This file adds the true end-to-end layer that links UI to HTTP contract.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── DO NOT mock @/lib/api — we use the real claimPayment() function ──────────
//    Only mock external/native modules that cannot run in Node.

// useNetworkState wraps native expo-network, which cannot load under Node.
// Report "online" so submits go through the real HTTP path.
jest.mock('@/hooks/useNetworkState', () => ({
  useNetworkState: () => ({ isOnline: true, isChecking: false }),
}));

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function byTestId(root: ReactTestRenderer, testId: string) {
  return root.root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestRenderer, testId: string) {
  try {
    return root.root.findByProps({ testID: testId });
  } catch {
    return null;
  }
}

/**
 * Mount ClaimCard inside a fresh QueryClient, run `cb`, then tear down.
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

/**
 * Fill both fields and submit — two-phase act() ensures the mutation closure
 * captures committed state values, and the 200ms wait allows React Query's
 * async chain to settle before assertions.
 */
async function submitForm(
  root: ReactTestRenderer,
  orderId: string,
  email: string,
) {
  await act(async () => {
    byTestId(root, 'input-order-id').props.onChangeText?.(orderId);
    byTestId(root, 'input-email').props.onChangeText?.(email);
  });
  await act(async () => {
    byTestId(root, 'btn-klaim').props.onPress?.();
    await new Promise<void>((r) => setTimeout(r, 200));
  });
}

/**
 * Return a mock `fetch` Response object whose json() and text() match `body`.
 */
function makeFetchResponse(status: number, body: unknown) {
  const text =
    typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => text,
  };
}

// ── global.fetch setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn() as jest.Mock;
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end scenario 1 — Valid orderId + matching email → success
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard + real claimPayment() — success (server 200)', () => {
  it('renders the green success banner after receiving a 200 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { ok: true, creditsGranted: 3 }),
    );

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'INV-20240812-001', 'tono@example.com');

      expect(byTestId(root, 'banner-success')).toBeTruthy();
      expect(queryByTestId(root, 'banner-error')).toBeNull();
    });
  });

  it('fires onSuccess (balance-refresh) after receiving a 200 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { ok: true, creditsGranted: 5 }),
    );

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'INV-20240812-001', 'tono@example.com');

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the creditsGranted count in the success banner', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { ok: true, creditsGranted: 7 }),
    );

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-777', 'user@example.com');

      const json = JSON.stringify(root.toJSON());
      expect(json).toContain('7');
      expect(json).toContain('kredit Exum');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end scenario 2 — Wrong email → 404 → red banner with Indonesian text
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimCard + real claimPayment() — wrong email (server 404)', () => {
  const SERVER_ERROR =
    'Pesanan tidak ditemukan. Pastikan ID pesanan dan email pembelian benar.';

  it('renders the red error banner with the exact Indonesian message from the server', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(404, { error: SERVER_ERROR }),
    );

    await withCard(jest.fn(), async (root) => {
      await submitForm(root, 'INV-20240812-001', 'wrong@example.com');

      // Banner is visible
      expect(byTestId(root, 'banner-error')).toBeTruthy();
      // Exact server message is shown — not a generic client string
      expect(byTestId(root, 'text-error-msg').props.children).toBe(SERVER_ERROR);
      expect(queryByTestId(root, 'banner-success')).toBeNull();
    });
  });

  it('does NOT fire onSuccess when the server returns 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(404, { error: SERVER_ERROR }),
    );

    const onSuccess = jest.fn();
    await withCard(onSuccess, async (root) => {
      await submitForm(root, 'INV-20240812-001', 'wrong@example.com');

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
