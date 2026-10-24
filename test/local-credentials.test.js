// Disk-backed credentials with dummy keys only. No external API request is made.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const createCredentials = require('../shared/local-credentials')
const createResearch = require('../features/research/research-service')
const createTranslation = require('../features/english/english-translation')
const createEnglish = require('../features/english/english-service')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'researchbox-credentials-test-'))
const directory = path.join(root, 'micro-tools-local'), filename = path.join(directory, 'credentials-v1.json')
const data = {}
const storage = { getItem: id => data[id], setItem: (id, value) => { data[id] = JSON.parse(JSON.stringify(value)) } }
const host = { dbStorage: storage }
const credentials = () => createCredentials({ directory })
try {
  let research = createResearch(() => host, { credentials: credentials() })
  let state = research.saveSettings({ mode: 'direct', provider: 'first', protocol: 'openai', baseUrl: 'https://first.example/v1/', model: 'fixture', apiKey: 'FAKE-AI-KEY-ONE' })
  assert.equal(state.credentialStorage, 'local')
  assert.equal(state.persisted, true)
  assert.equal(state.hasKey, true)
  assert.ok(!JSON.stringify(state).includes('FAKE-AI-KEY-ONE'))
  assert.ok(!JSON.stringify(data).includes('FAKE-AI-KEY-ONE'), 'Keys must not enter synced dbStorage')
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700)
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600)
  }
  research = createResearch(() => host, { credentials: credentials() })
  assert.equal(research.getSettings().hasKey, true, 'A new service and file store restore the saved key')
  research.saveSettings({ apiKey: '', model: 'fixture-two' })
  assert.equal(createResearch(() => host, { credentials: credentials() }).getSettings().hasKey, true, 'Blank preserves saved key')
  assert.equal(research.saveSettings({ baseUrl: 'https://first.example/v1/chat/completions' }).hasKey, true, 'Equivalent API endpoint keeps matching key')
  assert.equal(research.saveSettings({ baseUrl: 'https://second.example/v1' }).hasKey, false, 'Different endpoint never inherits a key')
  research.saveSettings({ apiKey: 'FAKE-AI-KEY-TWO' })
  assert.equal(research.saveSettings({ provider: 'second' }).hasKey, false, 'Different provider never inherits a key')
  assert.equal(research.saveSettings({ provider: 'first' }).hasKey, true, 'Returning to saved scope restores its key')
  assert.equal(research.saveSettings({ protocol: 'anthropic' }).hasKey, false, 'Different protocol never inherits a key')
  assert.equal(research.saveSettings({ protocol: 'openai', baseUrl: 'https://first.example/v1' }).hasKey, true)
  research.saveSettings({ clearKey: true })
  assert.equal(createResearch(() => host, { credentials: credentials() }).getSettings().hasKey, false, 'Explicit clear persists across restart')
  assert.ok(!fs.readFileSync(filename, 'utf8').includes('FAKE-AI-KEY-ONE'))
  assert.equal(research.saveSettings({ baseUrl: 'https://second.example/v1' }).hasKey, true, 'Clearing one scope preserves other endpoints')

  let translation = createTranslation(storage, { credentials: credentials() })
  const providers = {}
  for (const provider of translation.providers) {
    providers[provider.id] = {}
    for (const field of provider.fields) if (field.secret) providers[provider.id][field.key] = 'FAKE-' + provider.id + '-' + field.key
  }
  state = translation.config({ engine: 'deepl', providers })
  assert.equal(state.credentialStorage, 'local')
  assert.equal(state.persisted, true)
  for(const p of translation.providers)for(const f of p.fields)if(f.secret){if(f.display)assert.equal(state.providers[p.id][f.key],providers[p.id][f.key]);else assert.equal(state.providers[p.id][f.key],undefined)}
  assert.ok(!JSON.stringify(data).includes('FAKE-'), 'Translation credentials never enter host database')
  translation = createTranslation(storage, { credentials: credentials() })
  for (const provider of translation.providers) for (const field of provider.fields) if (field.secret) assert.equal(translation.config().providers[provider.id].has[field.key], true, provider.id + '.' + field.key)
  translation.config({ providers: { deepl: { apiKey: '', plan: 'pro' } } })
  translation = createTranslation(storage, { credentials: credentials() })
  assert.equal(translation.config().engine, 'deepl')
  assert.equal(translation.config().providers.deepl.plan, 'pro')
  assert.equal(translation.config().providers.deepl.has.apiKey, true)
  translation.config({ clearCredentials: ['deepl'] })
  translation = createTranslation(storage, { credentials: credentials() })
  assert.equal(translation.config().providers.deepl.has.apiKey, false)
  assert.equal(translation.config().providers['google-cloud'].has.apiKey, true)
  assert.equal(createResearch(() => host, { credentials: credentials() }).getSettings().hasKey, true, 'Translation saves preserve AI namespace')
  const english = createEnglish(storage, { credentials: credentials() })
  assert.equal(english.translationConfig().providers['google-cloud'].has.apiKey, true, 'English service forwards the private store')
  const backup = JSON.stringify({ lessons: english.list().map(item => english.get(item.id)), progress: {} })
  assert.ok(!backup.includes('FAKE-'), 'Lesson backups do not include credentials')

  // A real filesystem failure cannot report success or mutate running settings.
  let chosenDirectory = directory
  const changingStore = createCredentials({ directory: () => chosenDirectory })
  const failingResearch = createResearch(() => host, { credentials: changingStore })
  const beforeResearch = failingResearch.getSettings()
  const failingTranslation = createTranslation(storage, { credentials: changingStore })
  const beforeTranslation = failingTranslation.config()
  const beforeDisk = fs.readFileSync(filename, 'utf8')
  const blocked = path.join(root, 'blocked'); fs.writeFileSync(blocked, 'not a directory')
  chosenDirectory = blocked
  assert.throws(() => failingResearch.saveSettings({ apiKey: 'FAKE-FAILED-REPLACEMENT', model: 'should-not-stick' }), /凭据/)
  assert.deepEqual(failingResearch.getSettings(), beforeResearch)
  assert.throws(() => failingTranslation.config({ engine: 'baidu', providers: { baidu: { secretKey: 'FAKE-FAILED-TRANSLATION' } } }), /凭据/)
  assert.deepEqual(failingTranslation.config(), beforeTranslation)
  assert.throws(() => failingTranslation.config({ clearCredentials: ['google-cloud'] }), /凭据/)
  assert.equal(fs.readFileSync(filename, 'utf8'), beforeDisk)
  chosenDirectory = directory

  // Failed ordinary settings writes roll back a completed credentials update.
  const failStorage = { getItem: storage.getItem, setItem() { throw Error('write denied') } }
  const failedSave = createResearch(() => ({ dbStorage: failStorage }), { credentials: credentials() })
  const prior = failedSave.getSettings()
  assert.throws(() => failedSave.saveSettings({ apiKey: 'FAKE-ROLLBACK-KEY' }), /保存失败/)
  assert.deepEqual(failedSave.getSettings(), prior)
  const failedTranslation = createTranslation(failStorage, { credentials: credentials() })
  assert.throws(() => failedTranslation.config({ providers: { baidu: { secretKey: 'FAKE-ROLLBACK-TRANSLATION' } } }), /保存失败/)
  assert.equal(fs.readFileSync(filename, 'utf8'), beforeDisk)

  // A missing host filesystem is explicitly session-only, without a disk fallback.
  const sessionResearch = createResearch(() => ({ dbStorage: storage }))
  assert.equal(sessionResearch.saveSettings({ apiKey: 'FAKE-SESSION' }).credentialStorage, 'session')
  assert.equal(createResearch(() => ({ dbStorage: storage })).getSettings().hasKey, false)
  const sessionTranslation = createTranslation(storage)
  assert.equal(sessionTranslation.config({ providers: { deepl: { apiKey: 'FAKE-SESSION' } } }).credentialStorage, 'session')
  assert.equal(createTranslation(storage).config().providers.deepl.has.apiKey, false)
  assert.ok(!JSON.stringify(data).includes('FAKE-'))

  // Corruption is visible and must not be mistaken for a new empty file.
  fs.writeFileSync(filename, '{broken')
  assert.throws(() => createResearch(() => host, { credentials: credentials() }).getSettings(), /无法读取本机凭据/)
  assert.throws(() => credentials().write('translation', {}), /无法读取本机凭据/)
  assert.equal(fs.readFileSync(filename, 'utf8'), '{broken')
  console.log('PASS local credentials: disk reopen, AI endpoint/provider/protocol isolation, all translation secrets, blank/clear, local permissions, backup exclusion, write rollback, corruption and explicit session fallback. Dummy credentials only; zero network calls.')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
