// Manual import warnings and sentence selection, with isolated local storage only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const C=require('../features/english/english-core'),create=require('../features/english/english-service'),root=path.resolve(__dirname,'..');
const wait=()=>new Promise(r=>setTimeout(r,35));let w;
(async()=>{
 const source={title:'Manual review fixture',description:'练习土壤研究中的常见比较与结果描述。',domain:'methods',level:'★★★',sentences:[
  {en:'We compare soil communities across the selected sampling sites.',chunks:[{en:'We compare soil communities'},{en:'across the selected sampling sites.'}]},
  {en:'We compare soil communities across the selected sampling sites.',chunks:[{en:'We compare soil communities across the selected sampling'},{en:'sites.'}]},
  {en:'We compared RNAs across the selected sampling sites.',chunks:[{en:'We compared RNAs'},{en:'across the selected sampling sites.'}]},
  {en:'The report mentions osmB in this paragraph.',chunks:[{en:'The report mentions osmB'},{en:'in this paragraph.'}]}
 ]};source.sentences.forEach(s=>s.quote=s.en);
 const report=C.teachingIssues(C.clean(source),{requireChunks:true,learningReady:true});assert(report.some(x=>x.sentenceIndex===1&&x.code==='chunk-length'));assert(!report.some(x=>x.sentenceIndex===2));assert.deepEqual(report.find(x=>x.code==='identifier').tokens,['osmB']);
 for(const term of ['DNA','DNAs','RNA','RNAs','mRNA','mRNAs','PCRs'])assert(!C.teachingIssues({description:source.description,title:'x',sentences:[{en:'We compare '+term+' across sites.'}]},{learningReady:true}).some(x=>x.code==='identifier'));
 const db=new Map(),api=create({getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,structuredClone(v))});api.settings({voice:'system',autoPlay:false,preload:false});
 const text=source.sentences.map(s=>s.en).join('\n'),prepared=await api.prepare({text,count:4,title:source.title});
 assert.throws(()=>api.validateSession({session_id:prepared.session_id,lesson:source}),e=>e.code==='ENGLISH_TEACHING');
 assert.doesNotThrow(()=>api.validateSession({session_id:prepared.session_id,lesson:source,teaching:'review'}));
 assert.throws(()=>api.tools.save_english_lesson({session_id:prepared.session_id,lesson:source,teaching:'review',save:true}),e=>e.code==='ENGLISH_TEACHING','MCP stays strict');
 assert.throws(()=>api.validateSession({session_id:prepared.session_id,lesson:{...source,sentences:source.sentences.slice(0,3)},teaching:'review'}),/句数/);
 assert.throws(()=>api.validateSession({session_id:prepared.session_id,lesson:{...source,sentences:source.sentences.map((s,i)=>i? s:{...s,quote:'This quote is not present.'})},teaching:'review'}),/原文依据未匹配/);
 assert.throws(()=>C.readCourse({...source,source:{url:'javascript:alert(1)'}}),/HTTPS/);
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});w=dom.window;const $=id=>w.document.getElementById(id),errors=[];w.englishApi=api;w.ResearchCore={jsonResult:JSON.parse};w.addEventListener('error',e=>errors.push(e.message));w.HTMLMediaElement.prototype.pause=function(){};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.LessonAudioCache=class{set(){}prioritize(){}async get(){throw Error('fixture')}};
 for(const f of ['english-core.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
 await w.EnglishUI.onView('english');$('enCreateTab').click();$('enTitle').value=source.title;$('enMaterial').value=text;$('enCount').value='4';$('enAgentJson').value=JSON.stringify(source);await $('enImportAgent').onclick();
 assert(!$('enDraft').hidden);assert(!$('enReviewSummary').hidden);assert.equal($('enPreview').querySelectorAll('input[type=checkbox]').length,4);assert.match($('enReviewStatus').textContent,/2 句有警告.*保留 4 句/);assert(!$('enSave').disabled);
 $('enExcludeWarnings').click();assert.equal(JSON.parse($('enDraftJson').value).sentences.length,2);assert.match($('enReviewStatus').textContent,/保留 2 句/);assert.equal(JSON.parse($('enAgentJson').value).sentences.length,4,'original model JSON stays intact');
 $('enRestoreSentences').click();assert.equal(JSON.parse($('enDraftJson').value).sentences.length,4);
 const toggle=i=>$('enPreview').querySelector('[data-review-index="'+i+'"]').click();for(let i=0;i<4;i++)toggle(i);assert($('enSave').disabled);assert.match($('enReviewStatus').textContent,/至少保留一句/);
 $('enRestoreSentences').click();toggle(1);toggle(3);assert.equal(JSON.parse($('enDraftJson').value).sentences.length,2);await $('enValidate').onclick();assert(!$('enDraft').hidden);assert.match($('enNotice').textContent,/校验通过/);assert.equal($('enPreview').querySelectorAll('input[type=checkbox]').length,2);
 await $('enSave').onclick();const saved=api.list().find(c=>c.title===source.title);assert(saved);assert.equal(api.get(saved.id).sentences.length,2);assert(api.get(saved.id).sentences.some(s=>s.en.includes('RNAs')));
 // Keeping a flagged identifier is also a valid explicit choice on manual import.
 $('enCreateTab').click();$('enTitle').value=source.title+' kept';$('enMaterial').value=text;$('enCount').value='4';$('enAgentJson').value=JSON.stringify(source);await $('enImportAgent').onclick();await $('enSave').onclick();assert.equal(api.list().find(c=>c.title===source.title+' kept').count,4);
 // No source means no evidence claim; lexical advice still remains available.
 $('enCreateTab').click();$('enAgentJson').value=JSON.stringify(source);await $('enImportAgent').onclick();assert.match($('enNotice').textContent,/未提供原文/);assert(!$('enSave').disabled);
 assert.deepEqual(errors,[]);w.close();console.log('PASS manual teaching warnings, acronym plurals, strict evidence/count/security, MCP strictness, selection/remove-all/restore, save subset and keep flagged sentences.');
})().catch(e=>{w?.close();console.error(e);process.exitCode=1});
