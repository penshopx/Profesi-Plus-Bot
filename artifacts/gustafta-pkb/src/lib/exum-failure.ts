import { PlanLimitError, ExumGenerationError } from "./api";

/**
 * Classification of a generate-exum failure (Task #206).
 *
 * - `quota`     — plan limit hit (402); show the purchase paywall.
 * - `retrySafe` — the SERVER CONFIRMED the credit refund and persisted nothing;
 *                 safe to clear stale content and offer an immediate retry.
 * - `unsafe`    — refund NOT confirmed. This covers explicit server failures
 *                 without `retrySafe` AND transport/network errors, where the
 *                 request may have reserved a credit before the connection
 *                 dropped. ALL generation entry points must lock until the
 *                 user reconciles their credit status.
 */
export type ExumFailure =
  | { kind: "quota"; message: string }
  | { kind: "retrySafe"; message: string }
  | { kind: "unsafe"; message: string };

export const UNSAFE_FALLBACK_MESSAGE =
  "Gagal membuat Executive Summary — status kredit belum dapat dipastikan. Muat ulang status kredit sebelum mencoba lagi.";

export function classifyExumFailure(err: unknown): ExumFailure {
  if (err instanceof PlanLimitError) {
    return { kind: "quota", message: err.message };
  }
  if (err instanceof ExumGenerationError && err.retrySafe) {
    return { kind: "retrySafe", message: err.message };
  }
  // Preserve the server's guidance (e.g. "hubungi admin") when available;
  // plain fetch/network errors get the generic ambiguous-state message.
  return {
    kind: "unsafe",
    message: err instanceof ExumGenerationError ? err.message : UNSAFE_FALLBACK_MESSAGE,
  };
}
