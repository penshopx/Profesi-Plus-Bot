/**
 * Verifies the push-token rotation client side (usePushRegistration):
 * 1. When the app returns to the foreground (AppState → 'active'), the current
 *    Expo push token is re-sent to the server via PATCH /users/me/push-token.
 * 2. When fetching the Expo token fails, nothing crashes and no bogus request
 *    is sent.
 *
 * Uses react-test-renderer directly (see .agents/memory/react-native-jest-setup.md).
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

const mockGetExpoPushTokenAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4 },
}));

import { usePushRegistration } from '@/hooks/usePushRegistration';

// The real lib/api registerPushToken runs; expo/fetch is mapped to global.fetch
// by __mocks__/expo-fetch.js, so we spy at the network boundary.
const fetchSpy = jest.fn(async () => ({ ok: true }));

function Harness({ signedIn }: { signedIn: boolean }) {
  usePushRegistration(signedIn, async () => 'auth-token-123');
  return null;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

/** The AppState 'change' handler registered by the hook (last subscription). */
function lastAppStateHandler(): (state: string) => void {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls
    .filter(([event]) => event === 'change');
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1];
}

beforeEach(() => {
  jest.clearAllMocks();
  (global as { fetch: unknown }).fetch = fetchSpy;
  process.env.EXPO_PUBLIC_DOMAIN = 'test.example.com';
});

describe('usePushRegistration — foreground re-registration', () => {
  it('re-sends the current token via PATCH /users/me/push-token when AppState becomes active', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[initial]' });

    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<Harness signedIn />); });
    await flush();

    // Sign-in registration happened once
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Simulate an OS-side token rotation while backgrounded, then foreground.
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[rotated]' });
    fetchSpy.mockClear();

    const handler = lastAppStateHandler();
    await act(async () => { handler('active'); });
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.example.com/api/users/me/push-token');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer auth-token-123');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'ExponentPushToken[rotated]' });

    await act(async () => { root.unmount(); });
  });

  it('does not re-register on non-active AppState transitions', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[x]' });

    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<Harness signedIn />); });
    await flush();
    fetchSpy.mockClear();

    const handler = lastAppStateHandler();
    await act(async () => { handler('background'); handler('inactive'); });
    await flush();

    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });

  it('does not attach an AppState listener when signed out', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[x]' });

    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<Harness signedIn={false} />); });
    await flush();

    expect(
      (AppState.addEventListener as jest.Mock).mock.calls.filter(([e]) => e === 'change'),
    ).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });

  it('does not crash or send a bogus request when getting the Expo token fails', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[ok]' });

    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<Harness signedIn />); });
    await flush();
    fetchSpy.mockClear();

    // Token fetch fails on foreground — must be swallowed, no PATCH sent.
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('no push service'));
    const handler = lastAppStateHandler();
    await act(async () => { handler('active'); });
    await flush();

    expect(fetchSpy).not.toHaveBeenCalled();

    // Hook keeps working: a later foreground with a valid token registers again.
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[recovered]' });
    await act(async () => { handler('active'); });
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string))
      .toEqual({ token: 'ExponentPushToken[recovered]' });

    await act(async () => { root.unmount(); });
  });
});
