// Targeted local fixtures: no external HTTP, AI or speech requests.
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process');
// Classification tests keep legacy catalogs without audio; audio downloads have dedicated tests.
const bundled=require('../assets/data/english-catalog-default.json');for(const item of bundled.courses)delete item.audio;
const create=require('../features/english/english-service'),createCatalog=require('../features/english/english-catalog'),C=require('../features/english/english-core'),manifest=require('../assets/data/english-catalog-default.json');
const hash=lesson=>'english-'+crypto.createHash('sha256').update(JSON.stringify(C.clean(lesson))).digest('hex').slice(0,24);
const memory=()=>{const values=new Map();return {getItem:k=>structuredClone(values.get(k)),setItem:(k,v)=>values.set(k,structuredClone(v))}};
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'english-library-test-'));
 try{
  execFileSync(process.execPath,[path.join(__dirname,'../materials/english/assemble-packs.cjs'),dir]);
  const storage=memory(),responses=new Map(),calls=[];
  for(const item of manifest.courses){const bytes=fs.readFileSync(path.join(dir,item.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(hash(JSON.parse(bytes)),item.lessonId);responses.set(new URL(item.url,createCatalog.DEFAULT_URL).href,bytes)}
  const request=async url=>{calls.push(url);if(!responses.has(url))throw Error('Unexpected URL: '+url);return responses.get(url)};
  let api=create(storage,{catalogRequest:request}),directory=await api.catalogList();
  assert.equal(directory.courses.length,4);assert(directory.courses.every(c=>c.count===60&&!c.installedLessonId));assert.equal(directory.bundled,true);assert.equal(calls.length,0);
  // Exact 1.6.5 content IDs migrate on read without changing stored records or progress.
  const legacy=manifest.courses[0],legacyLesson=C.clean(JSON.parse(responses.get(new URL(legacy.url,createCatalog.DEFAULT_URL).href)));
  const oldRecord={...legacyLesson,id:legacy.lessonId,createdAt:'2026-10-24T00:00:00Z',builtin:false};
  storage.setItem('research-english-library-v1',[oldRecord]);
  api.saveProgress(legacy.lessonId,{seconds:123,index:3,results:{0:{favorite:true,notes:'保留旧笔记',modes:{dictation:{complete:true,attempts:2}}}}});
  api=create(storage,{catalogRequest:request});
  assert.equal(api.list().find(x=>x.id===legacy.lessonId).library,'builtin');assert.equal(api.get(legacy.lessonId).downloaded,true);assert.deepEqual(storage.getItem('research-english-library-v1'),[oldRecord]);
  assert.equal((await api.catalogList()).courses[0].installedLessonId,legacy.lessonId);
  for(const item of manifest.courses){const result=await api.catalogDownload({id:'remote:'+item.id});assert.equal(result.id,item.lessonId);assert.equal(result.lesson.library,'builtin');assert.equal(result.lesson.builtin,false);assert.equal(result.lesson.downloaded,true);assert.equal(result.lesson.catalog.lessonId,result.id)}
  assert.equal(api.list().filter(x=>x.library==='builtin').length,8);assert.equal(api.list().filter(x=>x.library==='custom').length,0);assert((await api.catalogList()).courses.every(c=>c.installedLessonId));
  await api.catalogDownload({id:'remote:'+legacy.id});assert.equal(api.list().length,8);assert.equal(api.progress(legacy.lessonId).seconds,123);assert.equal(api.progress(legacy.lessonId).results[0].notes,'保留旧笔记');
  api.trash(legacy.lessonId);api=create(storage,{catalogRequest:request});assert(!api.list().some(x=>x.id===legacy.lessonId));assert.equal((await api.catalogList()).courses[0].installedLessonId,null);
  await api.catalogDownload({id:'remote:'+legacy.id});assert(api.list().some(x=>x.id===legacy.lessonId));assert.equal(api.progress(legacy.lessonId).seconds,123);
  const copy=api.edit(legacy.lessonId,api.get(legacy.lessonId));assert.notEqual(copy.id,legacy.lessonId);assert.equal(copy.lesson.library,'custom');assert.equal(copy.lesson.downloaded,false);assert(api.list().some(x=>x.id===legacy.lessonId));assert.equal(api.progress(copy.id).results[0].notes,'保留旧笔记');
  const edited=api.edit(legacy.lessonId,{...api.get(legacy.lessonId),title:'我的科研面试练习'});assert.equal(edited.lesson.library,'custom');assert(!edited.lesson.downloaded);assert(api.list().some(x=>x.id===legacy.lessonId));
  const backup=api.list().filter(x=>!x.builtin).map(x=>api.get(x.id)),restored=create(memory());for(const item of backup){const r=restored.save(item);assert.equal(r.id,item.id);assert.equal(r.lesson.library,item.library)}
  const fake=api.save({title:legacy.title,sentences:['A different sentence with the same course title.'],catalog:api.get(legacy.lessonId).catalog});assert.equal(fake.lesson.library,'custom','titles and stale provenance cannot classify a custom lesson');
  // A custom source keeps its own entries and its own persisted download provenance.
  const source='https://example.org/courses/catalog.json',courseURL='https://example.org/courses/custom.json',lesson={title:'自选网站素材',domain:'生态学',sentences:['We discuss the uncertainty in this ecological study.']},bytes=Buffer.from(JSON.stringify(lesson)),digest=crypto.createHash('sha256').update(bytes).digest('hex');
  responses.set(source,JSON.stringify({version:1,courses:[{id:'custom',title:lesson.title,domain:lesson.domain,count:1,url:'custom.json',sha256:digest}]}));responses.set(courseURL,bytes);
  api.catalogSettings({url:source});assert.equal((await api.catalogList()).bundled,false);await api.catalogList({refresh:true});const downloaded=await api.catalogDownload({id:'remote:custom'});assert.equal(downloaded.lesson.library,'builtin');assert.equal(downloaded.lesson.catalog.sourceUrl,source);
  api=create(storage,{catalogRequest:request});directory=await api.catalogList();assert.equal(directory.url,source);assert.equal(directory.courses.length,1);assert.equal(directory.courses[0].installedLessonId,downloaded.id);assert.equal(directory.cached,true);
  const backupCustom=create(memory()).save(api.get(downloaded.id));assert.equal(backupCustom.lesson.library,'builtin');assert.equal(backupCustom.lesson.catalog.sourceUrl,source);
  const manualImport=api.save({...lesson,title:'同名来源自行整理'});assert.equal(manualImport.lesson.library,'custom');
  console.log('PASS English library: bundled 4 packs/240 sentences, verified content IDs, legacy migration, installed-card mapping, restart, downloaded/builtin grouping, duplicate downloads, trash/restore, progress retention, custom copies, provenance backups and custom sources. Network is stubbed.');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1});
