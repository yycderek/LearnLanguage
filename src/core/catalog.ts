import type { CoursePack, LanguageAdapter } from "./types.js";
import {
  validateCoursePack,
  validateLanguageDefinition,
  type ValidationIssue,
} from "./validation.js";

export class CatalogValidationError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ValidationIssue[],
  ) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export class LearningCatalog {
  readonly #languages = new Map<string, LanguageAdapter>();
  readonly #courses = new Map<string, CoursePack>();

  registerLanguage(adapter: LanguageAdapter): void {
    const result = validateLanguageDefinition(adapter.definition);
    if (!result.valid) {
      throw new CatalogValidationError(
        `Invalid language pack: ${adapter.definition.id}`,
        result.issues,
      );
    }

    if (this.#languages.has(adapter.definition.id)) {
      throw new Error(`Language is already registered: ${adapter.definition.id}`);
    }

    this.#languages.set(adapter.definition.id, adapter);
  }

  registerCourse(course: CoursePack): void {
    const result = validateCoursePack(course);
    if (!result.valid) {
      throw new CatalogValidationError(
        `Invalid course pack: ${course.manifest.id}`,
        result.issues,
      );
    }

    if (!this.#languages.has(course.manifest.languageId)) {
      throw new Error(
        `Language pack is not registered: ${course.manifest.languageId}`,
      );
    }

    if (this.#courses.has(course.manifest.id)) {
      throw new Error(`Course is already registered: ${course.manifest.id}`);
    }

    this.#courses.set(course.manifest.id, course);
  }

  getLanguage(id: string): LanguageAdapter | undefined {
    return this.#languages.get(id);
  }

  getCourse(id: string): CoursePack | undefined {
    return this.#courses.get(id);
  }

  listLanguages(): readonly LanguageAdapter[] {
    return [...this.#languages.values()];
  }

  listCourses(languageId?: string): readonly CoursePack[] {
    const courses = [...this.#courses.values()];
    return languageId
      ? courses.filter((course) => course.manifest.languageId === languageId)
      : courses;
  }
}
