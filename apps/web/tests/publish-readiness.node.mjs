import assert from "node:assert/strict";
import test from "node:test";
import { createCourseFromTemplate } from "../lib/course-templates.ts";
import { assessPublishReadiness, canPublish } from "../lib/publish-readiness.ts";
import { validateCourse } from "../lib/course.ts";

test("no-code templates create structurally valid private drafts", () => {
  for (const id of ["single-lesson", "scenario-course", "practice-course"]) {
    const course = createCourseFromTemplate(id, "ja", "en");
    const validation = validateCourse(JSON.stringify(course));
    assert.equal(validation.issues.length, 0);
    assert.equal(course.manifest.status, "draft");
    assert.equal(course.manifest.visibility, "private");
  }
});

test("publish readiness separates blockers from recommendations", () => {
  const course = createCourseFromTemplate("single-lesson", "ja", "en");
  const checks = assessPublishReadiness(course, "en", [], true);
  assert.equal(canPublish(checks), true);
  delete course.manifest.license;
  const blocked = assessPublishReadiness(course, "en", [], true);
  assert.equal(canPublish(blocked), false);
  assert.equal(blocked.find((check) => check.id === "license")?.status, "blocked");
});
