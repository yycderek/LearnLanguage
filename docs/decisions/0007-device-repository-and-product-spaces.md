# ADR 0007：设备仓库与 Learn/Studio 产品空间

## 状态

已接受。

## 决策

- 无账户模式使用全新的 `learn-language-device-v1` IndexedDB 数据库作为设备本地事实来源。
- 不读取、不迁移旧 LocalStorage 数据；旧键保留在浏览器中也不会影响新系统。
- 课程记录、完整引擎事件流和持久化 Effect 在同一 IndexedDB 事务中写入。
- Web 提供实现 Application Repository 端口的 IndexedDB 适配器，后续客户端可替换为 SQLite 适配器。
- API Key 只保存在当前标签页的 SessionStorage；非敏感 AI 偏好保存到 IndexedDB。
- `/learn` 与 `/studio` 是独立路由。Learn 写入真实设备档案；Studio 预览仅使用内存临时档案。
- 导入 JSON 或创建课程只产生创作素材；发布产生不可变版本；用户明确选择“安装到学习空间”后，课程才进入 Learn 课程目录。

## Sites 存储选择

当前产品明确要求无需账户、离线优先和设备本地档案，因此不启用托管 D1。未来账户同步属于可选服务，不能取代本地 Repository。
