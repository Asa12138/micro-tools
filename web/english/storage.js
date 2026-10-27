/* Serialize read-modify-write operations and commit each API mutation atomically. */
const NAME='research-english-web-v1';
const clone=value=>value==null?value:structuredClone(value);
function open(){return new Promise((resolve,reject)=>{const q=indexedDB.open(NAME,1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>{q.result.onversionchange=()=>q.result.close();resolve(q.result)};q.onerror=()=>reject(Error('无法打开浏览器数据库，请退出隐私模式或允许此网站存储数据'));q.onblocked=()=>reject(Error('数据库升级被旧标签页阻止，请关闭其他科研英语页面后重试'))})}
module.exports=async function createStorage(){
 if(!navigator.locks)throw Error('当前浏览器缺少 Web Locks，请更新至近期 Chrome、Edge、Firefox 或 Safari 后使用');
 const database=await open();let values=new Map(),changed=new Map(),queue=Promise.resolve();
 const storage={getItem:key=>clone(values.get(key)),setItem(key,value){values.set(key,clone(value));changed.set(key,clone(value))}};
 async function read(){values=await new Promise((resolve,reject)=>{const map=new Map(),tx=database.transaction('kv'),q=tx.objectStore('kv').openCursor();q.onsuccess=()=>{const c=q.result;if(c){map.set(c.key,c.value);c.continue()}};tx.oncomplete=()=>resolve(map);tx.onerror=()=>reject(tx.error)});changed=new Map()}
 async function commit(){if(!changed.size)return;await new Promise((resolve,reject)=>{const tx=database.transaction('kv','readwrite'),store=tx.objectStore('kv');for(const [key,value]of changed)store.put(value,key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('保存失败：浏览器存储空间不足或访问被阻止；本次改动未写入，请先导出备份'))});changed.clear()}
 function run(operation){const work=queue.then(()=>navigator.locks.request(NAME,async()=>{await read();try{const result=await operation();await commit();return clone(result)}catch(error){await read();throw error}}));queue=work.catch(()=>{});return work}
 await run(()=>{});
 return {storage,run,export:()=>run(()=>Object.fromEntries([...values].filter(([key])=>!key.startsWith('web-ai')&&!key.startsWith('web-translation')&&!key.includes('cache')&&!key.includes('community')))),restore:input=>run(()=>{for(const [key,value]of Object.entries(input))storage.setItem(key,value)}),snapshot:()=>new Map(values),close:()=>database.close()};
};
