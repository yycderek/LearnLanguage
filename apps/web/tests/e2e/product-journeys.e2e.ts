import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { startProdServer } from "vinext/server/prod-server";

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
    if (request.url().startsWith(origin)) {
      problems.push(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
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

test("one-click course start persists the active lesson and returns to the learning map", async ({ page }) => {
  const problems = observeBrowserProblems(page);
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);

  await page.getByRole("button", { name: "一键开始学习" }).first().click();
  await expect(page.getByRole("button", { name: "保存并退出" })).toBeVisible();
  await expect(page.locator(".learner-shell")).toBeVisible();
  await page.getByRole("button", { name: "保存并退出" }).click();

  await expect(page.getByText("本课学习地图")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "学习导航" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("本课学习地图")).toBeVisible();
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
  await dialog.getByLabel("语言 ID").fill("es");
  await dialog.getByLabel("语言符号").fill("Es");
  await dialog.getByLabel("中文名称").fill("西班牙语");
  await dialog.getByLabel("英文名称").fill("Spanish");
  await dialog.getByLabel("本地名称").fill("Español");
  await dialog.getByLabel("书写系统代码").fill("Latn");
  await dialog.getByRole("button", { name: "保存并创建课程" }).click();

  await expect(page.getByRole("navigation", { name: "工作台导航" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "西班牙语咖啡店点单", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByText(/已保存到当前设备 · 修订 1/)).toBeVisible();

  await page.getByRole("button", { name: "预览学习流程" }).click();
  await expect(page.getByText("STUDIO PREVIEW", { exact: true })).toBeVisible();
  await expect(page.getByText("临时预览档案 · 不保存")).toBeVisible();
  await expectResponsiveDocument(page);
  expect(problems).toEqual([]);
});
