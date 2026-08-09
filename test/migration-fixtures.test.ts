import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { safeImportCoursePack } from "../src/index.js";

async function fixture(name: string) {
  return readFile(new URL(`./fixtures/migrations/${name}`, import.meta.url), "utf8");
}

describe("pinned Course Pack migration boundaries", () => {
  it("keeps the prototype reset explicit by rejecting the v1 fixture", async () => {
    const result = safeImportCoursePack(await fixture("course-pack-v1.json"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        stage: "schema",
        path: "/schemaVersion",
      }));
    }
  });

  it("accepts the pinned v2 fixture without hidden normalization", async () => {
    const raw = await fixture("course-pack-v2.json");
    const result = safeImportCoursePack(raw);
    expect(result.success).toBe(true);
    if (result.success) expect(result.course).toEqual(JSON.parse(raw));
  });
});
