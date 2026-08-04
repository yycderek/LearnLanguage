import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EventStoreConcurrencyError,
  LessonSessionService,
  MemorySessionEventStore,
  SqliteSessionEventStore,
  japaneseCafeCourse,
  replaySessionEvents,
  startSession,
} from "../src/index.js";

const lesson = japaneseCafeCourse.lessons[0]!;
const startCommand = {
  sessionId: "persistent-session",
  learnerId: "learner-1",
  courseId: japaneseCafeCourse.manifest.id,
  lessonId: lesson.id,
  occurredAt: "2026-08-04T08:00:00.000Z",
} as const;

describe("session event persistence", () => {
  it("restores and advances a session through the storage interface", async () => {
    const store = new MemorySessionEventStore();
    const service = new LessonSessionService(store);
    const started = await service.start(lesson, startCommand);

    const restored = await service.load(startCommand.sessionId);
    expect(restored?.state).toEqual(started.state);

    const advanced = await service.submit(
      lesson,
      {
        attemptId: "attempt-1",
        expectedStepId: lesson.entryStepId,
        expectedSequence: started.state.lastSequence,
        occurredAt: "2026-08-04T08:01:00.000Z",
        decision: "advance",
        supportLevelUsed: "full",
        promptLevel: 0,
      },
      startCommand.sessionId,
    );

    expect(advanced.state.currentStepId).toBe("preteach");
    expect((await service.load(startCommand.sessionId))?.state).toEqual(
      advanced.state,
    );
  });

  it("rejects writes based on an outdated stream sequence", async () => {
    const store = new MemorySessionEventStore();
    const transition = startSession(lesson, startCommand);
    await store.append(startCommand.sessionId, 0, transition.events);

    await expect(
      store.append(startCommand.sessionId, 0, transition.events),
    ).rejects.toBeInstanceOf(EventStoreConcurrencyError);
  });

  it("recovers a session after reopening a SQLite database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "learn-language-"));
    const filename = join(directory, "sessions.sqlite");

    try {
      const transition = startSession(lesson, startCommand);
      const firstStore = new SqliteSessionEventStore(filename);
      await firstStore.append(startCommand.sessionId, 0, transition.events);
      firstStore.close();

      const reopenedStore = new SqliteSessionEventStore(filename);
      const recoveredEvents = await reopenedStore.load(startCommand.sessionId);
      reopenedStore.close();

      expect(recoveredEvents).toEqual(transition.events);
      expect(replaySessionEvents(recoveredEvents)).toEqual(transition.state);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
