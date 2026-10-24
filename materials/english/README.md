# 科研英语素材库 · 2026-10 v1

本目录提供 4 门课程，每门 60 句，共 240 句。内容为 AI 辅助生成的原创教学表达，按当前科研英语模块的数据结构整理；不是论文摘要摘录，也不代表学习者本人的研究成果。第一人称表达请按真实经历使用。

每句包含英文、中文、表达/语法说明、语法词块、重点词汇及音标、口语追问。重点词汇的音标采用美式写法；未提供逐词完整音标，也未打包整课 MP3。朗读仍由软件按所选声音生成。

## 现在就使用

在科研小盒 1.6.4 的「科研英语 → 自建素材库 → 自建题库 → 上传 PDF / 文本 / JSON」中选择 `research-english-240-import.json`，即可一次导入全部 4 门课程。也可以单独上传 `v1/courses/` 中的一门课程 JSON，预览后保存。

同一课程内容重复导入会复用已有课程；不会以导入文件中的空进度覆盖现有练习记录。

## 课程

| 素材包 | 文件 | 句子编排 |
| --- | --- | --- |
| 科研交流与博后面试 | research-communication.json | 1–20 研究介绍；21–40 博后面试；41–60 会议交流 |
| 生信分析与可复现研究 | bioinformatics-reproducibility.json | 1–20 生信流程；21–40 模型验证；41–60 可复现研究 |
| 微生物生态与环境研究 | microbiome-environment.json | 1–20 微生物生态；21–40 土壤与环境；41–60 统计解释 |
| 论文精读与学术讨论 | reading-discussion.json | 1–20 论文阅读；21–40 讲图与研究限制；41–60 合作与组会 |

建议先练第一个包的研究介绍，再按项目选领域包。每天 5 句，48 天可完成一轮；练习顺序为：听写 → 读词块 → 用自己的课题改述 → 回答追问。

## 已选择的托管位置

素材保存在个人网站仓库 `Asa12138/Asa12138.github.io` 的 `research-english/` 目录。该仓库已启用 GitHub Pages，从 main 分支根目录发布，网站首页的实际下载检查已通过。

GitHub Pages 的素材目录地址为：

```text
https://asa12138.github.io/research-english/catalog.json
```

科研小盒 1.6.5 默认使用此地址；旧版可在「科研英语 → 练习设置 → 素材下载来源」保存该地址，然后到「内置素材 → 获取素材」刷新。软件只下载用户选中的课程。目录更新推送后，等待 Pages 部署完成再刷新。

`catalog.json` 使用相对路径，可整体迁移到其他公开 HTTPS 静态站或对象存储。只需修改软件中的目录地址，无需逐个改课程链接。不要使用 GitHub 的 `/blob/` 网页地址。

### 版本维护

- 根目录 `catalog.json` 是对外固定入口，本版指向 `v1/courses/`。
- 正式发布之后保留旧版文件；未来新增 `v2/` 并更新根目录，不覆盖既有版本。
- 每个目录项带有 SHA256，编辑课程后须重新生成目录，否则软件下载校验会失败。
- 本版重新生成和验证：`node /path/to/micro-tools/english-materials/build-catalog.cjs /path/to/Asa12138.github.io/research-english`，再运行同目录的 `verify-import.cjs` 并传入相同目录。脚本固定生成 v1；后续版应调整版本号及课程清单。
- 单个课程最多 120 句，单个远程 JSON 最大 2 MB；本版每包 60 句。
- 本目录没有附加公开内容许可。公开发布前可选择 CC BY 4.0 等教材许可，并明确作者署名；应用源码的许可可独立管理。

## 本版检查

240 句英文互不重复，每句 8–15 词；语法块按原句顺序完整覆盖，每块最多 6 词。已通过应用的数据格式检查、4 门课程的目录解析及批量导入检查。重复导入不新增重复课程，并保留已有练习记录。离线兼容性检查记录保存在 `validation.json`。

## 为什么选个人网站

- 已有公开网站和 Pages 发布配置，不需要租用服务器，也不需要启用新的发布服务。
- JSON 素材可以与网站一起保留版本，下载入口固定。
- 本次使用软件同样的下载通道访问个人网站首页成功；GitHub Raw 直连则出现连接重置，因此优先使用 Pages 地址。
- 国内用户仍可能遇到不同网络条件。如果后续反馈访问失败，可以将整个 `research-english/` 镜像到另一个公开 HTTPS 静态站。
- 未来若打包大量 MP3 或视频，建议媒体使用单独的对象存储，避免 Git 历史积累大文件。

## 参考与后续真实素材来源

本版句子为原创，不从以下教程逐句复制。它们适合后续选题和真实资料精读：

- The Carpentries 的 [Data Processing and Visualization for Metagenomics](https://github.com/carpentries-lab/metagenomics-analysis)：生信教学课程；后续改编需按该课程自己的许可标注来源。
- [Data Carpentry lessons](https://datacarpentry.github.io/lessons/)：查找数据整理、分析和可视化课程。
- [GitHub Raw 文件说明](https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files)。
- [GitHub Pages 简介](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)及[使用限额](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。

将来新增论文素材时，每门课分别保存原论文/视频链接和真实原文依据。不要把原创练习的 `quote` 填成看似来自论文的句子，也不要把未知结果改成肯定结论。
