// Run from any directory: node english-materials/build-catalog.cjs
// Validates original teaching packs, builds download catalogs and one import backup.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const C=require('../../features/english/english-core'),root=process.argv[2]?path.resolve(process.argv[2]):__dirname,version='v1',base=path.join(root,version);
const names=['research-communication','bioinformatics-reproducibility','microbiome-environment','reading-discussion'];
const seen=new Map(),lessons=[],entries=[],stats=[];
const previous=fs.existsSync(path.join(root,'catalog.json'))?JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8')):{};
const bundled=require('../../assets/data/english-catalog-default.json');
const contentId=raw=>'english-'+crypto.createHash('sha256').update(JSON.stringify(C.clean(raw))).digest('hex').slice(0,24);
// Vocabulary uses dictionary headwords; accept their plural form in the sentence.
const vocabularyPresent=(sentence,term)=>{
 const text=sentence.toLowerCase(),word=term.toLowerCase(),forms=[word];
 if(/[^aeiou]y$/.test(word))forms.push(word.slice(0,-1)+'ies');
 if(/is$/.test(word))forms.push(word.slice(0,-2)+'es');
 return forms.some(form=>text.includes(form));
};
for(const id of names){
 const rel='courses/'+id+'.json',bytes=fs.readFileSync(path.join(base,rel)),raw=JSON.parse(bytes),lesson=C.exportCourse(raw);
 assert.deepEqual(raw,lesson,'Course source must use the canonical material format');
 C.validateTeaching(lesson,{requireChunks:true});assert.equal(lesson.sentences.length,60,id);assert.equal(lesson.source.kind,'original');
 const wordCounts=[];
 for(const [i,s]of lesson.sentences.entries()){
  const name=id+':'+(i+1),key=C.words(s.en).map(C.norm).join(' ');assert.ok(!seen.has(key),'Duplicate '+name+' and '+seen.get(key));seen.set(key,name);
  assert.ok(s.zh&&s.note&&s.question,name+' teaching fields');assert.equal(s.quote,'',name+' original course must not claim a quoted source');
  assert.ok(s.vocabulary.length>=1&&s.vocabulary.length<=2,name+' vocabulary');assert.ok(s.chunks.length>=2,name+' meaningful chunks');
  for(const v of s.vocabulary){assert.ok(v.meaning,name+' meaning');assert.ok(vocabularyPresent(s.en,v.term),name+' vocabulary not present: '+v.term);assert.ok(!/[A-Za-z]{20}/.test(v.ipa),name+' invalid IPA field')}
  wordCounts.push(C.words(s.en).length);
 }
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');const prior=previous.courses?.find(x=>x.id===id)||{},stable=bundled.courses.find(x=>x.id===id),sentenceHash=crypto.createHash('sha256').update(JSON.stringify(lesson.sentences)).digest('hex'),priorIdentity=prior.lessonId?prior:stable;entries.push({id,title:lesson.title,...C.materialMetadata(lesson),count:lesson.sentences.length,url:rel,sha256,lessonId:priorIdentity&&(!priorIdentity.sentenceHash||priorIdentity.sentenceHash===sentenceHash)?priorIdentity.lessonId:contentId(lesson),contentId:contentId(lesson),sentenceHash,...(prior.audio?{audio:{...prior.audio,url:prior.audio.url.startsWith(version+'/')?prior.audio.url.slice(version.length+1):prior.audio.url}}:{})});lessons.push(lesson);stats.push({id,title:lesson.title,sentences:60,minWords:Math.min(...wordCounts),maxWords:Math.max(...wordCounts),bytes:bytes.length,sha256});
}
const write=(name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
// Preserve independently maintained wordbook packs when rebuilding sentence catalogs.
const wordbookDir=path.join(base,'wordbooks');if(fs.existsSync(wordbookDir)){const {cleanRows,signature}=require('../../features/english/english-wordbooks'),wordbooks=new Map((previous.wordbooks||[]).map(w=>[w.id,w]));for(const name of fs.readdirSync(wordbookDir).filter(n=>n.endsWith('.json'))){const bytes=fs.readFileSync(path.join(wordbookDir,name)),raw=JSON.parse(bytes);assert.equal(raw.format,'research-english-wordbook-v1');const id=path.basename(name,'.json');assert.match(id,/^[A-Za-z0-9_-]+$/);assert.deepEqual(raw,C.exportWordbook(raw),'Wordbook source must use the canonical material format');const {words,duplicates}=cleanRows(raw.words.map(w=>[w.term,w.meaning,w.usphone,w.ukphone]));assert.equal(duplicates,0);wordbooks.set(id,{id,title:raw.title,...C.materialMetadata(raw),count:words.length,url:version+'/wordbooks/'+name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),contentHash:signature(words)})}previous.wordbooks=[...wordbooks.values()]}
write('v1/catalog.json',{version:1,courses:entries,...(previous.wordbooks?{wordbooks:previous.wordbooks.map(w=>({...w,url:w.url.startsWith(version+'/')?w.url.slice(version.length+1):w.url}))}:{})});write('catalog.json',{...previous,version:1,courses:entries.map(e=>({...e,url:version+'/'+e.url,...(e.audio?{audio:{...e.audio,url:version+'/'+e.audio.url}}:{})}))});
write('research-english-240-import.json',{format:'research-english-backup-v1',exportedAt:'2026-10-24T00:00:00.000Z',lessons,progress:{}});
const report={edition:'2026-10 v1',origin:'original AI-assisted teaching content, not article quotations',courses:lessons.length,sentences:seen.size,uniqueSentences:seen.size,bytes:stats.reduce((n,s)=>n+s.bytes,0),minWords:Math.min(...stats.map(s=>s.minWords)),maxWords:Math.max(...stats.map(s=>s.maxWords)),checks:['EnglishCore.clean','EnglishCore.validateTeaching(requireChunks:true)','60 sentences per course','global unique English sentences','Chinese, grammar note, oral question and vocabulary supplied','vocabulary headword or its plural occurs in its sentence','original content has no fabricated quotation','SHA256 for each course'],coursesDetail:stats};write('validation.json',report);
console.log(JSON.stringify({courses:report.courses,sentences:report.sentences,bytes:report.bytes,wordRange:[report.minWords,report.maxWords]}));

const preview=['# 科研英语 · 4 包 240 句预览','', '原创教学表达；第一人称内容请按真实项目使用。完整语法块、音标和词汇在课程 JSON 中。',''];
for(const lesson of lessons){preview.push('## '+lesson.title,'',lesson.description,'');lesson.sentences.forEach((s,i)=>preview.push('### '+(i+1)+'. '+s.en,'',s.zh,'','表达：'+s.note,'','口语追问：'+s.question,''))}
fs.writeFileSync(path.join(root,'PREVIEW.md'),preview.join('\n'));
