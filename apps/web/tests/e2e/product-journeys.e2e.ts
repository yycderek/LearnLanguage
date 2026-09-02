import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readdir, stat } from "node:fs/promises";
import { startProdServer } from "vinext/server/prod-server";
import { publishCourseDraft, sampleCourse } from "../../lib/course.ts";

let origin = "";
let closeServer: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  const { server, port } = await startProdServer({
    host: "127.0.0.1",
    port: 0,
    outDir: fileURLToPath(new URL("../../dist", import.meta.url)),
    noCompression: true,
  });
  origin = `http://127.0.0.1:${port}`;
  closeServer = () => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test.afterAll(async () => {
  await closeServer?.();
});

function observeBrowserProblems(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "unknown";
    const isCanceledRscNavigation = failure === "net::ERR_ABORTED" && new URL(url).pathname.endsWith(".rsc");
    if (url.startsWith(origin) && !isCanceledRscNavigation) {
      problems.push(`request failed: ${request.method()} ${url} (${failure})`);
    }
  });
  return problems;
}

async function dismissFirstUseGuide(page: Page) {
  const close = page.getByRole("button", { name: /关闭使用帮助|Close guide/ });
  await expect(close).toBeVisible();
  await close.click();
  await expect(close).toBeHidden();
}

async function readStudioWorkingCopy(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("learn-language-device-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("drafts", "readonly");
      const value = transaction.objectStore("drafts").get("studio-working-copy-v1");
      value.onerror = () => reject(value.error);
      value.onsuccess = () => resolve(value.result);
    };
  }));
}

async function readDevicePreference(page: Page, key: string) {
  return page.evaluate((preferenceKey) => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("learn-language-device-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("preferences", "readonly");
      const value = transaction.objectStore("preferences").get(preferenceKey);
      value.onerror = () => reject(value.error);
      value.onsuccess = () => resolve(value.result);
    };
  }), key);
}

async function acceptanceCourse(version: string) {
  const draft = sampleCourse("en");
  draft.manifest.id = "community.en.acceptance";
  draft.manifest.version = version;
  draft.manifest.title = { "zh-CN": "验收英语课程", en: "Acceptance English Course" };
  draft.manifest.description = { "zh-CN": `用于验证课程迁移流程的 ${version} 版本。`, en: `Version ${version} for validating course portability.` };
  draft.manifest.author = { id: "acceptance-author", displayName: "Acceptance Author" };
  draft.manifest.visibility = "community";
  draft.manifest.source = { kind: "original", title: "LearnLanguage acceptance fixture" };
  draft.manifest.license = { id: "CC-BY-4.0", attribution: "Acceptance Author" };
  return publishCourseDraft(draft);
}

async function expectResponsiveDocument(page: Page) {
  const documentState = await page.evaluate(() => ({
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    styleSheets: document.styleSheets.length,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }));
  expect(documentState.primary).toBe("#5a48d6");
  expect(documentState.styleSheets).toBeGreaterThan(0);
  expect(documentState.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(documentState.bodyBackground).not.toBe("rgba(0, 0, 0, 0)");
}

test("first visit redirects to a styled, language-neutral Learn entry", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  const response = await page.goto(`${origin}/`);

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await expect(page.getByRole("heading", { name: "从一门课程开始" })).toBeVisible();
  await expect(page.getByText("平台的学习流程不绑定日语或粤语")).toBeVisible();
  await expect(page.getByRole("region", { name: "选择学习方式" })).toBeVisible();
  await expectResponsiveDocument(page);

  const unnamedButtons = await page.locator("button:visible").evaluateAll((buttons) => buttons.filter((button) => {
    const element = button as HTMLElement;
    return !element.innerText.trim() && !element.getAttribute("aria-label") && !element.getAttribute("title");
  }).length);
  expect(unnamedButtons).toBe(0);
  expect(problems).toEqual([]);
});

