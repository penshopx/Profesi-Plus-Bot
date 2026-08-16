/**
 * generate-exum failure classification (Task #206)
 *
 * The web chat page keys its entire Exum failure UX off classifyExumFailure:
 * - `retrySafe` → clear stale content + retry button ("credits not lost")
 * - `unsafe`    → lock EVERY generation entry point until the user reconciles
 *                 credit status (banner + disabled buttons in chat.tsx)
 *
 * Crucially, a plain network/transport error (rejected fetch) must classify
 * as `unsafe`: the request may have reserved a credit server-side before the
 * connection dropped, so offering "try again" could burn another credit.
 */

import { describe, it, expect } from "vitest";
import { PlanLimitError, ExumGenerationError } from "../api";
import { classifyExumFailure, UNSAFE_FALLBACK_MESSAGE } from "../exum-failure";

describe("classifyExumFailure", () => {
  it("classifies PlanLimitError (402) as quota", () => {
    const f = classifyExumFailure(new PlanLimitError("Kredit Exum Anda sudah habis."));
    expect(f.kind).toBe("quota");
    expect(f.message).toMatch(/habis/);
  });

  it("classifies a server-confirmed refund (retrySafe:true) as retrySafe", () => {
    const f = classifyExumFailure(
      new ExumGenerationError("Gagal membuat Executive Summary. Kredit Anda tidak terpotong — silakan coba lagi.", true),
    );
    expect(f.kind).toBe("retrySafe");
    expect(f.message).toMatch(/tidak terpotong/);
  });

  it("classifies a server failure WITHOUT confirmed refund as unsafe, preserving server guidance", () => {
    const f = classifyExumFailure(
      new ExumGenerationError("Gagal membuat Executive Summary. Jika kredit Anda terpotong, hubungi admin.", false),
    );
    expect(f.kind).toBe("unsafe");
    expect(f.message).toMatch(/hubungi admin/);
  });

  it("classifies a plain network/transport error (rejected fetch) as unsafe — never retry-safe", () => {
    // fetch() rejects with a plain TypeError on network failure.
    const f = classifyExumFailure(new TypeError("Failed to fetch"));
    expect(f.kind).toBe("unsafe");
    expect(f.message).toBe(UNSAFE_FALLBACK_MESSAGE);
  });

  it("classifies unknown thrown values as unsafe", () => {
    expect(classifyExumFailure("boom").kind).toBe("unsafe");
    expect(classifyExumFailure(undefined).kind).toBe("unsafe");
  });
});
