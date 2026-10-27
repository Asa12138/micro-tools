# 科研英语独立网页版

入口：<https://asa12138.github.io/apps/research-english/>
素材：<https://asa12138.github.io/apps/research-english/materials/catalog.json>

网页版从 `micro-tools` 当前源码生成。课程界面、四种练习、单词本、学习足迹、主题、题库校验、内容 ID 与版本号共用桌面实现。网页顶部显示版本号和源码指纹，`sync-manifest.json` 记录共享文件的 SHA256；不能只修改版本号来声称同步。

## 更新

更新顺序固定为：先完成 ZTools 版的功能修改、版本号和必要验证，再从同一份源码生成同版本网页版。不要直接修改生成目录的界面或只改网页版版本号。

在 `micro-tools` 目录运行（默认不传参数时输出到 `dist/apps/research-english`）：

```sh
node scripts/build-english-web.cjs /绝对路径/网站仓库/apps/research-english
```

本机的正式输出目录是 `/Users/asa/Documents/GitHub/Asa12138.github.io/apps/research-english`。旧 `research-english-pages` 在主站重建后仅保留为历史副本，不再作为 Git 发布入口。

构建不需要 npm 安装，使用已纳入源码的 hash.js SHA256 子集（MIT）、PDF.js、SheetJS。生成器只更新英语页面所需文件，不清空目录，也不读取用户课程、密钥或已安装 ZTools 的数据。网页产物可直接放入 GitHub Pages，不需要 Node 服务端。素材统一维护在输出目录下的 `materials/`，目录中的课程、音频和词表使用相对路径，并保留 SHA256 校验；生成器不会覆盖素材。浏览器从当前应用目录相对读取官方 materials/，本地预览和正式网站使用同一份文件。

生成后核对 `sync-manifest.json` 的版本和源码指纹，检查网页启动及素材读取。每次执行 `git push` 前，都要向用户说明目标仓库、分支和实际改动，并获得本次推送的明确确认；生成文件或通过检查不代表已发布。推送获准后，等待 Pages 部署成功并回读线上版本。

新仓库不恢复旧 `resources/` 目录。ZTools 和新版网页会将两种旧官方素材地址自动迁到上述新地址，自定义素材地址保留。旧版客户端需要升级或手动改地址；网页 404 跳转不能替代 JSON 下载接口。

本机验证入口为 `test/english-web.test.cjs`，使用已有 Playwright；通过环境变量指定 `ENGLISH_WEB_TEST_URL`、`ENGLISH_WEB_SITE`、`ENGLISH_WEB_CHROME`。它检查真实 IndexedDB 持久化、跨标签页写入、桌面内容 ID、一份课程及词表的完整校验、提示词/导入、配置和备份恢复。接口测试使用受控响应，不代表各家外部服务全部可用。

## Agent 建库

进入「我的素材库 → 自建题库」，填写正文或导入 PDF/TXT/Markdown、题库名和句数，打开「通过 AI Agent 建题库」，复制完整提示词。任意 Agent 均可按内嵌 Schema 返回完整 JSON，无需 MCP、网页 API key 或注册新账号。

把结果粘贴到「粘贴 Agent 返回的课程 JSON」进行校验与预览。有原文时同时校验句数及引用原文；没有原文时只校验结构与教学格式。也支持从「导入题库」选择 JSON 文件。GitHub Pages 自身不会运行 MCP Server，Agent 不能直接修改此浏览器的私有题库。

## 数据保存与备份

