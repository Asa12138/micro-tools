// Run: node test/journal-tools.test.js (real bundled datasets, no network or AI).
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const createTools = require('../features/journals/journal-tools')
const root = path.join(__dirname, '..')
const manifest = require('../plugin.json')
const datasets = require('../assets/data/journals/manifest.json')
const hashes = () => ['jcr', 'ccf'].map(key =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, datasets[key].file))).digest('hex'))
const before = hashes()
for (const key of ['jcr', 'ccf']) {
  const bytes = fs.readFileSync(path.join(root, datasets[key].file))
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), datasets[key].sha256)
}
assert.equal(datasets.ccf.linkedJcrSha256, datasets.jcr.sha256)

global.window = { ztools: { dbStorage: { getItem() {}, setItem() {} } } }
require('../preload')
assert.equal(typeof window.journalApi.search, 'function', 'old host / preview still works')
delete require.cache[require.resolve('../preload')]
const registered = {}
global.window = { ztools: { dbStorage: { getItem() {}, setItem() {} }, registerTool(name, handler) {
  assert.ok(manifest.tools[name], 'every tool is declared')
  registered[name] = handler
} } }
require('../preload')
assert.deepEqual(Object.keys(registered).sort(), Object.keys(manifest.tools).sort())
assert.equal(window.journalApi.loaded, false, 'registering tools does not load data eagerly')
const { search_journals: search, get_journal: detail } = registered

const nature = search({ query: 'Nature', limit: 2 })
assert.equal(nature.items[0].name, 'NATURE')
assert.equal(nature.items[0].match, 'exact')
assert.equal(nature.items[1].match, 'related')
assert.equal(nature.returned, 2)
assert.ok(nature.total > 2 && nature.truncated)
assert.equal(nature.items[0].year, '2025')
assert.equal(nature.snapshot.journalCount, 22643)
assert.deepEqual(nature.snapshot.jifYears, ['2025'])
const n = detail({ id: nature.items[0].id })
assert.equal(n.item.jif, window.journalApi.search('Nature', 1)[0].jif)
assert.ok(n.item.catDetail.includes('MULTIDISCIPLINARY SCIENCES'))
assert.equal(n.item.ccfRank, null)
assert.equal(n.item._tokensAll, undefined)
assert.equal(n.item.jifNum, undefined)
assert.equal(n.snapshot.id, nature.snapshot.id)
// Recorded before removing the identical root download copies.
assert.equal(n.snapshot.id, '3ee548c0607346fa', 'moving files does not invalidate journal IDs')

for (const query of ['0028-0836', '00280836', '0028 0836', '1476-4687']) {
  const found = search({ query })
  assert.equal(found.total, 1)
  assert.equal(found.items[0].id, n.item.id)
  assert.equal(found.items[0].match, 'exact')
}
const isme = search({ query: 'ISME J' })
assert.equal(isme.items[0].name, 'ISME Journal')
assert.ok(detail({ id: isme.items[0].id }).item.catDetail.includes('MICROBIOLOGY'))
const cvpr = search({ query: 'CVPR', type: 'conference' })
assert.equal(cvpr.items[0].ccfRank, 'A')
assert.equal(cvpr.items[0].type, 'conference')
assert.equal(cvpr.items[0].jif, null)
assert.equal(cvpr.items[0].year, null)
assert.ok(search({ query: 'CVPR' }).items.every(item => item.type === 'journal'))
const tpami = search({ query: 'TPAMI' }).items[0]
assert.equal(tpami.ccfRank, 'A')
assert.equal(tpami.type, 'journal')
assert.notEqual(tpami.jif, null)
const ccf = search({ query: '人工智能', type: 'all', limit: 50 })
assert.ok(ccf.items.every(item => item.ccfCat.includes('人工智能')))
const aiConferences = search({ query: '人工智能', type: 'conference' })
assert.ok(aiConferences.total > 0 && aiConferences.items.every(item => item.type === 'conference'))
assert.ok(ccf.total > aiConferences.total)
assert.ok(ccf.items.every(item => item.match === 'related'))
const empty = search({ query: 'zzzz_nonexistent_venue_1022' })
assert.equal(empty.total, 0)
assert.deepEqual(empty.items, [])
assert.equal(empty.truncated, false)

for (const input of [null, [], {}, { query: '' }, { query: '  ' }, { query: 12 },
  { query: 'a'.repeat(257) }, { query: 'Nature', limit: 0 }, { query: 'Nature', limit: 51 },
  { query: 'Nature', limit: 1.5 }, { query: 'Nature', limit: '2' },
  { query: 'Nature', type: 'conf' }, { query: 'Nature', unexpected: true }]) {
  assert.throws(() => search(input))
}
for (const input of [null, {}, { id: '../preload.js' }, { id: 0 }, { id: n.item.id, query: 'Nature' }]) {
  assert.throws(() => detail(input))
}
assert.throws(() => detail({ id: '0000000000000000:20' }), /快照已变化/)
assert.throws(() => detail({ id: nature.snapshot.id + ':99999999' }), /未找到/)

// Verify scientific value semantics independently of the current dataset contents.
const records = [{ name: 'Zero', jif: '0', year: '2025' },
  { name: 'Small', jif: '<0.1', year: '2025' }, { name: 'Missing', jif: '' }]
const fakeApi = { ensureLoaded: () => ({ ok: true, ccfError: 'missing CCF' }),
  total: 3, allTotal: 3, get: i => records[i], search: () => records }
const degraded = createTools(fakeApi, root).search_journals({ query: 'sample' })
assert.deepEqual(degraded.items.map(item => item.jif), ['0', '<0.1', null])
assert.equal(degraded.snapshot.warnings.length, 1)
assert.ok(degraded.items.every(item => /^[a-f0-9]{16}:\d+$/.test(item.id)))
const failed = createTools({ ensureLoaded: () => ({ ok: false, error: 'missing JCR' }) }, root)
assert.throws(() => failed.search_journals({ query: 'Nature' }), /数据库加载失败/)
assert.deepEqual(hashes(), before, 'bundled scientific data unchanged')
console.log('PASS: registration, real journal/ISSN/CCF queries, details, input validation, stale IDs, missing/zero/censored metrics and data failures')
