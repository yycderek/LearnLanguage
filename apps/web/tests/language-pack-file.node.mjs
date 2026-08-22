import assert from "node:assert/strict";
import test from "node:test";
import { builtInLanguagePacks } from "../lib/language-pack.ts";
import {
  languagePackFileName,
  languagePackUsage,
  MAX_LANGUAGE_PACK_FILE_BYTES,
  parseLanguagePackFile,
  serializeLanguagePackFile,
} from "../lib/language-pack-file.ts";

test("a Language Pack survives an export and import round trip", () => {
  const pack = builtInLanguagePacks.find((item) => item.id === "ja");
  assert.ok(pack);
  const serialized = serializeLanguagePackFile(pack);
  const parsed = parseLanguagePackFile(serialized);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.pack, pack);
  assert.ok(serialized.endsWith("\n"));
  assert.equal(MAX_LANGUAGE_PACK_FILE_BYTES, 1024 * 1024);
});

test("Language Pack files reject ambiguous scripts and invalid adapters", () => {
  const japanese = builtInLanguagePacks.find((item) => item.id === "ja");
  assert.ok(japanese);
  const duplicateScript = structuredClone(japanese);
  duplicateScript.id = "duplicate-script";
  duplicateScript.scripts.push(structuredClone(duplicateScript.scripts[0]));
  assert.match(parseLanguagePackFile(JSON.stringify(duplicateScript)).error, /code 重复/u);

  const twoPrimary = structuredClone(japanese);
  twoPrimary.id = "two-primary";
  twoPrimary.scripts.push({ code: "Latn", name: { en: "Latin" }, direction: "ltr", primary: true });
  assert.match(parseLanguagePackFile(JSON.stringify(twoPrimary)).error, /只能有一种主要书写系统/u);

  const missingAdapter = structuredClone(japanese);
  missingAdapter.id = "missing-adapter";
  delete missingAdapter.adapter;
  assert.match(parseLanguagePackFile(JSON.stringify(missingAdapter)).error, /需要 adapter 定义/u);

  const unknownCapability = structuredClone(japanese);
  unknownCapability.id = "unknown-capability";
  unknownCapability.adapter.capabilities.push("speech-scoring");
  assert.match(parseLanguagePackFile(JSON.stringify(unknownCapability)).error, /不受支持的能力/u);
});

test("Language Pack deletion is blocked while any product space references it", () => {
  assert.deepEqual(languagePackUsage("fr", undefined, [], []), {
    activeEditor: false,
    draftCount: 0,
    installedCourseCount: 0,
    canDelete: true,
  });
  assert.deepEqual(languagePackUsage("fr", "fr", ["fr", "de"], ["fr", "fr"]), {
    activeEditor: true,
    draftCount: 1,
    installedCourseCount: 2,
    canDelete: false,
  });
});

test("Language Pack filenames cannot escape the download directory", () => {
  const pack = structuredClone(builtInLanguagePacks[0]);
  pack.id = "../../unsafe language";
  assert.equal(languagePackFileName(pack), "unsafe-language.language-pack.json");
  assert.doesNotMatch(languagePackFileName(pack), /[\\/ ]/u);
});
