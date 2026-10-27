// Verify these material files using the application's actual catalog and library services.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const C = require('../../features/english/english-core');
const root = path.resolve(process.argv[2] || __dirname);
const origin = 'https://asa12138.github.io/apps/research-english/materials/';
const data = new Map();
const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, structuredClone(value)) };
const service = require('../../features/english/english-service')(storage);
const catalog = require('../../features/english/english-catalog')({ storage, request: async value => {
  assert.ok(value.startsWith(origin));
  return fs.readFileSync(path.join(root, value.slice(origin.length)));
} });
const backup = JSON.parse(fs.readFileSync(path.join(root, 'research-english-240-import.json')));
const initialCount = service.list().length;
const importBackup = () => backup.lessons.map(raw => {
  const saved = service.save(C.clean(raw));
  if (backup.progress?.[raw.id]) service.saveProgress(saved.id, C.mergeProgress(service.progress(saved.id), backup.progress[raw.id]));
  return saved;
});
(async () => {
  assert.equal(backup.format, 'research-english-backup-v1');
  assert.equal(backup.lessons.length, 4);
  const imported = importBackup();
  assert.ok(imported.every(x => !x.existing));
  service.saveProgress(imported[0].id, { seconds: 145, index: 3, mode: 'dictation', results: { 0: { favorite: true, notes: '保留已有练习', modes: { dictation: { complete: true, attempts: 2, errors: 1 } } } } });
  const progressBefore = service.progress(imported[0].id);
  assert.ok(importBackup().every(x => x.existing));
  assert.equal(service.list().length, initialCount + 4);
  assert.deepEqual(service.progress(imported[0].id), progressBefore);
  for (const endpoint of ['catalog.json', 'v1/catalog.json']) {
    catalog.settings({ url: origin + endpoint });
    const remote = (await catalog.list({ refresh: true })).courses.filter(x => x.origin === 'remote');
    assert.equal(remote.length, 4);
    for (const [i, entry] of remote.entries()) {
      const { lesson } = await catalog.download({ id: entry.id });
      assert.equal(lesson.sentences.length, 60);
      assert.deepEqual(lesson, C.clean(backup.lessons[i]));
      const saved = service.save(lesson);
      assert.equal(saved.id, imported[i].id);
      assert.equal(saved.existing, true);
    }
  }
  assert.equal(service.list().length, initialCount + 4);
  assert.deepEqual(service.progress(imported[0].id), progressBefore);
  const results = {
    catalogEndpoints: 2, remoteCoursesPerCatalog: 4, verifiedDownloads: 8,
    bulkImportCourses: 4, bulkImportSentences: backup.lessons.reduce((sum, lesson) => sum + lesson.sentences.length, 0),
    repeatImportDeduplicated: true, practiceProgressPreserved: true,
    downloadMatchesOfflineImport: true,
    transport: 'Local files injected into the real catalog downloader; the new URL has not been published.'
  };
  const reportFile = path.join(root, 'validation.json');
  const report = JSON.parse(fs.readFileSync(reportFile));
  report.compatibility = results;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
