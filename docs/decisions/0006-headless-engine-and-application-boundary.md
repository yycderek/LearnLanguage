# ADR 0006：无头引擎与 Application 边界

## 状态

已接受。

## 决策

- `@learn-language/engine` 是纯 TypeScript 状态机，只依赖协议包。
- 引擎接收 Command，返回 State、不可变 Event 和待执行 Effect；不访问 UI、网络、时钟、随机数或存储。
- 调用方负责生成 ID 和时间，保证回放与测试具有确定性。
- `@learn-language/application` 负责加载课程与事件流、执行事务、追加事件并持久化 Effect。
- Event Repository 使用期望序号实施乐观并发控制。
- Effect 使用确定性 ID，队列按 ID 去重，允许至少一次执行。
- Web 只保留界面输入适配、课程级聚合与当前设备投影；课节推进由公共引擎决定。

## 第一条垂直链路

`lesson.start` 创建会话并进入入口步骤；`exercise.submit` 记录尝试、重试或推进步骤；终点步骤产生 `session.completed` 事件和 `lesson-completion.recorded` Effect。

## 后续

R3 将为 Web 实现 IndexedDB Repository，并由 Application 服务替换当前 LocalStorage 持久化。移动端和桌面端可以实现 SQLite Repository，同时复用相同合约测试。
