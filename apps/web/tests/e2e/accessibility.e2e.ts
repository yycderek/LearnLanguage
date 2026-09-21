import { AxeBuilder } from "@axe-core/playwright";
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

async function expectNoAutomaticAccessibilityViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(violations, `${state} has automatic accessibility violations`).toEqual([]);
}

async function dismissFirstUseGuide(page: Page) {
  const close = page.getByRole("button", { name: /关闭使用帮助|Close guide/ });
  await expect(close).toBeVisible();
  await close.click();
  await expect(close).toBeHidden();
}

test("Learn entry and first-use guide meet the automatic WCAG baseline", async ({ page }) => {
  await page.goto(`${origin}/learn`);
  const firstGuide = page.getByRole("dialog");
  await expect(firstGuide).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(firstGuide.locator("button").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstGuide.locator("button").first()).toBeFocused();
  await expectNoAutomaticAccessibilityViolations(page, "Learn first-use guide");

  await dismissFirstUseGuide(page);
  await expect(page.getByRole("heading", { name: "从一门课程开始" })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page, "Learn course entry");

  const guideButton = page.getByRole("button", { name: "使用帮助" });
  await guideButton.click();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(guideButton).toBeFocused();
});

test("English Learn and settings meet the automatic WCAG baseline", async ({ page }) => {
  await page.goto(`${origin}/learn`);
  await dismissFirstUseGuide(page);
  await page.locator(".course-library-tools select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectNoAutomaticAccessibilityViolations(page, "English Learn course entry");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings and local data" })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page, "English settings center");

  const aiButton = page.getByRole("button", { name: "Configure AI" });
  await aiButton.click();
  await expect(page.getByRole("dialog", { name: "Choose your AI" })).toBeFocused();
  await expectNoAutomaticAccessibilityViolations(page, "English AI settings dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose your AI" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Settings and local data" })).toBeVisible();
  await expect(aiButton).toBeFocused();
});

test("Studio entry and first-use guide meet the automatic WCAG baseline", async ({ page }) => {
  await page.goto(`${origin}/studio`);
  await expect(page.getByRole("dialog")).toBeFocused();
  await expectNoAutomaticAccessibilityViolations(page, "Studio first-use guide");

  await dismissFirstUseGuide(page);
  await expect(page.getByRole("heading", { name: "先选择课程的目标语言" })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page, "Studio entry");

  const languageButton = page.getByRole("button", { name: "设置目标语言" });
  await languageButton.click();
  await expect(page.getByRole("dialog", { name: "添加目标语言" })).toBeFocused();
  await expectNoAutomaticAccessibilityViolations(page, "Add target language dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "添加目标语言" })).toBeHidden();
  await expect(languageButton).toBeFocused();

  const materialButton = page.getByRole("button", { name: "导入素材" });
  await materialButton.click();
  await expect(page.getByRole("dialog", { name: "导入素材生成课程草稿" })).toBeFocused();
  await expectNoAutomaticAccessibilityViolations(page, "Material import dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "导入素材生成课程草稿" })).toBeHidden();
  await expect(materialButton).toBeFocused();
});


test("Studio flow selected text meets the automatic WCAG baseline", async ({ page }) => {
  await page.goto(`${origin}/studio`);
  await dismissFirstUseGuide(page);
  await page.getByRole("button", { name: "设置目标语言" }).click();
  const dialog = page.getByRole("dialog", { name: "添加目标语言" });
  for (const [name, value] of [["中文名称", "意大利语"], ["英文名称", "Italian"], ["本地名称", "Italiano"]]) {
    await dialog.getByLabel(name, { exact: true }).fill(value);
  }
  await dialog.getByRole("button", { name: "保存并创建课程" }).click();
  await page.getByRole("button", { name: "课节流程", exact: true }).click();
  await expectNoAutomaticAccessibilityViolations(page, "Studio selected unit and lesson");
});
