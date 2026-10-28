/* Browser signing must produce the same packets as the plugin. No live credentials. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),nativeCrypto=require('node:crypto');
const shared=require('../features/english/english-translation');
const sandbox={window:{},TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,URL,URLSearchParams,structuredClone,crypto:{randomUUID:()=> 'fixture-nonce'},Date:class extends Date{static now(){return 1700000000000}},module:{exports:{}}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/english/hash.js'),'utf8'),sandbox);
function load(relative,requireFn){sandbox.module={exports:{}};sandbox.require=requireFn;vm.runInContext('(function(require,module,exports){'+fs.readFileSync(path.join(__dirname,'..',relative),'utf8')+'\n})(require,module,module.exports)',sandbox);return sandbox.module.exports}
const platform=load('web/english/platform.js',id=>require('../web/english/'+id));sandbox.Buffer=platform.Bytes;
for(const key of ['key','密钥', 'x'.repeat(100),new Uint8Array([0,1,255])])for(const value of ['research','科研 🧬','x'.repeat(150)])assert.equal(platform.cryptoAdapter.createHmac('sha256',key).update(value).digest('hex'),nativeCrypto.createHmac('sha256',key).update(value).digest('hex'));
for(const value of ['','research','科研 🧬'])assert.equal(platform.cryptoAdapter.createHash('md5').update(value).digest('hex'),nativeCrypto.createHash('md5').update(value).digest('hex'));
const browserShared=load('features/english/english-translation.js',id=>id==='crypto'?platform.cryptoAdapter:{});
const session=new Map();sandbox.sessionStorage={getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
const requests=[];let raw;
const create=load('web/english/services.js',id=>id==='../../features/english/english-translation'?browserShared:{endpoint:v=>new URL(v).href,request:async(url,options={})=>{requests.push({url,...options});return {status:200,body:JSON.stringify(raw)}}});
const stored=new Map(),storage={getItem:k=>structuredClone(stored.get(k)),setItem:(k,v)=>stored.set(k,structuredClone(v))};
const api=create(storage).translation;
const responses={google:[[['研究']]],mymemory:{responseStatus:200,responseData:{translatedText:'研究'}},'google-cloud':{data:{translations:[{translatedText:'研究'}]}},aliyun:{Code:200,Data:{Translated:'研究'}},baidu:{trans_result:[{dst:'研究'}]},volcengine:{TranslationList:[{Translation:'研究'}]},tencent:{Response:{TargetText:'研究'}},transmart:{auto_translation:['研究']},niutrans:{tgt_text:'研究'},youdao:{errorCode:'0',translation:['研究']},deepl:{translations:[{text:'研究'}]},caiyun:{target:['研究']}};
(async()=>{
 for(const p of shared.providers){
  assert.deepEqual(JSON.parse(JSON.stringify(api.providers.find(x=>x.id===p.id).fields)),p.fields);
  const credentials=Object.fromEntries(p.fields.map(f=>[f.key,f.default||('fixture-'+f.key)]));
  api.config({engine:p.id,providers:{[p.id]:credentials}});raw=responses[p.id];
  const r=await api.translate({text:'research'});assert.equal(r.translation,'研究');
  const expected=shared.buildRequest(p.id,'research',credentials,1700000000000,'fixture-nonce');expected.headers=Object.fromEntries(Object.entries(expected.headers||{}).filter(([k])=>!['host','origin','referer','user-agent','content-length'].includes(k.toLowerCase())));
  assert.deepEqual(JSON.parse(JSON.stringify(requests.at(-1))),expected,p.id+' packet');
  for(const f of p.fields)if(f.secret){assert.equal(api.config().providers[p.id].has[f.key],true);assert.equal(JSON.stringify([...stored]).includes(credentials[f.key]),false,'secret outside durable storage')}
 }
 api.config({engine:'baidu',providers:{baidu:{appId:'',secretKey:''}}});assert.equal(api.config().providers.baidu.appId,'fixture-appId');
 api.config({clearCredentials:['baidu']});assert.equal(api.config().providers.baidu.has.appId,false);assert.equal(api.config().providers.tencent.has.secretKey,true);
 await assert.rejects(()=>api.translate({text:'research'}),/APP ID/);
 assert.throws(()=>api.config({providers:{tencent:{region:'bad'}}}),/地域/);
 assert.throws(()=>api.config({providers:{tencent:{projectId:'NaN'}}}),/项目/);
 assert.throws(()=>api.config({providers:{deepl:{plan:'bad'}}}),/套餐/);
 session.set('research-english-web-secret:translation:openai','legacy-key');assert.equal(api.config().providers.openai.has.apiKey,true);api.config({clearCredentials:['openai']});assert.equal(api.config().providers.openai.has.apiKey,false);
 assert.equal(create(storage).translation.config().providers.tencent.has.secretId,true,'same-session reload');session.clear();assert.equal(create(storage).translation.config().providers.tencent.has.secretId,false,'new session clears credentials');
 console.log('PASS browser: 12 shared schemas, MD5 and HMAC vectors, all signed request packets/response parsing, independent session credentials, legacy keys, clearing and config validation.');
})().catch(e=>{console.error(e);process.exitCode=1});
