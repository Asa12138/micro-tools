const {cryptoAdapter}=require('./platform');
const {request}=require('./network');
const hash=text=>cryptoAdapter.createHash('sha256').update(text).digest('hex');
module.exports=async function preparedAudio(){
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('research-english-web-audio',1);q.onupgradeneeded=()=>q.result.createObjectStore('audio');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
 let starter=null,available=new Set();
 await new Promise((resolve,reject)=>{const tx=db.transaction('audio'),q=tx.objectStore('audio').openKeyCursor();q.onsuccess=()=>{const c=q.result;if(c){available.add(c.key);c.continue()}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 async function install(raw,sentences){require('../../features/english/english-prepared-audio').validate(raw,sentences);await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');for(const [id,e]of Object.entries(raw.entries))tx.objectStore('audio').put(e.data,id);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('配套音频保存失败，请检查浏览器存储空间'))});for(const id of Object.keys(raw.entries))available.add(id)}
 async function loadStarter(){if(!starter)starter=(async()=>{const r=await request('assets/audio/english-starter-audio.json',{maxBytes:2*1024*1024});if(r.status!==200)throw Error('内置音频读取失败，请刷新页面重试');await install(JSON.parse(r.body))})().catch(e=>{starter=null;throw e});return starter}
 return {install,has:(text,voice='andrew')=>voice==='andrew'&&available.has(hash(text)),async get(text,voice='andrew'){if(voice!=='andrew')return null;if(!available.has(hash(text)))await loadStarter();return new Promise((resolve,reject)=>{const q=db.transaction('audio').objectStore('audio').get(hash(text));q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})},async available(texts,voice='andrew'){if(voice!=='andrew')return [];try{await loadStarter()}catch{}return texts.filter(t=>available.has(hash(t)))}};
};
