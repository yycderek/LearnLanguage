# LearnLanguage Mobile

Android/iOS 移动学习客户端。使用 Expo SDK 57 和 React Native，复用仓库内的 Course Pack、Language Pack、Application Service 与学习引擎。

## 当前范围

- 浏览英语、日语、粤语内置课程。
- 离线完成选择、排序和文字练习。
- SQLite 保存课程进度与复习任务。
- 中文或英文界面与讲解语言。
- 导出、恢复学习记录；较旧备份不会覆盖较新本机数据。
- 无需账户；AI 与同步不是核心学习依赖。

移动端首版只提供 Learn 学习空间。无代码 Studio 继续使用 Web。

## 安装

当前提供可从源码构建的移动端 MVP，尚未提供已签名的 APK、AAB 或 IPA。Android/iOS 环境要求、安装命令、离线范围与数据备份说明见 [移动端安装与开发](../../docs/MOBILE_INSTALL.md)。

## 开发

在仓库根目录安装依赖：

```powershell
pnpm install --frozen-lockfile
```

类型检查与测试：

```powershell
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test
```

启动开发服务器：

```powershell
pnpm --dir apps/mobile start
```

Android 和 iOS 原生构建需要各平台工具链或 Expo EAS Build。应用目标：Android 7+、iOS 16.4+。
