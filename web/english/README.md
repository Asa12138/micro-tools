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

构建不需要 npm 安装，使用已纳入源码的 hash.js SHA256 子集（MIT）、blueimp JavaScript-MD5 v2.19.0（MIT，仅用于百度接口签名）、PDF.js、SheetJS。生成器只更新英语页面所需文件，不清空目录，也不读取用户课程、密钥或已安装 ZTools 的数据。网页产物可直接放入 GitHub Pages，不需要 Node 服务端。素材统一维护在输出目录下的 `materials/`，目录中的课程、音频和词表使用相对路径，并保留 SHA256 校验；生成器不会覆盖素材。浏览器从当前应用目录相对读取官方 materials/，本地预览和正式网站使用同一份文件。

生成后核对 `sync-manifest.json` 的版本和源码指纹，检查网页启动及素材读取。每次执行 `git push` 前，都要向用户说明目标仓库、分支和实际改动，并获得本次推送的明确确认；生成文件或通过检查不代表已发布。推送获准后，等待 Pages 部署成功并回读线上版本。

新仓库不恢复旧 `resources/` 目录。ZTools 和新版网页会将两种旧官方素材地址自动迁到上述新地址，自定义素材地址保留。旧版客户端需要升级或手动改地址；网页 404 跳转不能替代 JSON 下载接口。

本机验证入口为 `test/english-web.test.cjs`，使用已有 Playwright；通过环境变量指定 `ENGLISH_WEB_TEST_URL`、`ENGLISH_WEB_SITE`、`ENGLISH_WEB_CHROME`。它检查真实 IndexedDB 持久化、跨标签页写入、桌面内容 ID、一份课程及词表的完整校验、提示词/导入、配置和备份恢复。接口测试使用受控响应，不代表各家外部服务全部可用。

## Agent 建库

进入「我的素材库 → 自建题库」，填写正文或导入 PDF/TXT/Markdown、题库名和句数，打开「通过 AI 或 Agent 建题库」，复制完整提示词。长正文只复制建库要求，需同时下载当前素材 TXT 并上传到外部 AI。对话型 AI 受单次回复长度限制，建议每次生成 30 句以下；更多句数建议使用可生成 JSON 文件的 Agent。无需 MCP 或网页 API key 即可使用这条导入路径。

