/**
 * Detects whether the device has an active network connection.
 * Subscribes to expo-network's native connectivity events for instant
 * updates, with a 5 s polling fallback for platforms where the
 * subscription doesn't fire reliably.
 * Returns `isOnline: boolean` and `isChecking: boolean`.
 */

import { useState, useEffect, useRef } from 'react';
import * as Network from 'expo-network';

function stateToOnline(state: Partial<Network.NetworkState>): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true); // optimistic default
  const [isChecking, setIsChecking] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(stateToOnline(state));
    } catch {
      // If the API itself fails, assume online to avoid false negatives
      setIsOnline(true);
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    check();

    // Instant reaction: native event subscription fires as soon as the OS
    // reports a connectivity change (no polling delay).
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Network.addNetworkStateListener((state) => {
        setIsOnline(stateToOnline(state));
        setIsChecking(false);
      });
    } catch {
      // Listener unsupported on this platform — polling below still covers us.
    }

    // Polling fallback (e.g. web or platforms where the listener is flaky).
    intervalRef.current = setInterval(check, 5_000);

    return () => {
      subscription?.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isOnline, isChecking };
}
