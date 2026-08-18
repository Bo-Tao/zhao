# zhao v0.6.0

这个版本新增使用本机 macOS 应用打开 Zhao 项目的能力。

## 使用应用打开项目

新增 `zhao open [query]`：

```bash
# 选择项目和打开工具
zhao open

# 指定项目后选择工具
zhao open '学习报告'

# 直接使用指定工具
zhao open '学习报告' --with cursor
zhao open --with code
```

工具选择器按固定顺序展示本机已安装的 VS Code、Cursor、Zed、Antigravity、Finder、Terminal、iTerm2、Warp、Xcode 和 Android Studio。

`--with/-w` 支持大小写不敏感的规范名称和常用别名。显式指定的工具未安装时会返回明确错误，不会自动改用其他应用。

## macOS 集成

- 通过 LaunchServices 按 bundle ID 查找应用，不依赖固定的 `/Applications` 路径。
- Finder、编辑器和 IDE 接收项目目录；Terminal、iTerm2、Warp 会以项目目录启动。
- 非 macOS、SSH 或无图形环境会在项目选择前直接报错。

## 项目解析与兼容性

- `zhao open` 仅打开索引中已登记的普通项目或 monorepo target。
- 未指定 query 时优先识别当前位置；当前位置未登记时显示项目选择器。
- 不记录默认或最近使用工具，现有配置文件无需迁移。
- 原规划中尚未实现的链接别名打开命令改名为 `zhao link <alias>`。

## 升级

```bash
npm install --global @botaoxyz/zhao@0.6.0
zhao --version
```
