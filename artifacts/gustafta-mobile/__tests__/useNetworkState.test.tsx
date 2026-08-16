/**
 * Task: offline detection must react instantly when the user loses
 * connection mid-session — not wait for the 5 s polling interval.
 *
 * Verifies that useNetworkState subscribes to expo-network's native
 * connectivity listener and flips `isOnline` to false immediately
 * (well within 1–2 s) when the listener fires an offline event.
 */

import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// ─── expo-network mock ────────────────────────────────────────────────────────
type NetState = { isConnected: boolean; isInternetReachable: boolean };

let mockCurrentState: NetState = { isConnected: true, isInternetReachable: true };
let mockListeners: Array<(s: NetState) => void> = [];

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve(mockCurrentState)),
  addNetworkStateListener: jest.fn((cb: (s: NetState) => void) => {
    mockListeners.push(cb);
    return {
      remove: () => {
        mockListeners = mockListeners.filter((l) => l !== cb);
      },
    };
  }),
}));

import * as Network from 'expo-network';
import { useNetworkState } from '../hooks/useNetworkState';

function emit(state: NetState) {
  mockCurrentState = state;
  mockListeners.forEach((l) => l(state));
}

function Probe() {
  const { isOnline } = useNetworkState();
  return <Text testID="status">{isOnline ? 'online' : 'offline'}</Text>;
}

function statusText(root: ReactTestRenderer): string {
  const node = root.root.findByProps({ testID: 'status' });
  return node.props.children as string;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockCurrentState = { isConnected: true, isInternetReachable: true };
  mockListeners = [];
  (Network.getNetworkStateAsync as jest.Mock).mockClear();
  (Network.addNetworkStateListener as jest.Mock).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useNetworkState instant offline detection', () => {
  it('subscribes to the native network state listener on mount', async () => {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<Probe />);
    });
    expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
    expect(statusText(root)).toBe('online');
    await act(async () => root.unmount());
  });

  it('flips isOnline to false immediately when the listener fires — no polling delay', async () => {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<Probe />);
    });
    expect(statusText(root)).toBe('online');

    // Simulate the OS reporting a lost connection. Advance time by only 100 ms
    // (far less than the 5 s polling interval) to prove reaction is instant.
    await act(async () => {
      emit({ isConnected: false, isInternetReachable: false });
      jest.advanceTimersByTime(100);
    });

    expect(statusText(root)).toBe('offline');
    // The poll should NOT have been needed: only the initial mount check ran.
    expect(Network.getNetworkStateAsync).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it('flips back to online instantly when connectivity returns', async () => {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<Probe />);
    });
    await act(async () => {
      emit({ isConnected: false, isInternetReachable: false });
    });
    expect(statusText(root)).toBe('offline');

    await act(async () => {
      emit({ isConnected: true, isInternetReachable: true });
    });
    expect(statusText(root)).toBe('online');

    await act(async () => root.unmount());
  });

  it('polling fallback still detects offline if the listener never fires', async () => {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<Probe />);
    });
    expect(statusText(root)).toBe('online');

    // Connectivity drops but the platform listener does not fire.
    mockCurrentState = { isConnected: false, isInternetReachable: false };
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      // let the async check() promise settle
      await Promise.resolve();
    });

    expect(statusText(root)).toBe('offline');
    await act(async () => root.unmount());
  });

  it('removes the listener and interval on unmount', async () => {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(<Probe />);
    });
    expect(mockListeners).toHaveLength(1);
    await act(async () => root.unmount());
    expect(mockListeners).toHaveLength(0);
  });
});
