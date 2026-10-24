'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const create=require('../features/english/english-catalog'),C=require('../features/english/english-core');
function memory(){const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}}
async function transportChecks(){
 const https=require('https'),{EventEmitter}=require('events'),original=https.get;let handler,calls=[];
 https.get=(url,options,callback)=>{calls.push(url);const req=new EventEmitter();req.destroy=()=>{};process.nextTick(()=>{const config=handler(url),res=new EventEmitter();res.statusCode=config.status||200;res.headers=config.headers||{};res.resume=()=>{};res.destroy=()=>{};callback(res);if(config.body!==undefined){res.emit('data',Buffer.from(config.body));res.emit('end')}});return req};
 try{
  handler=url=>url.endsWith('start')?{status:302,headers:{location:'/final'}}:{body:'{"version":1}'};
  assert.equal((await create.requestBytes('https://example.com/start')).toString(),'{"version":1}');assert.deepEqual(calls,['https://example.com/start','https://example.com/final']);
  handler=()=>({status:302,headers:{location:'http://example.com/plain'}});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/HTTPS/);
  handler=()=>({status:302,headers:{location:'https://127.0.0.1/private'}});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/公开网站/);
  handler=()=>({status:302,headers:{location:'/loop'}});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/重定向次数/);
  handler=()=>({status:503});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/HTTP 503/);
  handler=()=>({headers:{'content-length':2*1024*1024+1}});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/2 MB/);
  handler=()=>({body:Buffer.alloc(2*1024*1024+1)});await assert.rejects(()=>create.requestBytes('https://example.com/start'),/2 MB/);
 }finally{https.get=original}
}
async function main(){
 const storage=memory(),calls=[],responses=new Map(),api=create({storage,request:async url=>{calls.push(url);const answer=responses.get(url);if(answer instanceof Error)throw answer;if(answer===undefined)throw Error('unexpected URL '+url);return answer}});
 assert.equal(api.settings().url,create.DEFAULT_URL);
 storage.setItem('english-catalog-settings-v1',{url:''});assert.equal(api.settings().url,create.DEFAULT_URL,'legacy empty settings use the default source');
 const local=await api.list();assert.equal(local.courses.length,4);assert.equal(local.fallback,false);assert.equal(local.bundled,true);assert.equal(local.cached,false);assert.equal(calls.length,0);
 assert(local.courses.every(item=>item.origin==='remote'&&item.count===60));
 assert.deepEqual(local.courses.map(item=>item.id),require('../assets/data/english-catalog-default.json').courses.map(item=>'remote:'+item.id));
 const base='https://raw.githubusercontent.com/owner/repo/main/materials/catalog.json',url='https://raw.githubusercontent.com/owner/repo/main/materials/course.json';
 const lesson={title:'远程测试课',domain:'我的领域',level:'博士讨论',source:{kind:'组会讲稿'},sentences:[{en:'We checked sample quality before comparing the two groups.',zh:'先检查质量，再比较。'}]};
 const bytes=Buffer.from(JSON.stringify(lesson)),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const entry={id:'test',title:lesson.title,domain:lesson.domain,level:lesson.level,count:1,description:'测试',url:'course.json',sha256:hash};
 const manifest={version:1,courses:[entry]};responses.set(base,JSON.stringify(manifest));responses.set(url,bytes);
 api.settings({url:base});const samples=await api.list();assert.equal(samples.courses.length,3);assert.equal(samples.bundled,false);assert.equal(calls.length,0,'no automatic remote request');
 for(const item of samples.courses){assert.equal(item.origin,'sample');const out=await api.download({id:item.id});assert.equal(out.lesson.sentences.length,4);assert.equal(out.catalog.origin,'sample');for(const sentence of out.lesson.sentences){assert(C.words(sentence.en).length<=16);assert(sentence.chunks.length>=2);assert(sentence.zh)}}
 assert.equal(create({storage}).settings().url,base,'existing custom sources survive reopening');
 const remote=await api.list({refresh:true});assert.equal(remote.courses.length,1);assert.equal(remote.courses[0].url,url);assert.equal(remote.fallback,false);assert.equal(calls.length,1);
 const result=await api.download({id:'remote:test'});assert.equal(result.lesson.domain,'我的领域');assert.equal(result.lesson.level,'博士讨论');assert.equal(result.lesson.title,'远程测试课');
 responses.set(base,new Error('network unavailable'));await assert.rejects(()=>api.list({refresh:true}),/network/);assert.equal((await api.list()).courses.length,1,'keep successful cache on refresh failure');
 const cached=await create({storage,request:()=>{throw Error('reopening must not use network')}}).list();assert.equal(cached.courses[0].id,'remote:test');assert.equal(cached.cached,true,'cache persists across sessions');
 responses.set(url,Buffer.from(JSON.stringify({...lesson,title:'tampered'})));await assert.rejects(()=>api.download({id:'remote:test'}),/校验失败/);
 responses.set(base,JSON.stringify({version:1,courses:[{...entry,sha256:'',count:2}]}));responses.set(url,bytes);await api.list({refresh:true});await assert.rejects(()=>api.download({id:'remote:test'}),/句数与目录不一致/);
 responses.set(base,JSON.stringify({version:1,courses:[{...entry,url:'http://example.com/course.json'}]}));await assert.rejects(()=>api.list({refresh:true}),/HTTPS/);
 responses.set(base,JSON.stringify({version:1,courses:[entry,entry]}));await assert.rejects(()=>api.list({refresh:true}),/唯一/);
 responses.set(base,Buffer.alloc(2*1024*1024+1));await assert.rejects(()=>api.list({refresh:true}),/2 MB/);
 responses.set(base,'<!doctype html>');await assert.rejects(()=>api.list({refresh:true}),/有效 JSON/);
 for(const address of ['http://example.com/catalog.json','https://name:password@example.com/catalog.json','https://example.com/catalog.json?token=private','https://localhost/catalog.json','https://127.0.0.1/catalog.json','https://[::1]/catalog.json','https://[::ffff:127.0.0.1]/catalog.json','https://10.0.0.1/catalog.json'])assert.throws(()=>api.settings({url:address}));
 assert.equal(create.publicURL('course.json',base),url);assert.equal(create.isPublicAddress('8.8.8.8'),true);assert.equal(create.isPublicAddress('192.168.1.3'),false);assert.equal(create.isPublicAddress('::ffff:10.1.1.1'),false);
 api.settings({url:'https://example.com/second/catalog.json'});assert.equal((await api.list()).courses.length,3,'changed source clears previous catalog');
 const beforeReset=calls.length;api.settings({url:'  '});assert.equal(api.settings().url,create.DEFAULT_URL);assert.equal((await api.list()).courses.length,4);assert.equal((await api.list()).bundled,true);assert.equal(calls.length,beforeReset,'restoring the default source does not fetch');await assert.rejects(()=>api.download({id:'remote:test'}),/找不到素材/);
 responses.set(create.DEFAULT_URL,JSON.stringify({version:1,courses:Array.from({length:4},(_,i)=>({...entry,id:'pack-'+i,url:'v1/courses/pack-'+i+'.json'}))}));
 const official=await api.list({refresh:true});assert.equal(official.courses.length,4);assert(official.courses.every(c=>c.origin==='remote'),'remote catalogs replace local examples');assert.equal(calls.at(-1),create.DEFAULT_URL);assert.equal(official.courses[0].url,'https://asa12138.github.io/research-english/v1/courses/pack-0.json');
 api.settings({url:''});assert.equal((await api.list()).courses.length,4,'saving the same effective default preserves its cache');
 await transportChecks();
 console.log('PASS English catalog: bundled four-pack default on first launch, default-source migration and reset, preserved custom sources, custom-source sample fallback, remote-only catalogs, explicit refresh/download, metadata and hashes, persisted cache, URL and size validation. Network calls are stubs.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
