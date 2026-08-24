#!/usr/bin/env bash
# ============================================================
# 打包 科研小盒 (micro-tools) 为 ZTools 可安装的 .zpx
#
# .zpx 格式 = brotli 压缩的 Electron ASAR（ZTools ≥ 2.3.1 采用；
#            ZTools 安装时先解压，再按 ASAR 读取 plugin.json）
#
# 用法：  bash pack.sh                    （在插件项目根目录执行）
# 产物：  ../micro-tools-v<版本>.zpx      （生成在插件目录上一级，方便直接分发）
#
# 关键：只打包「git 跟踪的运行文件」，绝不包含 .git / .DS_Store /
#       node_modules / 本脚本 / 未跟踪的临时文件。
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

[ -f plugin.json ] || { echo "❌ 未找到 plugin.json，请在插件项目根目录运行。" >&2; exit 1; }

# 从 plugin.json 读取版本号，用于产物命名（版本统一以 plugin.json 为准）
VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' plugin.json | head -1 | sed -E 's/.*"([^"]+)"$/\1/')"
[[ -n "$VERSION" ]] || { echo "❌ 无法从 plugin.json 读取 version。" >&2; exit 1; }
OUT="../micro-tools-v${VERSION}.zpx"

# 收集要打包的文件：git 跟踪文件（天然排除 .git / node_modules / 未跟踪文件），
# 再排除开发类文件：.gitignore、本打包脚本
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ 不在 git 仓库内：请先 git init && git add . && git commit（依赖 git 跟踪列表排除 .git）。" >&2
  exit 1
fi
git ls-files | grep -vE '^(\.gitignore|pack\.sh)$' > /tmp/mt_pack_files.txt
[ -s /tmp/mt_pack_files.txt ] || { echo "❌ 没有可打包的文件（git ls-files 为空），请先 git add 并提交。" >&2; exit 1; }

# 把文件复制到临时干净目录（保持目录结构）
TMP_SRC="$(mktemp -d)"
TMP_ASAR="${TMP_SRC}/plugin.asar"
while IFS= read -r f; do
  mkdir -p "${TMP_SRC}/$(dirname "$f")"
  cp "$f" "${TMP_SRC}/$f"
done < /tmp/mt_pack_files.txt

# ASAR 打包器：优先用已安装的 asar，否则 npx 临时拉取 @electron/asar；
# 也支持显式指定：ASAR_BIN=/path/to/asar bash pack.sh
if [ -n "${ASAR_BIN:-}" ]; then
  :
elif command -v asar >/dev/null 2>&1; then
  ASAR_BIN=asar
else
  ASAR_BIN="npx --yes @electron/asar"
fi
echo "📦 使用 ASAR 打包器：$ASAR_BIN"
$ASAR_BIN pack "$TMP_SRC" "$TMP_ASAR"

# brotli 压缩为 .zpx（node 内置 zlib，无需额外依赖）
node -e "const fs=require('fs'),z=require('zlib');const a=fs.readFileSync('${TMP_ASAR}');fs.writeFileSync('${OUT}',z.brotliCompressSync(a));console.log('✔ 已生成 ${OUT} ('+fs.statSync('${OUT}').size+' B)')"

# 校验：列出包内文件（应只见运行文件，无 .git）
echo "--- 包内文件 ---"
$ASAR_BIN list "$TMP_ASAR"

rm -rf "$TMP_SRC" /tmp/mt_pack_files.txt
echo "✅ 打包完成：${OUT}"
