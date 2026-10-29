// Fixed Google relay; no API keys, provider credentials or arbitrary upstream URLs.
module.exports=function createPublicTranslation({endpoint,fetchImpl=(...args)=>fetch(...args),now=()=>Date.now()}){
 const address=new URL(endpoint);
 if(address.protocol!=='https:'&&!(address.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(address.hostname))||address.username||address.password||address.search||address.hash)throw Error('翻译中转需为 HTTPS 地址；本机开发可使用 loopback HTTP。');
 const jobs=new Map();let blockedUntil=0,lastError;
 return async function translate(text){
  if(typeof text!=='string'||!text.trim()||text.length>500)throw Error('请选择 1–500 字符');text=text.trim();
  if(now()<blockedUntil)throw lastError;
  if(jobs.has(text))return jobs.get(text);
  if(jobs.size>=2)throw Error('翻译正在准备，请稍后再试。');
  const job=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   try{
    const response=await fetchImpl(address.href,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,source:'en',target:'zh-CN'}),signal:controller.signal});
    if(!response.ok){let detail;try{detail=(await response.json()).error}catch{}
     const error=Error(detail?.message||(response.status===404?'翻译中转尚未部署，请联系部署者更新服务。':'翻译中转返回 HTTP '+response.status));error.code=detail?.code||'http_'+response.status;
     if([429,503].includes(response.status)){const seconds=Number(response.headers.get('Retry-After'));blockedUntil=now()+Math.min(86400,Math.max(5,Number.isFinite(seconds)&&seconds>0?seconds:60))*1000;lastError=error}throw error;
    }
    if(!/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('翻译中转未返回有效 JSON。');
    const reader=response.body.getReader(),chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error('翻译响应超过大小限制。')}chunks.push(value)}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    const result=JSON.parse(new TextDecoder().decode(bytes));if(typeof result.translation!=='string'||!result.translation.trim()||result.translation.length>10000)throw Error('翻译中转未返回有效译文。');
    return result.translation.trim();
   }catch(error){if(error.name==='AbortError')throw Error('翻译中转响应超时，请稍后重试。');if(error instanceof TypeError)throw Error('无法连接翻译中转，请检查网络以及服务允许的网站来源。');throw error}finally{clearTimeout(timer)}
  })();jobs.set(text,job);try{return await job}finally{jobs.delete(text)}
 };
};
