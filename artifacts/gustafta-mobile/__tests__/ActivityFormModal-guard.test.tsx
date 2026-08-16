/**
 * Unsaved-changes guard tests for ActivityFormModal (Task #192)
 *
 * The guard resets its baseline form state whenever `visible` transitions to
 * `true`. These tests cover the edge cases:
 *   1. Close without saving, reopen → baseline resets correctly (no stale
 *      "dirty" state from the previous session).
 *   2. Save successfully (modal closed by onSaved) → no stale baseline on the
 *      next open.
 *   3. Edit modal opened with an existing activity → baseline matches server
 *      data, not blank (no false positive), and real edits still trigger the
 *      Alert (no false negative).
 *
 * Uses react-test-renderer directly (see react-native-jest-setup memory).
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

// ── Mock native/expo modules that cannot load under Node ─────────────────────
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
jest.mock('@/lib/api'); // auto-mock: every export becomes jest.fn()
jest.mock('@/lib/retry', () => ({ retryWithBackoff: (fn: () => unknown) => fn() }));

import { ActivityFormModal, buildInitialForm } from '@/app/(home)/kegiatan';
import { createKegiatanPkb, updateKegiatanPkb, type PkbActivity } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

const alertSpy = Alert.alert as jest.Mock;
const createMock = createKegiatanPkb as jest.Mock;
const updateMock = updateKegiatanPkb as jest.Mock;

const SERVER_ACTIVITY: PkbActivity = {
  id: 7,
  namaKegiatan: 'Webinar K3 Konstruksi',
  tanggalMulai: '2025-06-15',
  tanggalSelesai: '2025-06-16',
  tempatKegiatan: 'Zoom',
  modePelaksanaan: 'online',
  namaMateri: 'Manajemen K3',
  penyelenggara: 'PT BKI',
  namaInstruktur: 'Ir. Budi',
  uraianSingkat: 'Ringkasan',
  linkRekaman: '',
  jenisPkb: 'Webinar',
  jpPkb: 4,
  status: 'draft',
} as unknown as PkbActivity;

// ── Harness ───────────────────────────────────────────────────────────────────

type ModalProps = {
  visible: boolean;
  initial?: PkbActivity | null;
};

function buildElement(client: QueryClient, props: ModalProps, onClose: jest.Mock, onSaved: jest.Mock) {
  // Build a FRESH element every render — root.update() bails out on identical
  // element references (see memory: root.update() bailout).
  return (
    <QueryClientProvider client={client}>
      <Harness {...props} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>
  );
}

function Harness({ visible, initial, onClose, onSaved }: ModalProps & {
  onClose: () => void; onSaved: (a: PkbActivity) => void;
}) {
  const colors = useColors();
  return (
    <ActivityFormModal
      visible={visible}
      initial={initial ?? null}
      prefill={null}
      onClose={onClose}
      onSaved={onSaved}
      colors={colors}
    />
  );
}

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function findByTestId(root: ReactTestRenderer, testID: string) {
  return root.root.findByProps({ testID });
}

function findInputByPlaceholder(root: ReactTestRenderer, placeholder: string) {
  return root.root.findByProps({ placeholder });
}

/** Simulate the user typing into the "Nama Kegiatan" field. */
async function typeNama(root: ReactTestRenderer, text: string) {
  const input = findInputByPlaceholder(root, 'Webinar K3 Konstruksi 2025');
  await act(async () => {
    input.props.onChangeText(text);
  });
}

/** Press the header "Batal" button (triggers confirmClose). */
async function pressCancel(root: ReactTestRenderer) {
  await act(async () => {
    findByTestId(root, 'form-cancel').props.onPress();
  });
}

/** Press "Simpan" and wait for the React Query mutation chain to settle. */
async function pressSave(root: ReactTestRenderer) {
  await act(async () => {
    findByTestId(root, 'form-save').props.onPress();
    await new Promise((r) => setTimeout(r, 200));
  });
}

async function setVisible(
  root: ReactTestRenderer, client: QueryClient,
  props: ModalProps, onClose: jest.Mock, onSaved: jest.Mock,
) {
  await act(async () => {
    root.update(buildElement(client, props, onClose, onSaved));
  });
}

