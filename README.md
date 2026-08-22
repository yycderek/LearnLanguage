# LearnLanguage

[![CI](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml/badge.svg)](https://github.com/yycderek/LearnLanguage/actions/workflows/ci.yml)

LearnLanguage 是一个通用、可切换语种的语言学习工具。学习者可以直接使用内置课程，也可以导入别人分享的课程；课程作者可以在可视化界面中创建自己的语言课程。

## 直接使用

- [打开学习空间](https://learnlanguage-studio.yycderek.chatgpt.site/learn)
- [打开课程创作空间](https://learnlanguage-studio.yycderek.chatgpt.site/studio)

网站公开可访问，不需要 ChatGPT 登录或 LearnLanguage 账户。课程、学习进度和草稿默认保存在当前浏览器。

## 五分钟快速开始

1. 在学习空间选择英语、日语或粤语入门课程。
2. 点击“一键开始学习”；首次学习该课程时，可以设置目标与每周节奏，并选择参加基础检查或直接跳过。
3. 确认建议的开始课节，再按“理解—练习—运用”完成课程。
4. 回到学习首页查看“今天学什么”：系统会按本周实际进度、未完成课节和到期复习，安排继续学习、下一课或复习任务。

当前三门内置课程属于 **CEFR Can-do A1 核心入门内容**，不代表完整的 A1 考试认证课程。英语从字母与大小写、`be` 和基础语序开始；日语课程包含 JLPT N5 相关内容，但不是完整的 N5 备考课程。现阶段暂不提供录音、语音识别或发音评分练习。

## 创建自己的课程

1. 进入课程创作空间并选择目标语言；可以从模板开始，也可以粘贴文本、导入网页，或上传文章、对话、歌词、字幕、PDF 和 DOCX 生成私有草稿。
2. 用“单元 → 课节 → 学习步骤”组织课程，通过可视化选择器关联目标、知识点、例句和练习。
3. 修改会自动保存为当前设备的工作副本；点击“保存草稿”可建立可恢复的明确修订。
4. 预览完整学习流程，并根据发布检查清单补齐课程内容。
5. 发布后安装到学习空间；如需分享，导出已发布课程文件。

普通课程作者不需要编辑 JSON 或手动维护技术 ID。素材会按份生成课程单元，并自动给出难度估计、候选词汇、确定性填空与排序答案，以及主旨和迁移任务。歌词和字幕保留原分行；歌谱、音符和音频暂不解析。基础生成默认在浏览器内完成，网页导入由本站读取公开页面；作者也可以主动启用自己的 AI 来补充翻译、语法和释义。所有自动结果都需要在发布前复核。新的目标语言可以使用内置 Language Pack，也可以创建或导入自定义 Language Pack。

## AI、本地数据与备份

- AI 是可选的；基础练习无需配置 AI。
- 自由回答需要反馈，或素材课程需要翻译、语法、释义和更细的难度估计时，可在课程创作空间的“个人 AI”中配置自己的服务商和模型。
- API 密钥只保留在当前标签页，关闭标签页后清除；启用素材 AI 增强时，素材会发送给该服务。
- 清除网站数据、更换浏览器或更换设备时，本地内容不会自动迁移。
- 学习档案包含已完成课节、掌握度、复习安排和个人学习计划；课程草稿、已发布课程和自定义 Language Pack 仍需分别导出备份。
- 首次在线打开 Learn 或 Studio 后，网页会缓存应用外壳；断网时可继续打开已缓存页面并使用设备本地数据。AI、网页素材导入和同步仍需网络。

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
