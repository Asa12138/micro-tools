// Native browser transport for the same Read Aloud protocol used by the desktop.
// Reuses our vendored edge-tts v2 token module; no proxy or prepared audio download.
const token=require('../../vendor/ms-edge-tts/english-speech-token');
const {voices}=require('../../features/english/english-core');
const {Bytes}=require('./platform');
const clientToken='6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const escape=text=>text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const connectionError='微软在线语音连接失败。可自动使用本机英语声音，或在设置选择 Google 兼容发音。';
// Browser WebSocket cannot supply the headers used by the Node transport.
// Current Read Aloud direct access requires Chromium Edge; EdgiOS is WebKit.
function capabilities(ua=globalThis.navigator?.userAgent||''){
 const direct=/\bEdg(?:A)?\//.test(ua)&&!/\b(?:EdgiOS|iPhone|iPad|iPod)\b/.test(ua);
 return {direct,message:direct?'':'当前浏览器无法直连微软在线语音。可用 Edge 在线生成，或播放已有音频、选择本机英语声音。'};
}
function synthesize(text,voice){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID().replaceAll('-',''),url=new URL('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1');
  url.search=new URLSearchParams({TrustedClientToken:clientToken,'Sec-MS-GEC':token(clientToken),'Sec-MS-GEC-Version':'2-143.0.3650.75',ConnectionId:crypto.randomUUID().replaceAll('-','')});
  const ws=new WebSocket(url.href),chunks=[];let size=0,done=false;
  ws.binaryType='arraybuffer';
  const deadline=setTimeout(()=>finish(Error('微软语音生成超时，请重试。')),45000);
  let timer=setTimeout(()=>finish(Error(connectionError)),5000);
  function finish(error){if(done)return;done=true;clearTimeout(timer);clearTimeout(deadline);ws.onopen=ws.onmessage=ws.onerror=ws.onclose=null;ws.close();if(error)reject(error);else resolve(Bytes.concat(chunks).toString('base64'))}
  ws.onopen=()=>{
   clearTimeout(timer);timer=setTimeout(()=>finish(Error('微软语音生成超时，请重试。')),30000);
   const timestamp=new Date().toUTCString();
   try{
    ws.send('X-Timestamp:'+timestamp+'\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'+JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:false,wordBoundaryEnabled:false},outputFormat:'audio-24khz-48kbitrate-mono-mp3'}}}}));
    ws.send('X-RequestId:'+id+'\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:'+timestamp+'\r\nPath:ssml\r\n\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="'+voice.id.slice(0,5)+'"><voice name="'+voice.id+'"><prosody pitch="+0Hz" rate="+0%" volume="+0%">'+escape(text)+'</prosody></voice></speak>');
   }catch{finish(Error(connectionError))}
  };
  ws.onmessage=event=>{
   try{
    if(typeof event.data==='string'){
     const headers=event.data.split('\r\n\r\n',1)[0];
     if(!headers.includes('X-RequestId:'+id))return;
     if(/(?:^|\r\n)Path:turn.end(?:\r\n|$)/.test(headers))finish(size>100?null:Error('微软未返回有效音频，请重试。'));
    }else{
     if(event.data.byteLength<2)throw Error('微软语音数据不完整，请重试。');
     const length=new DataView(event.data).getUint16(0);if(length+2>event.data.byteLength)throw Error('微软语音数据不完整，请重试。');
     const headers=new TextDecoder().decode(new Uint8Array(event.data,2,length));
     if(!headers.includes('X-RequestId:'+id)||!/(?:^|\r\n)Path:audio(?:\r\n|$)/.test(headers))return;
     const chunk=new Uint8Array(event.data,2+length);size+=chunk.length;
     if(size>2000000)throw Error('语音超过大小限制');chunks.push(chunk);
    }
   }catch(error){finish(error)}
  };
  ws.onerror=()=>finish(Error(connectionError));
  ws.onclose=event=>finish(Error(event.code===1008?'微软语音请求受到限制，请稍后重试。':connectionError));
 });
}
const inflight=new Map(),waiting=[];let active=0,unavailableUntil=0;
module.exports=async function speech(text,voice='andrew',{fresh=false}={}){
 if(typeof text!=='string'||!text.trim()||text.length>1000)throw Error('语音句子需为 1–1000 字符');
 if(!Object.hasOwn(voices,voice))throw Error('不支持的微软语音');
 const support=capabilities();if(!support.direct)throw Error(support.message);
 if(!fresh&&Date.now()<unavailableUntil)throw Error(connectionError);const key=voice+'|'+text;if(inflight.has(key))return inflight.get(key);
 const job=(async()=>{if(active>=2)await new Promise(resolve=>waiting.push(resolve));else active++;
  try{if(!fresh&&Date.now()<unavailableUntil)throw Error(connectionError);const data=await synthesize(text,voices[voice]);unavailableUntil=0;return data}catch(e){unavailableUntil=Date.now()+60000;throw e}finally{const next=waiting.shift();if(next)next();else active--}
 })();inflight.set(key,job);try{return await job}finally{inflight.delete(key)}
};
module.exports.capabilities=capabilities;
