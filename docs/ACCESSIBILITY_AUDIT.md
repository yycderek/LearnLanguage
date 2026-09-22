# Web 无障碍自动审计

本基线用于在尚无真实用户参与时，尽早阻止可机器识别的界面退化。它不是 WCAG 合规认证，也不能替代屏幕阅读器、低视力用户或键盘用户的真实测试。

## 当前自动门禁

`apps/web/tests/e2e/accessibility.e2e.ts` 使用 Playwright 与官方 `@axe-core/playwright`，在桌面 Chromium 和 Pixel 7 移动视口检查：

- Learn 首次帮助、中文课程入口、英文课程入口和英文设置中心；
- Studio 首次帮助、语言中立入口、添加目标语言和素材导入；
- 个人 AI 设置弹窗；
- Studio 课节流程中选中单元、选中课节的文字对比度；
- WCAG 2 A、AA、2.1 A、AA 与 2.2 AA 的 axe 可自动判断规则；
- 弹窗初始焦点、Tab/Shift+Tab 焦点环、Esc 关闭和关闭后的焦点恢复；
- 移动端隐藏可见标签后，表单控件仍保留可访问名称。

运行：

```bash
pnpm --dir apps/web exec playwright install chromium
pnpm --dir apps/web test
pnpm --dir apps/web test:e2e
```

当前门禁不忽略 `color-contrast`，也不为已知问题设置规则豁免。自动扫描发现并修复了课程状态提示、课程目标说明、首次帮助、Studio 侧栏、编辑器标签和同步状态的对比度问题。

工具与设置的键盘展开、Esc/外部点击/焦点离开收起、关闭帮助后的焦点恢复，以及语言筛选，另由 `product-journeys.e2e.ts` 验证。2026-09-21 对工具展开状态进行过桌面和手机视口的补充 axe 检查，未发现所扫描规则的违规；该补充检查不等同于持久化 CI 中的全部扫描范围。

## 仍需真人验证

- NVDA、VoiceOver 或 TalkBack 的阅读顺序、播报质量和操作效率；
- 200%–400% 缩放、系统高对比度、色觉差异及长时间阅读舒适度；
- 仅键盘完成整节课、备份恢复和完整课程创作；
- 文案、导航与课程术语是否容易理解。

真人参与条件具备后，继续使用[新手可用性测试](./NEWCOMER_USABILITY_TEST.md)。在此之前，只能声明“自动基线通过”，不能声明“真实用户无障碍验收通过”。
