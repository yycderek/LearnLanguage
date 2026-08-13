import { describe, expect, it } from "vitest";
import { runHeadlessClient } from "../src/headless-client.js";

describe("non-Web client portability", () => {
  it("runs the shared authoring, library, profile, and learning services on SQLite", async () => {
    await expect(runHeadlessClient()).resolves.toEqual({
      client: "headless-sqlite",
      draftRevision: 1,
      languagePackCount: 1,
      installedCourseCount: 1,
      profileCount: 1,
      sessionEventCount: 2,
    });
  });
});
