const {request}=require('./network');
const keyFor=id=>'research-english-web-secret:'+id;
const secret={get(id){try{return sessionStorage.getItem(keyFor(id))||''}catch{return ''}},set(id,value){try{if(value)sessionStorage.setItem(keyFor(id),value);else sessionStorage.removeItem(keyFor(id))}catch{throw Error('无法保存会话密钥，请允许当前标签页使用会话存储')}}};
const AI=require('../../shared/ai-protocols');
const sharedTranslation=require('../../features/english/english-translation');
const providers=sharedTranslation.providers.map(p=>({...p,note:p.note+' 网页版需接口允许跨域访问；否则请使用插件版或自己的 HTTPS 中转。'}));
const credentialId=(id,key,address='')=>'translation:'+id+':'+key+(address?':'+AI.scope({provider:id,protocol:'translation',baseUrl:address}):'');
function checkStatus(r){if(r.status<200||r.status>=300)throw Error('接口返回 HTTP '+r.status+'，请检查地址、密钥、额度及权限');let result;try{result=JSON.parse(r.body)}catch{throw Error('接口没有返回有效 JSON')}return result}
module.exports=function services(storage,{relay,googleTranslation}={}){
 let controller=null;const cache=new Map();
 function currentAI(){const c=storage.getItem('web-ai-settings')||{};return {provider:c.provider||'custom',protocol:c.protocol||'openai',baseUrl:c.baseUrl||c.endpoint||'',model:c.model||''}}
 const aiKey=c=>'ai:'+AI.scope(c);
 // Bind legacy session secrets to the previously saved recipient before any edit.
 const previous=currentAI();if(secret.get('ai')){if(previous.baseUrl)secret.set(aiKey(previous),secret.get('ai'));secret.set('ai','')}
 const oldTranslation=storage.getItem('web-translation-settings')||{};
 for(const p of providers)for(const f of p.fields)if(f.secret){const old=credentialId(p.id,f.key),address=oldTranslation.providers?.[p.id]?.endpoint||'',legacy=secret.get(old)||(f.key==='apiKey'?secret.get('translation:'+p.id):'');if(address&&legacy){secret.set(credentialId(p.id,f.key,address),legacy);secret.set(old,'')}if(f.key==='apiKey')secret.set('translation:'+p.id,'')}
 function credential(id,key,config){return secret.get(credentialId(id,key,config?.endpoint||''))}
 function aiConfig(patch){
  const current=currentAI();if(!patch)return {...current,endpoint:current.baseUrl,hasKey:!!secret.get(aiKey(current))};
  if(controller)throw Error('请先停止当前模型请求。');
  const next={...current};for(const k of ['provider','protocol','baseUrl','model'])if(patch[k]!==undefined)next[k]=String(patch[k]).trim();
  if(patch.endpoint!==undefined&&patch.baseUrl===undefined)next.baseUrl=String(patch.endpoint).trim();
  AI.endpoint(next);if(!next.model||next.model.length>200)throw Error('请填写模型 ID');
  if(patch.apiKey!==undefined&&(typeof patch.apiKey!=='string'||patch.apiKey.length>2048||/[\r\n\0]/.test(patch.apiKey)))throw Error('API key 格式无效。');
  const id=aiKey(next),old=secret.get(id);try{if(patch.apiKey?.trim())secret.set(id,patch.apiKey.trim());if(patch.clear||patch.clearKey)secret.set(id,'');storage.setItem('web-ai-settings',next)}catch(e){secret.set(id,old);throw e}
  return {...next,endpoint:next.baseUrl,hasKey:!!secret.get(id)};
 }
 async function call(messages,{probe=false}={}){
  if(controller)throw Error('已有模型请求正在进行。');const c=currentAI();if(!c.baseUrl||!c.model)throw Error('请先配置 AI 接口');
  const key=secret.get(aiKey(c)),packet=AI.request(c,key,messages,{probe});controller=new AbortController();
  try{const r=await request(packet.url,{...packet,timeoutMs:probe?20000:180000,maxBytes:3*1024*1024,signal:controller.signal});return AI.read(c,checkStatus(r))}
  catch(e){throw Error(String(e.message).split(key||'\0').join(key?'[已隐藏]':'\0').slice(0,400))}finally{controller=null}
 }
 const research={presets:AI.presets,config:aiConfig,call,cancel(){controller?.abort()},async checkAvailability({force=false}={}){
  if(controller)return {ok:false,state:'busy',message:'模型正在处理任务。'};
  try{const c=currentAI();if(!c.baseUrl||!c.model)throw Error('请先配置 AI 接口');AI.endpoint(c);if(force)await call([{role:'user',content:'Connection test. Reply only with {"ok":true}.'}],{probe:true});return {ok:true,state:'ready',message:force?'连接正常，可以使用当前模型。':'配置已就绪；点击测试连接才调用模型。'}}catch(e){return {ok:false,state:force?'unavailable':'unconfigured',message:e.message}}
 }};
 function config(patch){
  const stored=storage.getItem('web-translation-settings')||{};
  const c={engine:providers.some(p=>p.id===stored.engine)?stored.engine:'google',pronunciation:['youdao','google'].includes(stored.pronunciation)?stored.pronunciation:'youdao',providers:{}};
  for(const p of providers){c.providers[p.id]={};for(const f of p.fields)if(!f.secret)c.providers[p.id][f.key]=stored.providers?.[p.id]?.[f.key]??f.default??''}
  if(patch){
   const writes=new Map();
   if(patch.engine!==undefined){if(!providers.some(p=>p.id===patch.engine))throw Error('请选择支持的翻译引擎');c.engine=patch.engine}
   if(patch.pronunciation!==undefined){if(!['youdao','google'].includes(patch.pronunciation))throw Error('请选择有道或 Google 发音');c.pronunciation=patch.pronunciation}
   if(patch.clearCredentials!==undefined){if(!Array.isArray(patch.clearCredentials))throw Error('清除凭据的引擎无效');for(const id of patch.clearCredentials){const p=providers.find(p=>p.id===id);if(!p)throw Error('清除凭据的引擎无效');writes.set('translation:'+id,'');for(const f of p.fields)if(f.secret)writes.set(credentialId(id,f.key,c.providers[id]?.endpoint),'')}}
   for(const [id,values]of Object.entries(patch.providers||{})){
    const p=providers.find(p=>p.id===id);if(!p||!values||typeof values!=='object')throw Error('翻译引擎配置无效');
    const address=values.endpoint!==undefined?(values.endpoint?AI.serviceURL(values.endpoint).href:''):c.providers[id]?.endpoint;
    for(const f of p.fields){
     if(!Object.hasOwn(values,f.key))continue;const raw=values[f.key];if(typeof raw!=='string'||raw.length>2048||/[\r\n\0]/.test(raw))throw Error('翻译设置格式无效');const value=raw.trim();
     if(f.secret){if(value)writes.set(credentialId(id,f.key,address),value);continue}
     if(f.options&&!f.options.some(o=>o.value===value))throw Error('请选择有效套餐');
     if(f.key==='region'&&!/^[a-z]{2}-[a-z]+(?:-\d+)?$/.test(value))throw Error('请填写有效的腾讯云地域，如 ap-guangzhou');
     if(f.key==='projectId'&&!/^\d{1,12}$/.test(value))throw Error('项目 ID 必须为非负整数');
     c.providers[id][f.key]=f.key==='endpoint'&&value?AI.serviceURL(value).href:value;
    }
   }
   const before=new Map([...writes.keys()].map(k=>[k,secret.get(k)]));
   try{for(const [k,v]of writes)secret.set(k,v);storage.setItem('web-translation-settings',c)}catch(e){for(const [k,v]of before)secret.set(k,v);throw e}
   cache.clear();
  }
  const view=structuredClone(c);
  for(const p of providers){const safe=view.providers[p.id];safe.has={};for(const f of p.fields)if(f.secret){const value=credential(p.id,f.key,c.providers[p.id]);safe.has[f.key]=!!value;if(f.display)safe[f.key]=value}}
  return {...view,credentialStorage:'browser-session',googleNetwork:{mode:'direct',proxy:''}};
 }
 const translation={providers:providers.map(p=>p.id==='google'&&googleTranslation?{...p,note:'通过本站 Google 翻译中转查询，无需密钥。所选文字会经中转发送给 Google；每 IP 每天最多 100 次，北京时间零点重置，与语音额度分开。免密钥网页接口可能受 Google 限流。'}:p),config,async translate({text}){
  text=String(text||'').trim();if(!text||text.length>500)throw Error('请选择 1–500 字符');const c=config(),id=c.engine,provider=providers.find(p=>p.id===id),p={...c.providers[id]};
  for(const f of provider.fields){if(f.secret)p[f.key]=credential(id,f.key,p);if(f.required&&!p[f.key])throw Error('请先在设置中填写'+provider.name+'的'+f.label)}
  const cacheKey=JSON.stringify([id,p,text]);if(cache.has(cacheKey))return {...cache.get(cacheKey),cached:true};let result;
  if(id==='google'&&googleTranslation)result=await googleTranslation(text);
  else{const req=sharedTranslation.buildRequest(id,text,p,Date.now(),crypto.randomUUID());
   const headers=Object.fromEntries(Object.entries(req.headers||{}).filter(([k])=>!['host','origin','referer','user-agent','content-length'].includes(k.toLowerCase())));
   result=sharedTranslation.readResult(id,checkStatus(await request(req.url,{...req,headers})));}
  if(typeof result!=='string'||!result.trim()||result.length>10000)throw Error('翻译接口未返回有效 translation');const value={translation:result.trim(),engine:id,route:id==='google'&&googleTranslation?'Google 翻译中转':'浏览器直连'};cache.set(cacheKey,value);if(cache.size>100)cache.delete(cache.keys().next().value);return value;
 },async pronounce({text,accent='en-US',engine:override}){text=typeof text==='string'?text.trim():'';if(!text||text.length>200||!/[a-z]/i.test(text))throw Error('发音支持 1–200 个字符的英文单词或短语');if(!['en-US','en-GB'].includes(accent))throw Error('请选择美式或英式发音');const engine=override||config().pronunciation;if(!['google','youdao'].includes(engine))throw Error('发音来源无效');if(engine==='google'&&relay?.config().endpoint)return {base64:await relay.synthesize(text,accent,'google'),mime:'audio/mpeg',source:'Google 在线发音 · 语音服务'};const u=new URL(engine==='youdao'?'https://dict.youdao.com/dictvoice':'https://translate.google.com/translate_tts');const params=engine==='youdao'?{audio:text,type:accent==='en-GB'?'1':'2'}:{ie:'UTF-8',client:'tw-ob',tl:accent,q:text};for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);return {url:u.href,mime:'audio/mpeg',source:engine==='youdao'?'有道在线发音':'Google 在线发音'}}};
 return {research,translation,secret};
};
