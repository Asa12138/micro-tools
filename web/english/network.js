const {Bytes}=require('./platform');
async function request(url,{maxBytes=2*1024*1024,timeoutMs=20000,headers={},method='GET',body,signal}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 try{
  const response=await fetch(url,{method,headers,body,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store'});
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error('响应超过允许大小');
  const reader=response.body?.getReader();let data;
  if(reader){const chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw Error('响应超过允许大小')}chunks.push(value)}data=Bytes.concat(chunks)}else{data=Bytes.from(await response.arrayBuffer());if(data.length>maxBytes)throw Error('响应超过允许大小')}
  return {status:response.status,body:data.toString(),bytes:data,route:'浏览器直连'};
 }catch(error){if(controller.signal.aborted)throw Error(signal?.aborted?'已取消请求':'请求超时，请稍后重试');if(error instanceof TypeError)throw Error('浏览器无法连接接口：请检查网络及 CORS 跨域许可，或配置你自己的 HTTPS 中转接口');throw error}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
async function catalogRequest(url,options){const catalog=require('../../features/english/english-catalog');url=catalog.publicURL(url);const officialBase=new URL('./',catalog.DEFAULT_URL).href;const target=url==='https://asa-english-community.netlify.app/config.json'?'web/english/community-config.json':url.startsWith(officialBase)?'materials/'+url.slice(officialBase.length):url;const r=await request(target,options);if(r.status!==200)throw Error('素材服务返回 HTTP '+r.status);return r.bytes}
function endpoint(value){let u;try{u=new URL(value)}catch{throw Error('请输入完整 HTTPS 接口地址')};if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('接口地址必须为无账号密码的 HTTPS 地址');if([...u.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k)))throw Error('请把密钥填写在专用密钥字段，不要写在 URL 中');return u.href}
module.exports={request,catalogRequest,endpoint};
