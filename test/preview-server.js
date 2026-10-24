// Isolated loopback UI preview. Real local journal metadata, explicitly mocked AI.
// Not included in the install package; no keys, paid requests or uploads to third parties.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const root = path.resolve(__dirname, '..'), C = require('../features/research/research-core')
global.window = { ztools: { dbStorage: { getItem() {}, setItem() {} } } }; require('../preload'); const api = global.window.journalApi; api.ensureLoaded()
const input = process.argv[2], corpus = input ? C.parseBibtex(fs.readFileSync(input, 'utf8')).entries : []
const venueKey = name => C.normalize(String(name || '').replace(/^the\s+/i, ''))
const names = new Set(corpus.map(e => venueKey(e.journal)))
const seeds = ['FEMS MICROBIOLOGY ECOLOGY', 'GLOBAL CHANGE BIOLOGY', 'ISME JOURNAL', 'NATURE']
seeds.forEach(n => names.add(venueKey(n)))
C.candidates(api, { journal_seeds: seeds, search_terms: ['microbiology', 'ecology'] }).forEach(r => names.add(venueKey(r.name)))
const records = []
for (let i = 0; i < api.allTotal; i++) { const r = api.get(i); if (!r._conf && (names.has(venueKey(r.name)) || names.has(venueKey(r.abbr)))) records.push({ _i: records.length, name: r.name, abbr: r.abbr, publisher: r.publisher, category: r.category, catDetail: r.catDetail, issn: r.issn, eissn: r.eissn, year: r.year, jif: r.jif, quartile: r.quartile }) }
function setup(records) {
  const norm = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  window.journalApi = { ensureLoaded() {}, loaded: true, total: records.length, allTotal: records.length, ccfTotal: 0, get: i => records[i], search(query, limit) { const n = norm(query); return records.filter(r => [r.name, r.abbr, r.issn].some(v => norm(v).includes(n))).slice(0, limit || 60) } }
  window.researchApi = {
    getSettings: () => ({ mode: 'host', hostModel: '界面测试 · 模拟结果', hasKey: false, hostAvailable: true }),
    models: async () => [], saveSettings: () => ({ persisted: false }), cancel() {},
    async call(messages) {
      const data = JSON.parse(messages[1].content)
      if (messages[0].content.includes('建立研究画像')) return JSON.stringify({ summary: '界面测试文案：本示例用于展示摘要解析与期刊建议的排版，未调用真实模型。', field: '微生物生态学', study_type: '研究论文', keywords: ['Arctic', 'glacier forefield', 'microbial succession'], search_terms: ['microbiology', 'ecology'], journal_seeds: ['ISME Journal', 'Global Change Biology', 'FEMS Microbiology Ecology'], highlights: [{ label: '方法', quote: data.abstract.slice(0, 65), explanation: '仅用于检查原文高亮显示' }], strengths: [{ title: '研究主题可辨识', evidence: '示例摘要提供了研究对象与场景，可作为期刊候选召回的线索。' }], concerns: [{ title: '依据全文再作决定', evidence: '摘要不足以确认完整证据和创新程度。' }], missing_information: ['请结合全文、对照文献与作者指南核实'], novelty_note: '本页是 UI 测试，不代表真实投稿评估。' })
      if (messages[0].content.includes('已核对期刊候选')) {
        const chosen = ['ISME JOURNAL', 'NATURE COMMUNICATIONS', 'FEMS MICROBIOLOGY ECOLOGY', 'GLOBAL CHANGE BIOLOGY', 'PROCEEDINGS OF THE NATIONAL ACADEMY OF SCIENCES OF THE UNITED STATES OF AMERICA']
        return JSON.stringify({ strategy: '界面测试：将专科刊与综合刊放在同一轮比较。以下内容为模拟文案，用于展示结构与交互，不代表实际投稿结论。', recommendations: chosen.map((name, i) => { const r = data.candidates.find(x => norm(x.name) === norm(name)); return r && { id: r.id, tier: i ? '拓展考虑' : '优先比较', fit: i ? '中等' : '较高', reasons: [r.is_general ? '将研究对象与更广泛的生态过程联系，供跨学科受众比较（测试文案）。' : '读者群体覆盖微生物生态学与环境变化研究（测试文案）。', '可围绕生态过程与演替规律组织研究叙述（测试文案）。'], concerns: ['需核实全文的证据强度、创新性和该刊当前收稿范围。'], to_verify: ['Aims & Scope 与研究论文稿型', '摘要字数、图表与数据共享要求', '开放获取选项与最新 APC'] } }).filter(Boolean), general_assessment: data.candidates.filter(c => c.is_general).map(c => ({ id: c.id, decision: chosen.includes(c.name.toUpperCase()) ? '入选' : '待核实', reason: '界面测试：综合刊已参与比较；需从全文确认跨领域意义、证据完整性和适用稿型。' })), checklist: [{ title: '核实作者指南', detail: '在提交前确认稿型、格式、数据可用性与费用。' }, { title: '对照近期文章', detail: '比较该刊近期研究主题与本稿的读者定位。' }], limitations: '模拟模型输出仅用于界面验证；数值指标来自真实本地期刊数据。' })
      }
      return JSON.stringify({ items: data.items.map(e => ({ id: e.id, kind: 'unknown', evidence: '', reason: '测试环境不推断文献类型' })) })
    }
  }
}
const bootstrap = '<script>;(' + setup.toString() + ')(' + JSON.stringify(records).replace(/</g, '\\u003c') + ');</script>'
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<main class="app">', '<main class="app"><p class="notice">本地界面测试 · AI 输出为模拟文案 · 期刊指标为本地真实快照</p>').replace('<script src="features/research/research-core.js">', bootstrap + '<script src="features/research/research-core.js">')
const allow = new Set(['shared/ai-connection.js','index.css','features/research/research.css','features/research/research-core.js','features/research/research-metrics.js','features/research/research-report.js','features/research/research-prompts.js','index.js','features/research/research-ui.js','assets/images/logo.png'])
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1)
  if (!name || name === 'index.html') { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html); return }
  if (!allow.has(name)) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript;charset=utf-8' : name.endsWith('.css') ? 'text/css;charset=utf-8' : 'image/png'); res.end(fs.readFileSync(path.join(root, name)))
}).listen(8778, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8778/; journal subset:', records.length))
