// Fixed-provider audio service; no arbitrary upstream URLs or SSML accepted.
const speech=require('../features/english/english-speech');
const network=require('../features/english/english-network');
const {voices}=require('../features/english/english-core');
const {timingSafeEqual}=require('node:crypto');
const mp3=b=>Buffer.isBuffer(b)&&b.length>100&&b.length<=2000000&&(b.subarray(0,3).toString()==='ID3'||b[0]===255&&(b[1]&224)===224);
async function generate({text,voice,engine}){
 if(engine==='microsoft')return Buffer.from(await speech(text,voice),'base64');
 const u=new URL('https://translate.google.com/translate_tts');u.search=new URLSearchParams({ie:'UTF-8',client:'tw-ob',tl:voice,q:text});
 const r=await network.request({url:u.href,method:'GET',binary:true},{mode:'auto'});
 if(r.status!==200||!/^audio\//i.test(r.contentType)||!mp3(r.body))throw Error('Google 未返回有效音频，请稍后重试或使用微软语音。');return r.body;
}
module.exports=function createHandler({origins=[],token='',synthesize=generate}={}){
 const allowed=new Set(origins),buckets=new Map();let active=0;
 return async function handle(request,ip='local'){
  const origin=request.headers.get('origin'),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const reply=(status,error)=>Response.json({error},{status,headers});
  if(!allowed.has(origin))return reply(403,'此网页未获准使用语音服务。');
  Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,'仅支持 POST 语音请求。');
  if(token){const expected=Buffer.from('Bearer '+token),actual=Buffer.from(request.headers.get('authorization')||'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply(401,'语音服务访问口令无效。');}
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply(415,'请发送 JSON 请求。');
  let input;try{const reader=request.body?.getReader();if(!reader)return reply(400,'请求不能为空。');const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,'语音请求过大。');}chunks.push(value);}input=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(400,'语音请求格式无效。');}
  const {text,voice='andrew',engine='microsoft'}=input||{};
  if(!['microsoft','google'].includes(engine)||typeof text!=='string'||!text.trim()||text.length>(engine==='google'?200:1000))return reply(400,'语音引擎或句子长度无效。');
  if(typeof voice!=='string'||(engine==='microsoft'?!Object.hasOwn(voices,voice):!['en-US','en-GB'].includes(voice)))return reply(400,'语音音色无效。');
  const now=Date.now();for(const [key,b]of buckets)if(now-b.at>=60000)buckets.delete(key);
  const bucket=buckets.get(ip)||{at:now,count:0};if(bucket.count>=60||active>=4||buckets.size>=10000&&!buckets.has(ip)){headers['Retry-After']='60';return reply(429,'语音请求过于频繁，请一分钟后重试。');}bucket.count++;buckets.set(ip,bucket);active++;
  try{const bytes=await synthesize({text:text.trim(),voice,engine});if(!mp3(bytes))throw Error('语音服务未生成有效 MP3。');return new Response(bytes,{headers:{...headers,'Content-Type':'audio/mpeg','Content-Length':String(bytes.length)}});}
  catch(e){return reply(502,engine==='google'?'Google 语音服务暂不可用，请检查服务端网络或改用微软语音。':'微软语音服务暂不可用，请稍后重试。');}finally{active--;}
 };
};
module.exports.mp3=mp3;
