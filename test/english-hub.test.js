// Navigation, folder compatibility, daily deduplication and independent word practice.
// In-memory fixtures; no network, production data or paid APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const create=require('../features/english/english-service'),C=require('../features/english/english-core'),createActivity=require('../features/english/english-activity');
let testWindow;
const wait=()=>new Promise(r=>setTimeout(r,35)),root=path.join(__dirname,'..');
(async()=>{
 let date=new Date(2026,9,24,12),activity=createActivity({now:()=>date});
 activity('record',{session:'a',totals:{'2026-10-24':65},sentences:{'2026-10-24':['english-starter-methods:0','english-starter-methods:0']}});
 activity('record',{session:'b',totals:{},sentences:{'2026-10-24':['english-starter-methods:0','english-starter-methods:1']}});
 assert.equal(activity().todaySentences,2);assert.equal(activity().todaySeconds,65);
 date=new Date(2026,9,25,12);assert.equal(activity().todaySentences,0);assert.equal(activity().history[0].sentences,2);
 assert.throws(()=>activity('record',{session:'a',totals:{},sentences:{'2026-02-30':['english-starter-methods:0']}}));
 const db=new Map(),storage={getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,structuredClone(v))},api=create(storage);
 api.settings({autoPlay:false,preload:false});let queries=0,translations=0;api.dictionary=async({text})=>{queries++;return {word:text,entries:[]}};api.translate=async()=>{translations++;return {translation:'测试释义',engine:'fixture'}};
 const id=api.list()[0].id;api.saveProgress(id,{seconds:42,results:{0:{favorite:true,notes:'Keep note',modes:{}}}});
 const imported=api.wordbooks('import',{title:'Research fixture',rows:[['cell','细胞'],['soil','土壤'],['plot','图'],['sample','样本']],preview:false});
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),errors=[];
 testWindow=w;w.englishApi=api;w.addEventListener('error',e=>errors.push(e.message));w.HTMLMediaElement.prototype.pause=function(){};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.LessonAudioCache=class{set(){}prioritize(){}async get(){throw Error('no audio')}};
 for(const f of ['english-core.js','english-wordbook-ui.js','english-extras.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
 const clickText=(scope,text)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'button '+text);b.click();return b};
 await w.EnglishUI.onView('english');
 assert.equal(w.document.querySelectorAll('.en-tabs>button').length,5);assert(!$('enHub').querySelector('.en-hub-overview').contains($('enAttendance')));assert($('enPreferences').contains($('enAttendance')));
 $('enActivityDetails').click();await wait();assert(!$('enPreferences').hidden);assert($('enLibrary').hidden);
 $('enCustomTab').click();await wait();w.document.querySelector('#enHubNav [data-pane=mistake]').click();assert.match($('enMistakesTab').textContent,/0 句/);w.document.querySelector('#enHubNav [data-pane=favorite]').click();assert.equal($('enCourses').children.length,1);assert.match($('enFavoritesTab').textContent,/1 句/);
 $('enNewFolder').click();$('enFolderName').value='论文写作';w.document.querySelector('.en-folder-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
 const folder=api.settings().favoriteFolders[0];assert.equal(folder.title,'论文写作');assert.equal($('enCourses').children.length,2);
 $('enFavoritesTab').click();await wait();assert.equal($('enCourseTitle').textContent,'我的收藏');$('enFavoriteFolder').click();clickText(w.document.querySelector('.en-folder-options'),'论文写作');await wait();
 assert.equal(api.progress(id).results[0].favoriteFolder,folder.id);assert.equal(api.progress(id).results[0].notes,'Keep note');
 $('enPracticeBack').click();await wait();assert.match($('enFavoritesTab').textContent,/0 句/);const folderCard=$('enCourses').querySelector('[data-folder-id="'+folder.id+'"]');assert.match(folderCard.textContent,/1 句/);folderCard.click();await wait();assert.equal($('enCourseTitle').textContent,'论文写作');
 // Repeated success on one sentence, including collection routes, counts once per day.
 $('enMode').value='typing';$('enMode').dispatchEvent(new w.Event('change'));const completeSentence=()=>{const words=C.words(api.get(id).sentences[0].en);[...$('enAnswer').querySelectorAll('input')].forEach((input,i)=>{input.value=words[i];input.dispatchEvent(new w.Event('input'))});$('enCheck').click()};completeSentence();await wait();$('enRetry').click();completeSentence();await wait();assert.equal(api.activity().todaySentences,1);
 $('enPracticeBack').click();await wait();assert.equal($('enTodaySentences').textContent,'1 句');
 // Folder assignment survives restart, clean, merge, and a real UI backup export/import.
 assert.equal(create(storage).progress(id).results[0].favoriteFolder,folder.id);assert.equal(C.mergeProgress({},api.progress(id)).results[0].favoriteFolder,folder.id);
 let backup;w.Blob=class{constructor(parts){backup=JSON.parse(parts[0])}};w.HTMLAnchorElement.prototype.click=function(){};await $('enExport').onclick();assert.equal(backup.favoriteFolders[0].title,'论文写作');
 $('enImportLocal').onchange({target:{files:[{size:1000,text:async()=>JSON.stringify(backup)}],value:'fixture'}});await wait();assert.equal(api.settings().favoriteFolders.length,1);
 $('enWordsTab').click();await wait();const card=[...$('enWordbookContent').querySelectorAll('.en-course')].find(n=>n.textContent.includes('Research fixture'));assert(card);card.click();await wait();clickText($('enWordbookContent'),'开始打字练习');await wait();
 const practice=$('enWordPractice');assert(!practice.hidden);assert($('enHub').hidden);assert.equal(practice.tagName,'SECTION');assert.equal(w.document.querySelector('dialog.en-word-practice'),null);
 const order=practice.querySelector('select');assert.equal(order.value,'sequential');w.Math.random=()=>0;order.value='random';order.dispatchEvent(new w.Event('change'));await wait();
 const progress=api.wordbooks('progress',{id:imported.id});assert.equal(progress.order,'random');assert.equal(new Set(progress.sequence).size,4);assert.notDeepEqual(progress.sequence,api.wordbooks('get',{id:imported.id}).words.map(w=>w.id));
 const first=practice.querySelector('.en-word-target').textContent;const input=practice.querySelector('input');input.value=first;input.dispatchEvent(new w.Event('input'));input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));await wait();assert.equal(api.wordbooks('progress',{id:imported.id}).completed.length,1);assert.equal(api.wordbooks('progress',{id:imported.id}).index,1);
 const nextWord=practice.querySelector('.en-word-target').textContent;clickText(practice,'词典详情');await wait();assert.equal(queries,1);assert.equal(translations,0,'saved meaning avoids redundant online translation');assert.equal(w.document.querySelector('.en-lookup strong').textContent,nextWord);assert(!practice.hidden);
 clickText(practice,'跳过 →');assert.equal(w.document.querySelector('.en-lookup'),null);clickText(practice,'隐藏单词');assert(!practice.querySelector('.en-word-upnext').textContent.includes('下一词 · '));
 clickText(practice,'暂停');assert(input.disabled);clickText(practice,'继续');assert(!input.disabled);
 clickText(practice,'‹ 返回单词本');await wait();assert(practice.hidden);assert(!$('enHub').hidden);const after=api.wordbooks('progress',{id:imported.id});assert.equal(after.index,2);assert.deepEqual(after.sequence,progress.sequence);
 clickText($('enWordbookContent'),'开始打字练习');await wait();assert.equal(practice.querySelector('select').value,'random');assert.match(practice.textContent,/3 \/ 4/);assert.equal(queries,1,'no automatic dictionary request');
 assert(w.EnglishUI.back());await wait();assert(practice.hidden);assert.equal(practice.children.length,0);assert(!$('enHub').hidden);
 assert.deepEqual(errors,[]);dom.window.close();console.log('PASS five-tab hub, compact activity, legacy/default/custom folders, original record mapping, backup roundtrip, daily sentence dedupe, standalone typing, random queue/resume, dictionary, pause and exit cleanup.');
})().catch(e=>{testWindow?.close();console.error(e);process.exitCode=1});
