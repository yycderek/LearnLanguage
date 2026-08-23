# LearnLanguage 产品定位与竞品基线

基线日期：2026-08-23。

本文件记录当前产品完整性、主要竞品能力和 LearnLanguage 的竞争位置。市场功能会变化，实施重大产品决策前应重新核对官方信息。

## 核心定位

LearnLanguage 不应定位为另一个 Duolingo，也不应直接复制真人教师市场。更合适的定位是：

> 面向开源和自部署、本地优先、课程与数据由用户掌控的通用语言学习和无代码课程创作平台。

仓库当前仍为 private；“面向开源”描述 Apache-2.0 许可、治理和自部署方向，不表示代码已经公开可见。

核心用户包括需要创建专属课程的教师与学习者、学习小语种或传承语的人群、重视隐私和自托管的用户，以及需要复用无头学习引擎的客户端开发者。

## 产品完整性基线

现有学习、创作、语言扩展、离线、备份和跨客户端架构已经形成可用闭环。R33 已补齐用户控制的数据删除与学习重置、课程级结业总结、从既有证据派生的薄弱项练习、本地数据故障恢复、统一设置入口和完整回归测试。

课程扩充、AI 学习导师、课程社区、移动端、桌面端和发音训练不作为 R33 的完成条件。

## 功能对比

| 产品 | 当前强项 | 相对 LearnLanguage 的优势 | LearnLanguage 的差异 |
| --- | --- | --- | --- |
| LearnLanguage | 确定性学习引擎、计划与复习、完整 Course Pack、无代码创作、任意语种扩展、本地离线与完整备份 | 内容规模、音频、口语、人类反馈和用户生态仍弱 | 无需账户、面向开源与自部署、本地优先、用户拥有课程与数据、可自带 AI、引擎与客户端解耦 |
| Duolingo | 大规模结构化课程、个性化练习、积分与连续学习机制、AI Roleplay 和 Video Call | 内容规模、留存设计、品牌、移动体验和口语互动 | LearnLanguage 不依赖游戏化，允许完整课程创作、导出和本地数据控制 |
| Busuu | CEFR 课程、四项技能、入学测试、学习计划、证书、社区母语者纠正和 AI 对话 | 专家课程质量、口语与社区反馈、等级认证 | LearnLanguage 支持作者自建任意语种课程，不要求账户或平台订阅 |
| Babbel | 专家设计课程、复习、语音识别和 AI 场景对话 | 成熟课程、发音反馈和真实对话准备 | LearnLanguage 更适合自定义课程、私有素材和可替换语言运行时 |
| Memrise | 母语者视频、间隔复习、AI 对话、发音与社区词表 | 真实音视频、词汇规模、口语和记忆体验 | LearnLanguage 的创作单位是完整课程、课节、目标与练习，不只是在现有引擎中添加词表 |
| LingQ | 导入网页、书籍、歌曲和视频，使用音频与文本沉浸学习，跟踪词汇并进行 SRS 复习 | 真实内容库、音频转录、阅读与听力沉浸、社区 | LearnLanguage 更强调结构化课程协议、可视化课程编排、确定性练习与本地数据所有权 |
| Preply | 真人一对一教师、个性化课程、实时口语反馈，以及课后 AI 总结和练习 | 人类指导、口语纠错、问责和高度个性化 | Preply 更适合作为互补服务；LearnLanguage 提供教师课外课程、学习记录和私有内容工具 |

表中对竞品是否提供同等功能的判断，依据下列官方功能描述作出，不代表竞品绝对不存在内部、实验或地区限定功能。

## 竞争性判断

### 直接竞争

若以“面向大众的完整语言学习 App”竞争，LearnLanguage 当前竞争力偏弱。主要差距是课程规模、听说素材、专业内容团队、人类反馈、原生移动端和成熟留存体系。

### 差异化竞争

若以“本地优先的开放课程学习与创作平台”竞争，差异明显：

- 同一标准 Course Pack 同时服务学习、创作、导入、发布、分享和跨客户端运行。
- Language Pack 与运行时能力允许新增语种，不把语言逻辑写死在界面或学习引擎。
- 无账户也可完整学习；课程、进度和草稿可以备份与迁移，并可按课程重置或完整删除本地数据。
- AI 可选且由用户选择服务商；没有 AI 时仍保留确定性流程。
- Learn 与 Studio 分离，普通作者不用编辑 JSON。

这组能力在所查竞品中没有发现完整等价组合。此结论属于基于公开官方功能页的推断。

## 建议策略

1. R33 核心闭环已完成；后续课程扩充和 AI 导师应继续以真实用户验证为依据。
2. 继续保持“书面学习优先、发音暂缓”的明确范围，不与成熟口语产品正面竞争。
3. 优先服务自定义课程、小语种、传承语、教师私有课程和自托管用户。
4. 课程社区如实施，应围绕可验证 Course Pack、来源、许可证和兼容更新，不做普通文件上传站。
5. AI 导师应复用现有学习证据与课程目标，保持自带服务商和无 AI 降级，不复制通用聊天机器人。
6. App 与桌面端应证明共享引擎和 Repository 架构价值，不为客户端数量单独扩张范围。

## 官方资料

- [Duolingo 个性化、游戏化与练习机制](https://investors.duolingo.com/static-files/f19d76fb-dee4-4f13-96ae-138ebfd0f2d3)
- [Duolingo Max：Roleplay 与 Video Call](https://blog.duolingo.com/duolingo-max/)
- [Busuu 课程、CEFR、社区纠正与入学测试](https://help.busuu.com/hc/en-us/articles/15936615354641-What-is-Busuu)
- [Busuu 学习计划](https://help.busuu.com/hc/en-us/articles/16097312171153-What-s-a-Study-Plan-How-do-I-make-one)
- [Busuu AI Conversations](https://help.busuu.com/hc/en-gb/articles/21862192336402-What-are-Busuu-Conversations-and-how-can-they-help-me-learn-a-language)
- [Babbel Speak](https://support.babbel.com/hc/en-us/articles/25875402999826-Babbel-Speak)
- [Babbel 语音识别](https://support.babbel.com/hc/en-gb/articles/19211305815570-Speech-recognition)
- [Memrise 当前产品能力](https://www.memrise.com/about)
- [Memrise 社区词表与课程](https://explore.memrise.com/community-courses)
- [LingQ 内容导入、音频文本与 SRS](https://www.lingq.com/en/learn-english-online/)
- [LingQ 教师与课程能力](https://www.lingq.com/en/schools/)
- [Preply 真人教师与个性化学习](https://preply.com/en/how-it-works)
- [Preply AI Lesson Insights、Daily Exercises 与 Scenario Practice](https://preply.com/en/blog/preply-announces-new-ai-powered-features-to-guide-the-future-of-personalized-learning-in-a-human-ai-world/)
