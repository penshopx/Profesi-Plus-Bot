import { describe, it, expect } from "vitest";
import { selectOrphans } from "../upload-cleanup";

const cutoff = new Date("2026-08-09T00:00:00Z"); // 7 days before "now"

function obj(name: string, objectPath: string, timeCreated: string) {
  return { name, objectPath, timeCreated: new Date(timeCreated) };
}

describe("selectOrphans", () => {
  it("selects old, unregistered objects", () => {
    const candidates = [
      obj(".private/uploads/1/a", "/objects/uploads/1/a", "2026-08-01T00:00:00Z"),
    ];
    expect(selectOrphans(candidates, new Set(), cutoff)).toHaveLength(1);
  });

  it("skips objects newer than the cutoff (in-flight uploads)", () => {
    const candidates = [
      obj(".private/uploads/1/b", "/objects/uploads/1/b", "2026-08-15T00:00:00Z"),
    ];
    expect(selectOrphans(candidates, new Set(), cutoff)).toHaveLength(0);
  });

  it("skips registered objects even when old", () => {
    const candidates = [
      obj(".private/uploads/1/c", "/objects/uploads/1/c", "2026-08-01T00:00:00Z"),
    ];
    const registered = new Set(["/objects/uploads/1/c"]);
    expect(selectOrphans(candidates, registered, cutoff)).toHaveLength(0);
  });

  it("mixes correctly: only the old unregistered object is returned", () => {
    const candidates = [
      obj("p/uploads/1/old-orphan", "/objects/uploads/1/old-orphan", "2026-07-01T00:00:00Z"),
      obj("p/uploads/1/old-registered", "/objects/uploads/1/old-registered", "2026-07-01T00:00:00Z"),
      obj("p/uploads/1/fresh", "/objects/uploads/1/fresh", "2026-08-16T00:00:00Z"),
    ];
    const registered = new Set(["/objects/uploads/1/old-registered"]);
    const orphans = selectOrphans(candidates, registered, cutoff);
    expect(orphans.map((o) => o.objectPath)).toEqual(["/objects/uploads/1/old-orphan"]);
  });

  it("treats an object created exactly at the cutoff as not old enough", () => {
    const candidates = [
      obj("p/uploads/1/edge", "/objects/uploads/1/edge", cutoff.toISOString()),
    ];
    expect(selectOrphans(candidates, new Set(), cutoff)).toHaveLength(0);
  });
});
