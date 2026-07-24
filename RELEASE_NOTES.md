# zhao v0.2.0

`zhao scan` 现在会自动维护 `projects.yaml`，新扫描到的项目无需再手动创建配置条目。

## 新功能

- 首次扫描时，如果 `projects.yaml` 不存在，会自动创建该文件。
- 后续扫描会按 Git remote 生成的稳定项目 ID 补齐新项目 key。本地目录移动或不同成员使用不同 clone 路径时，项目配置仍能正确对应。
- 新项目会生成可直接编辑的元数据结构，包括空的 `aliases`、`domains`、`keywords`、`links.ci-test` 和 `links.ci-prod`。

## 行为与可靠性改进

- 已有的别名、域名、关键词、CI 链接和域名黑名单都会保留，扫描不会覆盖手工配置。
- 暂时未被本次扫描发现的旧项目条目仍会保留。
- 没有新项目时不会重写 `projects.yaml`，避免无意义的文件变更。
- 多个项目条目之间会保留空行，生成的 YAML 更容易阅读和编辑。
- `zhao info` 不再显示自动生成但尚未配置的空链接。

## 升级

```bash
npm install --global @botaoxyz/zhao@0.2.0
zhao --version
zhao scan
```

运行 `zhao scan` 后即可获得自动维护的 `projects.yaml`。升级不会删除或覆盖已有手工元数据。