test("Learn defers Studio material and document parsers until requested", async ({ page }) => {
  const assetsDirectory = fileURLToPath(new URL("../../dist/client/assets", import.meta.url));
  const documentAssets = (await readdir(assetsDirectory)).filter((name) => name.startsWith("document-import-") && name.endsWith(".js"));
  const heavyParserAssets = new Set((await Promise.all(documentAssets.map(async (name) => ({
    name,
    size: (await stat(new URL(`../../dist/client/assets/${name}`, import.meta.url))).size,
  })))).filter(({ size }) => size > 100 * 1024).map(({ name }) => name));
  const deferredAssetRequests: string[] = [];
  page.on("request", (request) => {
    const name = new URL(request.url()).pathname.split("/").at(-1) ?? "";
    if (heavyParserAssets.has(name) || name.startsWith("material-import-dialog-")) deferredAssetRequests.push(name);
  });

  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await expect(page.getByRole("heading", { name: "从一门课程开始" })).toBeVisible();
  expect(deferredAssetRequests).toEqual([]);

  await page.goto(`${origin}/studio`);
  await page.getByRole("button", { name: "导入素材" }).click();
  await expect(page.getByRole("dialog", { name: "导入素材生成课程草稿" })).toBeVisible();
  await expect.poll(() => deferredAssetRequests.some((name) => name.startsWith("material-import-dialog-"))).toBeTruthy();
  expect(deferredAssetRequests.filter((name) => heavyParserAssets.has(name))).toEqual([]);
});
test("complete device backups are previewed before any restore choice", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await page.getByText("课程与数据管理", { exact: true }).click();
  await expect(page.getByRole("button", { name: /保护本地数据|本地数据已保护|浏览器不支持保护/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出全部数据" })).toBeVisible();

  const backup = {
    kind: "learn-language-device-backup",
    schemaVersion: 1,
    exportedAt: "2026-08-22T12:00:00.000Z",
    collections: { preferences: [], drafts: [], languagePacks: [], installedCourses: [], courseRecords: [], learningPlans: [] },
  };
  await page.getByLabel("选择完整备份").setInputFiles({ name: "device-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText("恢复前预览", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "合并恢复" })).toBeVisible();
  await expect(page.getByRole("button", { name: "清空本机后恢复" })).toBeVisible();
  await expect(page.getByRole("button", { name: "取消" })).toBeVisible();

  const reload = page.waitForEvent("load");
  await page.getByRole("button", { name: "合并恢复" }).click();
  await reload;
  await expect(page.getByRole("heading", { name: "从一门课程开始" })).toBeVisible();
  await expect(page.getByText("恢复前预览", { exact: true })).toBeHidden();
  expect(problems).toEqual([]);
});

test("Personal AI connection settings keep credentials session-only", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.route(`${origin}/api/ai`, async (route) => {
    const body = route.request().postDataJSON() as { action?: string; apiKey?: string };
    expect(body.action).toBe("test");
    expect(body.apiKey).toBe("acceptance-secret");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Connection ready" }) });
  });

  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "配置 AI" }).click();

  const dialog = page.getByRole("dialog", { name: "选择你使用的 AI" });
  await dialog.getByLabel("模型 ID").fill("acceptance-model");
  await dialog.getByLabel("API 密钥（兼容服务可不填）").fill("acceptance-secret");
  await dialog.getByRole("button", { name: "测试连接" }).click();
  await expect(dialog.getByText("连接成功，可以用于开放题反馈和课节内 AI 导师。")).toBeVisible();
  await dialog.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByText("OpenAI 配置已保存；密钥将在关闭标签页后清除")).toBeVisible();

  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("learn-language-ai-key-session-v1"))).toBe("acceptance-secret");
  await expect.poll(() => readDevicePreference(page, "ai")).toMatchObject({ provider: "openai", model: "acceptance-model", apiKey: "" });
  expect(problems).toEqual([]);
});