- 课程、进度、词表和学习足迹：独立 IndexedDB `research-english-web-v1`。共享服务的原数据键与内容哈希不变；Web Locks 将多标签页的读改写串行化，每个 API 操作在事务提交后才返回成功。
- 录音及播放缓存：IndexedDB `micro-tools-english-media`；下载的配套语音：`research-english-web-audio`。密钥在当前标签页的 sessionStorage，普通接口设置在 IndexedDB。
- ZTools 与网页没有自动数据同步；更换浏览器、设备、协议或域名会使用另一份存储。仅改变同一域名的路径不会产生浏览器安全隔离，`asa12138.github.io` 下的页面共享同源权限。不要在公共电脑保留敏感 API key。
- 从 `/research-english/` 迁到 `/apps/research-english/` 保持原数据库名称、数据键和课程 ID；同一浏览器、同一 HTTPS 域名下的已有记录继续使用，无需清空或重新导入。
- 关闭普通标签页后学习数据保留；清除网站数据会删除全部本地内容。隐私模式通常在窗口关闭时清除数据。存储空间不足时保存会报错并回退本次数据库改动。
- 「数据与同步」可申请持久存储、下载或合并恢复完整网页备份。备份含课程、进度、单词本、收藏、学习足迹和学习设置；不含密钥、AI/翻译接口配置、录音和下载音频。恢复优先保留现有设置与同 ID 的词表；课程进度按共享合并规则恢复。
- 与桌面交换课程使用原有课程 JSON / `research-english-backup-v1`；词表单独导出再导入。网页完整备份是网页专用格式。录音从口语练习单独下载。
- 当前未注册 Service Worker；打开页面仍需要网络或浏览器自身 HTTP 缓存。已保存的题库与音频不会因代码更新被清除。

## API、语音和兼容性

- 自定义 AI 支持 OpenAI 兼容 `chat/completions` HTTPS 接口。翻译支持 Google 网页接口、Google Cloud、OpenAI 兼容接口和自建翻译中转（POST `{text,source,target}`，返回 `{translation}`）。
- 接口必须允许网页 Origin 的 CORS 请求。第三方 API 禁止跨域时，浏览器无法像 Electron 的 Node 层一样直连；可配置用户自己的 HTTPS 后端中转。网页不能读取系统代理配置、设置 HTTP CONNECT 代理或运行 localhost MCP Server。不提供公共密钥中转，不上传给维护者。素材广场沿用现有 Supabase 公共目录；`web/english/community-config.json` 仅含已公开的项目地址与 publishable key，不含用户会话或服务端密钥。社区迁移项目时同步这个公开配置。
- 微软语音复用桌面相同的 edge-tts v2 协议，通过浏览器原生 WebSocket 按需生成任意课程句子，支持 Andrew、Ava、Emma、Ryan、Sonia；无需下载配套音频包，也不自动降级为系统声音。生成结果复用 IndexedDB 播放缓存；在线许可与预加载开关继续生效。已在 Microsoft Edge 156 验证真实合成；同机 Chromium 直连失败，Chrome、Firefox、Safari 不能保证可用，可手动选择系统声音。若以后需要跨浏览器稳定的微软语音，再部署服务端中转。
- 单词美式/英式发音使用浏览器音频播放器直接加载 Google 音频，翻译接口仍通过 fetch 读取 JSON；媒体播放不要求接口允许脚本跨域读取音频字节。
- 练习快捷键使用捕获阶段处理 Alt+A / Alt+P，并支持 F8 打开答案与解析（Mac 顶部按键为媒体控制时可用 Fn+F8）。浏览器或扩展若在网页收到事件前拦截 Alt+A，可使用 F8 或界面按钮。
- 音频首次自动播放可能被拦截，点击播放后即可继续。录音需要 HTTPS 和用户麦克风授权；PDF 与 Excel 在本机解析，不上传文件。所有接口只在用户发起相应操作时接收必要文本。
- 面向近期 Chrome、Edge、Firefox、Safari，需支持 IndexedDB、Web Crypto、Web Locks、Web Audio、dialog；旧浏览器会明确提示启动失败。手机可用，物理键盘操作体验更完整。

参考：[GitHub Pages 静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[MDN 浏览器存储与清理](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)、[Qwerty Learner](https://github.com/RealKai42/qwerty-learner)。采用相同静态部署思路，练习功能继续复用本项目已有代码。
