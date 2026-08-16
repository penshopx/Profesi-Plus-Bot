/**
 * Retry an async operation up to `maxAttempts` times with exponential backoff.
 * Stops immediately on ApiError with a 4xx status — those are definitive
 * rejections (bad token, auth, not-found) that re-trying won't fix.
 * Network errors and 5xx responses are retried.
 *
 * Extracted from app/(home)/kegiatan.tsx so the branch logic is unit-testable.
 */

import { ApiError } from './api';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      // ApiError with 4xx = permanent rejection; bail out immediately.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise<void>((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr;
}
