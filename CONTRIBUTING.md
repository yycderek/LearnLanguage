# 参与贡献

感谢你帮助 LearnLanguage 变得更通用、更可靠。项目接受代码、课程格式、语言适配、测试、文档和可访问性改进。

## 开始之前

1. 对较大的功能先创建 Issue，说明用户问题、协议影响和不做什么。
2. 不要提交 API Key、学习记录、真实用户语料或其他敏感信息。
3. 新功能不能让纯本地学习依赖账户、网络或特定 AI 服务。
4. 语言特性优先通过能力声明和适配器实现，避免在通用引擎中加入语种条件分支。

## 本地检查

需要 Node.js 22.13+ 和 pnpm 11.9：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm --dir apps/web test
```

协议变更还必须更新 JSON Schema、固定迁移样例、类型、测试和对应 ADR。界面变更需要保持 Learn 与 Studio 的产品边界。

## CI 状态

- 推送或 PR 只有在 Core Node 22、Core Node 24 和 Web build and test 全部通过后才算完成。
- 推送后应检查 GitHub Actions 运行结果；失败会阻止候选版本或公开版本发布，必须先查看失败步骤日志。
- 不要用本机已有的 `node_modules` 代替冻结锁文件验证；依赖变更必须先运行 `pnpm install --frozen-lockfile`。

## Pull Request

- 一个 PR 解决一个明确问题。
- 写清行为变化、兼容性、测试方式和隐私影响。
- 不要混入无关格式化或生成文件。
- 所有提交按 Apache-2.0 许可进入项目；提交即表示你有权贡献相关内容。
