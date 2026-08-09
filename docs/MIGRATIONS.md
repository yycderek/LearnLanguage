# 数据与协议迁移策略

LearnLanguage 的课程包、语言包、学习事件和同步协议分别维护版本号。客户端必须先检查版本，再决定读取、迁移或拒绝；不得静默猜测旧数据含义。

## 当前边界

- Course Pack 当前版本为 v2。原型阶段的 v1 被明确拒绝，不做自动迁移。
- Language Pack 当前版本为 v1。
- Session Event 当前版本为 v2。
- Sync Protocol 当前版本为 v1；服务端通过能力发现端点公布支持版本。
- `learn-language-device-v1` 是当前设备数据库。项目没有承诺迁移更早的 LocalStorage 原型数据。

## 固定样例

`test/fixtures/migrations` 保存不可随实现细节漂移的输入：

- `course-pack-v1.json` 固定“必须拒绝”的旧协议边界。
- `course-pack-v2.json` 固定当前可接受的最小课程结构。

任何协议升级必须先增加“升级前”和“升级后”样例，再实现显式迁移函数并加入往返、幂等和失败恢复测试。没有对应固定样例的隐式迁移不能合并。
