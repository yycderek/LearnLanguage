# LearnLanguage

[![CI](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml/badge.svg)](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml)

LearnLanguage 是一个通用、可切换语种的语言学习工具。学习者可以直接使用内置课程，也可以导入别人分享的课程；课程作者可以在可视化界面中创建自己的语言课程。

## 直接使用

- [打开学习空间](https://learnlanguage-studio.yycderek.chatgpt.site/learn)
- [打开课程创作空间](https://learnlanguage-studio.yycderek.chatgpt.site/studio)

网站公开可访问，不需要 ChatGPT 登录或 LearnLanguage 账户。课程、学习进度和草稿默认保存在当前浏览器。

## 五分钟快速开始

1. 在学习空间选择日语或粤语入门课程。
2. 点击“一键开始学习”，直接进入第一课。
3. 按“理解—练习—运用”完成课节。
4. 回到学习首页继续下一课或完成待复习内容。

当前内置课程属于 **CEFR Can-do A1 核心入门内容**。日语课程包含 JLPT N5 相关内容，但不是完整的 N5 备考课程。现阶段暂不提供录音、语音识别或发音评分练习。

## 创建自己的课程

1. 进入课程创作空间，从模板开始创建课程。
2. 在可视化界面编辑知识点、例句、练习和课节顺序。
3. 保存草稿并预览完整学习流程。
4. 通过发布检查后，将课程安装到学习空间进行正式学习。
5. 如需分享，导出已发布课程文件；其他用户可在“课程与数据管理”中导入。

普通课程作者不需要编辑 JSON。新的目标语言可以使用内置 Language Pack，也可以创建或导入自定义 Language Pack。

## AI、本地数据与备份

- AI 是可选的；基础练习无需配置 AI。
- 自由回答需要额外反馈时，可在课程创作空间的“AI 设置”中配置自己的服务商和模型。
- API 密钥只保留在当前标签页，关闭标签页后清除。
- 清除网站数据、更换浏览器或更换设备时，本地内容不会自动迁移。
- 学习档案、课程草稿、已发布课程和自定义 Language Pack 需要分别导出备份。

学习档案备份、课程导入和可选设备同步位于学习空间底部的“课程与数据管理”。

## 本地开发

需要 Node.js 22 或更高版本，以及 pnpm。

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm --dir apps/web test
pnpm --dir apps/web lint
```

主要入口：

- `apps/web`：Learn 和 Studio Web 应用
- `apps/headless`：无界面客户端示例
- `packages/engine`：学习状态机与事件
- `packages/application`：跨客户端应用服务
- `packages/protocol`：课程包与学习协议
- `packages/language-runtime`：语言能力与适配器运行时
- `packages/sync`：可选同步协议与参考实现

## 项目文档

- [架构设计](docs/ARCHITECTURE.md)
- [课程格式与内置课程](docs/COURSE_LIBRARY.md)
- [自部署指南](docs/SELF_HOSTING.md)
- [贡献指南](CONTRIBUTING.md)
- [安全政策](SECURITY.md)

软件采用 [Apache License 2.0](LICENSE)。课程内容使用各 Course Pack 自己声明的许可证。
