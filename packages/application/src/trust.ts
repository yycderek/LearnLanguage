import type { CoursePack } from "@learn-language/protocol";

export type CourseTrustLevel = "official" | "community" | "local" | "untrusted";
export type CourseTrustIssueCode =
  | "not-published"
  | "content-hash-missing"
  | "license-missing"
  | "official-author-unrecognized"
  | "source-url-insecure"
  | "source-attribution-missing";

export interface CourseTrustIssue {
  code: CourseTrustIssueCode;
  severity: "warning" | "blocked";
}

export interface CourseTrustReport {
  level: CourseTrustLevel;
  canInstall: boolean;
  requiresConfirmation: boolean;
  issues: readonly CourseTrustIssue[];
}

export interface CourseTrustPolicy {
  trustedOfficialAuthorIds: ReadonlySet<string>;
}

export const defaultCourseTrustPolicy: CourseTrustPolicy = {
  trustedOfficialAuthorIds: new Set(["learn-language"]),
};

export function assessCourseTrust(
  course: CoursePack,
  policy: CourseTrustPolicy = defaultCourseTrustPolicy,
): CourseTrustReport {
  const issues: CourseTrustIssue[] = [];
  if (course.manifest.status !== "published") issues.push({ code: "not-published", severity: "blocked" });
  if (!course.manifest.contentHash) issues.push({ code: "content-hash-missing", severity: "blocked" });
  if (!course.manifest.license?.id) issues.push({ code: "license-missing", severity: "blocked" });

  const sourceUrl = course.manifest.source.url;
  if (sourceUrl) {
    try {
      if (new URL(sourceUrl).protocol !== "https:") issues.push({ code: "source-url-insecure", severity: "warning" });
    } catch {
      issues.push({ code: "source-url-insecure", severity: "warning" });
    }
  }
  if (["imported", "forked"].includes(course.manifest.source.kind)
    && !course.manifest.source.title
    && !course.manifest.license?.attribution) {
    issues.push({ code: "source-attribution-missing", severity: "warning" });
  }

  let level: CourseTrustLevel;
  if (course.manifest.visibility === "official") {
    if (policy.trustedOfficialAuthorIds.has(course.manifest.author.id)) level = "official";
    else {
      level = "untrusted";
      issues.push({ code: "official-author-unrecognized", severity: "blocked" });
    }
  } else if (course.manifest.visibility === "community") level = "community";
  else level = "local";

  const canInstall = !issues.some((issue) => issue.severity === "blocked");
  return {
    level: canInstall ? level : "untrusted",
    canInstall,
    requiresConfirmation: canInstall && level !== "official",
    issues,
  };
}
