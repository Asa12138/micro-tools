// Practice settings, dialog reuse, grading assistance, optional images, and online consent.
// Synthetic local fixtures only; no remote voice or image requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.join(__dirname,'..'),C=require('../features/english/english-core'),create=require('../features/english/english-service'),Cache=require('../features/english/english-audio-loader');
const wait=()=>new Promise(r=>setTimeout(r,30));
(async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,structuredClone(v))},api=create(storage);
 assert.equal(api.settings().allowOnline,true);assert.equal(api.settings().autoPlay,true);
 const plain={title:'Preferences fixture',source:{kind:'user'},sentences:[{en:'We study soil.',zh:'我们研究土壤。',phonetics:[{word:'soil',ipa:'sɔɪl'}],vocabulary:[{term:'soil',ipa:'sɔɪl',meaning:'土壤'}]},{en:'We compare samples.',zh:'我们比较样本。'}]};
 assert(!('image' in C.clean(plain).sentences[0]));
 const course=api.save({...plain,sentences:[{...plain.sentences[0],image:{url:'https://example.org/soil.png',alt:'土壤示意图'}},plain.sentences[1]]});
 for(const url of ['javascript:alert(1)','file:///tmp/a','https://user:pass@example.org/a'])assert.throws(()=>C.clean({...plain,sentences:[{en:'Test.',image:{url}}]}));
 assert.deepEqual(require('../plugin.json').tools.save_english_lesson.inputSchema.properties.lesson,C.schema);
 api.settings({voice:'andrew',autoPlay:false,preload:false,online:{[api.list()[0].id]:false}});
 let requests=0;api.speech=async()=>{requests++;return 'YQ=='};api.preparedAudio=async()=>null;
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),errors=[];
 w.addEventListener('error',e=>errors.push(e.message));w.englishApi=api;w.HTMLMediaElement.prototype.pause=function(){};let plays=0;w.HTMLMediaElement.prototype.play=async function(){plays++};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 const blobs=new Map();w.LessonAudioCache=class extends Cache{constructor(options){super({...options,read:async k=>blobs.get(k),write:async(k,v)=>blobs.set(k,v)})}};
 for(const f of ['english-core.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
 await w.EnglishUI.onView('english');$('enCustomTab').click();await wait();$('enCourses').firstChild.click();await wait();
 const change=(id,value)=>{const el=$(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change'))};
 assert.equal($('enOnlineVoice').checked,true);assert.equal($('enAllowCloud').checked,true,'new custom lessons inherit global on');
 for(const id of ['enCheck','enRetry','enReveal','enHelp']){assert($('enPlayerBar').contains($(id)));assert(!$('enAnswer').closest('.en-stage').contains($(id)))}
 assert($('enAnswer').closest('.en-stage').contains($('enNextPreview')));assert(!$('enPlayerBar').contains($('enNextPreview')));
 const input=$('enAnswer').querySelector('input');input.value='draft';input.dispatchEvent(new w.Event('input'));input.focus();
 $('enQuickSettings').click();assert($('enQuickDialog').open);assert($('enQuickContent').contains($('enPracticeOptions')));assert.equal(w.document.querySelectorAll('#enShowChinese').length,1);
 change('enShowChinese',false);assert($('enChinese').hidden);assert($('enNextPreview').hidden);change('enShowPhonetics',false);change('enToolbarStyle','compact');change('enOnlineVoice',false);assert($('enAllowCloud').disabled);
 $('enQuickClose').click();assert(!$('enQuickDialog').open);assert($('enPracticeOptionsHome').contains($('enPracticeOptions')));assert.equal(input.value,'draft');assert.equal(w.document.activeElement,input);assert($('enPractice').classList.contains('en-toolbar-compact'));await wait();assert.match($('enCheck').getAttribute('aria-label'),/提交整句.*Enter/);assert.match($('enReveal').title,/Alt \+ A/);assert($('enPlay').style.getPropertyValue('--dock-icon').includes('svg'));
 $('enPlay').click();await wait();assert.equal(requests,0);assert.match($('enAudioStatus').textContent,/在线语音已关闭/);
 change('enOnlineVoice',true);$('enPlay').click();await wait();assert.equal(requests,1);change('enOnlineVoice',false);$('enPlay').click();await wait();assert.equal(requests,1,'cached audio still plays with global voice off');assert.match($('enAudioStatus').textContent,/Microsoft/);
 change('enOnlineVoice',true);$('enAllowCloud').checked=false;$('enAllowCloud').dispatchEvent(new w.Event('change'));$('enNext').click();await wait();$('enPlay').click();await wait();assert.equal(requests,1,'per-course opt-out wins over global on');
 $('enPrev').click();await wait();assert($('enSentenceImage').hidden);assert(!$('enSentenceImage').hasAttribute('src'));change('enShowImages',true);assert.equal($('enSentenceImage').getAttribute('src'),'https://example.org/soil.png');change('enShowImages',false);assert(!$('enSentenceImage').hasAttribute('src'));
 // Cached first sentence automatically plays on navigation; disabling prevents subsequent automatic playback.
 change('enAutoPlay',true);const beforeAuto=plays;$('enNext').click();await wait();$('enPrev').click();await wait();assert.equal(plays,beforeAuto+1);assert.equal(create(storage).settings().autoPlay,true);
 change('enAutoPlay',false);const beforeOff=plays;$('enNext').click();await wait();$('enPrev').click();await wait();assert.equal(plays,beforeOff);assert.equal(create(storage).settings().autoPlay,false);
 change('enShowChinese',true);assert(!$('enNextPreview').hidden);$('enFilter').value='favorite';$('enFilter').dispatchEvent(new w.Event('change'));assert($('enNextPreview').hidden);$('enFilter').value='all';$('enFilter').dispatchEvent(new w.Event('change'));
 $('enRetry').click();change('enRevealAfter','3');for(let i=0;i<2;i++){$('enCheck').click();assert($('enAnalysis').hidden)}$('enCheck').click();assert(!$('enAnalysis').hidden);assert.equal($('enAnalysisBody').querySelector('.en-phonetics'),null);assert(!$('enAnalysisBody').textContent.includes('sɔɪl'));
 const inputs=[...$('enAnswer').querySelectorAll('input')];inputs.forEach((n,i)=>{n.value=['We','study','soil'][i];n.dispatchEvent(new w.Event('input'))});$('enCheck').click();await wait();assert.equal(api.progress(course.id).results[0].modes.dictation.corrected,false,'automatic answer counts as assisted');assert($('enCelebration').children.length>0);change('enCelebrate',false);assert.equal($('enCelebration').children.length,0);
 change('enShowPhonetics',true);assert($('enAnalysisBody').querySelector('.en-phonetics'));$('enAnalysisClose').click();
 for(const mode of ['dictation','puzzle','study','speaking']){change('enMode',mode);assert.equal($('enAnswer').style.marginTop,'0px');assert(Number.isFinite(parseFloat($('enAnswer').parentElement.style.marginTop)));assert(parseFloat($('enAnswer').parentElement.style.marginTop)>=0);assert.equal($('enChinese').parentElement.nextElementSibling,$('enAnswer'))}
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Control',ctrlKey:true,bubbles:true}));assert(!$('enShortcutOverlay').hidden);w.dispatchEvent(new w.Event('blur'));assert($('enShortcutOverlay').hidden);change('enShortcutHints',false);w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Meta',metaKey:true,bubbles:true}));assert($('enShortcutOverlay').hidden);
 $('enQuickSettings').click();$('enPracticeBack').click();await wait();assert(!$('enQuickDialog').open);assert($('enPracticeOptionsHome').contains($('enPracticeOptions')));$('enSettingsTab').click();await wait();assert.equal($('enToolbarStyle').value,'compact');assert.equal(create(storage).settings().showPhonetics,true);assert.equal(create(storage).settings().online[course.id],false);assert.equal(create(storage).settings().online[api.list()[0].id],false,'existing per-course opt-outs retained');
 assert.deepEqual(errors,[]);dom.window.close();console.log('PASS preferences: shared quick dialog preserves draft/focus, persisted options, 4-mode clearance, wrong-answer assistance, blind mode, optional images, shortcut cleanup, and global/per-course/cached voice consent.');
})().catch(e=>{console.error(e);process.exitCode=1});
