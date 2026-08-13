# 内置课程库

## 当前范围

首批内置课程使用同一套 Course Pack、学习引擎和客户端交互承载不同语言。版本 0.3.0 将原来的三个咖啡店场景课扩展为七课零基础路径；它仍是 A1 起步课程，而不是完整的 A1 等级课程。

日语课程先学习文字系统、平假名基础表、浊音／拗音／促音／长音和片假名，再进入点单、规格数量和堂食外带。

粤语课程先学习汉字与粤拼的关系、声母韵母、入声韵尾、1 至 6 调号，以及问候、名字和身份表达，再进入相同的三个点单场景。

每个语种包含 7 个 Can-do 目标和 21 个独立练习。讲解、翻译、提示与选项同时提供中文和英文；目标语言文本不随应用语言切换。基础课只做文字、标音识别、排序和输入，不包含录音、语音识别或发音评分。

## 学习顺序

课节按数组顺序逐课解锁，前四课构成基础模块，后三课构成场景模块。已有基础的学习者目前仍可逐课快速完成；后续诊断跳过功能应在引擎中以通用学习决策实现，不能只为日语或粤语增加界面分支。

当前覆盖矩阵：

| 语言 | 基础文字／标音 | 结构规则 | 基础交际 | 场景迁移 |
| --- | --- | --- | --- | --- |
| 日语 | 平假名、片假名 | 浊音、半浊音、拗音、促音、长音 | 基础词语识读 | 咖啡店点单 |
| 粤语 | 汉字＋粤拼 | 声母、韵母、入声韵尾、六个调号 | 问候、名字、係／唔係 | 咖啡店点单 |

## 架构边界

- 内置课程由 `apps/web/lib/starter-course-library.ts` 生成标准 Course Pack。
- `sampleCourse()` 只负责选择内置课程或为自定义语种创建单课节可编辑脚手架。
- 学习引擎、课程播放器和练习渲染器不判断日语或粤语。
- 语言特殊信息保存在 Course Pack 的知识点和读音字段中；可复用的规范化、分词和书写系统能力仍由 Language Pack 与语言运行时负责。

## 内容校验

自动测试检查课程引用和流程有效性、九步学习路径可达性、每课练习独立性、四种练习形态覆盖、读音存在，以及所有教学字段的中英文完整性。

课程结构与表达参考日本国际交流基金 Irodori／Marugoto 的入门文字和餐饮场景资料、粤拼官方学习资料，以及香港政府常用粤语、香港中文大学粤语教程和粵典的服务场景用法。课程文字和练习为本项目重新编写；后续正式扩充内容时，仍须逐条记录来源、审校状态和内容许可证。

- https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf
- https://www.jpf.go.jp/e/project/japanese/teach/tsushin/news/202211.html
- https://marugoto.jpf.go.jp/en/teacher/qateaching/
- https://jyutping.org/en/learn/
- https://www.hkengage.gov.hk/en/essentials/living/useful-language-phrases
- https://www.ilc.cuhk.edu.hk/workshop/Chinese/Cantonese/OnlineTutorial/courseList_b5.aspx
- https://words.hk/zidin/%E5%96%BA%E5%BA%A6%E9%A3%9F
