// Resume-safe official Andrew audio build. Only the checked-in teaching sentences are sent.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const speech=require('../features/english/english-speech');
const site=process.argv[2];
if(!site||!path.isAbsolute(site))throw Error('请传入 research-english 素材网站目录的绝对路径');
const dir=path.resolve(__dirname,'../../reports/english-official-audio');fs.mkdirSync(dir,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const catalog=JSON.parse(fs.readFileSync(site+'/catalog.json'));
const groups=[{id:'starter',sentences:require('../assets/data/english-seed.json').flatMap(x=>x.sentences)},...catalog.courses.map(c=>({id:c.id,sentences:JSON.parse(fs.readFileSync(path.join(site,c.url))).sentences}))];
const unique=[...new Set(groups.flatMap(g=>g.sentences.map(s=>s.en)))];
console.log(JSON.stringify({sentences:groups.reduce((n,g)=>n+g.sentences.length,0),unique:unique.length,characters:unique.join('').length}));
(async()=>{let cursor=0,done=0;async function worker(){while(cursor<unique.length){const en=unique[cursor++],target=path.join(dir,hash(en)+'.mp3');if(!fs.existsSync(target)){const b64=await speech(en,'andrew');fs.writeFileSync(target,Buffer.from(b64,'base64'));}if(++done%20===0)console.log(done+'/'+unique.length)}}await Promise.all([worker(),worker()]);
 for(const g of groups){const entries={};for(const s of g.sentences){const data=fs.readFileSync(path.join(dir,hash(s.en)+'.mp3'));entries[hash(s.en)]={text:s.en,sha256:hash(data),data:data.toString('base64')}}const output=Buffer.from(JSON.stringify({version:1,voice:'andrew',entries}));
  if(g.id==='starter')fs.writeFileSync(path.resolve(__dirname,'../assets/audio/english-starter-audio.json'),output);
  else {fs.mkdirSync(site+'/v1/audio',{recursive:true});const filename='v1/audio/'+g.id+'-andrew.json';fs.writeFileSync(site+'/'+filename,output);const c=catalog.courses.find(c=>c.id===g.id);c.audio={voice:'andrew',url:filename,sha256:hash(output),bytes:output.length,count:g.sentences.length};}
 }
 fs.writeFileSync(site+'/catalog.json',JSON.stringify(catalog,null,2)+'\n');
 const bundled=require('../assets/data/english-catalog-default.json');for(const c of bundled.courses)c.audio=catalog.courses.find(x=>x.id===c.id).audio;fs.writeFileSync(path.resolve(__dirname,'../assets/data/english-catalog-default.json'),JSON.stringify(bundled,null,2)+'\n');
 console.log('DONE: 24 bundled + 240 downloadable Andrew sentences');process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
