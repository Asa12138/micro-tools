// Run with Node + jsdom. No external model, paid request, or credentials required.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const http = require('node:http')
const { JSDOM } = require('jsdom')
const C = require('../features/research/research-core')
const M = require('../features/research/research-metrics')
const R = require('../features/research/research-report')
const createService = require('../features/research/research-service')
const root = path.join(__dirname, '..')
const testcase = process.argv[2]
const output = process.argv[3]
if (output) fs.mkdirSync(output, { recursive: true })
let checks = 0
function check(value, message) { assert.ok(value, message); checks++ }
const tick = () => new Promise(resolve => setImmediate(resolve))
async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 10)) } throw new Error('等待 UI 结果超时') }
async function main() {
  for (const f of fs.readdirSync(root).filter(f => f.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f })
  JSON.parse(fs.readFileSync(path.join(root, 'plugin.json')))
  const input = String.raw`@string{j = "Example Journal"}
@comment{ignored {nested}}
@article{a, title={A {systematic review} of {Arctic} warming}, author={M{\"u}ller, J and {Research and Science Group}}, journal=j # " Letters", year=2020, doi={10.1234/abc}, keywords={glacial glaciers methane}}
@misc(b, title="An observational analysis", author="Doe, Jane", year={2021}, type={Original Research})
@article{c, title={An observational analysis}, year=2021}
@book{d, title={A reference book}, year=2019}`
  const parsed = C.parseBibtex(input), stats = C.analyze(parsed.entries)
  check(parsed.entries.length === 4, 'braces/parentheses/macros')
  check(parsed.entries[0].journal === 'Example Journal Letters', 'macro concatenation')
  check(parsed.entries[0].authors[0] === 'Müller, J' && parsed.entries[0].authors[1] === 'Research and Science Group', 'LaTeX and corporate authors')
  check(parsed.entries.map(e => e.kind).join() === 'review,research,unknown,other', 'type provenance')
  check(stats.duplicates === 1, 'duplicate title detection')
  check(C.terms('glacial glaciers').length === 1, 'one document counted once after stemming')
  check(C.parseBibtex('% @article{skip,title={Ignore}}\n@article{real,title="A {quoted "word"} title",year={2020}}').entries[0].title === 'A quoted "word" title', 'comment lines and nested quoted text')
  check(C.plain('Earth &amp; Environment') === 'Earth & Environment', 'HTML entity normalization')
  assert.throws(() => C.parseBibtex('@article{x,title={Oops}'), /未闭合/); checks++
  assert.throws(() => C.jsonResult('bad output'), /完整 JSON/); checks++
  check(C.jsonResult('```json\n{"ok":true}\n```').ok, 'JSON fences')
  const formula = Object.assign({}, parsed.entries[0], { title: '=HYPERLINK("bad")' })
  check(C.csv([formula]).includes("'=HYPERLINK"), 'spreadsheet formula escaping')

  let store
  const host = { dbStorage: { getItem: () => store, setItem: (_, value) => { store = value } }, ai: () => Promise.resolve({ content: '{"ok":true}' }), allAiModels: async () => [{ value: 'm1', label: 'Test', providerLabel: 'Local' }] }
  const service = createService(() => host)
  check((await service.models())[0].value === 'm1', 'host model metadata')
  check(await service.call([{ role: 'user', content: 'test' }]) === '{"ok":true}', 'host AI shape')
  service.saveSettings({ mode: 'direct', baseUrl: 'https://example.invalid/v1', model: 'test', apiKey: 'test-secret' })
  check(!JSON.stringify(store).includes('test-secret') && !JSON.stringify(service.getSettings()).includes('test-secret'), 'key not persisted or returned')
  check(!createService(() => host).getSettings().hasKey, 'reload clears key')
  assert.throws(() => service.saveSettings({ baseUrl: 'http://example.com/v1' }), /HTTPS/); checks++
  assert.throws(() => service.saveSettings({ baseUrl: 'https://example.com/v1?key=test' }), /查询参数/); checks++
  assert.throws(() => service.saveSettings({ baseUrl: 'https://YOUR-WORKSPACE-ID.cn-beijing.maas.aliyuncs.com/v1' }), /占位符/); checks++
  let received
  const server = http.createServer((req, res) => { let raw = ''; req.on('data', x => { raw += x }); req.on('end', () => { received = { url: req.url, headers: req.headers, body: JSON.parse(raw) }; if (req.url.includes('/slow')) return; if (req.url.includes('/error')) { res.writeHead(401); res.end('test-secret'); return }; res.setHeader('Content-Type', 'application/json'); if (req.url.endsWith('/messages')) res.end(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }] })); else if (req.url.includes(':generateContent')) res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })); else res.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })) }) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  try {
    for (const protocol of ['openai', 'anthropic', 'gemini']) {
      service.saveSettings({ protocol, baseUrl: base + '/v1', apiKey: 'test-secret' })
      check(await service.call([{ role: 'system', content: 'role' }, { role: 'user', content: 'test' }]) === '{"ok":true}', protocol + ' transport')
      check(!received.url.includes('test-secret'), 'key not in URL')
      if (protocol === 'openai') check(received.headers.authorization === 'Bearer test-secret' && received.body.messages.length === 2 && received.url === '/v1/chat/completions', 'OpenAI payload')
      if (protocol === 'anthropic') check(received.headers['x-api-key'] === 'test-secret' && received.body.system === 'role' && received.body.messages.length === 1, 'Anthropic payload')
      if (protocol === 'gemini') check(received.headers['x-goog-api-key'] === 'test-secret' && received.body.contents.length === 1 && received.url === '/v1/models/test:generateContent', 'Gemini payload')
    }
    service.saveSettings({ protocol: 'openai', baseUrl: base + '/error' })
    await assert.rejects(service.call([{ role: 'user', content: 'test' }]), e => e.message.includes('401') && !e.message.includes('test-secret')); checks++
    service.saveSettings({ baseUrl: base + '/slow' })
    const request = service.call([{ role: 'user', content: 'test' }]); const cancellation = assert.rejects(request, /停止/)
    service.cancel(); await cancellation; checks++
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }

  const metricInput = C.parseBibtex('@article{a,title={Example one},author={Doe, J and Roe, K and Li, A and Doe, J},journal={Example Journal},year=2020}\n@article{b,title={Example two},author={Doe, J and Roe, K},journal={Abbr. J.},year=2022}\n@article{c,title={Example three},author={others},year=2022}').entries
  const records = [{ name: 'Example Journal', abbr: 'Abbr J', issn: '1234-567X', jif: '4.5', year: 2025 }, { name: 'Zero Journal', jif: '0', year: 2025 }, { name: 'Missing Journal', jif: '', year: 2025 }]
  const metricApi = { ensureLoaded() {}, allTotal: records.length, get: i => records[i] }
  const metricMatches = M.matchJournals(metricInput, metricApi), ms = M.analyze(metricInput, metricMatches)
  check(metricMatches[0].jif === 4.5 && metricMatches[1].jif === 4.5 && metricMatches[2].jif === null, 'exact journal/abbreviation matching, missing not zero')
  check(M.numericJif(0) === 0 && M.numericJif('') === null && M.numericJif('<0.1') === null, 'strict numeric JIF with true zero')
  check(ms.authors.length === 3 && ms.authors[0].count === 2 && ms.missingAuthors === 1 && ms.multi === 2, 'authors deduplicated per document; others excluded')
  check(Math.abs(ms.authors.reduce((n, a) => n + a.fractional, 0) - 2) < 1e-10, 'fractional authorship conserves each document credit')
  check(ms.ifSummary.median === 4.5 && ms.ifBins[1].count === 2 && ms.ifRecords.length === 2, 'IF bins and quantiles exclude missing')
  const full = M.network(metricInput, ms, 'author', 30, 1, 'full'), frac = M.network(metricInput, ms, 'author', 30, 1, 'fractional')
  check(full.links.find(e => e.documents === 2).weight === 2 && frac.links.find(e => e.documents === 2).weight === 1.5, 'full and VOS-style fractional collaboration weights')
  check(M.network(metricInput, ms, 'author', 30, 2, 'fractional').links.length === 1, 'edge threshold uses shared documents, not fractional weight')
  check(M.matchesFilter(metricInput[0], metricMatches, { author: 'doe j', ifbin: '1', year: '2020' }) && !M.matchesFilter(metricInput[2], metricMatches, { ifbin: '0' }), 'linked author/year/IF filters')
  const ambiguous = M.matchJournals(metricInput, { ...metricApi, allTotal: 2, get: i => ({ name: 'Example Journal', jif: i + 1 }) })
  check(ambiguous[0].status === 'ambiguous' && ambiguous[0].jif === null, 'ambiguous venue never assigned arbitrary IF')
  const byIssn = M.matchJournals([{ ...metricInput[2], fields: { issn: '1234567X' } }], metricApi)
  check(byIssn[2].jif === 4.5 && byIssn[2].method === 'ISSN', 'ISSN matching without title')
  check(M.matchJournals(metricInput, null)[0].status === 'database-unavailable', 'browser without database explains unavailable IF')
  check(M.matchJournals([{ ...metricInput[0], journal: 'The Example Journal' }], metricApi)[0].jif === 4.5, 'leading The is a documented typographic normalization')
  check(M.matchJournals(metricInput, { ...metricApi, error: 'data failed' })[0].status === 'database-unavailable', 'database failure retains local analysis with explicit IF status')
  const noData = M.analyze([], {})
  check(noData.ifSummary.median === null && M.network([], noData, 'author', 30, 2, 'full').nodes.length === 0, 'empty genre slice has no fabricated statistics')
  const assets = service.reportAssets()
  check(assets.css.includes('.journal-facts') && !JSON.stringify(assets).includes('test-secret'), 'report embeds complete public styles, no key')
  let entries
  if (testcase) {
    const loaded = C.parseBibtex(fs.readFileSync(testcase, 'utf8')), a = C.analyze(loaded.entries); entries = loaded.entries
    check(a.total === 111 && a.journals.length === 33 && a.missing.journal === 36, 'provided BibTeX normalized venue counts')
    check(a.years[0].label === '2004' && a.years.at(-1).label === '2026' && a.missing.doi === 111 && a.missing.abstract === 111, 'provided file metadata coverage')
    check(a.kinds.find(x => x.kind === 'unknown').count === 111, 'do not invent paper genre')
    console.log('BibTeX:', JSON.stringify({ total: a.total, journals: a.journals.length, missing: a.missing, years: [a.years[0].label, a.years.at(-1).label] }))
  }
  // Preload also initializes the English service; provide an isolated host store.
  const preloadStore = new Map()
  global.window = { ztools: { dbStorage: { getItem: key => preloadStore.get(key), setItem: (key, value) => preloadStore.set(key, value) } } }
  require('../preload'); const journalApi = global.window.journalApi
  if (entries) { const matches = M.matchJournals(entries, journalApi), actual = M.analyze(entries, matches); check(actual.authors.length === 510 && actual.ifRecords.length === 69 && actual.statuses['missing-venue'] === 36 && actual.statuses.unmatched === 6, 'real corpus author and conservative JIF coverage'); console.log('Bibliometrics:', JSON.stringify({ authors: actual.authors.length, multi: actual.multi, matchedJif: actual.ifRecords.length, statuses: actual.statuses, ifYears: actual.ifYears, median: actual.ifSummary.median })); if (output) fs.writeFileSync(path.join(output, 'bibliometrics.json'), JSON.stringify(actual, null, 2)) }
  const shortlist = C.candidates(journalApi, { journal_seeds: ['Nature', 'ISME Journal'], search_terms: ['microbiology ecology'] })
  check(shortlist.some(x => C.normalize(x.name) === 'nature') && shortlist.every(x => !journalApi.get(x.id)._conf), 'local candidate IDs, no conferences')
  const recall = C.candidates(journalApi, { journal_seeds: ['ISME Journal'], search_terms: ['ecology'] })
  check(recall.length === 65 && ['nature', 'science', 'naturecommunications', 'scienceadvances'].every(name => recall.some(c => C.normalize(c.name) === name && c.is_general)), 'general journals reserved despite specialist keyword truncation')
  check(recall.some(c => c.catDetail.includes('ECOLOGY') && c.recall_source === '学科关键词匹配'), 'detailed multi-category subjects used for local recall')
  const specialist = C.candidates(journalApi, { journal_seeds: ['Nature', 'ISME Journal'], search_terms: ['ecology'] }, { include_general: false })
  check(specialist.length > 0 && specialist.every(c => !c.is_general), 'general checkbox excludes even profile-seeded general journals')
  const ranged = C.candidates(journalApi, { search_terms: ['ecology'] }, { if_range: { min: 5, max: 20 } })
  check(ranged.every(c => Number(c.jif) >= 5 && Number(c.jif) <= 20) && ranged.some(c => C.normalize(c.name) === 'naturecommunications') && !ranged.some(c => C.normalize(c.name) === 'nature'), 'IF range constrains general and specialist recall equally')
  const fakeRecords = [{ _i: 0, name: 'Ecology A', category: 'Multiple', catDetail: 'ECOLOGY(SCIE):Q1', jif: '0' }, { _i: 1, name: 'Ecology B', category: 'ECOLOGY', jif: '' }, { _i: 2, name: 'Ecology C', category: 'ECOLOGY', jif: 'invalid' }]
  const fakeApi = { ensureLoaded() {}, allTotal: 3, get: i => fakeRecords[i], search: () => [] }
  const zero = C.candidates(fakeApi, { search_terms: ['ecology'] }, { include_general: false, if_range: { min: 0, max: 0 } })
  check(zero.length === 1 && zero[0].id === 0 && !zero[0].is_general, 'zero IF valid, missing excluded, Multiple does not mean interdisciplinary')
  check(C.candidates(journalApi, { search_terms: ['ecology'] }, { if_range: { min: 900 } }).length === 0, 'empty IF pool does not silently widen constraints')
  check(journalApi.search('CVPR', 5)[0].ccfRank === 'A' && journalApi.search('1471-0072', 5, 'journal').length > 0, 'existing journal regression')

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window, doc = w.document, get = id => doc.getElementById(id), event = (id, type) => get(id).dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }))
  const errors = []; w.addEventListener('error', e => errors.push(e.message))
  let calls = 0, requests = [], exported = [], failureMode = false, cancelReject
  w.URL.createObjectURL = blob => { exported.push(blob); return 'blob:test' }; w.URL.revokeObjectURL = () => {}
  const anchorClick = w.HTMLAnchorElement.prototype.click
  w.HTMLAnchorElement.prototype.click = function () { if (!this.download) anchorClick.call(this) }
  w.journalApi = journalApi
  w.researchApi = { reportAssets: () => assets, getSettings: () => ({ mode: 'host', protocol: 'openai', provider: 'custom', baseUrl: '', model: '', hostModel: '', hasKey: false, hostAvailable: true }), models: async () => [], saveSettings: () => ({ hasKey: false, persisted: true }), cancel() { if (cancelReject) cancelReject(new Error('已停止分析。')) }, async call(messages) {
    if (failureMode === 'cancel') return new Promise((_, reject) => { cancelReject = reject })
    if (failureMode === 'json') return 'not JSON'
    requests.push(messages); calls++; const input = JSON.parse(messages[1].content)
    if (messages[0].content.includes('建立研究画像')) return JSON.stringify({ summary: '<script>bad()</script>研究摘要', field: '生态学', study_type: '研究论文', search_terms: ['ecology'], journal_seeds: ['Nature'], keywords: ['Arctic'], highlights: [{ label: '方法', quote: input.abstract.slice(0, 30), explanation: '方法' }, { label: '结果', quote: 'not actually in text', explanation: 'invalid' }], strengths: [{ title: '亮点', evidence: '摘要线索' }], concerns: [], missing_information: [], novelty_note: '需文献对照' })
    if (messages[0].content.includes('已核对期刊候选')) return JSON.stringify({ strategy: '匹配', recommendations: [{ id: input.candidates[0].id, tier: '优先比较', fit: '较高', reasons: ['主题'], concerns: [], to_verify: ['官网要求'] }, { id: 999999, tier: '优先比较' }, { id: input.candidates[0].id }], general_assessment: [{ id: input.candidates.find(c => c.is_general)?.id, decision: '入选', reason: '跨领域意义待核实' }, { id: 999999, reason: '不存在' }], checklist: [{ title: '检查稿型', detail: '官网核实' }], limitations: '仅摘要' })
    return JSON.stringify({ items: input.items.map(e => ({ id: e.id, kind: 'research', evidence: e.title.slice(0, 20), reason: '测试推断' })).concat([{ id: 999999, kind: 'review', evidence: 'fake' }]) })
  } }
  for (const file of ['features/research/research-core.js', 'features/research/research-metrics.js', 'features/research/research-report.js', 'features/research/research-prompts.js', 'index.js', 'features/research/research-ui.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'))
  check([...doc.querySelectorAll('#view-home [data-open]')].map(e => e.dataset.open).join() === 'journal,submission,literature,english,database', 'homepage card order')
  doc.querySelector('[data-open="submission"]').click()
  check(!get('view-submission').hidden && get('view-home').hidden, 'submission routing')
  check(!get('paperTitle').required && get('paperType').value === 'auto' && get('paperIncludeGeneral').checked, 'optional title, automatic type, general journals on by default')
  get('paperTitle').value = ''; get('paperAbstract').value = 'We sampled Arctic ecosystems and measured microbial communities along a glacier forefield. We observed an association with soil age, with uncertainty in causal interpretation.'
  event('submissionForm', 'submit'); await until(() => get('submissionStatus').textContent.includes('已完成'))
  check(calls === 2 && doc.querySelectorAll('.recommendation').length === 1, 'two-stage flow, invalid and duplicate IDs excluded')
  check(JSON.parse(requests[0][1].content).title === '' && JSON.parse(requests[0][1].content).manuscript_type === 'auto' && JSON.parse(requests[1][1].content).screening.include_general, 'blank title and structured screening reach both model stages')
  check(get('submissionProfile').compareDocumentPosition(get('submissionRecommendations')) & w.Node.DOCUMENT_POSITION_FOLLOWING, 'research profile precedes recommendations')
  check(get('submissionHighlights').compareDocumentPosition(get('submissionRecommendations')) & w.Node.DOCUMENT_POSITION_FOLLOWING, 'highlights precede recommendations')
  check(doc.querySelectorAll('#submissionGeneral article').length === 8 && !get('submissionGeneral').textContent.includes('不存在'), 'every real general candidate assessed with explicit missing-model fallback')
  get('submissionProfile').open = false; doc.querySelector('[data-report-target="submissionProfile"]').click()
  check(get('submissionProfile').open && doc.querySelector('.submission-side-nav .is-active'), 'side navigation opens collapsed target')
  const candidateCount = () => doc.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])').length
  check(candidateCount() === 20 && doc.querySelectorAll('[data-candidate-table] tbody tr').length === 65, 'broad recall table paginates without dropping candidates')
  doc.querySelector('[data-candidate-more]').click(); check(candidateCount() === 40, 'candidate load more')
  const categoryKind = doc.querySelector('[data-candidate-kind]'); categoryKind.value = 'general'; categoryKind.dispatchEvent(new w.Event('change'))
  check(candidateCount() === 8, 'candidate kind filtering')
  const tableQuery = doc.querySelector('[data-candidate-search]'); tableQuery.value = 'nature'; tableQuery.dispatchEvent(new w.Event('input'))
  const natureMatches = [...doc.querySelectorAll('[data-candidate-table] tbody tr')].filter(el => el.dataset.kind === 'general' && el.dataset.search.includes('nature')).length
  check(candidateCount() === natureMatches && natureMatches > 1 && natureMatches < 8, 'candidate name/publisher filtering combines with type')
  doc.querySelector('[data-candidate-min]').value = '10'; doc.querySelector('[data-candidate-min]').dispatchEvent(new w.Event('input'))
  const tableMax = doc.querySelector('[data-candidate-max]'); tableMax.value = '20'; tableMax.dispatchEvent(new w.Event('input'))
  check(candidateCount() === 1 && doc.querySelector('[data-candidate-table] tr:not([hidden])[data-order]').textContent.includes('Nature Communications'), 'candidate IF filtering combines with name and type')
  doc.querySelector('[data-candidate-reset]').click(); check(candidateCount() === 20, 'candidate reset')
  const tableSort = doc.querySelector('[data-candidate-sort]'); tableSort.value = 'if-desc'; tableSort.dispatchEvent(new w.Event('change'))
  const sortedIF = [...doc.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])')].map(el => Number(el.dataset.jif))
  check(sortedIF.every((v, i) => i === 0 || v <= sortedIF[i - 1]), 'candidate IF sort')
  check(doc.querySelectorAll('mark').length === 1 && doc.querySelector('#submissionResults script') === null && get('submissionResults').textContent.includes('<script>'), 'verbatim highlights and HTML escaping')
  get('exportSubmission').click(); check(exported.length === 1, 'submission report download')
  failureMode = 'json'; event('submissionForm', 'submit'); await until(() => get('submissionStatus').textContent.includes('完整 JSON'))
  check(!get('submissionRun').disabled, 'invalid JSON returns to usable form')
  failureMode = 'cancel'; event('submissionForm', 'submit'); get('submissionCancel').click(); await until(() => get('submissionStatus').textContent.includes('停止'))
  check(!get('submissionRun').disabled && get('submissionCancel').hidden, 'cancellation releases UI')
  failureMode = false
  get('backBtn').click(); doc.querySelector('[data-open="literature"]').click()
  const raw = testcase ? fs.readFileSync(testcase, 'utf8') : input
  const file = { name: 'case.bib', size: Buffer.byteLength(raw), text: async () => raw }
  Object.defineProperty(get('bibFile'), 'files', { configurable: true, value: [file] }); event('bibFile', 'change'); await until(() => get('bibStatus').textContent.includes('已在本地解析'))
  check(calls === 2 && doc.querySelectorAll('.bib-entry').length === Math.min(30, entries ? entries.length : 4), 'local import does not call model, pagination')
  doc.querySelector('[data-tab="network"]').click()
  const networkSvg = doc.querySelector('#bibGraph svg')
  doc.querySelector('[data-zoom="in"]').click(); check(networkSvg.getAttribute('viewBox').includes('720'), 'graph zoom changes viewport')
  doc.querySelector('[data-zoom="fit"]').click(); check(networkSvg.getAttribute('viewBox') === '0 0 900 530', 'graph fit')
  const networkKind = doc.querySelector('[data-option="network"]'); networkKind.value = 'term'; networkKind.dispatchEvent(new w.Event('change', { bubbles: true }))
  if (entries) {
    get('bibSearch').value = 'methane'; event('bibSearch', 'input'); check(doc.querySelectorAll('.bib-entry').length === 16, 'title substring filtering')
    get('bibReset').click(); doc.querySelector('[data-term="arctic"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); check(get('bibCount').textContent.includes('/ 42'), 'network filter')
    get('bibReset').click(); get('bibMore').click(); check(doc.querySelectorAll('.bib-entry').length === 60, 'load more')
  }
  const kind = doc.querySelector('[data-entry-kind]'); kind.value = 'review'; kind.dispatchEvent(new w.Event('change', { bubbles: true }))
  check(get('bibList').textContent.includes('人工指定'), 'manual type override')
  get('bibCsv').click(); get('bibReport').click(); check(exported.length === 3, 'CSV and complete report downloads')
  const blobText = blob => new Promise((resolve, reject) => { const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob) })
  const submissionReport = await blobText(exported[0]), literatureReport = await blobText(exported[2])
  const submissionOffline = new JSDOM(submissionReport, { url: 'file:///tmp/submission.html', runScripts: 'dangerously', pretendToBeVisual: true }), sd = submissionOffline.window.document
  check(sd.querySelectorAll('[data-candidate-table] tbody tr').length === 65 && sd.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])').length === 20, 'offline submission embeds complete recall and pagination')
  sd.querySelector('[data-candidate-search]').value = 'nature communications'; sd.querySelector('[data-candidate-search]').dispatchEvent(new submissionOffline.window.Event('input'))
  check(sd.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])').length > 0 && sd.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])').length < 20, 'offline submission filter runs without a server')
  sd.getElementById('submissionCandidates').open = false; sd.querySelector('[data-report-target="submissionCandidates"]').click()
  check(sd.getElementById('submissionCandidates').open, 'offline side navigation opens collapsed section')
  submissionOffline.window.dispatchEvent(new submissionOffline.window.Event('beforeprint'))
  check(sd.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])').length === 65, 'print includes every candidate regardless of pagination')
  submissionOffline.window.dispatchEvent(new submissionOffline.window.Event('afterprint')); submissionOffline.window.close()
  check(submissionReport.includes('.journal-facts') && submissionReport.includes('https://risingscholars.net/en/discussion/') && !submissionReport.includes('<script>bad()'), 'submission export keeps complete styles and safe external community links')
  check(!/src="(?:https?:|research)|<link[^>]+stylesheet/.test(literatureReport) && literatureReport.includes('ResearchMetrics') && !literatureReport.includes('test-secret'), 'standalone report embeds code and CSS without runtime dependencies/keys')
  const offline = new JSDOM(literatureReport, { url: 'file:///tmp/report.html', runScripts: 'dangerously', pretendToBeVisual: true })
  const od = offline.window.document
  check(od.querySelectorAll('#reportTable tbody tr').length === (entries ? 111 : 4) && od.querySelectorAll('[data-tab]').length === 4, 'offline report includes every record and all dashboard tabs')
  od.querySelector('[data-tab="impact"]').click(); check(od.querySelector('.coverage-summary') !== null, 'offline IF view works')
  od.querySelector('#reportSearch').value = 'methane'; od.querySelector('#reportSearch').dispatchEvent(new offline.window.Event('input'))
  if (entries) check(od.querySelectorAll('#reportTable tbody tr:not([hidden])').length === 16, 'offline table search works without server')
  od.querySelector('#reportReset').click(); od.querySelector('[data-tab="authors"]').click(); od.querySelector('[data-author]').click()
  check(od.querySelectorAll('#reportTable tbody tr:not([hidden])').length < (entries ? 111 : 4), 'offline author chart links to table')
  if (output) { fs.writeFileSync(path.join(output, 'submission-report-test.html'), submissionReport); fs.writeFileSync(path.join(output, 'literature-report-test.html'), literatureReport); fs.writeFileSync(path.join(output, 'literature-analysis-test.csv'), await blobText(exported[1])) }
  offline.window.close()
  const hostile = { entries: [{ ...metricInput[0], title: '</script><script>window.evil=1</script>' }], matches: metricMatches, state: {} }
  const hostileReport = R.build('Test', '<div id="reportDashboard"></div><input id="reportSearch"><span id="reportCount"></span><div id="reportFilters"></div><button id="reportReset"></button><table id="reportTable"><tbody></tbody></table>', '</title><script>bad()</script>', assets, hostile)
  const safeDom = new JSDOM(hostileReport, { runScripts: 'dangerously' })
  check(!safeDom.window.evil && safeDom.window.document.querySelectorAll('script').length === 2, 'report embedded JSON cannot close script tags')
  safeDom.window.close()
  get('bibClassify').click(); await until(() => get('bibAiStatus').textContent.includes('辅助分类完成'))
  check(get('bibList').textContent.includes('人工指定') && get('bibList').textContent.includes('AI 推断'), 'AI classifications preserve manual overrides')
  check(requests.slice(2).every(ms => !ms[1].content.includes('authors') && !ms[1].content.includes('journal')), 'classification sends minimal fields')
  get('paperIfMin').value = '20'; get('paperIfMax').value = '5'; const priorCalls = calls
  event('submissionForm', 'submit'); await tick(); check(calls === priorCalls && get('submissionStatus').textContent.includes('最低值'), 'invalid IF range blocks model calls')
  get('paperIfMin').value = '5'; get('paperIfMax').value = '20'; get('paperType').value = '综述'; get('paperIncludeGeneral').checked = false
  event('submissionForm', 'submit'); await until(() => get('submissionStatus').textContent.includes('已完成'))
  const rerank = JSON.parse(requests.at(-1)[1].content)
  check(rerank.manuscript_type === '综述' && rerank.candidates.every(c => !c.is_general && Number(c.jif) >= 5 && Number(c.jif) <= 20) && get('submissionOverview').textContent.includes('综述 · 用户指定'), 'user type override and range preserved with general journals off')
  check(!get('submissionGeneral') && doc.querySelector('[data-report-target="submissionCandidates"]'), 'new render refreshes navigation and does not leave old general panel')
  doc.querySelector('[data-candidate-kind]').value = 'general'; doc.querySelector('[data-candidate-kind]').dispatchEvent(new w.Event('change'))
  check(candidateCount() === 0 && !doc.querySelector('[data-candidate-empty]').hidden, 'new report filters initialize after rerender')
  get('settingsBtn').click(); await tick(); check(!get('view-settings').hidden, 'settings routing')
  get('aiMode').value = 'direct'; event('aiMode', 'change'); check(!get('directSettings').hidden && get('hostSettings').hidden, 'direct settings visible')
  get('aiProvider').value = 'gemini'; event('aiProvider', 'change'); check(get('aiProtocol').value === 'gemini' && get('providerGuide').textContent.includes('Google'), 'provider preset')
  get('bibClear').click(); check(get('bibWorkspace').hidden, 'clear memory UI')
  check(!errors.length, 'no browser-script exceptions: ' + errors.join('; '))
  dom.window.close(); delete global.window
  console.log('PASS:', checks, 'checks; model responses mocked; protocols tested on loopback only.')
}
main().catch(err => { console.error(err); process.exitCode = 1 })
