# LearnLanguage Web

LearnLanguage 的课程内容工作台。当前版本支持：

- 日语、粤语示例与任意 Course Pack v1 内容导入
- JSON、结构与引用完整性校验
- 课程统计和九阶段学习流程预览
- 登录用户隔离的 D1 私有草稿与修订历史
- 无数据库时的浏览器本地草稿回退

## 本地运行

需要 Node.js 22.13+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

生成数据库 migration：

```bash
pnpm db:generate
```

构建与测试：

```bash
pnpm test
```

`.openai/hosting.json` 声明 `DB` D1 绑定；部署时由 Sites 创建并应用真实数据库。
