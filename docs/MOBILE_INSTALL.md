# 移动端安装与开发

LearnLanguage Mobile 当前是可从源码构建的 Android/iOS MVP，尚未提供已签名的 APK、AAB 或 IPA，也未上架应用商店。普通用户目前不能直接下载安装包；开发者可以按本文在本机安装开发版本。

## 支持范围

- Android 7.0 及以上。
- iOS 16.4 及以上。
- 移动端 Learn 空间提供内置与导入课程、个人学习计划、自适应今日安排、练习、学习记录、复习、离线学习和本地备份。
- 课程设计与导入继续使用 Web 端 Studio。
- 不要求 LearnLanguage 账户。学习记录保存在设备本地 SQLite 数据库中。

## 准备环境

所有平台都需要：

- Git
- Node.js 22.13 或更高版本
- pnpm 11.9

克隆项目后，在仓库根目录安装依赖：

```bash
pnpm install --frozen-lockfile
```

本项目使用 Expo development build，不建议使用应用商店中的 Expo Go 运行当前 SDK 版本。

## Android 安装

额外准备 Android Studio、Android SDK、JDK，以及 Android 模拟器或已开启 USB 调试的实体设备。然后在仓库根目录运行：

```bash
pnpm --dir apps/mobile exec expo run:android
```

首次执行会生成 Android 原生工程、构建开发版本并安装到已连接的设备或模拟器。

## iOS 安装

iOS 原生构建必须在 macOS 上进行，并需要 Xcode、CocoaPods、iOS 模拟器或已注册的实体设备。然后在仓库根目录运行：

```bash
pnpm --dir apps/mobile exec expo run:ios
```

首次执行会生成 iOS 原生工程、安装 CocoaPods 依赖，并构建开发版本。

## 启动开发服务器

设备上已有开发版本后，在仓库根目录运行：

```bash
pnpm --dir apps/mobile start --dev-client
```

让电脑和设备处于同一网络，然后从设备上的 LearnLanguage 开发版本连接到该服务器。

## 验证环境

```bash
pnpm --dir apps/mobile exec expo install --check
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test
```

如果 Android 找不到设备，可先用 `adb devices` 检查连接。如果 iOS 构建失败，请先确认 Xcode Command Line Tools 和 CocoaPods 已安装。

## 导入自定义课程与语种

1. 在 Web Studio 创建课程；新语种先创建或导入对应 Language Pack。
2. 完成发布检查并导出已发布 Course Pack；自定义语种同时导出 Language Pack。
3. 在移动端打开“设置与数据”→“导入课程与语言”。新语种先导入 Language Pack，再导入 Course Pack。
4. 返回“学习”，导入课程会与内置课程一起出现，并可离线学习。

打开课程后可设置个人学习计划：选择学习目的、每天时长和每周频率。首页“今日安排”根据已完成课节与到期复习实时生成，不要求账户，也不会把计划作为开始学习的门槛。当前移动端暂不提供分级测试，因此不会自动跳过课程基础内容。

移动端会限制文件大小，验证 JSON 结构、领域引用、发布状态、许可证、来源、SHA-256 内容哈希、适配器版本与练习能力。内置课程和内置 Language Pack 不能被设备文件覆盖。同 ID 课程只接受保持现有学习进度兼容的更高版本。
## 离线与数据

内置课程、已导入课程和核心练习可离线使用。学习记录、导入课程与自定义 Language Pack 只保存在当前设备；卸载应用会删除这些本地数据。移动备份包含学习记录、复习与个人计划，并兼容旧版仅含学习记录的备份；恢复后仍需重新导入自定义内容文件。卸载、换机或重装前，请在应用设置中导出备份，并在新安装中导入。移动端首版暂不包含 AI 服务和跨设备云同步。

## 尚未提供

- 已签名的 Android APK/AAB 和 iOS IPA。
- Google Play、App Store 或 TestFlight 分发。
- 自动更新与正式发布渠道。
- 实体设备安装包验收。

这些内容属于移动端下一阶段工作。
