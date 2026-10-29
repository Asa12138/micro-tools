// Optional user-configured HTTPS audio relay. Secrets remain in this tab only.
const {Bytes}=require('./platform');
module.exports=function createRelay(storage){
 const key='web-speech-relay',secretKey='research-english-web-secret:speech-relay';
 function config(patch){
  let value=storage.getItem(key)||{endpoint:''};
  if(patch){
   let endpoint=String(patch.endpoint||'').trim();
   if(endpoint){const u=new URL(endpoint,location.href),local=['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.origin===location.origin;
    if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local)||u.username||u.password||u.search||u.hash)throw Error('语音服务需为 HTTPS 地址；本机预览可使用同源 HTTP。');endpoint=u.href;}
   if(endpoint!==value.endpoint)sessionStorage.removeItem(secretKey);
   if(patch.token!==undefined){const token=String(patch.token).trim();if(token.length>512||/[\r\n]/.test(token))throw Error('访问口令格式无效');if(token)sessionStorage.setItem(secretKey,token);else sessionStorage.removeItem(secretKey);}
   value={endpoint};storage.setItem(key,value);
  }
  return {...value,hasToken:!!sessionStorage.getItem(secretKey)};
 }
 async function synthesize(text,voice='andrew',engine='microsoft'){
  const endpoint=config().endpoint;if(!endpoint)throw Error('请先配置语音服务地址。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
  try{const token=sessionStorage.getItem(secretKey),r=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({text,voice,engine}),signal:controller.signal});
   if(!r.ok){let message;try{message=(await r.json()).error}catch{}throw Error(message||'语音服务返回 HTTP '+r.status);}
   if(!/^audio\/mpeg(?:;|$)/i.test(r.headers.get('content-type')||''))throw Error('语音服务未返回 MP3 音频。');
   const reader=r.body.getReader(),chunks=[];let size=0;
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('语音响应超过大小限制。');}chunks.push(value);}
   const bytes=Bytes.concat(chunks);if(size<100||!(bytes[0]===73&&bytes[1]===68&&bytes[2]===51||bytes[0]===255&&(bytes[1]&224)===224))throw Error('语音服务返回的音频无效。');return bytes.toString('base64');
  }catch(e){if(e.name==='AbortError')throw Error('语音服务超时，请稍后重试。');if(e instanceof TypeError)throw Error('无法连接语音服务，请检查地址、网络及服务的跨域设置。');throw e;}finally{clearTimeout(timer);}
 }
 return {config,synthesize};
};
