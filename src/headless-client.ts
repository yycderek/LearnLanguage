import {
  CourseLibraryApplicationService,
  DraftApplicationService,
  LanguagePackApplicationService,
  ProfileBackupApplicationService,
} from "@learn-language/application/workspace";
import { LessonSessionService } from "./core/session-service.js";
import { japaneseCafeCourse } from "./examples/courses.js";
import { japaneseLanguagePack } from "./language-packs/index.js";
import {
  SqliteDraftRepository,
  SqliteInstalledCourseRepository,
  SqliteLanguagePackRepository,
  SqliteLearningProfileRepository,
} from "./infrastructure/sqlite-workspace-repositories.js";
import { SqliteSessionEventStore } from "./infrastructure/sqlite-event-store.js";

export interface HeadlessSmokeResult {
  client: "headless-sqlite";
  draftRevision: number;
  languagePackCount: number;
  installedCourseCount: number;
  profileCount: number;
  sessionEventCount: number;
}

export async function runHeadlessClient(database = ":memory:"): Promise<HeadlessSmokeResult> {
  const draftRepository = new SqliteDraftRepository(database);
  const languageRepository = new SqliteLanguagePackRepository(database);
  const courseRepository = new SqliteInstalledCourseRepository(database);
  const profileRepository = new SqliteLearningProfileRepository<{ courseId: string; updatedAt: string; completedLessonIds: string[] }>(database);
  const sessionRepository = new SqliteSessionEventStore(database);
  try {
    const saved = await new DraftApplicationService(draftRepository).saveRevision({
      draftId: "portable-draft", title: "Portable course", languageId: "ja-portable",
      payload: JSON.stringify(japaneseCafeCourse), updatedAt: "2026-08-12T12:00:00.000Z",
    });
    const portableLanguage = structuredClone(japaneseLanguagePack.definition);
    portableLanguage.id = "ja-portable";
    const languageService = new LanguagePackApplicationService(languageRepository, []);
    await languageService.import(portableLanguage);

    const course = structuredClone(japaneseCafeCourse);
    course.manifest.status = "published";
    course.manifest.languageId = portableLanguage.id;
    course.manifest.license = { id: "CC-BY-4.0", attribution: "LearnLanguage contributors" };
    course.manifest.contentHash = "sha256:headless-smoke";
    const courseService = new CourseLibraryApplicationService(courseRepository, { assess: () => ({ status: "compatible", issues: [] }) });
    await courseService.install(course);

    const profileService = new ProfileBackupApplicationService(profileRepository);
    await profileService.restore([{ courseId: course.manifest.id, updatedAt: "2026-08-12T12:01:00.000Z", completedLessonIds: [] }]);
    const lesson = course.lessons[0]!;
    const transition = await new LessonSessionService(sessionRepository).start(lesson, {
      sessionId: "portable-session", learnerId: "portable-learner", courseId: course.manifest.id,
      lessonId: lesson.id, occurredAt: "2026-08-12T12:02:00.000Z",
    });
    return {
      client: "headless-sqlite", draftRevision: saved.revision.revision,
      languagePackCount: (await languageService.list()).length,
      installedCourseCount: (await courseService.list()).length,
      profileCount: (await profileService.snapshot()).length,
      sessionEventCount: transition.events.length,
    };
  } finally {
    draftRepository.close(); languageRepository.close(); courseRepository.close();
    profileRepository.close(); sessionRepository.close();
  }
}
