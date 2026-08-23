# LearnLanguage

[![CI](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml/badge.svg)](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml)

LearnLanguage 是一个可切换语种的语言学习工具。可以直接学习内置课程，也可以导入或可视化创建自己的课程。

## 直接使用

- [我要学习](https://learnlanguage-studio.yycderek.chatgpt.site/learn)
- [我要创建课程](https://learnlanguage-studio.yycderek.chatgpt.site/studio)

网站公开可访问，不需要 ChatGPT 登录或 LearnLanguage 账户。

## 我想学习

1. 打开学习空间，选择英语、日语、粤语或已导入的课程。
2. 点击“一键开始学习”；可以接受推荐起点，也可以自己选择课节。
3. 完成课程后回到首页，“今天学什么”会安排继续学习和到期复习。

## 我想创建课程

1. 打开课程创作空间，从模板开始，或导入自己的文本和文档。
2. 在可视化编辑器中整理单元、课节和练习，然后预览学习流程。
3. 发布并安装到学习空间；需要分享时导出课程文件。

课程作者不需要编辑 JSON 或技术 ID。新的目标语言可以使用内置语言包，也可以创建或导入自定义 Language Pack。

## 数据保存提醒

课程、学习进度和草稿默认只保存在当前浏览器，不会自动迁移到其他设备。请在“课程库 → 课程与数据管理”中定期导出完整设备备份。

AI 为可选功能；基础学习和课程编辑无需配置 AI。AI 密钥不会进入完整设备备份。

安装、离线使用、备份恢复、AI 隐私、支持的素材格式和课程等级说明，见[完整使用手册](docs/USER_GUIDE.md)。

## 当前范围

- 内置英语、日语和粤语核心入门课程，也支持任意语种的自定义课程。
- 当前课程用于入门学习，不等同于完整的 CEFR 或 JLPT 考试认证课程。
- 暂不提供录音、语音识别或发音评分。

## 本地开发

需要 Node.js 22 或更高版本，以及 pnpm。请从仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm --dir apps/web test
pnpm --dir apps/web lint
```

主要代码位于 `apps/web` 和 `packages`。项目使用共享协议、应用服务和学习引擎，为未来移动端与桌面端保留客户端边界。

## 项目文档

- [完整使用手册](docs/USER_GUIDE.md)
- [架构设计](docs/ARCHITECTURE.md)
- [课程格式与内置课程](docs/COURSE_LIBRARY.md)
- [自部署指南](docs/SELF_HOSTING.md)
- [贡献指南](CONTRIBUTING.md)
- [安全政策](SECURITY.md)

软件采用 [Apache License 2.0](LICENSE)。课程内容使用各 Course Pack 自己声明的许可证。
