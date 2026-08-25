# 移动端安装与开发

LearnLanguage Mobile 当前是可从源码构建的 Android/iOS MVP，尚未提供已签名的 APK、AAB 或 IPA，也未上架应用商店。普通用户目前不能直接下载安装包；开发者可以按本文在本机安装开发版本。

## 支持范围

- Android 7.0 及以上。
- iOS 16.4 及以上。
- 移动端首版提供 Learn 学习空间：内置课程、练习、学习记录、复习、离线学习和本地备份。
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

## 离线与数据

内置课程和核心练习可离线使用。学习记录只保存在当前设备；卸载应用会删除这些本地数据。卸载、换机或重装前，请在应用设置中导出备份，并在新安装中导入。移动端首版暂不包含 AI 服务和跨设备云同步。

## 尚未提供

- 已签名的 Android APK/AAB 和 iOS IPA。
- Google Play、App Store 或 TestFlight 分发。
- 自动更新与正式发布渠道。
- 实体设备安装包验收。

这些内容属于移动端下一阶段工作。
