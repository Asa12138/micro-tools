// Adapter contract tests use local fixtures only. They do not claim live account connectivity.
const assert=require('node:assert/strict');
const create=require('../features/english/english-translation');
const memory=()=>{const data={};return {data,getItem:k=>data[k],setItem:(k,v)=>{data[k]=JSON.parse(JSON.stringify(v))}}};
const credentials={
 'google-cloud':{apiKey:'google-test-secret'},aliyun:{accessKeyId:'aliyun-id',accessKeySecret:'aliyun-secret'},
 baidu:{appId:'2015063000000001',secretKey:'12345678'},volcengine:{accessKeyId:'volc-id',secretAccessKey:'volc-secret'},
 tencent:{secretId:'tencent-id',secretKey:'tencent-secret',region:'ap-guangzhou',projectId:'0'},
 niutrans:{apiKey:'niu-secret'},youdao:{appKey:'youdao-id',appSecret:'youdao-secret'},
 deepl:{apiKey:'deepl-secret:fx',plan:'auto'},caiyun:{token:'caiyun-token',secretKey:'caiyun-secret'}
};
const fixtures={
 google:[[ ['译文','research',null,null] ],null,'en'],
 'google-cloud':{data:{translations:[{translatedText:'译文 &amp; 验证'}]}},
 aliyun:{Code:'200',Data:{Translated:'译文'}},baidu:{trans_result:[{dst:'译文'}]},
 volcengine:{ResponseMetadata:{Error:null},TranslationList:[{Translation:'译文'}]},
 tencent:{Response:{TargetText:'译文'}},transmart:{auto_translation:['译文']},
 niutrans:{error_code:'0',tgt_text:'译文'},youdao:{errorCode:'0',translation:['译文']},deepl:{translations:[{text:'译文'}]},caiyun:{target:['译文']}
};
(async()=>{
 const storage=memory(),requests=[];
 let engine='google';
 const service=create(storage,{now:()=>Date.UTC(2026,9,24,10,0,0),nonce:()=> '1435660288',transport:async req=>{requests.push(req);return {status:200,body:fixtures[engine]}}});
 assert.equal(service.providers.length,11);assert.equal(service.providers.filter(p=>p.unofficial).length,2);
 let state=service.config({providers:credentials});
 assert.equal(state.credentialStorage,'session');assert.equal(state.providers.deepl.has.apiKey,true);assert.equal(state.providers.deepl.apiKey,undefined);
 for(const[id,fields]of Object.entries(credentials))for(const f of service.providers.find(p=>p.id===id).fields.filter(f=>f.secret))assert.ok(!JSON.stringify(storage.data).includes(fields[f.key]),'Secret persisted: '+id+'.'+f.key);
 for(const provider of service.providers){
  engine=provider.id;service.config({engine});
  const result=await service.translate({text:engine==='baidu'?'apple':'research'});
  assert.ok(result.translation.startsWith('译文'));assert.equal(result.engine,engine);assert.equal(result.cached,false);
  const size=requests.length;
  assert.equal((await service.translate({text:engine==='baidu'?'apple':'research'})).cached,true);assert.equal(requests.length,size);
  const req=requests.at(-1),url=new URL(req.url);assert.equal(url.protocol,'https:');assert.ok(!url.username&&!url.password);
  for(const f of provider.fields.filter(f=>f.secret)){const value=credentials[engine]?.[f.key];if(value)assert.ok(!req.url.includes(encodeURIComponent(value)),'Credentials should not be in a URL')}
  if(engine==='google')assert.equal(url.searchParams.get('q'),'research');
  if(engine==='google-cloud'){assert.equal(req.headers['x-goog-api-key'],'google-test-secret');assert.equal(result.translation,'译文 & 验证')}
  if(engine==='baidu'){
   // Published Baidu example: appid + apple + 1435660288 + 12345678.
   assert.equal(new URLSearchParams(req.body).get('sign'),'f89f9594663708c1605f3d736d01d2d4');
  }
  if(engine==='aliyun'){assert.equal(req.headers['x-acs-version'],'2018-10-12');assert.ok(req.headers.Authorization.startsWith('ACS3-HMAC-SHA256 Credential=aliyun-id,'));assert.equal(new URLSearchParams(req.body).get('SourceText'),'research')}
  if(engine==='volcengine'){assert.equal(req.headers['x-date'],'20261024T100000Z');assert.ok(req.headers.Authorization.includes('/cn-north-1/translate/request'));assert.equal(url.search,'?Action=TranslateText&Version=2020-06-01')}
  if(engine==='tencent'){assert.ok(req.headers.Authorization.includes('/2026-10-24/tmt/tc3_request'));assert.equal(req.headers['X-TC-Action'],'TextTranslate');assert.equal(JSON.parse(req.body).ProjectId,0)}
  if(engine==='youdao'){const body=new URLSearchParams(req.body);assert.equal(body.get('signType'),'v3');assert.match(body.get('sign'),/^[a-f0-9]{64}$/)}
  if(engine==='deepl'){assert.equal(url.hostname,'api-free.deepl.com');assert.equal(req.headers.Authorization,'DeepL-Auth-Key deepl-secret:fx')}
  if(engine==='caiyun'){assert.equal(req.headers['x-authorization'],'token caiyun-token');assert.match(JSON.parse(req.body).sign,/^[a-f0-9]{64}$/)}
 }
 // Persisted ordinary preferences survive; secrets never do.
 state=service.config({engine:'deepl',providers:{deepl:{apiKey:'',plan:'pro'}}});assert.equal(state.providers.deepl.has.apiKey,true);
 const restart=create(storage);assert.equal(restart.config().engine,'deepl');assert.equal(restart.config().providers.deepl.plan,'pro');assert.equal(restart.config().providers.deepl.has.apiKey,false);
 await assert.rejects(()=>restart.translate({text:'research'}),/填写/);
 service.config({clearCredentials:['deepl']});assert.equal(service.config().providers.deepl.has.apiKey,false);
 await assert.rejects(()=>service.translate({engine:'deepl',text:'research'}),/填写/);
 assert.throws(()=>service.config({providers:{tencent:{region:'bad\r\nInjected: true'}}}),/格式无效/);
 assert.throws(()=>service.config({providers:{tencent:{projectId:'-1'}}}),/非负整数/);
 assert.throws(()=>service.config({engine:'custom-evil'}),/支持/);
 await assert.rejects(()=>service.translate({text:'x'.repeat(501)}),/500/);
 // A key rotation must invalidate cache; cache keys contain credential hashes only.
 engine='google-cloud';const before=requests.length;
 service.config({engine,providers:{[engine]:{apiKey:'rotated-key'}}});await service.translate({text:'research'});assert.equal(requests.length,before+1);
 // Dedupe in-flight queries to avoid duplicate billable requests.
 let finish,called=0;const dedup=create(memory(),{transport:()=>{called++;return new Promise(resolve=>{finish=resolve})}});
 const first=dedup.translate({text:'biology'}),second=dedup.translate({text:'biology'});await Promise.resolve();assert.equal(called,1);
 finish({status:200,body:fixtures.google});assert.equal((await first).translation,(await second).translation);
 // Never surface provider responses/errors with secrets or request bodies.
 const bad=create(memory(),{transport:async()=>{throw Error('request Authorization SECRET-KEY at https://example.test/?key=SECRET-KEY')}});
 bad.config({engine:'deepl',providers:{deepl:{apiKey:'SECRET-KEY'}}});
 await assert.rejects(()=>bad.translate({text:'word'}),error=>!error.message.includes('SECRET-KEY')&&!error.message.includes('example.test'));
 for(const response of [{status:429,body:'secret'},{status:200,body:'<html>secret</html>'},{status:200,body:'x'.repeat(256*1024+1)},{status:200,body:{error:{message:'secret'}}}]){
  const failed=create(memory(),{transport:async()=>response});await assert.rejects(()=>failed.translate({text:'word'}),error=>!error.message.includes('secret'));
 }
 // Persisted user data may not inject a credential into session state.
 const poison=memory();poison.setItem('english-translation-v1',{engine:'deepl',providers:{deepl:{apiKey:'from-disk',plan:'auto'}}});
 assert.equal(create(poison).config().providers.deepl.has.apiKey,false);
 console.log('PASS translation: 11 adapters, published Baidu signature vector, request/response contracts, session-only credentials, redaction, bounded input/responses, per-engine cache, rotation and in-flight deduplication. Network calls are fixtures.');
})().catch(error=>{console.error(error);process.exitCode=1});
