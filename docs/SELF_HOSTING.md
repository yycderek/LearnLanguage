# 自部署指南

LearnLanguage 的 Web 学习和课程设计功能默认保存在设备本地，不需要账户、数据库或同步服务。

## 环境与开发启动

使用 Node.js 22.13 或更高版本、pnpm 11.9.0。在仓库根目录安装依赖，不要在各客户端目录单独生成锁文件：

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/web dev
```

访问终端显示的地址，默认学习入口为 `http://localhost:3000/learn`，创作入口为 `http://localhost:3000/studio`。开发服务器用于本机调试；生产运行使用下面的构建产物。

## 在 Node.js 中运行生产构建

在仓库根目录执行：

```bash
pnpm check
pnpm --dir apps/web test
pnpm --dir apps/web lint
pnpm --dir apps/web start
```

`pnpm --dir apps/web test` 会先构建 Web 再运行测试。只需重新生成产物时可运行 `pnpm --dir apps/web build`。`start` 使用 vinext 的 Node.js 生产服务器，读取 `apps/web/dist`；不是把整个应用当作静态 HTML 目录托管。

部署时保留完整的 `dist` 产物与运行依赖，包括 `dist/client` 和 `dist/server`。仅复制 `dist/server/index.js` 不足以运行。可用 `pnpm --dir apps/web start --port 3001` 指定端口，入口相应变为 `http://localhost:3001/learn`。

对外服务时使用进程管理器保持进程运行，通过反向代理提供 HTTPS。部署后按 [Web 验收清单](WEB_ACCEPTANCE.md)检查 Learn、Studio、静态资源、接口和离线更新；本地 localhost 可用于开发，但远程普通 HTTP 不满足 PWA 所需的安全上下文。

## Sites 与 Workers 部署配置

仓库还包含 `apps/web/worker/index.ts`、Cloudflare Vite 配置和 Sites 构建集成。这是托管平台适配路径，与上面的 Node.js 生产服务器分别配置，不要求运行 Node.js 服务的主机同时提供 Workers 环境。

使用该路径时，应由对应平台部署流程处理 Worker 入口、静态资源和绑定；不要把 Node.js 的 `start` 命令当作 Worker 发布命令。公开 Sites 部署前，必须确认对应 GitHub 提交的 CI 已通过。托管平台的项目绑定与发布权限需要单独配置。

## AI 与本地数据

AI 为可选能力。用户在“工具与设置 → AI 设置”中配置服务商、兼容端点、模型和自己的密钥。部署者不应内置用户密钥，也不应在请求日志中记录密钥或私人素材。

服务器部署成功不会自动同步浏览器数据。更换域名、协议或端口会形成不同的站点存储；迁移地址前先导出完整设备备份，在新地址恢复。

## 可选同步服务

`@learn-language/sync` 提供基于标准 `Request`/`Response` 的参考处理器：

- `GET /.well-known/learn-language-sync`：服务能力发现；
- `POST /v1/sync/push`：幂等提交本地变更；
- `POST /v1/sync/pull`：按游标增量拉取。

参考实现是内存存储，仅用于开发、协议验证和嵌入示例，不适合直接保存生产数据。生产适配器应实现持久化、事务、租户隔离、备份、限流和认证。服务可以声明 `none` 或 `bearer`，客户端必须先读取能力发现；即使服务不可用，本地学习也应继续运行。

## 数据备份

无账户 Web 模式的数据位于浏览器 IndexedDB。日常备份优先使用“课程库 → 课程与数据管理 → 完整设备备份 → 导出全部数据”，一次保存课程、草稿、语言包、学习进度、计划和偏好。恢复时先查看冲突预览，再选择“合并恢复”或“清空本机后恢复”；后者会删除当前持久数据。

学习档案、课程草稿、已发布 Course Pack 和 Language Pack 仍可分别导出，适合按用途迁移或分享。AI 密钥、同步令牌和临时会话不包含在完整备份中。各类文件的范围与 Web/移动端区别见[使用手册](USER_GUIDE.md#更换设备)。服务器目录备份不能代替用户浏览器数据备份。