test("published community Course Packs can be imported, updated, and exported", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);

  const first = await acceptanceCourse("1.0.0");
  const firstConfirmation = page.waitForEvent("dialog");
  await page.getByLabel("选择文件", { exact: true }).setInputFiles({
    name: "acceptance-1.0.0.course.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(first)),
  });
  const firstDialog = await firstConfirmation;
  expect(firstDialog.message()).toContain("非官方课程");
  expect(firstDialog.message()).toContain("CC-BY-4.0");
  await firstDialog.accept();
  await expect(page.getByText("已导入并安装「验收英语课程」")).toBeVisible();

  await page.getByRole("button", { name: "我的课程" }).click();
  const card = page.locator(".library-course-card").filter({ hasText: "验收英语课程" });
  await expect(card).toContainText("用户课程");
  await expect(card).toContainText("v1.0.0");
  const downloadPromise = page.waitForEvent("download");
  await card.getByRole("button", { name: "导出备份" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("community.en.acceptance-1.0.0.course.json");

  const second = await acceptanceCourse("1.1.0");
  const secondConfirmation = page.waitForEvent("dialog");
  await page.getByLabel("选择文件", { exact: true }).setInputFiles({
    name: "acceptance-1.1.0.course.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(second)),
  });
  const secondDialog = await secondConfirmation;
  await secondDialog.accept();
  await expect(page.getByText("已从文件更新至 v1.1.0，学习进度已保留")).toBeVisible();
  await expect(card).toContainText("v1.1.0");
  expect(problems).toEqual([]);
});
test("the Learn entry supports keyboard navigation and announced interface changes", async ({ page }) => {
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await page.reload();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: /跳到主要内容|Skip to main content/ });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const unlabeledFields = await page.locator("input:visible, select:visible, textarea:visible").evaluateAll((fields) => fields.filter((field) => {
    const element = field as HTMLInputElement;
    return !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby");
  }).length);
  expect(unlabeledFields).toBe(0);

  await page.locator(".course-library-tools select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the installed shell reopens Learn while offline", async ({ page, context }) => {
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  await page.reload();
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
  });

  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "从一门课程开始" })).toBeVisible();
    await expect(page.locator(".offline-status")).toContainText("离线模式");
  } finally {
    await context.setOffline(false);
  }
});

