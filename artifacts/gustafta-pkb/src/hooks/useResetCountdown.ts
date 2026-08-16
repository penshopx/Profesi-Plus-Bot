import { useState, useEffect, useRef } from "react";

/**
 * Live "reset in HH:MM:SS" countdown, device-clock-skew-safe (#92 pattern).
 * Computes the delay from server timestamps (resetAt - serverNow), then ticks
 * locally from Date.now() elapsed time — the device clock's absolute value is
 * never compared against server time.
 *
 * Returns null when there is nothing to count down (no resetAt, or expired).
 */
export function useResetCountdown(
  resetAt: string | null | undefined,
  serverNow: string | undefined,
): string | null {
  const [countdown, setCountdown] = useState<string | null>(null);
  const fetchedAt = useRef<number>(0);

  useEffect(() => {
    if (!resetAt || !serverNow) { setCountdown(null); return; }
    fetchedAt.current = Date.now();
    const resetDelay = new Date(resetAt).getTime() - new Date(serverNow).getTime();
    const tick = () => {
      const msLeft = Math.max(0, resetDelay - (Date.now() - fetchedAt.current));
      const totalSec = Math.ceil(msLeft / 1000);
      const hh = Math.floor(totalSec / 3600).toString().padStart(2, "0");
      const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
      const ss = (totalSec % 60).toString().padStart(2, "0");
      setCountdown(msLeft <= 0 ? null : `${hh}:${mm}:${ss}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resetAt, serverNow]);

  return countdown;
}
