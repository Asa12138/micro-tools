#!/usr/bin/env bash
# ============================================================
# 打包 科研小盒 (micro-tools) 为 ZTools 可安装的 .zpx
#
# .zpx 格式 = brotli 压缩的 Electron ASAR（ZTools ≥ 2.3.1 采用；
#            ZTools 安装时先解压，再按 ASAR 读取 plugin.json）
#
# 用法：  bash pack.sh [输出路径]          （默认正式版本路径，预览版请另指定）
# 产物：  ../micro-tools-v<版本>.zpx      （生成在插件目录上一级，方便直接分发）
#
# 关键：只打包明确列出的运行文件，绝不包含密钥、测试输入、测试脚本或临时文件。
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

[ -f plugin.json ] || { echo "❌ 未找到 plugin.json，请在插件项目根目录运行。" >&2; exit 1; }

# 从 plugin.json 读取版本号，用于产物命名（版本统一以 plugin.json 为准）
VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' plugin.json | head -1 | sed -E 's/.*"([^"]+)"$/\1/')"
[[ -n "$VERSION" ]] || { echo "❌ 无法从 plugin.json 读取 version。" >&2; exit 1; }
OUT="${1:-../micro-tools-v${VERSION}.zpx}"

FILE_LIST="$(mktemp)"
trap 'rm -f "$FILE_LIST"' EXIT
printf '%s\n' plugin.json preload.js index.html index.js index.css research.css \
  research-core.js research-metrics.js research-report.js research-prompts.js research-service.js research-ui.js \
  journals.json.gz ccf.json.gz logo.png logo.svg README.md CHANGELOG.md > "$FILE_LIST"
while IFS= read -r f; do
  [ -f "$f" ] || { echo "❌ 缺少运行文件：$f" >&2; exit 1; }
done < "$FILE_LIST"

# 构造 ASAR 并 brotli 压缩为 .zpx（node 内置能力，无需安装 @electron/asar / 联网）
#
# ASAR 布局（与 @electron/asar 完全一致）：
#   [u32 4][u32 8+jsonLen][u32 4+jsonLen][u32 jsonLen][json][数据区]
#   文件元信息里 offset 为相对数据区起点的偏移（字符串形式）
node -e '
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SRC = process.argv[1], OUT = process.argv[2];
const list = fs.readFileSync(process.argv[3], "utf8").trim().split("\n").filter(Boolean);
const chunks = []; let off = 0; const tree = {};
for (const f of list) {
  const buf = fs.readFileSync(path.join(SRC, f));
  tree[f] = { size: buf.length, offset: String(off) };
  off += buf.length; chunks.push(buf);
}
const json = Buffer.from(JSON.stringify({ files: tree }), "utf8");
const paddedLen = Math.ceil((4 + json.length) / 4) * 4;
const headerPayload = Buffer.alloc(paddedLen);
headerPayload.writeUInt32LE(json.length, 0);
json.copy(headerPayload, 4);
const head = Buffer.alloc(12);
head.writeUInt32LE(4, 0);
head.writeUInt32LE(4 + paddedLen, 4);
head.writeUInt32LE(paddedLen, 8);
const asar = Buffer.concat([head, headerPayload, ...chunks]);
fs.writeFileSync(OUT, zlib.brotliCompressSync(asar));
console.log("✔ 已生成 " + OUT + " (" + fs.statSync(OUT).size + " B，包内 " + list.length + " 个文件)");
' "$PWD" "$OUT" "$FILE_LIST"

# 校验：解回 ASAR 并列出包内文件（应只见运行文件，无 .git / .DS_Store）
echo "--- 包内文件 ---"
node -e '
const fs = require("fs"), zlib = require("zlib");
const b = zlib.brotliDecompressSync(fs.readFileSync(process.argv[1]));
const jl = b.readUInt32LE(12);
const h = JSON.parse(b.slice(16, 16 + jl).toString("utf8"));
for (const [n, m] of Object.entries(h.files)) console.log("  /" + n + "  " + m.size + " B");
' "$OUT"

echo "✅ 打包完成：${OUT}"
