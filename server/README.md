# 跨浏览器语音服务（本地开发版）

浏览器经 HTTP POST 接收真实 MP3，微软连接由 Node 端复用现有 `english-speech.js` 完成。支持 Andrew / Ava / Emma / Ryan / Sonia；Google 句子与试听固定使用 Google，与单词发音来源分别选择。没有更改桌面 TTS 协议。

## 本机运行

在 micro-tools 目录执行：

```sh
node scripts/build-english-web.cjs
node scripts/serve-english-speech.cjs
```

打开 `http://127.0.0.1:53785/apps/research-english/`。服务只监听回环地址，自动为该本机页面配置临时口令。Safari、Chrome、Chromium、Edge 均可通过同一 HTTP 接口请求，浏览器无需自己连接微软 WebSocket。本机页面与线上网页不是同一 Origin，不会自动共享学习记录。

Google 请求复用现有网络层：按系统 HTTP 代理设置连接；服务不会更改代理配置。微软连接仍使用既有 Node 实现。停止此进程后本机页面与中转均不可用。

## 独立 Netlify 部署准备

```sh
node scripts/build-speech-relay.cjs
```

输出 `dist/speech-relay/`，包含 `netlify.toml`、Node Function、依赖和许可证，约 600 KB，无需拷贝素材、个人数据或社区项目。它是可部署目录，尚未执行公网发布。

- 从该目录部署独立 Netlify 站点（需构建 Functions，不能只上传静态 public 目录）。部署根目录读取该处的 `netlify.toml`。
- 设置 `SPEECH_ALLOWED_ORIGINS=https://asa12138.github.io`；多个精确 Origin 以逗号分隔。默认未配置时拒绝全部来源。
- 私人服务可另设 `SPEECH_RELAY_TOKEN`，网页保留 `englishApi.speechRelayConfig({endpoint,token})` 配置接口；普通用户设置界面暂时隐藏。公共服务无口令时依靠来源限制、输入校验与限流；Origin 不是用户身份认证。
- Function 配置每 IP/域名 60 次/分钟限制；单实例最多 4 个活动请求。只接受固定引擎和音色，不接受任意 URL；不记录正文与音频，响应禁止公共缓存。句子会经此服务发往 Microsoft 或 Google。消耗 Netlify Functions 用量，部署时核对账户额度。
- 成功部署后，服务地址形如 `https://站点.netlify.app/api/speech`。可通过保留的配置接口设置，或用下面的构建参数作为网站默认值：

```sh
ENGLISH_SPEECH_RELAY_URL=https://站点.netlify.app/api/speech node scripts/build-english-web.cjs
```

默认地址仅用于首次未配置的浏览器，保留用户已有地址和停用选择。访问口令不写入构建、不进入课程或完整备份。前端和语音后端各自部署并验证后，才算公网可用。

## 本轮验证

- `test/english-speech-relay.test.cjs`：来源/口令、输入与大小限制、MP3 校验、Google 来源独立性。
- `test/english-web-speech-relay-live.test.cjs`：已有 Chromium 实际生成并播放 Andrew、刷新后复用 IndexedDB、默认单词来源为有道时播放真实 Google 句子与 Google 试听。
- 现有本机声音回退和配套音频播放检查通过；Edge 直连 Ava 生成后可解码。Chromium 停用中转后，Google 试听直接请求 Google 并播放成功；未配置服务的非 Edge 浏览器不再后台请求微软。
- Safari 自动化被系统的 Allow remote automation 设置拒绝，本轮未变更该设置；可直接打开本机预览进行实际试听。独立语音后端尚未部署至 Netlify。

协议依据：[edge-tts 浏览器限制](https://github.com/andresayac/edge-tts#browser-support)、[Netlify Functions 配置](https://docs.netlify.com/build/functions/configuration/)、[Functions 限流](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)。