将返回的完整 JSON 代码块粘贴回来，或选择生成的 JSON 文件，点击「校验并预览素材」。结构错误会阻止导入；有原文时同时核对目标句数及引用。句子偏长、词块格式、疑似专用标识等只提示警告，可逐句取消、批量剔除或恢复，至少保留一句再保存。没有原文时不能核实引用。完整规则见源码仓库的 [手动导入校验规则](https://github.com/Asa12138/micro-tools/blob/main/docs/english-import-validation.md)。GitHub Pages 自身不会运行 MCP Server，Agent 不能直接修改此浏览器的私有题库。

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

- 自定义 AI 支持 OpenAI 兼容 `chat/completions` HTTPS 接口。「翻译与网络」先显示单词发音，再显示文本翻译。翻译默认 Google 网页接口；网页共用插件的 12 个服务预设、凭据字段、请求签名与响应解析，包括百度、腾讯、阿里、有道、DeepL 等，并保留 OpenAI 兼容接口和自建翻译中转（POST `{text,source,target}`，返回 `{translation}`）。
- 接口必须允许网页 Origin 的 CORS 请求。第三方 API 禁止跨域时，浏览器无法像 Electron 的 Node 层一样直连；可配置用户自己的 HTTPS 后端中转。网页不能读取系统代理配置、设置 HTTP CONNECT 代理或运行 localhost MCP Server。AI 与翻译不提供公共密钥中转。语音仅在配置语音服务后将对应句子发送给该服务。素材广场沿用现有 Supabase 公共目录；`web/english/community-config.json` 仅含已公开的项目地址与 publishable key，不含用户会话或服务端密钥。社区迁移项目时同步这个公开配置。
- 微软语音沿用 edge-tts v2 协议。目前浏览器直连仅在 Chromium Edge 中尝试；HTTP 语音后端功能保留，“跨浏览器语音服务”配置区暂时隐藏；普通网页用户优先使用电脑上的 Edge 或 ZTools 插件版。其他浏览器未配置后端时不发起无效直连或后台重试，仍优先播放缓存和配套音频，无音频时默认回退到本机英语声音（可在设置关闭）。会等待浏览器加载声音列表，且停止/切句后不会播放过期请求。设置中的微软试听是预录文件，不能用来判断实时生成是否可用。
- 该限制与 [edge-tts 的浏览器支持说明](https://github.com/andresayac/edge-tts#browser-support) 一致；网页 WebSocket 无法设置服务所需的自定义请求头。若要跨浏览器实时生成 Andrew 等微软音色，需要独立语音后端。源码已提供本机服务和独立 Netlify 部署目录生成器，见 `server/README.md`；当前公网网站尚未部署该服务。
- 没有本机英语声音时，可主动选择「Google 兼容发音（联网）」，将句子按短段发送给 Google，未配置中转时通过浏览器播放器直接播放；配置中转时校验服务返回的 MP3 后播放。Google 句子朗读与试听不会沿用单词发音的有道设置。在线开关和本课许可继续有效；微软预加载不会为 Google 发起请求。
- 本机回退只选设备上的英语声音；它不生成可导出的音频文件。跨浏览器生成相同 Andrew 音色的文件仍需要可用的微软服务连接或独立后端。

- 单词美式/英式发音默认使用有道，可切换 Google；浏览器音频播放器直接加载所选来源，避免通过 fetch 读取音频产生的跨域限制。Google 网络区说明浏览器 / 系统代理设置，不展示无法生效的页面代理输入框。该设置不改变课程朗读声音。
- 翻译服务分为免密钥和 API / 自定义接口；需密钥服务提供官网入口与免费体验提示，具体额度以官网为准。MyMemory 只调用 get 查询接口，限制单次 500 UTF-8 字节，识别每日额度耗尽；不会调用 set 提交译文。各服务凭据分别保存在当前标签页会话，不进入完整备份；预设直连不能绕过服务端 CORS 限制，测试不通时可使用插件版或自己的 HTTPS 中转。
- 单词本提供「一键补全释义」和逐词补全，只查询缺少释义的词条并逐条保存。已有释义不覆盖，查询期间删除或修改的词条不恢复。可停止后续查询，连续三次失败自动暂停；更换网络或服务后重试剩余词条。
- 练习快捷键使用捕获阶段处理 Alt+A / Alt+P，并支持 F8 打开答案与解析（Mac 顶部按键为媒体控制时可用 Fn+F8）。浏览器或扩展若在网页收到事件前拦截 Alt+A，可使用 F8 或界面按钮。
- 音频首次自动播放可能被拦截，点击播放后即可继续。录音需要 HTTPS 和用户麦克风授权；PDF 与 Excel 在本机解析，不上传文件。所有接口只在用户发起相应操作时接收必要文本。
- 面向近期 Chrome、Edge、Firefox、Safari，需支持 IndexedDB、Web Crypto、Web Locks、Web Audio、dialog；旧浏览器会明确提示启动失败。手机可用，物理键盘操作体验更完整。

参考：[GitHub Pages 静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[MDN 浏览器存储与清理](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)、[Qwerty Learner](https://github.com/RealKai42/qwerty-learner)。采用相同静态部署思路，练习功能继续复用本项目已有代码。

声音设置面向网页用户说明 Microsoft / Google / 本机声音的适用条件，并链接插件项目主页和 Google 翻译。练习页“本课声音”提供同一套朗读音色选项，与设置页双向同步并保存；桌面保留五种微软音色和本机声音，网页另有 Google 兼容发音。

### 公共语音回退

Microsoft 音色优先使用缓存/配套音频，再尝试 Edge 直连；失败或非 Edge 浏览器通过 `https://asa-voice-lab-beta.vercel.app/api/public/speech` 按需获取 MP3。无需公开访问口令。已配置自定义中转时保留该回退路径。后台预生成不会调用公共接口；在线开关与本课授权仍生效。

公共服务需要部署者开启 Redis 共享限额：每 IP 每天 30 次、北京时间零点重置；受理失败也计次，本地缓存不计次。另受全站总预算约束。设置与练习声音面板显示最近一次请求的剩余额度/错误。部署步骤在独立 `asa-voice-lab/PUBLIC-SETUP.md`。
