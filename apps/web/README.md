# LearnLanguage Web

LearnLanguage 的公开课程内容工作台。当前版本支持：

- 日语、粤语示例与任意 Course Pack v1 内容导入
- JSON、结构与引用完整性校验
- 课程统计和九阶段学习流程预览
- 当前设备上的草稿与修订历史
- 用户自行选择 AI 服务商、模型、接口地址和 API 密钥

网站无需登录。草稿和 AI 配置只保存在用户当前浏览器中，不会发送到 LearnLanguage 服务。

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
