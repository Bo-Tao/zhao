# zhao v0.5.0

这个版本重点优化终端信息展示，并减少源码扫描中的域名误报。

## 终端展示改进

- `zhao list` 现在使用带表头、边框和行分隔线的对齐表格展示名称、路径与描述。
- 表格会根据终端宽度自动收缩并截断过长内容，中文、Emoji 和组合字符也能保持正确对齐。
- `zhao info` 按“基本信息 / 标记 / 域名 / 链接”分区展示表格，长路径和 URL 会换行显示，不会因终端较窄而丢失信息。
- 单元格中的换行符等控制字符会被归一化，避免破坏表格布局。

## 域名扫描修复

- 不再将 `js.configs.recommended`、`process.env.NODE_ENV`、`main.js` 等 JavaScript 成员访问、环境变量访问和资源文件名识别为域名。
- HTTP(S) URL 仍会直接识别；`.env`、Nginx 配置及明确的 URL、host、domain、endpoint 等配置项中的裸域名仍受支持。

## 兼容性

- `zhao list --json` 的数据结构和输出保持不变。
- 现有配置文件无需迁移。

## 升级

```bash
npm install --global @botaoxyz/zhao@0.5.0
zhao --version
```
