// MCP workflow integration tests. Deliberate test fixtures; no model/API calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { JSDOM, VirtualConsole } = require('jsdom')
const C = require('../research-core')
const root = path.join(__dirname, '..')
let modelCalls = 0
const handlers = {}
global.window = { ztools: { ai() { modelCalls++; throw new Error('No model configured') }, registerTool(name, handler) { handlers[name] = handler } } }
require('../preload')
const bridge = window.researchAgent, journalApi = window.journalApi
assert.equal(Object.keys(handlers).length, 10)
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'research-mcp-test-'))
async function main() {
  const abstract = 'We compared soil microbial communities across an observational chronosequence. Community composition was associated with soil carbon and moisture. The sampling design does not establish causal effects.'
  const profile = { summary: '观测土壤微生物群落与环境的关联。', field: 'Microbial ecology', study_type: '研究论文', keywords: ['soil'], search_terms: ['ecology', 'microbiology'], journal_seeds: ['ISME Journal'], highlights: [{ label: '方法', quote: 'We compared soil microbial communities', explanation: '观测设计' }], strengths: [{ title: '研究对象明确', evidence: 'soil microbial communities' }], concerns: [], missing_information: ['独立样本数'], novelty_note: '需文献对照' }
  const prep = handlers.prepare_submission({ title: '<script>globalThis.injected=true</script>', abstract, screening: { include_general: false, if_range: { min: 5, max: 20 } } })
  assert.equal(prep.stage, 'awaiting_profile')
  assert.ok(prep.instructions.includes('研究画像'))
  assert.ok(!prep.instructions.includes('不要调用工具、执行命令或要求密钥'))
  assert.throws(() => handlers.get_submission_candidates({ session_id: prep.session_id, profile: { ...profile, highlights: [{ ...profile.highlights[0], quote: 'fabricated quotation not in abstract' }] } }), /逐字/)
  const pool = handlers.get_submission_candidates({ session_id: prep.session_id, profile })
  assert.equal(pool.stage, 'awaiting_assessment')
  assert.ok(pool.context.candidates.every(c => !c.is_general && Number(c.jif) >= 5 && Number(c.jif) <= 20))
  const chosen = pool.context.candidates.find(c => c.name === 'ISME Journal')
  assert.ok(chosen)
  const assessment = { strategy: '先比较微生物生态学读者群，再核实官网范围。', recommendations: [{ id: chosen.id, tier: '优先比较', fit: '待核实', reasons: ['土壤微生物群落与生态学科相关'], concerns: ['独立样本数未提供'], to_verify: ['官网收稿范围'] }], general_assessment: [], checklist: [{ title: '核实范围', detail: '查阅作者指南' }], limitations: '仅依据所给摘要' }
  const finish = rank => handlers.finalize_submission({ session_id: prep.session_id, candidate_set_id: pool.candidate_set_id, assessment: rank })
  assert.throws(() => finish({ ...assessment, recommendations: [{ ...assessment.recommendations[0], id: 999999 }] }), /候选/)
  assert.throws(() => finish({ ...assessment, recommendations: [assessment.recommendations[0], assessment.recommendations[0]] }), /重复/)
  assert.throws(() => finish({ ...assessment, recommendations: [{ ...assessment.recommendations[0], jif: '999' }] }), /不支持参数/)
  const done = finish(assessment)
  assert.equal(done.assessment.recommendations[0].journal.jif, chosen.jif)
  assert.equal(done.stage, 'complete')
  const copy = bridge.latest('submission'); copy.data.rank.strategy = 'mutated'
  assert.equal(bridge.latest('submission').data.rank.strategy, assessment.strategy, 'UI receives isolated copy')

  const generalPrep = handlers.prepare_submission({ abstract })
  const generalPool = handlers.get_submission_candidates({ session_id: generalPrep.session_id, profile })
  assert.throws(() => handlers.finalize_submission({ session_id: generalPrep.session_id, candidate_set_id: generalPool.candidate_set_id, assessment }), /综合/)
  const changedPool = handlers.get_submission_candidates({ session_id: generalPrep.session_id, profile: { ...profile, summary: '另一份画像' } })
  assert.notEqual(changedPool.candidate_set_id, generalPool.candidate_set_id)
  assert.throws(() => handlers.finalize_submission({ session_id: generalPrep.session_id, candidate_set_id: generalPool.candidate_set_id, assessment }), /候选集已变化/)

  const source = '@article{a,title={Soil communities across time},author={Doe, J and Roe, A and Li, K},journal={ISME Journal},year={2020},abstract={We measured soil communities across time.}}\n@article{b,title={Soil ecology overview},author={Doe, J and Roe, A},year={2021},abstract={We summarize existing evidence on soil ecology.}}\n@article{c,title={An explicit editorial},type={Editorial},year={2022}}'
  const parsed = handlers.analyze_literature({ bibtex: source, filename: 'Fixture.bib' })
  assert.equal(parsed.total, 3)
  assert.equal(parsed.jif.matched, 1)
  assert.equal(parsed.quality.missing.journal, 2)
  const page = handlers.get_literature_entries({ session_id: parsed.session_id, limit: 1 })
  assert.equal(page.items.length, 1); assert.equal(page.next_offset, 1)
  assert.equal(page.items[0].journal_match.status, 'matched')
  assert.equal(handlers.get_literature_entries({ session_id: parsed.session_id, offset: 2 }).items[0].classification_allowed, false)
  const classify = items => handlers.classify_literature({ session_id: parsed.session_id, items })
  const valid = { id: 0, kind: 'research', evidence: 'We measured soil communities', reason: '已有摘要报告测量' }
  assert.throws(() => classify([valid, { id: 1, kind: 'review', evidence: 'invented evidence', reason: 'test' }]), /逐字/)
  assert.throws(() => classify([{ id: 1, kind: 'unknown', evidence: 'invented evidence', reason: 'test' }]), /逐字/)
  assert.notEqual(handlers.get_literature_entries({ session_id: parsed.session_id, limit: 1 }).items[0].kindSource, 'ai', 'bad batch is atomic')
  assert.throws(() => classify([{ id: 2, kind: 'research', evidence: 'An explicit editorial', reason: 'test' }]), /元数据/)
  classify([valid, { id: 1, kind: 'review', evidence: 'We summarize existing evidence', reason: '摘要描述综合已有证据' }])
  const revised = handlers.get_literature_entries({ session_id: parsed.session_id, scope: 'research' })
  assert.equal(revised.total, 1); assert.equal(revised.items[0].kindSource, 'ai')
  const full = handlers.get_literature_network({ session_id: parsed.session_id, counting: 'full' })
  const fractional = handlers.get_literature_network({ session_id: parsed.session_id, counting: 'fractional' })
  assert.ok(full.network.links.some(e => e.documents === 2 && e.weight === 2))
  assert.ok(fractional.network.links.some(e => e.documents === 2 && e.weight === 1.5))
  assert.ok(handlers.get_literature_network({ session_id: parsed.session_id, type: 'term' }).network.nodes.length)

  // Full local cycle, without plugin API configuration, including existing UI import.
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window, errors = []
  w.addEventListener('error', e => errors.push(e.message))
  w.journalApi = journalApi; w.researchAgent = bridge
  w.researchApi = { getSettings: () => ({ mode: 'host', hostAvailable: false }), call: () => { modelCalls++; throw Error('No model') } }
  for (const file of ['research-core.js', 'research-metrics.js', 'research-report.js', 'research-prompts.js', 'index.js', 'research-ui.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'))
  w.document.getElementById('submissionAgent').click()
  assert.ok(w.document.getElementById('submissionResults').textContent.includes('ISME Journal'))
  assert.equal(w.injected, undefined)
  const liveSubmission = w.document.getElementById('submissionResults').cloneNode(true)
  liveSubmission.querySelector('#exportSubmission').remove()
  w.document.getElementById('bibAgent').click()
  assert.equal(w.document.getElementById('bibWorkspace').hidden, false)
  assert.ok(w.document.getElementById('bibDashboard').querySelector('svg'))
  assert.deepEqual(errors, [])
  dom.window.close()

  for (const [id, name] of [[prep.session_id, 'submission'], [parsed.session_id, 'literature']]) {
    const file = path.join(temp, name + '.html')
    const exported = handlers.export_research_report({ session_id: id, format: 'html', output_path: file })
    assert.ok(exported.bytes > 10000)
    const html = fs.readFileSync(file, 'utf8')
    assert.ok(!html.includes('<script>globalThis.injected=true</script>'))
    const failures = [], vc = new VirtualConsole(); vc.on('jsdomError', e => failures.push(e.message))
    const report = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc })
    if (name === 'submission') {
      const d = report.window.document, ev = type => new report.window.Event(type)
      assert.equal(d.querySelector('.report-body').innerHTML, liveSubmission.innerHTML, 'MCP and live UI use identical rendered content')
      assert.ok(d.querySelector('.recommendation--lead .journal-facts'))
      assert.equal(d.querySelector('.abstract-highlight').textContent, abstract)
      assert.equal(d.querySelectorAll('mark.highlight').length, 1)
      assert.ok(d.querySelector('.submission-side-nav'))
      const rows = () => Array.from(d.querySelectorAll('[data-candidate-table] tbody tr:not([hidden])'))
      const total = pool.context.candidates.length
      assert.equal(rows().length, Math.min(20, total))
      d.querySelector('[data-candidate-more]').click()
      assert.equal(rows().length, Math.min(40, total))
      const search = d.querySelector('[data-candidate-search]')
      search.value = 'isme journal'; search.dispatchEvent(ev('input'))
      assert.equal(rows().length, 1)
      const order = d.querySelector('[data-candidate-sort]')
      d.querySelector('[data-candidate-reset]').click()
      order.value = 'if-asc'; order.dispatchEvent(ev('change'))
      assert.ok(rows().every((row, i, all) => !i || Number(all[i - 1].dataset.jif) <= Number(row.dataset.jif)))
      const kind = d.querySelector('[data-candidate-kind]')
      kind.value = 'general'; kind.dispatchEvent(ev('change'))
      assert.equal(rows().length, 0)
      assert.equal(d.querySelector('[data-candidate-empty]').hidden, false)
      d.querySelector('[data-candidate-reset]').click()
      const min = d.querySelector('[data-candidate-min]'), max = d.querySelector('[data-candidate-max]')
      min.value = max.value = chosen.jif; min.dispatchEvent(ev('input'))
      assert.ok(rows().length && rows().every(row => Number(row.dataset.jif) === Number(chosen.jif)))
      const category = d.querySelector('[data-candidate-category]')
      category.value = category.options[1].value; category.dispatchEvent(ev('change'))
      assert.ok(rows().every(row => row.dataset.categories.split('|').includes(category.value)))
      const section = d.getElementById('submissionCandidates'); section.open = false
      d.querySelector('[data-report-target="submissionCandidates"]').click()
      assert.equal(section.open, true)
      const navToggle = d.querySelector('.submission-side-nav button'); navToggle.click()
      assert.equal(navToggle.getAttribute('aria-expanded'), 'true')
      const requirement = d.querySelector('.submission-requirements'); requirement.querySelector('summary').click()
      assert.equal(requirement.open, true)
      const beforePrint = rows().length
      report.window.dispatchEvent(ev('beforeprint')); assert.equal(rows().length, total)
      report.window.dispatchEvent(ev('afterprint')); assert.equal(rows().length, beforePrint)
      assert.ok(d.querySelector('.journal-actions a[data-external][href^="https://"]'))
      assert.equal(d.querySelectorAll('script[src],link[rel="stylesheet"]').length, 0)
    }
    if (name === 'literature') {
      assert.ok(report.window.document.querySelector('#reportDashboard svg'))
      assert.equal(report.window.document.querySelectorAll('#reportTable tbody tr').length, 3)
      const search = report.window.document.getElementById('reportSearch'); search.value = 'overview'; search.dispatchEvent(new report.window.Event('input'))
      assert.equal(report.window.document.querySelectorAll('#reportTable tbody tr:not([hidden])').length, 1)
      assert.ok(!html.includes('We measured soil communities across time.'))
    }
    assert.deepEqual(failures, []); assert.equal(report.window.injected, undefined); report.window.close()
    assert.throws(() => handlers.export_research_report({ session_id: id, format: 'html', output_path: file }), /EEXIST/)
  }
  const csv = path.join(temp, 'entries.csv')
  handlers.export_research_report({ session_id: parsed.session_id, format: 'csv', output_path: csv })
  assert.ok(fs.readFileSync(csv, 'utf8').includes('ISME Journal'))
  assert.throws(() => handlers.export_research_report({ session_id: prep.session_id, format: 'csv', output_path: path.join(temp, 'bad.csv') }), /仅用于文献/)

  for (const [name, input] of [
    ['prepare_submission', { abstract, screening: { if_range: { min: 20, max: 5 } } }],
    ['prepare_submission', { abstract: 'too short' }],
    ['analyze_literature', { bibtex: source, file_path: '/tmp/a.bib' }],
    ['analyze_literature', { file_path: '/etc/passwd' }],
    ['get_literature_entries', { session_id: parsed.session_id, limit: 1000 }],
    ['get_literature_network', { session_id: parsed.session_id, max_nodes: 0 }],
    ['get_literature_entries', { session_id: 'missing' }]
  ]) assert.throws(() => handlers[name](input))

  // User-provided workspace bibliography: verify the same parser and counts via a real path.
  const bibPath = path.join(root, '..', 'Arctic_post_glacial_soil_microbiomes.bib')
  if (fs.existsSync(bibPath)) {
    const real = handlers.analyze_literature({ file_path: bibPath })
    assert.equal(real.total, C.parseBibtex(fs.readFileSync(bibPath, 'utf8')).entries.length)
    console.log('Workspace bibliography:', JSON.stringify({ total: real.total, matchedJif: real.jif.matched, missing: real.quality.missing }))
  }
  // Sessions expire explicitly; no disk persistence or silent stale reuse.
  const now = Date.now
  try { Date.now = () => now() + 61 * 60 * 1000; assert.throws(() => handlers.get_literature_entries({ session_id: parsed.session_id }), /过期/); assert.equal(bridge.latest('literature'), null) } finally { Date.now = now }
  assert.equal(modelCalls, 0)
  console.log('PASS: 10 registered tools, no-API submission/literature workflows, atomic validation, live UI import, interactive HTML/CSV exports, file and session boundaries; model calls = 0')
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => fs.rmSync(temp, { recursive: true, force: true }))
