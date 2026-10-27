// Starter grammar, settings navigation, and explicitly confirmed permanent deletion.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const create=require('../features/english/english-service'),C=require('../features/english/english-core'),seed=require('../assets/data/english-seed.json'),root=path.join(__dirname,'..');
const wait=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 assert.equal(seed.flatMap(l=>l.sentences).length,24);
 for(const lesson of seed){C.clean(lesson);for(const s of lesson.sentences){assert(s.chunks.length>=3);assert.equal(s.chunks.map(c=>c.en).join(' '),s.en);assert(s.chunks.every(c=>c.role&&c.zh&&c.en.split(/\s+/).length<=6));}}
 const db=new Map(),storage={getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,structuredClone(v))},api=create(storage);
 const originalActivity=api.activity;api.activity=(...args)=>({...originalActivity(...args),today:'2024-03-15'});api.settings({autoPlay:false,preload:false});const raw={title:'Delete fixture',sentences:[{en:'We study soil.',zh:'我们研究土壤。'}]};let saved=api.save(raw);
 api.saveProgress(saved.id,{seconds:50,results:{0:{favorite:true,notes:'private note',modes:{dictation:{errors:1}}}}});
 const keep=api.save({title:'Keep fixture',sentences:['We compare data.']});api.saveProgress(keep.id,{seconds:10});
 api.vocabulary('save',{term:'soil',meaning:'土壤'});api.activity('checkin');
 assert.throws(()=>api.purge(saved.id,{confirmed:true}),/最近删除/);api.trash(saved.id);assert.throws(()=>api.purge(saved.id),/确认/);assert.throws(()=>api.purge(seed[0].id,{confirmed:true}),/最近删除/);assert.equal(api.get(saved.id).title,raw.title);
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),errors=[];
 w.englishApi=api;w.addEventListener('error',e=>errors.push(e.message));w.HTMLMediaElement.prototype.pause=function(){};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.LessonAudioCache=class{set(){}prioritize(){}async get(){throw Error('No audio')}};
 for(const f of ['english-core.js','english-wordbook-ui.js','english-extras.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
 api.trash(saved.id,true);await w.EnglishUI.onView('english');$('enLibraryTab').click();await wait();[...$('enCourses').querySelectorAll('button')].find(b=>b.dataset.lessonId===saved.id).click();await wait();$('enPracticeBack').click();await wait();api.trash(saved.id);$('enSettingsTab').click();await wait();
 const tabs=[...$('enPreferences').querySelectorAll('[role="tab"]')];assert.equal(tabs.length,8);assert.equal($('enPreferences').querySelectorAll('[role="tabpanel"]:not([hidden])').length,1);
 for(const tab of tabs){tab.click();assert.equal(tab.getAttribute('aria-selected'),'true');assert(!$(tab.getAttribute('aria-controls')).hidden);assert.equal($('enPreferences').querySelectorAll('[role="tabpanel"]:not([hidden])').length,1)}
 tabs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(w.document.activeElement,tabs[1]);assert.equal(tabs[1].tabIndex,0);assert.equal(tabs[0].tabIndex,-1);
 $('enActivityDetails').click();await wait();assert(!$('enPrefPane-activity').hidden);
 const days=()=>[...$('enActivityWeek').querySelectorAll('button')];assert.equal(days().length,31);assert.equal($('enActivityRange').textContent,'2024 年 3 月');assert.equal($('enActivityWeek').querySelectorAll('.en-calendar-blank').length,5);assert($('enActivityNext').disabled);assert.equal(days().find(b=>b.getAttribute('aria-current')==='date').dataset.date,'2024-03-15');
 $('enActivityPrev').click();assert.equal(days().length,29);assert.equal(days().at(-1).dataset.date,'2024-02-29');days().at(-1).click();assert.equal(days().at(-1).getAttribute('aria-pressed'),'true');assert($('enActivityHistory').textContent.includes('2 月 29 日'));
 $('enActivityPrev').click();$('enActivityPrev').click();assert.equal($('enActivityRange').textContent,'2023 年 12 月');$('enActivityNext').click();assert.equal($('enActivityRange').textContent,'2024 年 1 月');$('enActivityRecent').click();assert.equal($('enActivityRange').textContent,'2024 年 3 月');assert($('enActivityNext').disabled);
 
 $('enPrefTab-materials').click();const deleteButton=()=>[...$('enTrashList').querySelectorAll('button')].find(b=>b.textContent==='永久删除');deleteButton().click();assert(w.document.querySelector('.en-delete-dialog').open);assert.equal(w.document.activeElement.textContent,'取消');w.document.activeElement.click();assert.equal(api.trashList().length,1,'cancel does not delete');
 deleteButton().click();w.document.querySelector('.en-delete-dialog .en-danger').click();await wait();assert.equal(api.trashList().length,0);assert.throws(()=>api.get(saved.id),/找不到/);assert.equal(db.get('english-progress:'+saved.id),null);assert.equal(api.get(keep.id).title,'Keep fixture');assert.equal(api.progress(keep.id).seconds,10);assert.equal(api.vocabulary().length,1);assert(api.activity().checkedToday);
 $('enLibraryTab').click();await wait();$('enSettingsTab').click();await wait();assert.equal(db.get('english-progress:'+saved.id),null,'later navigation does not resurrect records');
 // The same content can be imported afresh after permanent deletion.
 saved=api.save(raw);assert.equal(Object.keys(api.progress(saved.id).results).length,0);
 assert.deepEqual(errors,[]);dom.window.close();console.log('PASS all 24 starter structures, eight settings categories/keyboard navigation, cancel/confirm purge, source/record removal, unrelated data preservation and clean reimport.');
})().catch(e=>{console.error(e);process.exitCode=1});
