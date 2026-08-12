/**
 * Detects whether the device has an active network connection.
 * Uses expo-network to poll and react to connectivity changes.
 * Returns `isOnline: boolean` and `isChecking: boolean`.
 */

import { useState, useEffect, useRef } from 'react';
import * as Network from 'expo-network';

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true); // optimistic default
  const [isChecking, setIsChecking] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    } catch {
      // If the API itself fails, assume online to avoid false negatives
      setIsOnline(true);
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    check();
    // Poll every 5 s — expo-network doesn't provide a native subscription on all platforms
    intervalRef.current = setInterval(check, 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isOnline, isChecking };
}
