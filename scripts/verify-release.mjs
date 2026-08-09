import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "GOVERNANCE.md",
  "docs/ARCHITECTURE.md",
  "docs/MIGRATIONS.md",
  "docs/SELF_HOSTING.md",
  ".github/workflows/ci.yml",
  ".github/workflows/prerelease.yml",
  "test/fixtures/migrations/course-pack-v1.json",
  "test/fixtures/migrations/course-pack-v2.json",
];

await Promise.all(requiredFiles.map((path) => access(new URL(path, root))));

const manifests = [
  "package.json",
  "apps/web/package.json",
  "packages/application/package.json",
  "packages/engine/package.json",
  "packages/language-runtime/package.json",
  "packages/protocol/package.json",
  "packages/sync/package.json",
];
for (const path of manifests) {
  const manifest = JSON.parse(await readFile(new URL(path, root), "utf8"));
  if (manifest.license !== "Apache-2.0") throw new Error(`${path} must declare Apache-2.0`);
}

const schema = JSON.parse(await readFile(new URL("src/schemas/course-pack.schema.json", root), "utf8"));
if (schema.properties?.schemaVersion?.const !== 2) throw new Error("Course Pack schema version must remain pinned to v2");

const legacy = JSON.parse(await readFile(new URL("test/fixtures/migrations/course-pack-v1.json", root), "utf8"));
const current = JSON.parse(await readFile(new URL("test/fixtures/migrations/course-pack-v2.json", root), "utf8"));
if (legacy.schemaVersion !== 1 || current.schemaVersion !== 2) throw new Error("Migration fixtures are not pinned to v1 and v2");

const hosting = JSON.parse(await readFile(new URL("apps/web/.openai/hosting.json", root), "utf8"));
const extraHostingKeys = Object.keys(hosting).filter((key) => !["project_id", "d1", "r2"].includes(key));
if (!hosting.project_id || extraHostingKeys.length > 0) throw new Error("Sites hosting metadata contains invalid keys");

console.log(`release verification passed: ${requiredFiles.length} files, ${manifests.length} manifests`);
