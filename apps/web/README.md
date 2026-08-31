# LearnLanguage Web

LearnLanguage 的 Learn 学习空间与 Studio 无代码课程创作空间。Web 客户端使用与 Headless、未来移动端和桌面端共享的 Course Pack v2、应用服务和学习引擎。

面向使用者的操作说明见[完整使用手册](../../docs/USER_GUIDE.md)，发布检查见[Web/PWA 产品验收](../../docs/WEB_ACCEPTANCE.md)。本文件只保留 Web 客户端开发信息。

当前主要能力：

- 英语、日语、粤语和西班牙语内置入门课程，以及任意语种 Course Pack 导入；
- 学习目标、基础检查、个人计划、自适应今日安排、掌握度与复习；
- 可视化课程、单元、课节、知识点、语料和练习编辑；
- 从文本、网页、歌词、字幕、PDF 和 DOCX 生成私有课程草稿；
- 自定义 Language Pack、草稿修订、课程发布与完整性校验；
- 可选个人 AI，支持开放题反馈和课节内解释、提示、例子与提问；不配置 AI 也能完成确定性课程；
- PWA 安装入口、离线应用壳、用户确认更新和持久存储请求；
- 完整设备备份及恢复预览，也保留只迁移学习进度的精简档案。

网站无需登录。课程、草稿、语言包、学习进度和偏好默认保存在 IndexedDB；AI 密钥与同步令牌只保留在当前标签页，不进入完整备份。

当前暂不包含发音、录音、语音识别或语音评分。

## 本地运行

本仓库是 pnpm monorepo，只使用根目录锁文件。请从仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/web dev
```

完整验证：

```bash
pnpm check
pnpm --dir apps/web test
pnpm --dir apps/web lint
pnpm --dir apps/web test:e2e
```
