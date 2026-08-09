# 内置课程库

## 当前范围

首批内置课程用于验证同一套 Course Pack、学习引擎和客户端交互能够承载不同语言，而不是作为完整等级课程。日语与粤语课程均包含三个递进课节：

1. 礼貌点一杯饮料。
2. 说明冷热、饮料种类和数量。
3. 回答堂食或外带，并把表达迁移到完整点单场景。

每个语种包含 3 个 Can-do 目标、9 个知识点、6 条带读音例句和 9 个练习。讲解、翻译、提示与选项同时提供中文和英文；目标语言文本不随应用语言切换。

## 架构边界

- 内置课程由 `apps/web/lib/starter-course-library.ts` 生成标准 Course Pack。
- `sampleCourse()` 只负责选择内置课程或为自定义语种创建单课节可编辑脚手架。
- 学习引擎、课程播放器和练习渲染器不判断日语或粤语。
- 语言特殊信息保存在 Course Pack 的知识点和读音字段中；可复用的规范化、分词和书写系统能力仍由 Language Pack 与语言运行时负责。

## 内容校验

自动测试检查课程引用和流程有效性、九步学习路径可达性、每课练习独立性、四种练习形态覆盖、读音存在，以及所有教学字段的中英文完整性。

课程表达参考日本国际交流基金 Irodori 的餐饮场景语法资料，以及香港政府常用粤语、香港中文大学粤语教程和粵典的服务场景用法。课程文字和练习为本项目重新编写；后续正式扩充内容时，仍须逐条记录来源、审校状态和内容许可证。

- https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf
- https://www.hkengage.gov.hk/en/essentials/living/useful-language-phrases
- https://www.ilc.cuhk.edu.hk/workshop/Chinese/Cantonese/OnlineTutorial/courseList_b5.aspx
- https://words.hk/zidin/%E5%96%BA%E5%BA%A6%E9%A3%9F
