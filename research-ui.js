/* Research views. Model text is rendered as escaped text, never executable HTML. */
;(function () {
  'use strict'
  const C = window.ResearchCore, P = window.ResearchPrompts, M = window.ResearchMetrics
  const q = s => document.querySelector(s)
  const s = (v, max = 4000) => typeof v === 'string' ? v.slice(0, max) : ''
  const arr = (v, max = 12) => Array.isArray(v) ? v.slice(0, max) : []
  const strings = (v, max = 12) => arr(v, max).map(x => s(x, 800)).filter(Boolean)
  const KINDS = { review: '综述', research: '研究论文', unknown: '待确认', other: '其他' }
  let busy = '', stopped = false, submission = null
  const emptyFilters = () => ({ year: '', journal: '', term: '', author: '', ifbin: '', entry: '' })
  let bib = null, filename = '', filters = emptyFilters(), visible = 30, dashboard = null, reportAssets = null
  function api() { if (!window.researchApi) throw new Error('请在 ZTools 中加载插件以连接模型；文献本地分析可独立使用。'); return window.researchApi }
  function status(id, message, type = '') { const el = q('#' + id); el.textContent = message; el.className = 'status' + (type ? ' status--' + type : '') }
  function listHTML(items) { return '<ul class="detail-list">' + strings(items).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a')
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000)
  }
  function claim(owner) { if (busy) throw new Error('已有模型任务正在进行，请先停止或等待完成。'); busy = owner; stopped = false }
  function stop() { stopped = true; if (window.researchApi) window.researchApi.cancel() }
  function alive() { if (stopped) throw new Error('已停止分析。') }
  async function ask(prompt, input) { const result = await api().call([{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) }]); alive(); return C.jsonResult(result) }
  function modelLabel() {
    if (!window.researchApi) return 'AI 尚未连接 · 本地文献分析可用'
    const conf = api().getSettings()
    return conf.mode === 'host' ? '模型：ZTools ' + (conf.hostModel || '默认模型') : '模型：' + (conf.model || '待配置') + (conf.hasKey ? ' · 会话 key 已填写' : ' · 请检查 key / 本地服务')
  }
  function updateModelLabels() { document.querySelectorAll('[data-model-status]').forEach(el => { el.textContent = modelLabel() }) }
  q('#settingsBtn').addEventListener('click', () => showView('settings'))
  document.querySelectorAll('[data-open-settings]').forEach(b => b.addEventListener('click', () => showView('settings')))

  // ---------- Provider settings ----------
  const PRESETS = {
    custom: { protocol: 'openai', baseUrl: '', guide: '从平台官方文档获取 API key、Base URL 与模型 ID。OpenAI 兼容地址通常以 /v1 结尾；不要填写网页聊天地址。', url: '' },
    deepseek: { protocol: 'openai', baseUrl: 'https://api.deepseek.com', url: 'https://api-docs.deepseek.com/', guide: '在 DeepSeek 开放平台创建 API key，填写可用的模型 ID。' },
    qwen: { protocol: 'openai', baseUrl: 'https://YOUR-WORKSPACE-ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', url: 'https://help.aliyun.com/zh/model-studio/first-api-call-to-qwen', guide: '在阿里云百炼创建 API key，复制模型 ID 和业务空间 ID。将地址中的 YOUR-WORKSPACE-ID 替换为真实 ID；此模板为北京地域，其它地域请按官方文档修改。' },
    siliconflow: { protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', url: 'https://docs.siliconflow.cn/', guide: '在硅基流动控制台创建 API key，复制完整模型 ID（通常含厂商前缀）。' },
    moonshot: { protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', url: 'https://platform.moonshot.cn/docs', guide: '在 Moonshot 开放平台创建 API key，选择支持文本对话的模型。' },
    openai: { protocol: 'openai', baseUrl: 'https://api.openai.com/v1', url: 'https://platform.openai.com/docs/api-reference/chat', guide: '在 OpenAI API 平台创建 key 并检查 API 额度。请填写支持 Chat Completions 的模型 ID。' },
    anthropic: { protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', url: 'https://platform.claude.com/docs/en/api/messages/create', guide: '在 Anthropic Console 创建标准 API key，填写支持 Messages 的 Claude 模型 ID。' },
    gemini: { protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', url: 'https://ai.google.dev/gemini-api/docs/api-key', guide: '在 Google AI Studio 创建 Gemini API key，模型 ID 不含 models/ 前缀。此预设不适用于 Vertex AI。' },
    ollama: { protocol: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', url: 'https://docs.ollama.com/api/openai-compatibility', guide: '先启动本机 Ollama 并拉取模型，填写本机已有的模型名称。通常无需 key。请求在本机处理。' }
  }
  function modeChanged() { const direct = q('#aiMode').value === 'direct'; q('#hostSettings').hidden = direct; q('#directSettings').hidden = !direct }
  function providerGuide() {
    const preset = PRESETS[q('#aiProvider').value] || PRESETS.custom
    q('#providerGuide').innerHTML = esc(preset.guide) + (preset.url ? ' <button type="button" class="text-button" id="providerDocs">官方配置文档 ↗</button>' : '')
    const link = q('#providerDocs'); if (link) link.onclick = () => openExternal(preset.url)
  }
  async function loadSettings() {
    try {
      const conf = api().getSettings()
      q('#aiMode').value = conf.mode; q('#aiProtocol').value = conf.protocol; q('#aiProvider').value = PRESETS[conf.provider] ? conf.provider : 'custom'
      q('#aiBaseUrl').value = conf.baseUrl; q('#aiModel').value = conf.model; q('#aiKey').value = ''
      q('#keyState').textContent = conf.hasKey ? '本次会话已配置 key' : '本次会话没有 key'
      modeChanged(); providerGuide()
      const models = await api().models()
      q('#hostModel').innerHTML = '<option value="">ZTools 默认模型</option>' + models.map(m => '<option value="' + esc(m.value) + '">' + esc((m.provider ? m.provider + ' · ' : '') + m.label) + '</option>').join('')
      if (conf.hostModel && !models.some(m => m.value === conf.hostModel)) q('#hostModel').insertAdjacentHTML('beforeend', '<option value="' + esc(conf.hostModel) + '">' + esc(conf.hostModel) + '（已配置）</option>')
      q('#hostModel').value = conf.hostModel
      if (!conf.hostAvailable && conf.mode === 'host') status('settingsStatus', '未检测到 ZTools AI 接口。请在支持 AI 的 ZTools 版本中使用，或切换直连 API。')
    } catch (err) { status('settingsStatus', err.message, 'error'); modeChanged(); providerGuide() }
  }
  function saveSettings() {
    const conf = api().saveSettings({ mode: q('#aiMode').value, protocol: q('#aiProtocol').value, provider: q('#aiProvider').value, baseUrl: q('#aiBaseUrl').value, model: q('#aiModel').value, hostModel: q('#hostModel').value, apiKey: q('#aiKey').value })
    q('#aiKey').value = ''; q('#keyState').textContent = conf.hasKey ? '本次会话已配置 key' : '本次会话没有 key'; updateModelLabels()
    return conf
  }
  q('#aiMode').onchange = modeChanged
  q('#aiProvider').onchange = () => { const p = PRESETS[q('#aiProvider').value]; q('#aiProtocol').value = p.protocol; q('#aiBaseUrl').value = p.baseUrl; q('#aiModel').value = ''; q('#aiKey').value = ''; providerGuide() }
  q('#openHostSettings').onclick = () => { try { api().openHostSettings() } catch (err) { status('settingsStatus', err.message, 'error') } }
  q('#clearApiKey').onclick = () => { try { api().saveSettings({ clearKey: true }); q('#aiKey').value = ''; q('#keyState').textContent = '本次会话没有 key'; status('settingsStatus', '会话 key 已清除。', 'success'); updateModelLabels() } catch (err) { status('settingsStatus', err.message, 'error') } }
  q('#settingsForm').onsubmit = e => { e.preventDefault(); try { const conf = saveSettings(); status('settingsStatus', conf.persisted ? '配置已保存。API key 仅保留在本次会话内存中。' : '配置已用于本次会话；当前环境不能保存非敏感配置。', 'success') } catch (err) { status('settingsStatus', err.message, 'error') } }
  q('#testApi').onclick = async () => {
    try {
      if (busy) throw new Error('请先完成或停止其它模型任务。')
      saveSettings(); claim('test'); q('#testApi').disabled = true; q('#testApiCancel').hidden = false
      status('settingsStatus', '正在发送简短连接测试请求…')
      await api().call([{ role: 'user', content: '连接测试。请只返回一个 JSON 对象：{"ok":true}' }]); alive()
      status('settingsStatus', '连接成功，模型已返回文本。实际分析效果取决于所选模型。', 'success')
    } catch (err) { status('settingsStatus', err.message, 'error') }
    finally { if (busy === 'test') busy = ''; q('#testApi').disabled = false; q('#testApiCancel').hidden = true }
  }
  q('#testApiCancel').onclick = stop

  // ---------- Two-stage submission analysis ----------
  function profileResult(raw, abstract) {
    if (!s(raw.summary).trim() || !s(raw.field).trim()) throw new Error('模型缺少研究摘要或领域信息，请重新分析。')
    return {
      summary: s(raw.summary), field: s(raw.field, 200), study_type: s(raw.study_type, 200), keywords: strings(raw.keywords, 10), search_terms: strings(raw.search_terms, 10), journal_seeds: strings(raw.journal_seeds, 10),
      highlights: arr(raw.highlights, 5).filter(h => h && s(h.quote).length >= 15 && s(h.quote).length <= 240 && abstract.includes(h.quote)).map(h => ({ label: ['问题', '方法', '结果', '结论', '局限'].includes(h.label) ? h.label : '关注点', quote: h.quote, explanation: s(h.explanation, 800) })),
      strengths: arr(raw.strengths, 6).filter(x => x && s(x.title)).map(x => ({ title: s(x.title, 200), evidence: s(x.evidence, 1000) })),
      concerns: arr(raw.concerns, 6).filter(x => x && s(x.title)).map(x => ({ title: s(x.title, 200), evidence: s(x.evidence, 1000) })), missing_information: strings(raw.missing_information, 8), novelty_note: s(raw.novelty_note, 1500)
    }
  }
  function rankedResult(raw, candidates) {
    const ids = new Set(candidates.map(c => c.id)), used = new Set()
    const recommendations = arr(raw.recommendations, 10).filter(x => x && Number.isInteger(x.id) && ids.has(x.id) && !used.has(x.id) && used.add(x.id)).slice(0, 6).map(x => ({ id: x.id, tier: ['优先比较', '拓展考虑', '补充候选'].includes(x.tier) ? x.tier : '补充候选', fit: ['较高', '中等', '待核实'].includes(x.fit) ? x.fit : '待核实', reasons: strings(x.reasons, 5), concerns: strings(x.concerns, 4), to_verify: strings(x.to_verify, 6) }))
    if (!recommendations.length) throw new Error('模型没有返回可核对的期刊候选。摘要分析已保留，可重新尝试。')
    const generalRaw = arr(raw.general_assessment, 30), recommended = new Set(recommendations.map(x => x.id))
    const general_assessment = candidates.filter(c => c.is_general).map(c => {
      const item = generalRaw.find(x => x && x.id === c.id)
      return { id: c.id, decision: recommended.has(c.id) ? '入选' : item && ['待核实', '暂不优先'].includes(item.decision) ? item.decision : '待核实', reason: item && s(item.reason).trim() || '已送入本轮模型比较，但模型未给出单独评估依据，需人工确认。' }
    })
    return { strategy: s(raw.strategy), recommendations, general_assessment, checklist: arr(raw.checklist, 6).filter(x => x && s(x.title)).map(x => ({ title: s(x.title, 200), detail: s(x.detail, 1000) })), limitations: s(raw.limitations) }
  }
  function highlightsHTML(abstract, highlights) {
    const matches = highlights.map((h, i) => ({ start: abstract.indexOf(h.quote), end: abstract.indexOf(h.quote) + h.quote.length, h, i })).sort((a, b) => a.start - b.start)
    let cursor = 0, html = ''
    matches.forEach(m => { if (m.start < cursor) return; html += esc(abstract.slice(cursor, m.start)) + '<mark title="' + esc(m.h.label + '：' + m.h.explanation) + '" class="highlight highlight--' + m.i + '">' + esc(m.h.quote) + '</mark>'; cursor = m.end })
    return html + esc(abstract.slice(cursor))
  }
  const COMMUNITIES = [
    { name: 'Springer Nature Communities', label: '出版商官方社区', url: 'https://communities.springernature.com/', text: '编辑观点、论文背后的故事与学科讨论。可在社区内检索期刊名称。' },
    { name: 'Rising Scholars / AuthorAID', label: 'INASP 研究者社区', url: 'https://risingscholars.net/en/discussion/', text: '研究写作、发表与合作交流；论坛加入需申请。' },
    { name: 'PubPeer', label: '独立非营利 · 发表后评议', url: 'https://pubpeer.com/', text: '查看已发表论文的学术讨论，辅助了解研究内容。' }
  ]
  function externalLink(url, title, className = 'text-button') { return '<a class="' + className + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" data-external>' + esc(title) + ' ↗</a>' }
  document.addEventListener('click', e => { const link = e.target.closest('a[data-external]'); if (link) { e.preventDefault(); openExternal(link.href) } })
  function journalLinks(rec) {
    return {
      guidelines: 'https://www.bing.com/search?q=' + encodeURIComponent('"' + rec.name + '" official author guidelines ' + (rec.publisher || '')),
      profile: rec.abbr ? 'https://jcr.clarivate.com/jcr-jp/journal-profile?journal=' + encodeURIComponent(rec.abbr) + '&year=' + encodeURIComponent(rec.year || '2025') : '',
      experience: 'https://www.bing.com/search?q=' + encodeURIComponent('"' + rec.name + '" 投稿经验 review experience')
    }
  }
  function journalSubjects(rec) {
    if (rec.catDetail) return rec.catDetail.split('|').map(x => x.split('(')[0].split(':')[0].trim()).filter(Boolean).join(' · ')
    return rec.category && rec.category !== 'Multiple' ? rec.category : rec.ccfCat || '学科待核实'
  }
  function reportSection(id, title, caption, body, open = true) {
    return '<details class="panel research-profile submission-section" id="' + id + '"' + (open ? ' open' : '') + '><summary><span>' + title + '</span><small>' + caption + '</small></summary><div class="profile-body">' + body + '</div></details>'
  }
  function screeningLabel() {
    const range = submission.screening.if_range
    return range.min == null && range.max == null ? 'IF 不限' : 'IF ' + (range.min == null ? '0' : range.min) + '–' + (range.max == null ? '不限' : range.max)
  }
  function candidateTableHTML() {
    const candidates = submission.candidates || [], chosen = new Set(submission.rank ? submission.rank.recommendations.map(x => x.id) : [])
    const categories = Array.from(new Set(candidates.flatMap(c => journalSubjects(c).split(' · ')))).sort()
    return '<p class="help-text">以下是本轮送入模型比较的粗筛候选，最多 65 本，来自研究画像、学科关键词与综合期刊比较池。粗筛入围不等于建议投稿；IF / 分区来自本地快照。' + esc(screeningLabel()) + ' · ' + (submission.screening.include_general ? '包含综合期刊' : '仅专科期刊') + '。</p><div class="candidate-filters"><input data-candidate-search aria-label="检索粗筛期刊" placeholder="检索期刊、ISSN、出版方或学科"><select data-candidate-kind aria-label="期刊类别"><option value="">全部类别</option><option value="general">综合期刊</option><option value="specialist">专科期刊</option></select><select data-candidate-category aria-label="学科筛选"><option value="">全部学科</option>' + categories.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('') + '</select><input type="number" min="0" step="0.1" data-candidate-min aria-label="粗筛最低 IF" placeholder="最低 IF"><input type="number" min="0" step="0.1" data-candidate-max aria-label="粗筛最高 IF" placeholder="最高 IF"><select data-candidate-sort aria-label="粗筛排序"><option value="recall">召回顺序</option><option value="if-desc">IF 从高到低</option><option value="if-asc">IF 从低到高</option><option value="name">期刊名称 A–Z</option></select><button class="text-button" type="button" data-candidate-reset>重置筛选</button></div><p class="candidate-count" data-candidate-count aria-live="polite"></p><div class="candidate-table-wrap"><table class="candidate-table" data-candidate-table><thead><tr><th scope="col">期刊 / 出版方</th><th scope="col">JIF</th><th scope="col">分区</th><th scope="col">类别 / 学科</th><th scope="col">召回线索</th></tr></thead><tbody>' + candidates.map((c, i) => {
      const value = c.jif == null || String(c.jif).trim() === '' || !Number.isFinite(Number(c.jif)) ? '' : Number(c.jif), subjects = journalSubjects(c)
      return '<tr data-order="' + i + '" data-name="' + esc(c.name) + '" data-jif="' + value + '" data-kind="' + (c.is_general ? 'general' : 'specialist') + '" data-categories="' + esc(subjects.split(' · ').join('|')) + '" data-search="' + esc([c.name, c.publisher, subjects, c.issn].join(' ').toLowerCase()) + '"><td><strong>' + esc(c.name) + '</strong>' + (chosen.has(c.id) ? '<span class="candidate-picked">最优候选</span>' : '') + '<small>' + esc(c.publisher || '出版方待核实') + ' · ' + esc(c.issn || 'ISSN 未提供') + '</small></td><td class="candidate-if"><b>' + (value === '' ? '—' : value) + '</b><small>' + esc(c.year || '未标年') + '</small></td><td><span class="tag">' + esc(c.quartile || '—') + '</span></td><td><span class="candidate-kind' + (c.is_general ? ' candidate-kind--general' : '') + '">' + (c.is_general ? '综合期刊' : '专科期刊') + '</span><small>' + esc(subjects) + '</small></td><td><small>' + esc(c.recall_source || '研究画像线索') + '</small></td></tr>'
    }).join('') + '</tbody></table></div><p class="help-text" data-candidate-empty hidden>没有符合当前筛选条件的候选。请调整筛选或重置。</p><button class="secondary" type="button" data-candidate-more>显示更多候选</button>'
  }
  function renderSubmission() {
    const el = q('#submissionResults'); if (!submission || !submission.profile) { el.hidden = true; return }
    const p = submission.profile, r = submission.rank
    el.hidden = false
    const profile = reportSection('submissionProfile', '研究画像', '问题 · 方法 · 发现 · 研究亮点', '<p class="summary-text">' + esc(p.summary) + '</p><div class="tag-row">' + p.keywords.map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div><div class="recommendation-detail"><div><h4>值得突出</h4>' + p.strengths.map(x => '<div class="analysis-point"><strong>' + esc(x.title) + '</strong><p>' + esc(x.evidence) + '</p></div>').join('') + '</div><div><h4>需要补充说明</h4>' + p.concerns.map(x => '<div class="analysis-point"><strong>' + esc(x.title) + '</strong><p>' + esc(x.evidence) + '</p></div>').join('') + '</div></div>' + (p.novelty_note || p.missing_information.length ? '<details class="notice"><summary>评估边界与信息缺口</summary><p>' + esc(p.novelty_note) + '</p>' + listHTML(p.missing_information) + '</details>' : ''))
    const highlights = reportSection('submissionHighlights', '摘要高亮', '逐字核对原文 · 保留上下文', '<p class="abstract-highlight">' + highlightsHTML(submission.abstract, p.highlights) + '</p>' + (p.highlights.length ? '<div class="highlight-legend">' + p.highlights.map((h, i) => '<span><i class="highlight--' + i + '"></i>' + esc(h.label) + ' · ' + esc(h.explanation) + '</span>').join('') + '</div>' : '<p class="help-text">模型没有提供可逐字核对的高亮片段，已保留原文。</p>'))
    const sections = [['submissionOverview', '报告概览'], ['submissionProfile', '研究画像'], ['submissionHighlights', '摘要高亮']]
    if (r) sections.push(['submissionRecommendations', '最优候选'])
    if (submission.candidates && submission.candidates.length) sections.push(['submissionCandidates', '粗筛清单'])
    if (r && r.general_assessment.length) sections.push(['submissionGeneral', '综合刊比较'])
    if (r) sections.push(['submissionPreparation', '投稿准备'])
    sections.push(['submissionCommunities', '交流支持'])
    const nav = '<nav class="submission-side-nav" aria-label="报告章节导航"><button class="secondary" type="button" aria-expanded="false">报告导航 ☰</button><div><strong>本页导航</strong>' + sections.map(([id, title], i) => '<a href="#' + id + '" data-report-target="' + id + '"><span>' + String(i + 1).padStart(2, '0') + '</span>' + title + '</a>').join('') + '</div></nav>'
    el.innerHTML = nav + '<section class="panel submission-overview" id="submissionOverview"><div class="list-heading"><span class="eyebrow">YOUR JOURNAL SHORTLIST</span><button class="secondary" id="exportSubmission">导出完整报告</button></div><h2>' + esc(submission.title || '摘要投稿分析') + '</h2><div class="tag-row"><span class="tag tag--violet">' + esc(p.field) + '</span><span class="tag">' + esc(submission.type === 'auto' ? (p.study_type || '稿件类型待确认') + ' · 模型判断' : submission.type + ' · 用户指定') + '</span><span class="tag">' + esc(screeningLabel()) + '</span><span class="tag">' + (r ? r.recommendations.length + ' 本最优候选' : '研究画像已完成') + '</span></div><p>' + esc(r ? r.strategy : p.summary) + '</p><p class="help-text">内容匹配由 AI 基于提供的材料判断；指标来自本地 JCR / CCF 快照，匹配等级不是录用概率。</p></section>' + profile + highlights +
      (r ? reportSection('submissionRecommendations', '最优候选期刊', r.recommendations.length + ' 本 · 内容与受众匹配优先', '<nav class="shortlist-nav" aria-label="推荐期刊导航">' + r.recommendations.map((x, i) => '<a href="#journal-rec-' + i + '" data-report-target="journal-rec-' + i + '"><span>' + String(i + 1).padStart(2, '0') + '</span>' + esc(window.journalApi.get(x.id).name) + '</a>').join('') + '</nav><div class="journal-shortlist">' + r.recommendations.map(recommendationHTML).join('') + '</div>') : '<section class="notice">期刊推荐生成后会显示在这里。</section>') +
      (submission.candidates && submission.candidates.length ? reportSection('submissionCandidates', '本轮粗筛清单', submission.candidates.length + ' 本 · 可检索、筛选与排序', candidateTableHTML(), false) : '') +
      (r && r.general_assessment.length ? reportSection('submissionGeneral', '综合期刊比较', '入选依据与未优先推荐的原因', '<p class="help-text">以下综合刊均进入本轮比较。结论由模型基于摘要判断，未核实官方收稿范围或编辑意见。</p><div class="general-assessments">' + r.general_assessment.map(x => '<article><div><strong>' + esc(window.journalApi.get(x.id).name) + '</strong><span class="tag' + (x.decision === '入选' ? ' tag--violet' : '') + '">' + esc(x.decision) + '</span></div><p>' + esc(x.reason) + '</p></article>').join('') + '</div>', false) : '') +
      (r ? reportSection('submissionPreparation', '投稿准备清单', '作者指南 · 全文证据 · 材料准备', '<ol class="checklist">' + r.checklist.map(x => '<li><strong>' + esc(x.title) + '</strong><p>' + esc(x.detail) + '</p></li>').join('') + '</ol><p class="help-text">' + esc(r.limitations) + '</p>') : '') +
      reportSection('submissionCommunities', '学术交流与发表支持', '经核对的外部入口', '<div class="community-grid">' + COMMUNITIES.map(x => '<a class="community-card" data-external href="' + x.url + '" target="_blank" rel="noopener noreferrer"><span class="tag">' + x.label + '</span><strong>' + x.name + ' ↗</strong><p>' + x.text + '</p></a>').join('') + '</div><p class="help-text">这些社区的讨论主题各不相同；用户评论不代表期刊官方承诺。审稿周期、费用与稿型以最新作者指南为准。</p>', false)
    window.ResearchReport.initSubmission(el)
    q('#exportSubmission').onclick = () => exportReport('投稿分析', el.innerHTML, submission.title || '摘要投稿分析')
  }
  function recommendationHTML(item, i) {
    const rec = window.journalApi.get(item.id), links = journalLinks(rec)
    return '<article class="panel recommendation' + (i === 0 ? ' recommendation--lead' : '') + '" id="journal-rec-' + i + '"><div class="recommendation-top"><span class="rank-number">' + String(i + 1).padStart(2, '0') + '</span><div><div class="action-row"><span class="tag tag--violet">' + esc(item.tier) + '</span><span class="fit-chip">内容匹配 · ' + esc(item.fit) + '</span></div><h3>' + esc(rec.name) + '</h3><p class="panel-caption">' + esc(rec.publisher || '出版方待核实') + '</p></div></div><div class="journal-facts"><div><span>Journal Impact Factor</span><strong>' + esc(rec.jif !== '' && rec.jif != null ? rec.jif : '—') + '</strong><small>' + esc(rec.year || '未标年') + ' JIF · 本地快照</small></div><div><span>JCR 分区</span><strong>' + esc(rec.quartile || '—') + '</strong><small>' + (rec.ccfRank ? 'CCF ' + esc(rec.ccfRank) : '以所列学科分区为准') + '</small></div><div class="journal-field"><span>学科 / 期刊领域</span><b>' + esc(journalSubjects(rec)) + '</b><small>ISSN ' + esc(rec.issn || '未提供') + '</small></div></div><div class="journal-content"><div class="journal-fit"><h4>为什么值得比较</h4>' + listHTML(item.reasons) + '</div><div class="journal-concern"><h4>投稿前关注</h4>' + (item.concerns.length ? listHTML(item.concerns) : '<p class="help-text">摘要未提供足够信息；请结合全文与作者指南核实适配性。</p>') + '</div></div><details class="submission-requirements"><summary>投稿须知 <span>待核实 ' + item.to_verify.length + ' 项</span></summary>' + listHTML(item.to_verify.length ? item.to_verify : ['官网 Aims & Scope、稿件类型与格式、开放获取费用、最新投稿要求']) + '<p class="help-text">下列入口用于检索官网；本插件尚未抓取或认证具体投稿要求。</p></details><div class="action-row journal-actions">' + externalLink(links.guidelines, '检索官网指南', 'secondary') + (links.profile ? externalLink(links.profile, 'JCR 详情') : '') + externalLink(links.experience, '检索投稿经验') + '</div></article>'
  }
  q('#submissionForm').onsubmit = async e => {
    e.preventDefault()
    let claimed = false
    try {
      const title = q('#paperTitle').value.trim(), abstract = q('#paperAbstract').value.trim()
      if (abstract.length < 80) throw new Error('请填写至少 80 字符的摘要；标题可以留空。')
      const minText = q('#paperIfMin').value.trim(), maxText = q('#paperIfMax').value.trim(), min = minText === '' ? null : Number(minText), max = maxText === '' ? null : Number(maxText)
      if ([min, max].some(x => x != null && (!Number.isFinite(x) || x < 0 || x > 1000)) || (min != null && max != null && min > max)) throw new Error('请填写有效 IF 范围（0–1000），最低值不能高于最高值。')
      api(); claim('submission'); claimed = true
      q('#submissionRun').disabled = true; q('#submissionCancel').hidden = false
      submission = { title, abstract, preferences: q('#paperPreferences').value.trim(), type: q('#paperType').value, screening: { if_range: { min, max }, include_general: q('#paperIncludeGeneral').checked }, profile: null, rank: null, candidates: [] }; renderSubmission()
      status('submissionStatus', '1 / 3 · 提取研究画像与可核对的摘要高亮…', 'loading')
      submission.profile = profileResult(await ask(P.PROFILE, { title, abstract, manuscript_type: submission.type, preferences: submission.preferences, screening: submission.screening }), abstract)
      renderSubmission(); alive()
      status('submissionStatus', '2 / 3 · 在本地期刊库核对名称与学科候选…', 'loading')
      if (!window.journalApi) throw new Error('本地期刊库不可用，摘要分析已保留。请在 ZTools 中加载完整插件。')
      const candidates = C.candidates(window.journalApi, submission.profile, submission.screening)
      submission.candidates = candidates; renderSubmission()
      if (!candidates.length) throw new Error('当前主题与 IF / 期刊类别条件下没有匹配候选，摘要分析已保留。请放宽筛选范围或补充研究领域。')
      status('submissionStatus', '3 / 3 · 比较 ' + candidates.length + ' 个已核对候选并生成投稿建议…', 'loading')
      submission.rank = rankedResult(await ask(P.RANK, { title, abstract, preferences: submission.preferences, manuscript_type: submission.type, screening: submission.screening, profile: submission.profile, candidates }), candidates)
      renderSubmission(); status('submissionStatus', '已完成 · 高亮已与摘要原文核对，推荐期刊已与本地库核对。', 'success')
      if (q('#submissionResults').scrollIntoView) q('#submissionResults').scrollIntoView({ behavior: 'auto', block: 'start' })
    } catch (err) { status('submissionStatus', err.message, 'error') }
    finally { if (claimed) { busy = ''; q('#submissionRun').disabled = false; q('#submissionCancel').hidden = true } }
  }
  q('#submissionCancel').onclick = stop

  // ---------- Local bibliography ----------
  async function importBib(file) {
    if (!file) return
    if (busy === 'classify') { status('bibStatus', '请先停止或完成当前文献分类，再导入文件。', 'error'); return }
    try {
      if (!/\.bib$/i.test(file.name)) throw new Error('请选择 .bib 格式的 BibTeX 文件。')
      if (file.size > 8 * 1024 * 1024) throw new Error('文件超过 8 MB，请分批导入。')
      status('bibStatus', '正在本地解析文件…')
      const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('文件读取失败。')); r.readAsText(file) })
      const parsed = C.parseBibtex(text)
      bib = parsed; filename = file.name; filters = emptyFilters(); q('#bibSearch').value = ''; q('#bibTypeFilter').value = 'all'; visible = 30; dashboard = null; bib.matches = M.matchJournals(bib.entries, window.journalApi)
      q('#bibFilename').textContent = filename; q('#bibWorkspace').hidden = false
      status('bibAiStatus', ''); renderBib(); status('bibStatus', '已在本地解析 ' + bib.entries.length + ' 条文献。未发送网络请求。', 'success')
    } catch (err) { status('bibStatus', err.message, 'error') }
    finally { q('#bibFile').value = '' }
  }
  q('#bibFile').onchange = e => importBib(e.target.files[0])
  const drop = q('#bibDrop')
  ;['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('is-dragging') }))
  ;['dragleave', 'drop'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('is-dragging'); if (type === 'drop') importBib(e.dataTransfer.files[0]) }))
  function renderBib() {
    if (!bib) return
    const stats = C.analyze(bib.entries); bib.stats = stats
    const years = stats.years.map(x => x.label)
    q('#bibStats').innerHTML = [[stats.total, '文献总数'], [years.length ? years[0] + '–' + years[years.length - 1] : '—', '发表年份范围'], [stats.journals.length, '已提供的期刊 / 载体'], [stats.kinds.find(x => x.kind === 'unknown').count, '类型待确认']].map(([value, label]) => '<div class="stat-tile"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>').join('')
    q('#bibQuality').innerHTML = '<details><summary><strong>元数据完整性</strong> · 缺期刊 ' + stats.missing.journal + ' · 缺年份 ' + stats.missing.year + ' · 缺 DOI ' + stats.missing.doi + ' · 缺摘要 ' + stats.missing.abstract + '</summary><p>缺标题 ' + stats.missing.title + ' 条 · 疑似重复 ' + stats.duplicates + ' 条（统计中保留）。类型线索 / AI 推断 ' + stats.inferred + ' 条，均需复核。@article 与 @misc 不用于强制二分类；缺失元数据不等于文献质量低。</p>' + (bib.warnings.length ? listHTML(bib.warnings.slice(0, 30)) : '') + '</details>'
    const state = dashboard ? dashboard.getState() : undefined
    dashboard = M.mount(q('#bibDashboard'), bib.entries, bib.matches, { state, selection: filters,
      onSelect(value) { filters = value; visible = 30; renderBibList() },
      onScope(kind) { q('#bibTypeFilter').value = kind; visible = 30; renderBibList() },
      onLocate() { q('#bibList').scrollIntoView({ block: 'start' }) }
    })
    renderBibList()
  }
  function filteredEntries() {
    const query = q('#bibSearch').value.trim().toLowerCase(), kind = q('#bibTypeFilter').value
    return bib.entries.filter(e => (kind === 'all' || e.kind === kind) && M.matchesFilter(e, bib.matches, filters) && (!query || [e.title, e.key, e.journal, e.authors.join(' ')].join(' ').toLowerCase().includes(query)))
  }
  function renderBibList() {
    if (!bib) return
    const entries = filteredEntries()
    q('#bibCount').textContent = '显示 ' + Math.min(visible, entries.length) + ' / ' + entries.length + ' 条（共 ' + bib.entries.length + '）'
    q('#bibActiveFilters').innerHTML = Object.keys(filters).filter(k => filters[k]).map(k => '<button class="filter-tag" data-remove-filter="' + k + '">' + esc(k === 'ifbin' ? 'JIF ' + M.BINS[+filters[k]][2] : k === 'entry' ? '文献 ID ' + filters[k] : filters[k]) + ' ×</button>').join('')
    q('#bibList').innerHTML = entries.slice(0, visible).map(e => '<article class="bib-entry"><div class="bib-entry-main"><span class="bib-year">' + (e.year || '年份缺失') + '</span><h4>' + esc(e.title || '[标题缺失]') + '</h4><p>' + esc(e.authors.slice(0, 4).join(' · ')) + (e.authors.length > 4 ? ' 等' : '') + '</p><p class="panel-caption">' + esc(e.journal || '期刊 / 载体未提供') + ' · ' + esc(e.key) + (e.duplicateOf ? ' · 可能重复 ' + esc(e.duplicateOf) : '') + '</p>' + (e.doi && /^10\.\d{4,9}\/\S+$/i.test(e.doi) ? '<button class="text-button" data-doi="' + e.id + '">DOI ↗</button>' : '') + '</div><div class="bib-kind-control"><select data-entry-kind="' + e.id + '" aria-label="修改 ' + esc(e.key) + ' 的文献类型">' + Object.keys(KINDS).map(k => '<option value="' + k + '"' + (e.kind === k ? ' selected' : '') + '>' + KINDS[k] + '</option>').join('') + '</select><span>' + ({ metadata: '元数据', title: '标题线索 · 待复核', ai: 'AI 推断 · 待复核', manual: '人工指定', unknown: '证据不足' }[e.kindSource] || '待确认') + '</span><details><summary>分类依据</summary><p>' + esc(e.kindReason) + '</p></details></div></article>').join('') || '<p class="empty-state">没有符合筛选条件的文献。</p>'
    q('#bibMore').hidden = entries.length <= visible
  }
  q('#bibSearch').oninput = () => { visible = 30; renderBibList() }
  q('#bibTypeFilter').onchange = () => { visible = 30; if (dashboard) dashboard.setScope(q('#bibTypeFilter').value); renderBibList() }
  q('#bibReset').onclick = () => { filters = emptyFilters(); q('#bibSearch').value = ''; q('#bibTypeFilter').value = 'all'; visible = 30; if (dashboard) { dashboard.setSelection(filters); dashboard.setScope('all') }; renderBibList() }
  q('#bibActiveFilters').onclick = e => { const b = e.target.closest('[data-remove-filter]'); if (b) { filters[b.dataset.removeFilter] = ''; visible = 30; if (dashboard) dashboard.setSelection(filters); renderBibList() } }
  q('#bibMore').onclick = () => { visible += 30; renderBibList() }
  q('#bibList').onchange = e => { if (!e.target.matches('[data-entry-kind]')) return; const entry = bib.entries[Number(e.target.dataset.entryKind)]; if (!entry || !KINDS[e.target.value]) return; entry.kind = e.target.value; entry.kindSource = 'manual'; entry.kindReason = '用户人工指定'; renderBib() }
  q('#bibList').onclick = e => { const b = e.target.closest('[data-doi]'); if (b) openExternal('https://doi.org/' + encodeURI(bib.entries[Number(b.dataset.doi)].doi)) }
  q('#bibCsv').onclick = () => { if (bib) download(filename.replace(/\.bib$/i, '') + '-分析.csv', C.csv(bib.entries, bib.matches), 'text/csv;charset=utf-8') }
  q('#bibClear').onclick = () => { if (busy === 'classify') { status('bibStatus', '请先停止当前 AI 分类任务。', 'error'); return }; bib = null; dashboard = null; filename = ''; q('#bibWorkspace').hidden = true; status('bibStatus', '已清除本次文件与分析结果。') }
  q('#bibReport').onclick = () => {
    if (!bib) return
    const entries = bib.entries.map(e => ({ id: e.id, key: e.key, title: e.title, year: e.year, authors: e.authors, journal: e.journal, keywords: e.keywords, kind: e.kind, kindSource: e.kindSource, kindReason: e.kindReason }))
    const table = '<section class="panel"><div class="list-heading"><h3>完整文献清单</h3><span id="reportCount"></span></div><div class="report-search"><input id="reportSearch" placeholder="检索标题、期刊与作者" aria-label="检索导出文献"><button class="secondary" id="reportReset">重置筛选</button></div><div id="reportFilters"></div><div class="report-table-wrap"><table id="reportTable"><thead><tr><th>年份</th><th>标题 / 作者</th><th>期刊 / JIF</th><th>类型与依据</th></tr></thead><tbody>' + bib.entries.map(e => { const m = bib.matches[e.id] || {}; return '<tr data-id="' + e.id + '"><td>' + (e.year || '—') + '</td><td>' + esc(e.title) + '<br><small>' + esc(e.authors.join('; ')) + '</small></td><td>' + esc(e.journal || '未提供') + (m.jif != null ? '<br><small>' + esc(m.year) + ' JIF ' + esc(m.jif) + '<br>' + esc(m.method) + '</small>' : '<br><small>JIF 未匹配</small>') + '</td><td>' + M.KIND[e.kind] + ' · ' + esc(e.kindSource) + '<br><small>' + esc(e.kindReason) + '</small></td></tr>' }).join('') + '</tbody></table></div></section>'
    exportReport('文献图谱', '<h1>' + esc(filename) + '</h1><p class="panel-caption">本地分析 · ' + bib.entries.length + ' 条 · 图表和清单支持离线联动</p>' + q('#bibStats').outerHTML + q('#bibQuality').outerHTML + '<div id="reportDashboard"></div>' + q('.methods-note').outerHTML + table, filename, { entries, matches: bib.matches, state: dashboard.getState() })
  }
  q('#bibClassify').onclick = async () => {
    let claimed = false
    try {
      if (!bib) return
      api(); claim('classify'); claimed = true
      const pending = bib.entries.filter(e => e.kindSource === 'unknown' || e.kindSource === 'title')
      if (!pending.length) { status('bibAiStatus', '没有需要辅助分类的条目。', 'success'); return }
      q('#bibClassify').disabled = true; q('#bibClassifyCancel').hidden = false
      let processed = 0
      for (let start = 0; start < pending.length; start += 20) {
        alive(); const batch = pending.slice(start, start + 20)
        status('bibAiStatus', '发送至所选模型 · 已处理 ' + processed + ' / ' + pending.length + ' 条（每批 20 条）…', 'loading')
        const raw = await ask(P.CLASSIFY, { items: batch.map(e => ({ id: e.id, title: e.title, abstract: e.abstract.slice(0, 2400), metadata_type: [e.fields.type, e.fields.genre, e.fields.pubtype, e.fields['article-type']].filter(Boolean).join(' '), bibtex_type: e.bibType })) })
        if (!Array.isArray(raw.items)) throw new Error('模型没有返回有效分类列表。已完成的批次已保留。')
        const allowed = new Map(batch.map(e => [e.id, e])), seen = new Set()
        raw.items.forEach(item => {
          if (!item || !Number.isInteger(item.id) || !allowed.has(item.id) || seen.has(item.id) || !KINDS[item.kind]) return
          seen.add(item.id); const e = allowed.get(item.id), evidence = s(item.evidence, 400)
          if (e.kindSource === 'manual') return
          const sourceText = [e.title, e.abstract, e.fields.type, e.fields.genre, e.fields.pubtype, e.fields['article-type']].filter(Boolean).join('\n')
          if (item.kind !== 'unknown' && (!evidence || !sourceText.includes(evidence))) return
          e.kind = item.kind; e.kindSource = item.kind === 'unknown' ? 'unknown' : 'ai'; e.kindReason = (evidence ? '原文线索：“' + evidence + '” · ' : '') + s(item.reason, 500) + (item.kind === 'unknown' ? ' · 证据不足' : ' · AI 推断，待人工复核')
        })
        processed += batch.length; renderBib()
      }
      status('bibAiStatus', '辅助分类完成。无法核对原文证据的结果已忽略，AI 分类均需人工复核。', 'success')
    } catch (err) { status('bibAiStatus', err.message + (claimed ? ' 已完成批次已保留。' : ''), 'error') }
    finally { if (claimed) { busy = ''; q('#bibClassify').disabled = false; q('#bibClassifyCancel').hidden = true } }
  }
  q('#bibClassifyCancel').onclick = stop
  async function exportReport(type, body, title, data) {
    const statusId = type === '文献图谱' ? 'bibStatus' : 'submissionStatus'
    try {
      if (!reportAssets) {
        if (window.researchApi && typeof api().reportAssets === 'function') reportAssets = api().reportAssets()
        else {
          // Development HTTP preview only. ZTools reads the same files through Preload.
          const files = await Promise.all(['index.css', 'research.css', 'research-core.js', 'research-metrics.js'].map(async name => { const r = await fetch(name); if (!r.ok) throw new Error('报告资源读取失败：' + name); return r.text() }))
          reportAssets = { css: files[0] + '\n' + files[1], core: files[2], metrics: files[3] }
        }
      }
      const clean = document.createElement('div'); clean.innerHTML = body
      clean.querySelectorAll('#exportSubmission').forEach(el => el.remove())
      clean.querySelectorAll('details').forEach(el => { el.open = true })
      const html = window.ResearchReport.build(type, clean.innerHTML, title, reportAssets, data)
      download(type + '-' + new Date().toISOString().slice(0, 10) + '.html', html, 'text/html;charset=utf-8')
      status(statusId, '已导出完整 HTML 报告：CSS、图表与交互已内嵌，可离线打开。', 'success')
    } catch (err) { status(statusId, '导出失败：' + err.message, 'error') }
  }
  window.ResearchUI = { onView(view) { updateModelLabels(); if (view === 'settings') loadSettings() } }
  updateModelLabels()
})()
