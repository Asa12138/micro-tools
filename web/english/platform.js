/* Browser primitives for the unchanged CommonJS course/wordbook services. */
const bytes=(value,encoding)=>{
 if(typeof value==='string')return encoding==='base64'?Uint8Array.from(atob(value),c=>c.charCodeAt(0)):new TextEncoder().encode(value);
 return value instanceof ArrayBuffer?new Uint8Array(value):new Uint8Array(value);
};
class Bytes extends Uint8Array {
 static alloc(size){return new Bytes(size)}
 static from(value,encoding){return new Bytes(bytes(value,encoding))}
 static isBuffer(value){return value instanceof Bytes}
 static byteLength(value){return bytes(value).byteLength}
 static concat(values){const out=new Bytes(values.reduce((n,v)=>n+v.length,0));let i=0;for(const v of values){out.set(v,i);i+=v.length}return out}
 copy(target,offset=0){target.set(this,offset);return this.length}
 readUIntBE(offset,length){let value=0;for(let i=0;i<length;i++)value=value*256+this[offset+i];return value}
 readUInt32BE(offset){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint32(offset)}
 readUInt32LE(offset){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint32(offset,true)}
 writeUInt32BE(value,offset){new DataView(this.buffer,this.byteOffset,this.byteLength).setUint32(offset,value);return offset+4}
 writeUInt32LE(value,offset){new DataView(this.buffer,this.byteOffset,this.byteLength).setUint32(offset,value,true);return offset+4}
 writeBigUInt64BE(value,offset){new DataView(this.buffer,this.byteOffset,this.byteLength).setBigUint64(offset,value);return offset+8}
 toString(encoding='utf8'){if(encoding==='base64'){let text='';for(let i=0;i<this.length;i+=8192)text+=String.fromCharCode(...this.subarray(i,i+8192));return btoa(text)}if(encoding==='hex')return Array.from(this,b=>b.toString(16).padStart(2,'0')).join('');return new TextDecoder().decode(this)}
}
const cryptoAdapter={randomUUID:()=>crypto.randomUUID(),createHash(name){
 if(name==='md5'){const chunks=[];return {update(value){chunks.push(Bytes.from(value));return this},digest(encoding){const hex=require('./vendor/md5')(Bytes.concat(chunks).toString());return encoding==='hex'?hex:Bytes.from(hex.match(/../g).map(x=>parseInt(x,16)))}}}
 if(name!=='sha256')throw Error('Unsupported hash');const hash=window.EnglishSHA256();return {update(value){hash.update(bytes(value));return this},digest(encoding){return encoding==='hex'?hash.digest('hex'):Bytes.from(hash.digest())}}
},createHmac(name,key){
 if(name!=='sha256')throw Error('Unsupported HMAC');let k=bytes(key);if(k.length>64)k=cryptoAdapter.createHash(name).update(k).digest();
 const inner=Bytes.alloc(64),outer=Bytes.alloc(64);for(let i=0;i<64;i++){inner[i]=(k[i]||0)^0x36;outer[i]=(k[i]||0)^0x5c}
 const hash=cryptoAdapter.createHash(name).update(inner);return {update(value){hash.update(value);return this},digest(encoding){return cryptoAdapter.createHash(name).update(outer).update(hash.digest()).digest(encoding)}};
}};
function normalize(path){const out=[];for(const part of path.split('/')){if(part==='..')out.pop();else if(part&&part!=='.')out.push(part)}return '/'+out.join('/')}
const pathAdapter={join:(...parts)=>normalize(parts.join('/')),isAbsolute:s=>s.startsWith('/'),dirname:s=>s.slice(0,s.lastIndexOf('/'))||'/',extname:s=>s.match(/\.[^./]+$/)?.[0]||''};
const unavailable=()=>{throw Error('网页不能读取本机绝对路径，请使用文件选择按钮')};
const fsAdapter={readFileSync:file=>Bytes.from(JSON.stringify(window.EnglishModules(normalize(file)))),existsSync:()=>false,statSync:unavailable,lstatSync:unavailable};
const netAdapter={isIP(value){if(value.includes(':'))return 6;if(/^\d+\.\d+\.\d+\.\d+$/.test(value)&&value.split('.').every(n=>Number(n)<=255))return 4;return 0},BlockList:class{addSubnet(){}check(value,type){if(type==='ipv6')return true;const [a,b]=value.split('.').map(Number);return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0}}};
module.exports={Bytes,cryptoAdapter,pathAdapter,fsAdapter,netAdapter};
