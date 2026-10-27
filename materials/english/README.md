# 科研英语素材库 v1

本目录仅保留可编辑源文件和构建脚本，不存网站的合并发布副本，也不进入 ZPX。`source/courses/` 是 12 个教学单元，`source/wordbooks/` 是词表源；`assemble-packs.cjs` 将教学单元组成 4 门课程，每门 60 句，共 240 句。内容为 AI 辅助生成的原创教学表达，第一人称内容应按真实经历使用。

## 统一属性

课程与词表采用 [素材规范 v1](../../docs/english-material-spec-v1.md)：`format/title/domain/level/tags/description/source`，正文分别为 `sentences` 或 `words`。难度只存 1–5 个 `★`，没有评定依据的词表存 `null`。既有课程 B1–B2 按统一映射整理为 `★★★`。

词表发布文件不包含内部 ID、掌握状态及 `duplicatesRemoved` 等加工统计。内置资源自身的固定 ID 和本机学习记录独立保留。

## 四个课程包

| 包 | 教学单元 |
| --- | --- |
| research-communication | 研究介绍、博后面试、会议交流 |
| bioinformatics-reproducibility | 生信流程、模型验证、可复现研究 |
| microbiome-environment | 微生物生态、土壤环境、统计解释 |
| reading-discussion | 论文阅读、讲图与限制、合作组会 |

## 构建与校验

从插件目录运行，`<素材目录>` 指向个人网站仓库的 `apps/research-english/materials`：

```sh
node materials/english/assemble-packs.cjs <素材目录>
node materials/english/build-catalog.cjs <素材目录>
node materials/english/verify-import.cjs <素材目录>
```

词表源文件位于 `source/wordbooks/`，发布副本放入目标目录的 `v1/wordbooks/` 后再构建。生成结果包括根目录与 `v1/` 的目录、四课导入文件、校验报告和预览。根目录 `catalog.json` 同步到插件的 `assets/data/english-catalog-default.json`。社区 `packs/` 的 `content` 与对应下载文件保持一致，发布信息留在 `manifest`。

构建会重新计算文件 SHA256，并保留现有配套音频引用，无需重新合成语音。目录中的 `lessonId/contentId/sentenceHash` 用来区分元数据调整与练习内容变化：只改属性仍沿用旧 ID，修改句子则成为新版本。

默认在线目录为 `https://asa12138.github.io/apps/research-english/materials/catalog.json`。本地构建不会更新网站；目录和素材文件须一起部署，之后刷新素材目录。更换文件而未更新目录 SHA256 会导致下载校验失败。

本轮在正式推广前按项目所有者要求直接整理现有 v1 属性。未来正式分发后的内容更新使用新包版本及下载路径；课程 ID、词本 ID 和学习记录不清空。

## 与内置素材、网站的关系

- 内置 24 句：`../../assets/data/english-seed.json`，由 4 个各 6 句的固定 ID 单元组成；界面统一展示为基础素材入口。随安装包提供，不能用这里的 240 句替代。
- 内置 24 句音频：`../../assets/audio/english-starter-audio.json`。
- 编辑源：本目录 `source/`，修改课程后运行上述合并与校验脚本。
- 网站发布产物：网站仓库 `apps/research-english/materials/v1/courses/` 的 4 个各 60 句课程，以及 `v1/wordbooks/`、音频、catalog 和导入备份。
- 只保留网站合并版也可维护内容，但会失去按教学单元编辑与重新合并的工作流。当前保留约 828 KB 的源目录，不在插件仓库再复制合并版。
- 本地网站文件和线上文件是两个状态；Git 未提交或未部署的变化不会自动上网。