test("first course start saves an optional personal plan before entering the learning map", async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: Array<{ text: string; lang: string; rate: number; voice?: string }> = [];
    Object.defineProperty(globalThis, "__pronunciationSpoken", { configurable: true, value: spoken });
    class TestSpeechSynthesisUtterance {
      text: string;
      lang = "";
      rate = 1;
      voice: { voiceURI: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: TestSpeechSynthesisUtterance });
    Object.defineProperty(globalThis, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: () => undefined,
        getVoices: () => [{ voiceURI: "voice-en", name: "Test English", lang: "en-US", default: true, localService: true }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        speak: (utterance: TestSpeechSynthesisUtterance) => {
          spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate, ...(utterance.voice ? { voice: utterance.voice.voiceURI } : {}) });
          utterance.onstart?.();
          queueMicrotask(() => utterance.onend?.());
        },
      },
    });
  });
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);

  await page.getByRole("button", { name: "设置", exact: true }).click();
  const englishVoiceSettings = page.locator(".pronunciation-settings-panel article").filter({ hasText: "英语" });
  await expect(englishVoiceSettings).toBeVisible();
  await englishVoiceSettings.locator("select").nth(0).selectOption("voice-en");
  await englishVoiceSettings.locator("select").nth(1).selectOption("slow");
  await englishVoiceSettings.getByRole("button", { name: "试听" }).click();
  await expect.poll(() => page.evaluate(() => (globalThis as typeof globalThis & { __pronunciationSpoken: unknown[] }).__pronunciationSpoken.length)).toBe(1);
  await page.evaluate(() => { (globalThis as typeof globalThis & { __pronunciationSpoken: unknown[] }).__pronunciationSpoken.length = 0; });
  await page.getByRole("button", { name: "返回学习首页" }).click();

  await page.getByRole("button", { name: "一键开始学习" }).first().click();
  await expect(page.getByRole("heading", { name: "你为什么学习这门语言？" })).toBeVisible();
  await page.getByRole("button", { name: "跳过评估，从第一课开始" }).click();
  await expect(page.getByRole("heading", { name: "你的第一周路线已经准备好" })).toBeVisible();
  await page.getByRole("button", { name: "保存计划并开始" }).click();
  await expect(page.getByRole("button", { name: "保存并退出" })).toBeVisible();
  await expect(page.locator(".learner-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "朗读" }).first()).toBeEnabled();
  await page.getByRole("button", { name: "朗读" }).first().click();
  await page.getByRole("button", { name: "正常语速" }).first().click();
  const spoken = await page.evaluate(() => (globalThis as typeof globalThis & { __pronunciationSpoken: Array<{ text: string; lang: string; rate: number; voice?: string }> }).__pronunciationSpoken);
  expect(spoken).toHaveLength(2);
  expect(spoken[0]?.text).toBeTruthy();
  expect(spoken.map((item) => item.lang)).toEqual(["en", "en"]);
  expect(spoken.map((item) => item.rate)).toEqual([0.72, 1]);
  expect(spoken.map((item) => item.voice)).toEqual(["voice-en", "voice-en"]);
  await page.getByRole("button", { name: "AI 导师" }).click();
  await expect(page.getByRole("heading", { name: "可选 AI 学习导师" })).toBeVisible();
  await expect(page.getByText("需要先配置个人 AI")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开 AI 设置" })).toBeVisible();
  await page.getByRole("button", { name: "关闭 AI 导师" }).click();
  await page.getByRole("button", { name: "保存并退出" }).click();

  await expect(page.getByText("本课学习地图")).toBeVisible();
  await expect(page.getByText("个人学习计划")).toBeVisible();
  await expect(page.getByRole("heading", { name: "今天学什么" })).toBeVisible();
  await expect(page.locator(".adaptive-agenda-card")).toContainText("本周实际进度");
  await expect(page.getByRole("navigation", { name: "学习导航" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("本课学习地图")).toBeVisible();
  await expect(page.getByText("个人学习计划")).toBeVisible();
  await expect(page.getByRole("heading", { name: "今天学什么" })).toBeVisible();
  await expect(page.locator(".adaptive-agenda-card")).toContainText("本周实际进度");
  await expectResponsiveDocument(page);
  expect(problems).toEqual([]);
});

test("interface language follows the learner into the separate Studio space", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);

  await page.locator(".course-library-tools select").selectOption("en");
  await expect(page.getByRole("heading", { name: "Start with a course" })).toBeVisible();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Open Studio" }).click();

  await expect(page).toHaveURL(`${origin}/studio`);
  await expect(page.getByRole("heading", { name: "Start with the course's target language" })).toBeVisible();
  await expect(page.getByText("Studio does not default to Japanese or Cantonese.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Learn" })).toBeVisible();
  await expectResponsiveDocument(page);
  expect(problems).toEqual([]);
});

