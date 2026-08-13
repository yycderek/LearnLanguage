import { describe, expect, it } from "vitest";
import { assessCourseTrust } from "@learn-language/application/trust";
import { japaneseCafeCourse } from "../src/index.js";

function publishedCourse() {
  const course = structuredClone(japaneseCafeCourse);
  course.manifest.status = "published";
  course.manifest.contentHash = "sha256:test";
  course.manifest.license = { id: "CC-BY-4.0", attribution: "Author" };
  return course;
}

describe("course provenance trust", () => {
  it("recognizes official content only from trusted maintainers", () => {
    const course = publishedCourse();
    course.manifest.visibility = "official";
    course.manifest.author.id = "learn-language";
    expect(assessCourseTrust(course)).toMatchObject({ level: "official", canInstall: true, requiresConfirmation: false });
    course.manifest.author.id = "lookalike";
    expect(assessCourseTrust(course)).toMatchObject({ level: "untrusted", canInstall: false });
  });

  it("requires confirmation for installable community and local content", () => {
    const course = publishedCourse();
    course.manifest.visibility = "community";
    expect(assessCourseTrust(course)).toMatchObject({ level: "community", canInstall: true, requiresConfirmation: true });
    course.manifest.visibility = "private";
    expect(assessCourseTrust(course)).toMatchObject({ level: "local", canInstall: true, requiresConfirmation: true });
  });

  it("blocks incomplete published provenance", () => {
    const course = publishedCourse();
    delete course.manifest.contentHash;
    delete course.manifest.license;
    expect(assessCourseTrust(course)).toMatchObject({ level: "untrusted", canInstall: false });
  });
});
