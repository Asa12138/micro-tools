# 源码布局

本项目继续使用相对路径、CommonJS Preload 和浏览器原生脚本，无构建步骤。

- 根目录：`plugin.json`、`preload.js`、`index.html/js/css`、`pack.sh` 与用户文档。根目录不再保存期刊 gzip；插件及小程序维护脚本均读取带版本的期刊数据目录。
- `features/english/`：英语课程、练习、AI 整理、翻译、语音与 PDF 接口。
- `features/research/`：投稿助手、文献图谱、离线报告与 MCP 工作流。
- `features/journals/`：期刊 MCP 工具。数据读取由根目录 Preload 提供。
- `shared/`：本机凭据等公共服务。
- `assets/data/`：默认课程目录、种子题库与示例课程。
- `assets/data/journals/`：`manifest.json` 指定当前配套 JCR / CCF 快照；`2026-v1/` 保存原始 gzip 字节，说明见该目录 README。
- `assets/audio/`：内置课程音频与五种音色试听；`assets/images/`：图标。
- `vendor/pdfjs/`、`vendor/ms-edge-tts/`：第三方库及所需协议补丁；许可证在 `vendor/ENGLISH-LICENSES.txt`。
- `materials/english/`：`source/courses/` 和 `source/wordbooks/` 保存编辑源，目录外层保留生成脚本；不随插件安装。合并版在网站仓库维护为发布产物。
- `scripts/`、`test/`、`docs/`：维护脚本、测试和文档。

## 路径约定

HTML 和音频 URL 相对于根目录页面。CommonJS 与动态 import 相对于所属脚本；PDF Worker 通过 import.meta.url 定位。报告生成器从插件根目录读取并内嵌样式与脚本。

`pack.sh` 继续使用显式文件清单。新增运行文件必须加入清单；测试、素材编辑源文件、临时输出和凭据不进入安装包。

目录调整不改变课程 ID、数据库键、期刊快照哈希的文件名输入，或 userData 下的题库、音频缓存和凭据目录。小程序的共享源码同步脚本已同步新来源路径。

## 本地检查

```sh
node test/english-preview.js
bash pack.sh /absolute/path/to/preview.zpx
```

依赖 jsdom 的测试使用本机已有 NODE_PATH。预览使用独立临时题库。
