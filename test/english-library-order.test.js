// Library behavior against isolated storage; no network or user records.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const create=require('../features/english/english-service');
const root=path.resolve(__dirname,'..'),wait=()=>new Promise(r=>setTimeout(r,30));let w;
(async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,structuredClone(v))},api=create(storage);
 api.settings({autoPlay:false,preload:false,voice:'system'});
 const a=api.save({title:'Alpha course',domain:'生态比较',sentences:['We compare soil communities.','We report the observed differences.']},true);
 const b=api.save({title:'Beta course',domain:'论文写作',sentences:['We discuss the available evidence.','We explain the study limitations.']},true);
 api.saveProgress(a.id,{mode:'typing',results:{0:{modes:{typing:{complete:true}}},1:{modes:{speaking:{complete:true}}}}});
 api.saveProgress(b.id,{mode:'typing',results:{0:{modes:{typing:{complete:true}}}}});
 const open=async()=>{
  const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});w=dom.window;w.englishApi=api;w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};
  w.LessonAudioCache=class{set(){}prioritize(){}async get(){throw Error('fixture')}};
  for(const f of ['english-core.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
  await w.EnglishUI.onView('english');return id=>w.document.getElementById(id);
 };
 let $=await open();const order=()=>[...$('enCourses').querySelectorAll('button.en-course')].map(b=>b.dataset.lessonId),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change'))};
 assert.deepEqual([...$('enDomain').options].map(o=>o.value),['','基础入门','生态比较','论文写作']);
 assert.equal($('enSort').value,'recent');
 $('enCourses').querySelector('button[data-lesson-id="'+a.id+'"]').click();await wait();
 assert(api.settings().materialOpenedAt[a.id]);assert.equal($('enCourseTitle').textContent,'Alpha course');
 change('enFilter','incomplete');assert.equal($('enOutline').querySelectorAll('button').length,1);assert.match($('enOutline').textContent,/2\. We report/);assert.doesNotMatch($('enOutline').textContent,/✓/);
 change('enMode','speaking');assert.equal($('enOutline').querySelectorAll('button').length,1);assert.match($('enOutline').textContent,/1\. We compare/);
 change('enMode','dictation');assert.equal($('enOutline').querySelectorAll('button').length,2,'completion is specific to the current practice mode');
 $('enPracticeBack').click();await wait();assert.deepEqual(order(),[b.id,'english-collection-builtin',a.id]);
 $('enCourses').querySelector('button[data-lesson-id="'+b.id+'"]').click();await wait();$('enPracticeBack').click();await wait();assert.equal(order()[0],b.id);
 const recent=structuredClone(api.settings().materialOpenedAt);await api.get(a.id);assert.deepEqual(api.settings().materialOpenedAt,recent,'reading/exporting a course does not mark it opened');
 change('enSort','completion-desc');await wait();assert.deepEqual(order(),[b.id,'english-collection-builtin',a.id]);
 change('enSort','completion-asc');await wait();assert.deepEqual(order(),[b.id,'english-collection-builtin',a.id]);
 change('enSort','recent');await wait();assert.equal(order()[0],b.id);
 $('enCourses').querySelector('button[data-lesson-id="english-collection-builtin"]').click();await wait();$('enPracticeBack').click();await wait();assert.equal(api.settings().materialOpenedAt['english-collection-builtin']>0,true);
 change('enSort','title');await wait();assert.deepEqual(order(),['english-collection-builtin',b.id,a.id]);w.close();$=await open();assert.equal($('enSort').value,'title','sort choice survives reopen');
 change('enSort','recent');assert(api.settings().materialOpenedAt['english-collection-builtin'],'open history survives reopen');
 change('enDomain','生态比较');assert.deepEqual(order(),[a.id]);assert.equal(create(storage).progress(a.id).results[0].modes.typing.complete,true);
 w.close();console.log('PASS visible domains, recent-open sort/history, fixed state priority with persisted sorting, saved sort preference, current-mode unfinished filter and unchanged study progress.');
})().catch(e=>{w?.close();console.error(e);process.exitCode=1});
