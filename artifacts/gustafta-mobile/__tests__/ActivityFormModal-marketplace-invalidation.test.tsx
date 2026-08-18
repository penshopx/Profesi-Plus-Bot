/**
 * Marketplace-watched cache invalidation after PKB creation (Task #259)
 *
 * When ActivityFormModal creates a new Kegiatan linked to a marketplace
 * course (prefill.marketplaceId is set), a successful save must also
 * invalidate the ['marketplace-watched', userId] React Query cache so the
 * 'Dicatat PKB' badge appears immediately without waiting for staleTime.
 *
 * When there is no prefill (ordinary creation) the marketplace query must
 * NOT be invalidated.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
jest.mock('@/lib/api');
jest.mock('@/lib/retry', () => ({ retryWithBackoff: (fn: () => unknown) => fn() }));

// useAuth mock returns a fixed userId so we can assert against it.
const TEST_USER_ID = 'user_abc123';
jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: TEST_USER_ID, isSignedIn: true, getToken: async () => 'token' }),
}));

import { ActivityFormModal } from '@/app/(home)/kegiatan';
import { createKegiatanPkb, type PkbActivity } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

const createMock = createKegiatanPkb as jest.Mock;

const CREATED_ACTIVITY: PkbActivity = {
  id: 42,
  namaKegiatan: 'Kursus Online K3',
  tanggalMulai: '2025-07-01',
  status: 'draft',
} as unknown as PkbActivity;

const MARKETPLACE_PREFILL = {
  marketplaceId: 'course-xyz',
  courseTitle: 'Kursus Online K3',
  courseProvider: 'PT Maju Jaya',
  courseJabkerList: ['Pengawas K3'],
  courseSkkTagsList: ['K3'],
  watchedAt: '2025-07-01',
};

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function buildElement(
  client: QueryClient,
  prefill: typeof MARKETPLACE_PREFILL | null,
  onSaved: jest.Mock,
) {
  const colors = useColors();
  return (
    <QueryClientProvider client={client}>
      <ActivityFormModal
        visible
        initial={null}
        prefill={prefill}
        onClose={jest.fn()}
        onSaved={onSaved}
        colors={colors}
      />
    </QueryClientProvider>
  );
}

async function fillAndSave(root: ReturnType<typeof create>) {
  // Fill the required "Nama Kegiatan" field.
  const namaInput = root.root.findByProps({ placeholder: 'Webinar K3 Konstruksi 2025' });
  await act(async () => { namaInput.props.onChangeText('Kursus Online K3'); });

  // Fill the required tanggalMulai field.
  const dateInput = root.root.findAllByProps({ placeholder: '2025-06-15' })
    .find((n) => typeof n.props.onChange === 'function')!;
  await act(async () => { dateInput.props.onChange('2025-07-01'); });

  // Press Simpan and let the mutation settle.
  const saveBtn = root.root.findByProps({ testID: 'form-save' });
  await act(async () => {
    saveBtn.props.onPress();
    await new Promise((r) => setTimeout(r, 200));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  createMock.mockResolvedValue(CREATED_ACTIVITY);
});

// ── Core invalidation test ────────────────────────────────────────────────────

describe('marketplace-watched invalidation on PKB creation', () => {
  it('invalidates ["marketplace-watched", userId] when created with a marketplaceId prefill', async () => {
    const client = freshClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const onSaved = jest.fn();

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(buildElement(client, MARKETPLACE_PREFILL, onSaved));
    });

    await fillAndSave(root);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);

    // Must have invalidated the kegiatan list.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['kegiatan'] }),
    );

    // Must also have invalidated the user-scoped marketplace-watched query.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['marketplace-watched', TEST_USER_ID] }),
    );
  });

  it('does NOT invalidate ["marketplace-watched"] for a plain create without a marketplace prefill', async () => {
    const client = freshClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const onSaved = jest.fn();

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(buildElement(client, null /* no prefill */, onSaved));
    });

    await fillAndSave(root);

    expect(createMock).toHaveBeenCalledTimes(1);

    // kegiatan list is still invalidated.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['kegiatan'] }),
    );

    // marketplace-watched must NOT be touched.
    const marketplaceCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => Array.isArray((arg as any)?.queryKey) && (arg as any).queryKey[0] === 'marketplace-watched',
    );
    expect(marketplaceCalls).toHaveLength(0);
  });
});
