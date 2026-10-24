const assert=require('assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const createAudio=require('../features/english/english-prepared-audio'),create=require('../features/english/english-service'),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prepared-audio-test-'));try{
 const seed=require('../assets/data/english-seed.json').flatMap(c=>c.sentences),audio=createAudio({directory:dir});assert.equal(audio.available(seed.map(s=>s.en)).length,24);assert.equal(audio.available(seed.map(s=>s.en),'ava').length,0);
 const text='This sentence tests an offline course download.',pcm=Buffer.from(audio.get(seed[0].en),'base64'),raw={version:1,voice:'andrew',entries:{[hash(text)]:{text,data:pcm.toString('base64'),sha256:hash(pcm)}}};
 const lesson={title:'Test with audio',sentences:[{en:text}]},bytes=Buffer.from(JSON.stringify(lesson)),ab=Buffer.from(JSON.stringify(raw));const base='https://example.com/catalog.json',entry={id:'test',title:lesson.title,count:1,url:'course.json',sha256:hash(bytes),audio:{voice:'andrew',url:'audio.json',sha256:hash(ab),bytes:ab.length,count:1}};
 const values={},storage={getItem:k=>values[k],setItem:(k,v)=>values[k]=v};let calls=0,invalid=false;
 const request=async url=>{calls++;if(url.endsWith('catalog.json'))return JSON.stringify({version:1,courses:[entry]});if(url.endsWith('course.json'))return bytes;if(url.endsWith('audio.json'))return invalid?Buffer.from('bad'):ab;throw Error('unexpected URL')};
 let api=create(storage,{audio,catalogRequest:request});api.catalogSettings({url:base});await api.catalogList({refresh:true});invalid=true;await assert.rejects(api.catalogDownload({id:'remote:test'}),/音频校验/);assert.equal(api.list().length,4);invalid=false;
 const saved=await api.catalogDownload({id:'remote:test'});assert.equal(api.preparedAudio(text),pcm.toString('base64'));assert.equal((await api.catalogList()).courses[0].audioReady,true);
 api.saveProgress(saved.id,{seconds:25,index:0,results:{0:{notes:'retain'}}});const before=calls;
 api=create(storage,{audio:createAudio({directory:dir}),catalogRequest:()=>{throw Error('offline')}});assert.equal(api.preparedAudio(text),pcm.toString('base64'));assert.equal((await api.catalogList()).courses[0].audioReady,true);assert.equal(api.progress(saved.id).seconds,25);assert.equal(calls,before);
 assert.throws(()=>createAudio.validate({...raw,entries:{[hash(text)]:{...raw.entries[hash(text)],sha256:'0'.repeat(64)}}}),/校验/);
 assert.throws(()=>createAudio.validate(raw,[{en:'Different.'}]),/不一致/);
 assert.equal((await create(storage,{catalogRequest:request}).importURL('https://example.com/course.json')).title,lesson.title);await assert.rejects(api.importURL('https://127.0.0.1/private'),/公开/);
 console.log('PASS: 24 bundled clips, atomic course/audio download, checksums, disk reopen without network, voice isolation, preserved progress, validated URL import.');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
