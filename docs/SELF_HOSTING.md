# 自部署指南

LearnLanguage 的 Web 学习和课程设计功能默认保存在设备本地，不需要账户、数据库或同步服务。

## Web 应用

```bash
pnpm --dir apps/web install --frozen-lockfile
pnpm --dir apps/web build
pnpm --dir apps/web start
```

生产部署需要支持 Cloudflare Workers 兼容 ESM 输出的运行环境。部署前确认 `apps/web/dist/server/index.js` 存在，并通过反向代理提供 HTTPS。

AI 是可选能力。用户可以在界面中配置兼容端点和自己的密钥；服务端部署者不应内置或记录用户密钥。

## 可选同步服务

`@learn-language/sync` 提供基于标准 `Request`/`Response` 的参考处理器：

- `GET /.well-known/learn-language-sync`：服务能力发现；
- `POST /v1/sync/push`：幂等提交本地变更；
- `POST /v1/sync/pull`：按游标增量拉取。

参考实现是内存存储，仅用于开发、协议验证和嵌入示例，不适合直接保存生产数据。生产适配器应实现持久化、事务、租户隔离、备份、限流和认证。服务可以声明 `none` 或 `bearer`，客户端必须先读取能力发现；即使服务不可用，本地学习也应继续运行。

## 数据备份

无账户 Web 模式的数据位于浏览器 IndexedDB。清理站点数据或更换浏览器可能丢失记录；在正式同步/导出界面完成前，请把课程源 JSON 作为独立备份保存。
