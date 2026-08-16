/**
 * Unit tests: retryWithBackoff (lib/retry.ts)
 *
 * Task #189 — Confirm the registration retry flow doesn't silently swallow a
 * real token error.  The branch under test:
 *
 *   - ApiError 4xx (invalid/expired upload token, auth, not-found) must be
 *     propagated IMMEDIATELY with no further attempts — retrying a permanent
 *     rejection would leave the user stuck until timeout.
 *   - 5xx ApiError and raw network failures ARE retried, up to 3 attempts,
 *     then the last error is thrown.
 *
 * We mock `registerKegiatanDoc` (the real callee inside uploadLocalFile) and
 * pass it through retryWithBackoff exactly as kegiatan.tsx does.
 */

import { retryWithBackoff } from '@/lib/retry';
import { ApiError, registerKegiatanDoc } from '@/lib/api';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return { ApiError, registerKegiatanDoc: jest.fn() };
});

const mockRegister = registerKegiatanDoc as jest.MockedFunction<typeof registerKegiatanDoc>;

// Call exactly the way uploadLocalFile does, but with a 1ms base delay so the
// backoff waits don't slow the suite down.
function callThroughRetry() {
  return retryWithBackoff(
    () => registerKegiatanDoc(1, 'foto', 'a.jpg', '/objects/x', 'image/jpeg', 123),
    3,
    1,
  );
}

beforeEach(() => {
  mockRegister.mockReset();
});

describe('retryWithBackoff — 4xx token errors are NOT retried', () => {
  it('propagates ApiError(403) immediately with exactly one call', async () => {
    const tokenError = new ApiError('objectPath tidak valid atau sudah kadaluarsa — silakan upload ulang.', 403);
    mockRegister.mockRejectedValue(tokenError);

    await expect(callThroughRetry()).rejects.toBe(tokenError);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('propagates ApiError(400) immediately without retries', async () => {
    mockRegister.mockRejectedValue(new ApiError('docType, filename, objectPath wajib', 400));

    await expect(callThroughRetry()).rejects.toMatchObject({ name: 'ApiError', status: 400 });
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });
});

describe('retryWithBackoff — 5xx errors are retried up to 3 times', () => {
  it('retries a persistent 500 three times then throws the last error', async () => {
    const serverError = new ApiError('Gagal menyimpan dokumen — silakan coba lagi.', 500);
    mockRegister.mockRejectedValue(serverError);

    await expect(callThroughRetry()).rejects.toBe(serverError);
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });

  it('succeeds when the 500 clears on a later attempt (token re-issue path)', async () => {
    const doc = { id: 7 } as Awaited<ReturnType<typeof registerKegiatanDoc>>;
    mockRegister
      .mockRejectedValueOnce(new ApiError('Gagal menyimpan dokumen — silakan coba lagi.', 500))
      .mockRejectedValueOnce(new ApiError('Gagal menyimpan dokumen — silakan coba lagi.', 500))
      .mockResolvedValueOnce(doc);

    await expect(callThroughRetry()).resolves.toBe(doc);
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });
});

describe('retryWithBackoff — network failures are retried up to 3 times', () => {
  it('retries a persistent network failure three times then throws it', async () => {
    const netError = new TypeError('Network request failed');
    mockRegister.mockRejectedValue(netError);

    await expect(callThroughRetry()).rejects.toBe(netError);
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });

  it('succeeds when the network recovers on the second attempt', async () => {
    const doc = { id: 9 } as Awaited<ReturnType<typeof registerKegiatanDoc>>;
    mockRegister
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(doc);

    await expect(callThroughRetry()).resolves.toBe(doc);
    expect(mockRegister).toHaveBeenCalledTimes(2);
  });
});

describe('retryWithBackoff — backoff timing', () => {
  it('waits with exponential delays between failed attempts (base, base*2)', async () => {
    jest.useFakeTimers();
    try {
      const serverError = new ApiError('server down', 503);
      mockRegister.mockRejectedValue(serverError);

      const promise = retryWithBackoff(
        () => registerKegiatanDoc(1, 'foto', 'a.jpg', '/objects/x', 'image/jpeg', 123),
        3,
        1000,
      );
      // Attach the rejection handler before advancing timers.
      const assertion = expect(promise).rejects.toBe(serverError);

      // Attempt 1 fails → 1000ms wait
      await Promise.resolve();
      expect(mockRegister).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockRegister).toHaveBeenCalledTimes(2);
      // Attempt 2 fails → 2000ms wait
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockRegister).toHaveBeenCalledTimes(3);

      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
