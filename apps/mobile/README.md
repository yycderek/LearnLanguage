# LearnLanguage Mobile

Android/iOS 移动学习客户端。使用 Expo SDK 57 和 React Native，复用仓库内的 Course Pack、Language Pack、Application Service 与学习引擎。

## 当前范围

- 浏览英语、日语、粤语、西班牙语内置课程，并导入任意兼容语种的已发布 Course Pack 与 Language Pack。
- 离线完成选择、排序和文字练习。
- 使用设备系统语音朗读课程例句，支持正常语速、慢速和停止；iOS 实体机静音模式下不会播放。
- SQLite 保存个人学习计划、课程进度、复习任务、导入课程与自定义 Language Pack。
- 中文或英文界面与讲解语言。
- 首次启动说明学习与课程设计边界、离线数据和备份；启动或保存失败可原地重试。
- Android 系统返回键、iOS 键盘避让、状态栏安全区、大字体换行和屏幕阅读器页面播报基线。
- 按学习目的、每天时长与每周频率生成自适应“今日安排”，完成课程后明确收口。
- 导出、恢复学习记录与个人计划；较旧备份不会覆盖较新本机数据。
- 无需账户；AI 与同步不是核心学习依赖。

移动端首版只提供 Learn 学习空间。无代码 Studio 继续使用 Web；在 Studio 发布并导出的标准文件可从移动端“设置与数据”导入。

## 安装

当前提供可从源码构建的移动端 MVP，尚未提供已签名的 APK、AAB 或 IPA。Android/iOS 环境要求、安装命令、EAS 内部分发准备、离线范围与数据备份说明见 [移动端安装与开发](../../docs/MOBILE_INSTALL.md)；实体设备检查项见[移动端真机验收清单](../../docs/MOBILE_ACCEPTANCE.md)。

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
