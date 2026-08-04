import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import coursePackSchema from "../schemas/course-pack.schema.json" with { type: "json" };
import type { CoursePack } from "./types.js";
import { validateCoursePack } from "./validation.js";

export type CourseImportStage = "json" | "schema" | "domain";

export interface CourseImportIssue {
  readonly stage: CourseImportStage;
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type CourseImportResult =
  | { readonly success: true; readonly course: CoursePack }
  | { readonly success: false; readonly issues: readonly CourseImportIssue[] };

export class CourseImportError extends Error {
  constructor(readonly issues: readonly CourseImportIssue[]) {
    super(`Course import failed with ${issues.length} issue(s)`);
    this.name = "CourseImportError";
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateStructure = ajv.compile<CoursePack>(coursePackSchema);

function pathForAjvError(error: ErrorObject): string {
  if (error.keyword === "required") {
    const missingProperty = String(error.params.missingProperty);
    return `${error.instancePath}/${missingProperty}` || "/";
  }
  return error.instancePath || "/";
}

function schemaIssues(errors: readonly ErrorObject[]): CourseImportIssue[] {
  return errors.map((error) => ({
    stage: "schema",
    code: error.keyword,
    path: pathForAjvError(error),
    message: error.message ?? "Invalid course structure",
  }));
}

export function safeImportCoursePack(input: string | unknown): CourseImportResult {
  let parsed: unknown = input;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input) as unknown;
    } catch (error) {
      return {
        success: false,
        issues: [
          {
            stage: "json",
            code: "invalid-json",
            path: "/",
            message: error instanceof Error ? error.message : "Invalid JSON",
          },
        ],
      };
    }
  }

  if (!validateStructure(parsed)) {
    return {
      success: false,
      issues: schemaIssues(validateStructure.errors ?? []),
    };
  }

  const course = structuredClone(parsed);
  const domainValidation = validateCoursePack(course);
  if (!domainValidation.valid) {
    return {
      success: false,
      issues: domainValidation.issues.map((issue) => ({
        stage: "domain",
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    };
  }

  return { success: true, course };
}

export function importCoursePack(input: string | unknown): CoursePack {
  const result = safeImportCoursePack(input);
  if (!result.success) {
    throw new CourseImportError(result.issues);
  }
  return result.course;
}