async function mount(props: ModalProps, onClose: jest.Mock, onSaved: jest.Mock) {
  const client = freshClient();
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(buildElement(client, props, onClose, onSaved));
  });
  return { root, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── buildInitialForm sanity ───────────────────────────────────────────────────

describe('buildInitialForm', () => {
  it('maps an existing activity into form fields (nulls → empty strings)', () => {
    const form = buildInitialForm(SERVER_ACTIVITY, null);
    expect(form.namaKegiatan).toBe('Webinar K3 Konstruksi');
    expect(form.tanggalMulai).toBe('2025-06-15');
    expect(form.linkRekaman).toBe('');
    expect(form.jpPkb).toBe(4);
  });

  it('returns a blank form when no activity and no prefill', () => {
    const form = buildInitialForm(null, null);
    expect(form.namaKegiatan).toBe('');
    expect(form.tanggalMulai).toBe('');
  });
});

// ── Scenario 1: close without saving, reopen → baseline resets ────────────────

describe('close without saving, then reopen', () => {
  it('shows the discard Alert when dirty, and after reopen a pristine form closes without Alert', async () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { root, client } = await mount({ visible: true }, onClose, onSaved);

    // Dirty the form → Batal must warn, not close.
    await typeNama(root, 'Kegiatan baru saya');
    await pressCancel(root);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Buang perubahan?');
    expect(onClose).not.toHaveBeenCalled();

    // User picks "Buang" → onClose fires (simulate parent hiding the modal).
    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => { buttons[1].onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    alertSpy.mockClear();

    // Close and reopen: visible → false → true.
    await setVisible(root, client, { visible: false }, onClose, onSaved);
    await setVisible(root, client, { visible: true }, onClose, onSaved);

    // Baseline must have reset — the abandoned text is gone and the form is
    // pristine, so Batal closes immediately with NO Alert (no false positive).
    const input = findInputByPlaceholder(root, 'Webinar K3 Konstruksi 2025');
    expect(input.props.value).toBe('');
    await pressCancel(root);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// ── Scenario 2: save successfully → no stale baseline on next open ────────────

describe('save successfully, modal closed by onSaved, then reopen', () => {
  it('does not show a false-positive Alert on the next open, and still guards new edits', async () => {
    createMock.mockResolvedValue({ ...SERVER_ACTIVITY, id: 99 });
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { root, client } = await mount({ visible: true }, onClose, onSaved);

    // Fill required fields and save.
    await typeNama(root, 'Pelatihan Baru');
    // The date field is a DateInput wrapper — its prop is `onChange`.
    const dateInput = root.root.findAllByProps({ placeholder: '2025-06-15' })
      .find((n) => typeof n.props.onChange === 'function')!;
    await act(async () => { dateInput.props.onChange('2025-07-01'); });
    await pressSave(root);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);

    // Parent closes the modal via onSaved, then user reopens it later.
    await setVisible(root, client, { visible: false }, onClose, onSaved);
    await setVisible(root, client, { visible: true }, onClose, onSaved);

    // Pristine reopen: no stale baseline/dirty state → closes without Alert.
    await pressCancel(root);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    // No false negative after the reset: a fresh edit re-arms the guard.
    await typeNama(root, 'Sesuatu yang baru');
    await pressCancel(root);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Buang perubahan?');
  });
});

// ── Scenario 3: edit modal with an existing activity ──────────────────────────

describe('edit modal with an existing activity', () => {
  it('baseline matches server data: untouched form closes without Alert (no false positive)', async () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { root } = await mount({ visible: true, initial: SERVER_ACTIVITY }, onClose, onSaved);

    // Form is populated from the server data, not blank.
    const input = findInputByPlaceholder(root, 'Webinar K3 Konstruksi 2025');
    expect(input.props.value).toBe('Webinar K3 Konstruksi');

    // Closing immediately (no edits) must NOT warn.
    await pressCancel(root);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('editing a field then cancelling shows the Alert (no false negative)', async () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { root } = await mount({ visible: true, initial: SERVER_ACTIVITY }, onClose, onSaved);

    await typeNama(root, 'Webinar K3 Konstruksi (edit)');
    await pressCancel(root);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    // Reverting the edit back to the server value makes the form clean again.
    alertSpy.mockClear();
    await typeNama(root, 'Webinar K3 Konstruksi');
    await pressCancel(root);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saving an edit calls updateKegiatanPkb and reopening in edit mode has a fresh baseline', async () => {
    updateMock.mockResolvedValue({ ...SERVER_ACTIVITY, namaKegiatan: 'Diperbarui' });
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { root, client } = await mount({ visible: true, initial: SERVER_ACTIVITY }, onClose, onSaved);

    await typeNama(root, 'Diperbarui');
    await pressSave(root);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);

    // Parent closes, then reopens with the UPDATED server object.
    const updated = { ...SERVER_ACTIVITY, namaKegiatan: 'Diperbarui' };
    await setVisible(root, client, { visible: false, initial: updated }, onClose, onSaved);
    await setVisible(root, client, { visible: true, initial: updated }, onClose, onSaved);

    // Baseline now reflects the new server data → clean close, no Alert.
    const input = findInputByPlaceholder(root, 'Webinar K3 Konstruksi 2025');
    expect(input.props.value).toBe('Diperbarui');
    await pressCancel(root);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
