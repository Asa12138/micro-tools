// Reuses the offline report shell and interactive bibliometrics renderer.
const fs = require('fs')
const path = require('path')
const R = require('./research-report')
const C = require('./research-core')
const M = require('./research-metrics')
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const list = items => '<ul class="detail-list">' + items.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
const section = (title, body) => '<section class="panel"><h2>' + esc(title) + '</h2>' + body + '</section>'
module.exports = function makeReport(session, directory) {
  const read = file => fs.readFileSync(path.join(directory, file), 'utf8')
  const assets = { css: read('index.css') + '\n' + read('research.css'), core: read('research-core.js'), metrics: read('research-metrics.js') }
  const d = session.data
  if (session.kind === 'submission') {
    const p = d.profile, rank = d.rank, byId = new Map(d.candidates.map(c => [c.id, c]))
    const facts = c => '<p>' + esc(c.publisher) + ' · JIF ' + esc(c.jif) + '（' + esc(c.year) + '） · ' + esc(c.quartile) + '</p><p>' + esc(c.catDetail || c.category) + '</p>'
    const body = '<h1>' + esc(d.title || '摘要投稿分析') + '</h1><p class="help-text">当前 Agent 完成内容判断；未调用插件模型 API。期刊指标来自本地快照 ' + esc(session.snapshot.id) + '，匹配等级不是录用概率。</p>' +
      section('投稿策略', '<p>' + esc(rank.strategy) + '</p>') +
      section('研究画像', '<p>' + esc(p.summary) + '</p><p>' + esc(p.field) + ' · ' + esc(p.study_type) + '</p>' + list(p.keywords)) +
      section('摘要与原文证据', '<p style="white-space:pre-wrap">' + esc(d.abstract) + '</p>' + p.highlights.map(h => '<blockquote><strong>' + esc(h.label) + '</strong><p>' + esc(h.quote) + '</p><small>' + esc(h.explanation) + '</small></blockquote>').join('')) +
      section('研究亮点', list(p.strengths.map(x => x.title + '：' + x.evidence))) +
      section('信息缺口与关注点', list(p.concerns.map(x => x.title + '：' + x.evidence).concat(p.missing_information)) + '<p>' + esc(p.novelty_note) + '</p>') +
      section('候选期刊比较', rank.recommendations.map(item => '<article class="panel"><h3>' + esc(byId.get(item.id).name) + '</h3><p>' + esc(item.tier) + ' · 内容匹配 ' + esc(item.fit) + '</p>' + facts(byId.get(item.id)) + '<h4>匹配依据</h4>' + list(item.reasons) + '<h4>关注点</h4>' + list(item.concerns) + '<h4>待核实</h4>' + list(item.to_verify) + '</article>').join('')) +
      section('综合刊比较', rank.general_assessment.map(x => '<h3>' + esc(byId.get(x.id).name) + ' · ' + esc(x.decision) + '</h3><p>' + esc(x.reason) + '</p>').join('') || '<p>本轮未包含综合期刊。</p>') +
      section('完整粗筛清单', '<p>粗筛候选不等于推荐投稿；筛选条件：' + esc(JSON.stringify(d.screening)) + '</p><table><thead><tr><th>期刊</th><th>JIF / 数据年</th><th>JCR 分区</th><th>召回依据</th></tr></thead><tbody>' + d.candidates.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.jif) + ' / ' + esc(c.year) + '</td><td>' + esc(c.quartile) + '</td><td>' + esc(c.recall_source) + '</td></tr>').join('') + '</tbody></table>') +
      section('投稿准备', list(rank.checklist.map(x => x.title + '：' + x.detail)) + '<p>' + esc(rank.limitations) + '</p>')
    return R.build('投稿分析', body, d.title || '摘要投稿分析', assets)
  }
  // Exclude abstracts, file paths and raw BibTeX fields from exported HTML.
  const entries = d.entries.map(e => ({ id: e.id, key: e.key, title: e.title, year: e.year, authors: e.authors, journal: e.journal,
    keywords: e.keywords, kind: e.kind, kindSource: e.kindSource, kindReason: e.kindReason }))
  const quality = C.analyze(d.entries)
  const body = '<h1>' + esc(session.filename) + '</h1><p>本地分析 · ' + entries.length + ' 条 · 图表和清单支持离线联动</p>' +
    section('元数据完整性', '<p>缺期刊 ' + quality.missing.journal + ' · 缺年份 ' + quality.missing.year + ' · 缺 DOI ' + quality.missing.doi + ' · 缺摘要 ' + quality.missing.abstract + ' · 疑似重复 ' + quality.duplicates + '（保留在统计中）</p>' + list(d.warnings)) +
    '<div id="reportDashboard"></div><section class="panel"><h2>完整文献清单</h2><span id="reportCount"></span><div class="report-search"><input id="reportSearch" aria-label="检索导出文献" placeholder="检索标题、期刊与作者"><button id="reportReset">重置筛选</button></div><div id="reportFilters"></div><div class="report-table-wrap"><table id="reportTable"><thead><tr><th>年份</th><th>标题 / 作者</th><th>期刊 / JIF</th><th>类型与依据</th></tr></thead><tbody>' +
    entries.map(e => { const m = d.matches[e.id] || {}; return '<tr data-id="' + e.id + '"><td>' + esc(e.year || '—') + '</td><td>' + esc(e.title) + '<br><small>' + esc(e.authors.join('; ')) + '</small></td><td>' + esc(e.journal || '未提供') + '<br><small>' + esc(m.jif == null ? 'JIF 未匹配' : m.year + ' JIF ' + m.jif) + '</small></td><td>' + esc(M.KIND[e.kind]) + '<br><small>' + esc(e.kindReason) + '</small></td></tr>' }).join('') +
    '</tbody></table></div></section>'
  return R.build('文献图谱', body, session.filename, assets, { entries, matches: d.matches, state: { scope: 'all' } })
}
