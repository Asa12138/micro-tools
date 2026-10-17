/* A self-contained report: all styles, SVGs, data and interaction code travel together. */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.ResearchReport = factory()
})(typeof window === 'undefined' ? globalThis : window, function () {
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]))
  const json = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  // This DOM-only function is reused live and embedded verbatim in HTML exports.
  function initSubmission(root) {
    const nav = root.querySelector('.submission-side-nav')
    if (!nav || nav.__submissionInitialized) return
    nav.__submissionInitialized = true
    if (nav) {
      const toggle = nav.querySelector('button')
      toggle.onclick = () => { const expanded = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(expanded)); nav.classList.toggle('is-open', expanded) }
      root.querySelectorAll('a[data-report-target]').forEach(link => { link.onclick = event => {
        const target = root.querySelector('#' + link.dataset.reportTarget); if (!target) return
        event.preventDefault()
        for (let parent = target; parent && parent !== root; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true
        nav.querySelectorAll('a').forEach(a => a.classList.toggle('is-active', a === link))
        nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false')
        const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (target.scrollIntoView) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      } })
    }
    const table = root.querySelector('[data-candidate-table]'); if (!table) return
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const search = root.querySelector('[data-candidate-search]'), kind = root.querySelector('[data-candidate-kind]'), category = root.querySelector('[data-candidate-category]'), min = root.querySelector('[data-candidate-min]'), max = root.querySelector('[data-candidate-max]'), order = root.querySelector('[data-candidate-sort]'), count = root.querySelector('[data-candidate-count]'), more = root.querySelector('[data-candidate-more]'), empty = root.querySelector('[data-candidate-empty]')
    let visible = 20
    function update() {
      const query = search.value.toLowerCase().trim(), lo = min.value.trim() === '' ? null : Number(min.value), hi = max.value.trim() === '' ? null : Number(max.value)
      const allowed = rows.filter(row => {
        const value = row.dataset.jif === '' ? null : Number(row.dataset.jif)
        return (!query || row.dataset.search.includes(query)) && (!kind.value || row.dataset.kind === kind.value) && (!category.value || row.dataset.categories.split('|').includes(category.value)) && (lo == null || (value != null && value >= lo)) && (hi == null || (value != null && value <= hi))
      })
      allowed.sort((a, b) => {
        if (order.value === 'name') return a.dataset.name.localeCompare(b.dataset.name)
        if (order.value === 'if-desc' || order.value === 'if-asc') {
          if (a.dataset.jif === '' || b.dataset.jif === '') return (a.dataset.jif === '' ? 1 : 0) - (b.dataset.jif === '' ? 1 : 0)
          return (Number(a.dataset.jif) - Number(b.dataset.jif)) * (order.value === 'if-desc' ? -1 : 1) || Number(a.dataset.order) - Number(b.dataset.order)
        }
        return Number(a.dataset.order) - Number(b.dataset.order)
      })
      rows.forEach(row => { row.hidden = true })
      allowed.forEach((row, i) => { table.tBodies[0].appendChild(row); row.hidden = i >= visible })
      count.textContent = '显示 ' + Math.min(visible, allowed.length) + ' / 筛选匹配 ' + allowed.length + ' / 本轮候选 ' + rows.length
      more.hidden = visible >= allowed.length; empty.hidden = allowed.length !== 0
    }
    ;[search, min, max].forEach(control => { control.oninput = () => { visible = 20; update() } })
    ;[kind, category, order].forEach(control => { control.onchange = () => { visible = 20; update() } })
    root.querySelector('[data-candidate-reset]').onclick = () => { search.value = kind.value = category.value = min.value = max.value = ''; order.value = 'recall'; visible = 20; update() }
    more.onclick = () => { visible += 20; update() }
    // Exports restore form defaults. Reset removes filters copied from the live DOM.
    search.value = kind.value = category.value = min.value = max.value = ''; order.value = 'recall'; update()
  }
  function boot() {
    const print = document.querySelector('#reportPrint'); if (print) print.onclick = () => window.print()
    let priorDetails = [], priorRows = []
    window.addEventListener('beforeprint', () => { priorDetails = Array.from(document.querySelectorAll('details')).map(el => [el, el.open]); priorRows = Array.from(document.querySelectorAll('[data-candidate-table] tbody tr')).map(el => [el, el.hidden]); priorDetails.forEach(([el]) => { el.open = true }); priorRows.forEach(([el]) => { el.hidden = false }) })
    window.addEventListener('afterprint', () => { priorDetails.forEach(([el, open]) => { el.open = open }); priorRows.forEach(([el, hidden]) => { el.hidden = hidden }) })
    const dataEl = document.getElementById('reportData'); if (!dataEl) return
    const data = JSON.parse(dataEl.textContent), M = window.ResearchMetrics
    const selection = { year: '', journal: '', author: '', term: '', ifbin: '', entry: '' }
    let scope = data.state.scope || 'all', dashboard
    const query = document.getElementById('reportSearch'), label = document.getElementById('reportCount'), chips = document.getElementById('reportFilters')
    function update() {
      const search = query.value.toLowerCase().trim(), allowed = new Set(data.entries.filter(e => (scope === 'all' || e.kind === scope) && M.matchesFilter(e, data.matches, selection) && (!search || [e.title, e.journal, e.authors.join(' '), e.key].join(' ').toLowerCase().includes(search))).map(e => String(e.id)))
      document.querySelectorAll('#reportTable tbody tr').forEach(row => { row.hidden = !allowed.has(row.dataset.id) })
      label.textContent = '显示 ' + allowed.size + ' / ' + data.entries.length + ' 条'
      chips.replaceChildren()
      Object.entries(selection).filter(([, value]) => value !== '').forEach(([key, value]) => { const b = document.createElement('button'); b.className = 'filter-tag'; b.textContent = ({ ifbin: 'JIF 区间 ', entry: '文献 ID ' }[key] || '') + value + ' ×'; b.onclick = () => { selection[key] = ''; dashboard.setSelection(selection); update() }; chips.appendChild(b) })
    }
    dashboard = M.mount(document.getElementById('reportDashboard'), data.entries, data.matches, { state: data.state, onSelect(value) { Object.assign(selection, value); update() }, onScope(value) { scope = value; update() }, onLocate() { document.getElementById('reportTable').scrollIntoView({ block: 'start' }) } })
    query.oninput = update
    document.getElementById('reportReset').onclick = () => { Object.keys(selection).forEach(k => { selection[k] = '' }); query.value = ''; scope = 'all'; dashboard.setSelection(selection); dashboard.setScope('all'); update() }
    update()
  }
  function build(type, body, title, assets, data) {
    if (!assets || !assets.css || (data && (!assets.core || !assets.metrics))) throw new Error('完整报告资源未能读取，请重新加载插件后导出。')
    const reportCss = '.report-shell--submission{max-width:960px!important}.report-shell{max-width:1040px;margin:0 auto;padding:30px 24px 60px}.report-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px;gap:15px}.report-header strong{font-size:18px}.report-header p{font-size:12px;color:var(--muted);margin:6px 0}.report-footer{font-size:11px;color:var(--muted);border-top:1px solid var(--line);margin-top:30px;padding-top:16px;line-height:1.8}.report-search{display:flex;gap:12px;align-items:center;margin:16px 0}.report-search input{flex:1}.report-table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px;background:white}th,td{padding:13px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);line-height:1.7}th{background:#edf3f8;color:#587087}td small{color:var(--muted)}.report-body h1{font-size:22px;overflow-wrap:anywhere}.report-body .metrics-tabs{position:static}@media(max-width:660px){.report-shell{padding:20px 14px}.report-search{flex-wrap:wrap}.report-header strong{font-size:16px}}@media print{body{height:auto;background:white}.report-shell{padding:0;max-width:none}.report-header button,.report-search,.network-tools,.metrics-toolbar,.filter-tag{display:none!important}.panel{break-inside:avoid}.report-table-wrap,.matrix-scroll{overflow:visible}.metrics-grid{display:block}.metrics-grid .panel{margin:14px 0}a{color:inherit}details{display:block}}'
    const css = (assets.css + '\n' + reportCss).replace(/<\/style/gi, '<\\/style')
    const scripts = (data ? assets.core + '\n' + assets.metrics + '\n' : '') + ';(' + initSubmission.toString() + ')(document);(' + boot.toString() + ')();'
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><title>' + esc(type + ' · ' + title) + '</title><style>' + css + '</style></head><body><main class="report-shell research' + (type === '投稿分析' ? ' report-shell--submission' : '') + '"><header class="report-header"><div><strong>科研小盒 · ' + esc(type) + '</strong><p>' + esc(new Date().toLocaleString('zh-CN')) + ' · 样式与交互已内嵌，可离线打开</p></div><button class="secondary" id="reportPrint">打印 / 保存 PDF</button></header><div class="report-body">' + body + '</div><footer class="report-footer">分析基于所提供的材料；AI 内容判断需复核。期刊指标来自插件本地快照，投稿条件请核实官网。作者名称未做身份消歧，主题共现与合著不等于引用关系。报告包含你导出的研究信息，请按需分享。</footer></main>' + (data ? '<script type="application/json" id="reportData">' + json(data) + '</script>' : '') + '<script>' + scripts.replace(/<\/script/gi, '<\\/script') + '</script></body></html>'
  }
  return { build, initSubmission }
})
