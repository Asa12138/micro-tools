// Edge direct access first; the public gateway never receives a shared secret.
const {voices}=require('../../features/english/english-core');
const {Bytes}=require('./platform');
const ENDPOINT='https://asa-voice-lab-beta.vercel.app/api/public/speech';
module.exports=function createSpeechRouter({direct,relay,fetchImpl=(...args)=>fetch(...args),onStatus=()=>{},now=()=>Date.now(),endpoint=ENDPOINT}){
 const jobs=new Map();let blockedUntil=0,lastError;
 async function publicSpeech(text,voice,fresh=false){
  if(now()<blockedUntil)throw lastError;
  const key=(fresh?'probe:':'')+voice+'|'+text;if(jobs.has(key))return jobs.get(key);
  const job=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);
   try{
    const response=await fetchImpl(endpoint,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:voices[voice].id,speed:1,...(fresh?{fresh:true}:{})}),signal:controller.signal});
    if(!response.ok){
     let detail;try{detail=(await response.json()).error}catch{}
     const error=Error(detail?.message||'公共语音服务返回 HTTP '+response.status);error.code=detail?.code||'http_'+response.status;
     if([429,503].includes(response.status)){const seconds=Number(response.headers.get('Retry-After'));blockedUntil=now()+Math.min(86400,Math.max(60,Number.isFinite(seconds)?seconds:60))*1000;lastError=error;}
     throw error;
    }
    if(!/^audio\/mpeg(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('公共语音服务未返回 MP3 音频。');
    const reader=response.body.getReader(),chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000){await reader.cancel();throw Error('语音响应超过大小限制。')}chunks.push(value)}
    const bytes=Bytes.concat(chunks);
    if(size<100||!(bytes[0]===73&&bytes[1]===68&&bytes[2]===51||bytes[0]===255&&(bytes[1]&224)===224))throw Error('公共语音服务返回的音频无效。');
    const remaining=response.headers.get('X-Quota-Remaining'),limit=response.headers.get('X-Quota-Limit');
    onStatus({source:'public',message:'已使用公共语音'+(remaining!==null&&limit!==null?' · 当前 IP 今日剩余 '+remaining+' / '+limit+' 次':'')+' · 北京时间零点重置'});
    return bytes.toString('base64');
   }catch(error){
    if(error.name==='AbortError')error=Error('公共语音服务响应超时，请稍后重试。');
    else if(error instanceof TypeError)error=Error('无法连接公共语音服务，请检查网络或稍后重试。');
    onStatus({source:'error',message:error.message});throw error;
   }finally{clearTimeout(timer)}
  })();jobs.set(key,job);try{return await job}finally{jobs.delete(key)}
 }
 const speech=async(text,voice='andrew',{background=false,fresh=false}={})=>{
  if(typeof text!=='string'||!text.trim()||text.length>1000)throw Error('语音句子需为 1–1000 字符');
  if(!Object.hasOwn(voices,voice))throw Error('不支持的微软语音');
  if(direct.capabilities().direct){try{const value=await direct(text,voice,{fresh});if(!background)onStatus({source:'direct',message:'已使用 Edge 直连 · 不占公共语音额度'});return value}catch{/* The direct transport applies its own failure cooldown. */}}
  if(relay?.config().endpoint){const value=await relay.synthesize(text,voice);if(!background)onStatus({source:'custom',message:'已连接自定义语音服务'});return value}
  if(background){const error=Error('公共语音在播放时生成，生成后保存在当前浏览器，重复播放不消耗额度；不提前生成整课音频。');error.code='foreground_required';throw error}
  return publicSpeech(text,voice,fresh);
 };
 speech.capabilities=()=>({...direct.capabilities(),available:true,publicRelay:true,message:''});
 return speech;
};
