/**
 * Deep-link fallback tests for KegiatanScreen (Task #193)
 *
 * A push-notification tap navigates to /kegiatan?openActivityId=<id>. If the
 * activity list cache is empty or stale (user never opened the tab), the old
 * implementation silently did nothing. These tests prove:
 *   1. Activity in the list → detail opens from the cached list (no extra fetch).
 *   2. Activity NOT in the (empty) list → the screen fetches the detail
 *      directly via getKegiatanDetail and opens it.
 *   3. Detail fetch fails → a visible Alert is shown (no silent no-op).
 *
 * Uses react-test-renderer directly (see react-native-jest-setup memory).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

// ── Mock native/expo modules that cannot load under Node ─────────────────────
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff', card: '#fff', border: '#ccc', foreground: '#000',
    mutedForeground: '#888', muted: '#f5f5f5', primary: '#0B70C1',
    primaryForeground: '#fff', destructive: '#DC2626',
  }),
}));
jest.mock('@/lib/api'); // auto-mock: every export becomes jest.fn()
jest.mock('@/lib/retry', () => ({ retryWithBackoff: (fn: () => unknown) => fn() }));

import KegiatanScreen from '@/app/(home)/kegiatan';
import {
  listMyKegiatanPkb,
  getKegiatanDetail,
  type PkbActivity,
} from '@/lib/api';

const alertSpy = Alert.alert as jest.Mock;
const listMock = listMyKegiatanPkb as jest.Mock;
const detailMock = getKegiatanDetail as jest.Mock;

const ACTIVITY: PkbActivity = {
  id: 42,
  namaKegiatan: 'Webinar Geoteknik Lanjut',
  tanggalMulai: '2026-08-01',
  tanggalSelesai: '2026-08-01',
  tempatKegiatan: 'Zoom',
  modePelaksanaan: 'online',
  jenisPkb: 'Webinar',
  jpPkb: 2,
  status: 'diverifikasi',
  skk: [],
} as unknown as PkbActivity;

const ACTIVITY_DETAIL = { ...ACTIVITY, docs: [], journey: [] };

// ── Harness ───────────────────────────────────────────────────────────────────

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

async function mountScreen(): Promise<{ root: ReactTestRenderer; client: QueryClient; teardown: () => Promise<void> }> {
  const client = freshClient();
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <KegiatanScreen isTab />
      </QueryClientProvider>,
    );
    await new Promise<void>((r) => setTimeout(r, 50));
  });
  return {
    root,
    client,
    teardown: async () => {
      client.clear();
      await act(async () => { root.unmount(); });
    },
  };
}

async function settle(ms = 200) {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  });
}

function rendered(root: ReactTestRenderer): string {
  return JSON.stringify(root.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  // ActivityDetail mounts its own detail query — keep it resolved by default.
  detailMock.mockResolvedValue(ACTIVITY_DETAIL);
});

// ─────────────────────────────────────────────────────────────────────────────

describe('deep-link openActivityId', () => {
  it('opens the detail from the cached list when the activity is present', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([ACTIVITY]);

    const { root, teardown } = await mountScreen();
    await settle();

    // Detail modal shows the activity name in its header.
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });

  it('fetches the activity directly when the cached list is empty', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]); // user never opened the tab / stale cache

    const { root, teardown } = await mountScreen();
    await settle();

    // Fallback fetch fired and the detail modal opened anyway.
    expect(detailMock).toHaveBeenCalledWith(42);
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });

  it('fetches directly when the list is stale (does not contain the id)', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([{ ...ACTIVITY, id: 7, namaKegiatan: 'Kegiatan Lama' }]);

    const { root, teardown } = await mountScreen();
    await settle();

    expect(detailMock).toHaveBeenCalledWith(42);
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');
    await teardown();
  });

  it('shows a visible alert instead of failing silently when the fetch fails', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    detailMock.mockRejectedValue(new Error('404'));

    const { root, teardown } = await mountScreen();
    await settle();

    expect(detailMock).toHaveBeenCalledWith(42);
    expect(alertSpy).toHaveBeenCalledWith(
      'Kegiatan tidak ditemukan',
      expect.stringContaining('notifikasi'),
    );
    // No detail modal opened.
    expect(rendered(root)).not.toContain('Webinar Geoteknik Lanjut');
    await teardown();
  });

  it('shows the alert when the API rejects with a real 404-style error (apiFetch throws on non-2xx)', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    // apiFetch rejects non-2xx responses with an Error carrying the server's
    // `error` field and the HTTP status — model that exact shape here.
    detailMock.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));

    const { root, teardown } = await mountScreen();
    await settle();

    expect(alertSpy).toHaveBeenCalledWith('Kegiatan tidak ditemukan', expect.any(String));
    expect(rendered(root)).not.toContain('Webinar Geoteknik Lanjut');
    await teardown();
  });

  it('treats a JSON error body as a failure, not an activity (defensive shape check)', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    // If a helper ever resolved a non-2xx JSON body, it must not open a modal.
    detailMock.mockResolvedValue({ error: 'not found' } as never);

    const { root, teardown } = await mountScreen();
    await settle();

    expect(alertSpy).toHaveBeenCalledWith('Kegiatan tidak ditemukan', expect.any(String));
    // No detail modal opened with a bogus activity.
    const json = rendered(root);
    expect(json).not.toContain('Mapping SKK');
    await teardown();
  });

  it('still opens the activity when the list is replaced (still without the id) while the detail fetch is pending', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    // Keep the detail fetch pending until we resolve it manually.
    let resolveDetail!: (v: unknown) => void;
    detailMock.mockImplementation(() => new Promise((r) => { resolveDetail = r; }));

    const { root, client, teardown } = await mountScreen();
    await settle();
    expect(detailMock).toHaveBeenCalledWith(42);

    // Background list refresh lands mid-flight with a DIFFERENT activity —
    // this re-runs the effect and cleans up the previous run.
    await act(async () => {
      client.setQueryData(['kegiatan'], [{ ...ACTIVITY, id: 7, namaKegiatan: 'Kegiatan Lama' }]);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    // The re-run must not fire a duplicate request.
    expect(detailMock).toHaveBeenCalledTimes(1);

    // The original fetch finally resolves — the tap must still open the modal.
    await act(async () => {
      resolveDetail(ACTIVITY_DETAIL);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });

  it('opens from the refreshed list mid-flight and ignores the late detail result (no double-handling)', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    let resolveDetail!: (v: unknown) => void;
    detailMock.mockImplementation(() => new Promise((r) => { resolveDetail = r; }));

    const { root, client, teardown } = await mountScreen();
    await settle();
    expect(detailMock).toHaveBeenCalledWith(42);

    // Background refresh delivers the MATCHING activity while the detail
    // request is still pending — the effect re-run should open it directly.
    await act(async () => {
      client.setQueryData(['kegiatan'], [ACTIVITY]);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');

    // The late detail resolution must be a no-op (no alert, no crash).
    await act(async () => {
      resolveDetail(ACTIVITY_DETAIL);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(rendered(root)).toContain('Webinar Geoteknik Lanjut');
    await teardown();
  });

  it('a stale tap-A result never overrides tap B found in the refreshed list', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    let resolveA!: (v: unknown) => void;
    detailMock.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
    // The opened B modal fetches its own detail — keep that consistent with B
    // so any rendered detail data belongs to B, not A.
    detailMock.mockResolvedValue({ ...ACTIVITY_DETAIL, id: 99, namaKegiatan: 'Pelatihan Beton B' } as never);

    const { root, client, teardown } = await mountScreen();
    await settle();
    expect(detailMock).toHaveBeenCalledWith(42);

    // User taps notification B before A's fetch settles; B is already in the
    // refreshed list, so it opens directly from the cache.
    const ACTIVITY_B = { ...ACTIVITY, id: 99, namaKegiatan: 'Pelatihan Beton B' };
    mockParams = { openActivityId: '99' };
    await act(async () => {
      client.setQueryData(['kegiatan'], [ACTIVITY_B]);
      root.update(
        <QueryClientProvider client={client}>
          <KegiatanScreen isTab />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(rendered(root)).toContain('Pelatihan Beton B');
    // B was found in the list — no fallback fetch for B fired (the only
    // fallback call so far is A's; the opened modal's own detail query may
    // also call with 99, which is expected).
    const fallbackCallsForB = detailMock.mock.calls.filter(([id]) => id === 99).length;
    expect(fallbackCallsForB).toBeLessThanOrEqual(1);

    // A's stale fetch finally resolves — it must NOT replace B or alert.
    await act(async () => {
      resolveA(ACTIVITY_DETAIL);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    const json = rendered(root);
    expect(json).toContain('Pelatihan Beton B');
    expect(json).not.toContain('Webinar Geoteknik Lanjut');
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });

  it('tap A then tap B with both fetches pending: A never opens, B opens once, B is not fetched twice', async () => {
    mockParams = { openActivityId: '42' };
    listMock.mockResolvedValue([]);
    const pending = new Map<number, (v: unknown) => void>();
    detailMock.mockImplementation((id: number) => new Promise((r) => { pending.set(id, r); }));

    const { root, client, teardown } = await mountScreen();
    await settle();
    expect(detailMock).toHaveBeenCalledWith(42);

    // Tap B while A is still pending; B not in the list either → B fetch fires.
    mockParams = { openActivityId: '99' };
    await act(async () => {
      root.update(
        <QueryClientProvider client={client}>
          <KegiatanScreen isTab />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(detailMock).toHaveBeenCalledWith(99);
    expect(detailMock).toHaveBeenCalledTimes(2);

    // A resolves late — nothing opens, no alert.
    await act(async () => {
      pending.get(42)!(ACTIVITY_DETAIL);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(rendered(root)).not.toContain('Webinar Geoteknik Lanjut');
    expect(alertSpy).not.toHaveBeenCalled();

    // Force an effect re-run (list update) — B must not be fetched a second time.
    await act(async () => {
      client.setQueryData(['kegiatan'], [{ ...ACTIVITY, id: 7, namaKegiatan: 'Kegiatan Lama' }]);
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(detailMock).toHaveBeenCalledTimes(2);

    // B resolves — it opens.
    await act(async () => {
      pending.get(99)!({ ...ACTIVITY_DETAIL, id: 99, namaKegiatan: 'Pelatihan Beton B' });
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(rendered(root)).toContain('Pelatihan Beton B');
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });

  it.each(['abc', '42junk', ''])('ignores malformed openActivityId %p without fetching or alerting', async (bad) => {
    mockParams = bad ? { openActivityId: bad } : {};
    listMock.mockResolvedValue([]);

    const { teardown } = await mountScreen();
    await settle();

    expect(detailMock).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    await teardown();
  });
});