test("a non-technical author can create a new language, save a draft, and preview it", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/studio`);
  await dismissFirstUseGuide(page);

  await page.getByRole("button", { name: "设置目标语言" }).click();
  const dialog = page.getByRole("dialog", { name: "添加目标语言" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("语言 ID").fill("it");
  await dialog.getByLabel("语言符号").fill("It");
  await dialog.getByLabel("中文名称").fill("意大利语");
  await dialog.getByLabel("英文名称").fill("Italian");
  await dialog.getByLabel("本地名称").fill("Italiano");
  await dialog.getByLabel("书写系统代码").fill("Latn");
  await dialog.getByRole("button", { name: "保存并创建课程" }).click();

  await expect(page.getByRole("navigation", { name: "工作台导航" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "意大利语咖啡店点单", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByText(/已保存到当前设备 · 修订 1/)).toBeVisible();

  await page.getByRole("button", { name: "预览学习流程" }).click();
  await expect(page.getByText("STUDIO PREVIEW", { exact: true })).toBeVisible();
  await expect(page.getByText("临时预览档案 · 不保存")).toBeVisible();
  await expectResponsiveDocument(page);
  expect(problems).toEqual([]);
});

test("an author can turn material into a recoverable private visual draft", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(origin + "/studio");
  await dismissFirstUseGuide(page);

  await page.getByRole("button", { name: "导入素材" }).click();
  const dialog = page.getByRole("dialog", { name: "导入素材生成课程草稿" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("目标语言").selectOption("ja");
  await dialog.getByLabel("课程标题").fill("城市散步");
  await dialog.getByLabel("素材正文").fill("I walk through the old town. The market is busy today. I stop for coffee and write a postcard.");
  await dialog.getByRole("button", { name: "加入素材列表" }).click();
  await expect(dialog.getByText(/暂估 [A-C][1-2]/)).toBeVisible();
  await dialog.getByLabel(/我确认有权将这些素材用于自己的课程/).check();
  await dialog.getByRole("button", { name: "生成可编辑草稿" }).click();

  await expect(page.getByText(/已生成 1 个单元、.*4 个练习/)).toBeVisible();
  await page.getByRole("button", { name: "例句" }).click();
  await expect(page.getByText("I walk through the old town.")).toBeVisible();
  await page.getByRole("button", { name: "课节流程" }).click();
  await expect(page.getByRole("heading", { name: "课程单元与课节" })).toBeVisible();
  await expect(page.getByRole("region", { name: "课程单元" })).toBeVisible();
  await expect(page.getByText("课节 ID")).toHaveCount(0);

  await expect(page.locator(".autosave-state.saved")).toContainText("修改已自动保存", { timeout: 5000 });
  const savedBeforeReload = await readStudioWorkingCopy(page) as { course?: { manifest?: { title?: Record<string, string> } } };
  expect(savedBeforeReload.course?.manifest?.title?.["zh-CN"]).toBe("城市散步");
  await page.reload();
  const savedAfterReload = await readStudioWorkingCopy(page) as { course?: { manifest?: { title?: Record<string, string> } } };
  expect(savedAfterReload.course?.manifest?.title?.["zh-CN"]).toBe("城市散步");
  await expect(page.getByRole("heading", { name: "城市散步", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "课节流程" }).click();
  await expect(page.getByRole("heading", { name: "课程单元与课节" })).toBeVisible();
  await expectResponsiveDocument(page);
  expect(problems).toEqual([]);
});


test("R33 settings center previews destructive actions and resets only the current course", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);

  await page.getByRole("button", { name: "一键开始学习" }).first().click();
  await page.getByRole("button", { name: "跳过评估，从第一课开始" }).click();
  await page.getByRole("button", { name: "保存计划并开始" }).click();
  await page.getByRole("button", { name: "保存并退出" }).click();
  await page.locator("button:visible").filter({ hasText: "设置" }).first().click();

  await expect(page.getByRole("heading", { name: "设置与本地数据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "配置 AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出全部数据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "删除全部本地数据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "备份后重建设备数据库" })).toBeVisible();
  await expectResponsiveDocument(page);

  const deleteDialogPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "删除全部本地数据" }).click();
  const deleteDialog = await deleteDialogPromise;
  expect(deleteDialog.message()).toContain("永久删除");
  expect(deleteDialog.message()).toContain("完整设备备份");
  await deleteDialog.dismiss();

  const resetDialogPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "重置当前课程学习" }).click();
  const resetDialog = await resetDialogPromise;
  expect(resetDialog.message()).toContain("课程本身仍会保留");
  expect(resetDialog.message()).toContain("共");
  await resetDialog.accept();

  await expect(page.getByText("还没有个人学习计划")).toBeVisible();
  const counts = await page.evaluate(() => new Promise<{ courses: number; records: number; plans: number }>((resolve, reject) => {
    const request = indexedDB.open("learn-language-device-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction(["installedCourses", "courseRecords", "learningPlans"], "readonly");
      const courses = transaction.objectStore("installedCourses").count();
      const records = transaction.objectStore("courseRecords").count();
      const plans = transaction.objectStore("learningPlans").count();
      transaction.oncomplete = () => resolve({ courses: courses.result, records: records.result, plans: plans.result });
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  expect(counts).toEqual({ courses: 1, records: 0, plans: 0 });
  expect(problems).toEqual([]);
});
