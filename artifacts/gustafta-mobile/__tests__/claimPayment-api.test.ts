/**
 * Integration tests: claimPayment() API client function
 *
 * These tests exercise the REAL `claimPayment()` function from `lib/api.ts`
 * against a controlled `fetch` mock that simulates the API server.  Unlike the
 * ClaimCard component tests (which mock `claimPayment` itself), these tests
 * confirm that the mobile HTTP client:
 *
 *   - Sends a POST to the correct endpoint with the correct JSON body
 *   - Returns `{ ok, creditsGranted }` on a 200 response
 *   - Returns `{ ok, creditsGranted, alreadyClaimed: true }` for already-claimed orders
 *   - Throws with the server's EXACT Indonesian `error` field on a 404 response
 *   - Attaches the HTTP status code to the thrown error object
 *   - Falls back to raw response text when the error body is not JSON
 *   - Includes the `Content-Type: application/json` header in every request
 *
 * Scenario coverage (Task #83 acceptance criteria):
 *   ✓ Valid order ID + matching email → success (creditsGranted increments)
 *   ✓ Wrong email → 404 → exact Indonesian error message propagated to the caller
 */

// ── Setup ─────────────────────────────────────────────────────────────────────

// The expo/fetch mock in __mocks__/expo-fetch.js delegates to global.fetch so
// we can intercept HTTP calls without a real network or MSW server.
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn() as jest.Mock;
});

// ── Import the REAL claimPayment function ─────────────────────────────────────
import { claimPayment } from '@/lib/api';

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Build a mock Response object that global.fetch will return.
 *
 * For SUCCESS (2xx): `json()` must work — claimPayment() calls res.json().
 * For ERRORS (non-2xx): apiFetch reads body with `text()` only (single
 * consumption), then JSON-parses it to extract the `error` field.
 * Both paths expose `text()` for correctness and test-resilience.
 */
function mockFetchResponse(status: number, body: unknown): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () =>
      typeof body === 'string' ? JSON.parse(body) : body,
    text: async () => text,
  });
}

/** Fake a non-JSON response (e.g. HTML error page from proxy). */
function mockFetchHtmlResponse(status: number, html: string): void {
  // apiFetch reads body via text() only (one-shot stream), so this mock
  // correctly omits a working json() for the non-ok path.
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => html,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Successful claim (server returns 200)
// ─────────────────────────────────────────────────────────────────────────────

describe('claimPayment() — successful claim (server 200)', () => {
  it('sends a POST request to /api/users/me/claim-payment', async () => {
    mockFetchResponse(200, { ok: true, creditsGranted: 3 });

    await claimPayment('INV-20240812-001', 'tono@example.com');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch('/api/users/me/claim-payment');
    expect(init?.method).toBe('POST');
  });

  it('sends the orderId and customerEmail as a JSON body', async () => {
    mockFetchResponse(200, { ok: true, creditsGranted: 5 });

    await claimPayment('INV-ABCDE', 'buyer@mail.com');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.orderId).toBe('INV-ABCDE');
    expect(body.customerEmail).toBe('buyer@mail.com');
  });

  it('includes Content-Type: application/json in every request', async () => {
    mockFetchResponse(200, { ok: true, creditsGranted: 1 });

    await claimPayment('ORD-001', 'a@b.com');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('returns { ok: true, creditsGranted } from the server JSON', async () => {
    mockFetchResponse(200, { ok: true, creditsGranted: 7 });

    const result = await claimPayment('INV-777', 'user@example.com');

    expect(result.ok).toBe(true);
    expect(result.creditsGranted).toBe(7);
  });

  it('returns alreadyClaimed: true when the server includes it', async () => {
    mockFetchResponse(200, { ok: true, creditsGranted: 0, alreadyClaimed: true });

    const result = await claimPayment('INV-CLAIMED', 'owner@example.com');

    expect(result.alreadyClaimed).toBe(true);
    expect(result.creditsGranted).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Wrong email or non-existent order (server 404)
// Simulates: user types the wrong checkout email → server returns 404
// ─────────────────────────────────────────────────────────────────────────────

describe('claimPayment() — wrong email / non-existent order (server 404)', () => {
  const SERVER_ERROR =
    'Pesanan tidak ditemukan. Pastikan ID pesanan dan email pembelian benar.';

  it('throws an Error when the server returns 404', async () => {
    mockFetchResponse(404, { error: SERVER_ERROR });

    await expect(claimPayment('INV-001', 'wrong@example.com')).rejects.toThrow(Error);
  });

  it('throws with the EXACT Indonesian error message extracted from the server JSON', async () => {
    // apiFetch() parses the JSON body and extracts the `error` field, so the
    // thrown message is the clean string — NOT prefixed with "API 404:".
    mockFetchResponse(404, { error: SERVER_ERROR });

    await expect(
      claimPayment('INV-001', 'wrong@example.com'),
    ).rejects.toThrow(SERVER_ERROR);
  });

  it('attaches the HTTP status code to the thrown error', async () => {
    mockFetchResponse(404, { error: SERVER_ERROR });

    let caught: any;
    try {
      await claimPayment('INV-001', 'wrong@example.com');
    } catch (err) {
      caught = err;
    }

    expect(caught?.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Non-JSON error response (proxy or gateway failure)
// ─────────────────────────────────────────────────────────────────────────────

describe('claimPayment() — non-JSON error body (proxy or gateway failure)', () => {
  it('throws with the raw HTML body when the error response is not JSON', async () => {
    mockFetchHtmlResponse(502, '<html>Bad Gateway</html>');

    // apiFetch() falls back to response.text() when JSON parsing fails.
    await expect(claimPayment('ORD-X', 'x@x.com')).rejects.toThrow(
      '<html>Bad Gateway</html>',
    );
  });
});
