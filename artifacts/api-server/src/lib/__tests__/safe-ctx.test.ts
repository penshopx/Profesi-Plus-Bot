import { describe, it, expect, vi } from "vitest";
import { makeSafeCtx } from "../safe-ctx";

describe("makeSafeCtx", () => {
  it("returns the builder result on success without logging or recording errors", async () => {
    const warn = vi.fn();
    const errors: string[] = [];
    const safeCtx = makeSafeCtx({ warn }, errors);

    const result = await safeCtx("profile", async () => "PROFILE CONTEXT");

    expect(result).toBe("PROFILE CONTEXT");
    expect(errors).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("swallows a throwing builder, logs a warning, records the name, and returns empty string", async () => {
    const warn = vi.fn();
    const errors: string[] = [];
    const safeCtx = makeSafeCtx({ warn }, errors);
    const boom = new Error("db down");

    const result = await safeCtx("quiz", async () => { throw boom; });

    expect(result).toBe("");
    expect(errors).toEqual(["quiz"]);
    expect(warn).toHaveBeenCalledTimes(1);
    const [fields, msg] = warn.mock.calls[0];
    expect(fields).toMatchObject({ err: boom, contextBlock: "quiz", context_block_failed: "quiz" });
    expect(typeof msg).toBe("string");
  });

  it("strips the exum: prefix in the structured context_block_failed field but records the full name", async () => {
    const warn = vi.fn();
    const errors: string[] = [];
    const safeCtx = makeSafeCtx({ warn }, errors);

    await safeCtx("exum:profile", async () => { throw new Error("boom"); });

    expect(errors).toEqual(["exum:profile"]);
    expect(warn.mock.calls[0][0]).toMatchObject({
      contextBlock: "exum:profile",
      context_block_failed: "profile",
    });
  });

  it("accumulates multiple failures in the shared errors array", async () => {
    const warn = vi.fn();
    const errors: string[] = [];
    const safeCtx = makeSafeCtx({ warn }, errors);

    await Promise.all([
      safeCtx("profile", async () => { throw new Error("a"); }),
      safeCtx("kegiatan", async () => "ok"),
      safeCtx("competency", async () => { throw new Error("b"); }),
    ]);

    expect(errors.sort()).toEqual(["competency", "profile"]);
  });
});
