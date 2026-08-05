# LearnLanguage Web

LearnLanguage 的公开课程内容工作台。当前版本支持：

- 可视化编辑课程基本信息、知识点、例句、练习和课节流程
- 可视化表单与 Course Pack v1 JSON 双向同步
- 快速创建或导入自定义 Language Pack，自由补充目标语种
- 日语、粤语内置示例与任意 Course Pack v1 内容导入
- Course Pack 与 Language Pack 的 JSON、结构及引用完整性校验
- 课程统计和九阶段学习流程预览
- 当前设备上的草稿与修订历史
- 用户自行选择 AI 服务商、模型、接口地址和 API 密钥

网站无需登录。草稿、自定义语言包和 AI 配置只保存在用户当前浏览器中，不会发送到 LearnLanguage 服务。

## 本地运行

需要 Node.js 22.13+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

构建与测试：

```bash
pnpm test
```
