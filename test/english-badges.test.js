'use strict';
const assert=require('node:assert/strict'),create=require('../features/english/english-badges'),createService=require('../features/english/english-service');
const store=()=>{const m=new Map();return {m,getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,structuredClone(v))}};
function fixture(){
 const storage=store();let date=new Date(2026,9,5,12),serial=0;
 const courses=Array.from({length:3},(_,j)=>({id:'english-test-'+j,title:'Test '+j,domain:['methods','environment','reading'][j],library:'custom',sentences:Array.from({length:24},()=>({en:'We compare soil communities.'}))}));
 const saved={},act={totalSeconds:0,totalWords:0,history:[]};
 const api=create({storage,courses:()=>courses,progress:id=>saved[id]||{results:{}},activity:()=>structuredClone(act),now:()=>date});
 const event=(type,index=0,extra={})=>api('event',{type,id:'event-'+(++serial),courseId:courses[0].id,index,...extra});
 const complete=(index=0,mode='dictation',options={})=>{const practiceId='practice-'+(++serial);event('attempt',index,{mode,correct:true,helped:false,practiceId,...options});return event('complete',index,{mode,helped:false,practiceId,...options})};
 const speaking=index=>event('complete',index,{mode:'speaking',helped:false,practiceId:'speech-'+(++serial)});
 const has=id=>api().earned.some(b=>b.id===id),setDate=value=>{date=new Date(value)};
 return {api,event,complete,speaking,has,setDate,storage,courses,saved,act};
}
const covered=new Set();function earned(f,id){assert(f.has(id),'expected '+id);covered.add(id)}
{
 const f=fixture(),s=f.api();assert.equal(s.catalog.length,24);assert.equal(s.earned.length,0);assert.equal(s.catalog.filter(b=>b.kind==='secret').length,8);
 for(const b of s.catalog.filter(b=>b.kind==='secret')){assert.equal(b.emoji,'❔');assert.equal(b.name,'神秘伙伴');assert.equal(b.condition,undefined);assert.equal(b.current,undefined)}
 assert.equal(s.catalog.find(b=>b.id==='cat').current,0);
 f.storage.setItem('english-course-badges-v1',[{number:1,courseId:'legacy',title:'Old',count:1,date:'2026-01-01'}]);f.api();assert.equal(f.storage.getItem('english-course-badges-v1'),null);assert.equal(f.api().earned.length,0);
 for(let i=0;i<24;i++)f.complete(i);earned(f,'cat');earned(f,'panda');earned(f,'fox');earned(f,'beaver');assert(!f.has('rabbit'));
 for(let c=1;c<3;c++)for(let i=0;i<24;i++)f.event('complete',i,{courseId:f.courses[c].id,mode:'speaking',practiceId:'p-'+c+'-'+i,helped:false});earned(f,'rabbit');earned(f,'octopus');
 f.act.totalSeconds=17999;assert(!f.has('cow'));f.act.totalSeconds=18000;earned(f,'cow');f.act.totalWords=99;assert(!f.has('squirrel'));f.act.totalWords=100;earned(f,'squirrel');
 const state=f.api().earned.map(b=>b.id);f.courses.length=0;assert.deepEqual(f.api().earned.map(b=>b.id),state,'awards survive course deletion');
}
{
 const f=fixture();for(let i=0;i<7;i++)f.act.history.push({date:'2026-09-'+String(i+1).padStart(2,'0'),checked:true,seconds:1800});earned(f,'deer');assert(!f.has('wolf'));
 for(let i=7;i<30;i++)f.act.history.push({date:'2026-09-'+String(i+1).padStart(2,'0'),checked:true,seconds:1800});earned(f,'wolf');
}
{
 const f=fixture();f.act.history=[{date:'2026-10-01',checked:true,seconds:1800},{date:'2026-10-03',checked:true,seconds:1800},{date:'2026-10-04',checked:true,seconds:1800}];assert(!f.has('kangaroo'));f.act.history.push({date:'2026-10-05',checked:true,seconds:1800});earned(f,'kangaroo');
 const g=fixture();g.act.history=[3,4,5].map(d=>({date:'2026-10-0'+d,checked:true,seconds:1800}));assert(!g.has('kangaroo'),'first-ever three days are not a return');
}
{
 const f=fixture();f.act.history=[{date:'2026-10-05',checked:true,checkedAt:new Date(2026,9,5,22,59).toISOString()}];assert(!f.has('owl'));f.act.history[0].checkedAt=new Date(2026,9,5,23).toISOString();earned(f,'owl');
 const g=fixture();g.act.history=[{date:'2026-10-04',checked:true,checkedAt:new Date(2026,9,5,0,30).toISOString()}];assert(!g.has('owl'),'late upload of yesterday is not a midnight checkin');
}
{
 const f=fixture();for(let i=0;i<20;i++){const p='wrong-'+i;f.event('attempt',i,{mode:'dictation',correct:false,helped:false,practiceId:p});if(i<3)for(let j=0;j<2;j++)f.event('attempt',i,{mode:'dictation',correct:false,helped:false,practiceId:p});f.complete(i)}
 earned(f,'hedgehog');earned(f,'rhino');assert(!f.has('fox'),'eventual success is not first-try success');assert(!f.has('pig'),'interleaved first successes break a five-question error run');
 f.setDate('2026-10-06T12:00:00');for(let i=0;i<10;i++)f.complete(i);earned(f,'butterfly');
 const g=fixture();for(let i=0;i<5;i++)g.event('attempt',i,{mode:'typing',correct:false,helped:false,practiceId:'w'+i});assert(!g.has('pig'));for(let i=0;i<4;i++)g.complete(i,'typing');assert(!g.has('pig'));g.complete(4,'typing');earned(g,'pig');
 const h=fixture();for(let i=0;i<10;i++)h.event('attempt',0,{mode:'typing',correct:false,helped:false,practiceId:'same'+i});h.complete(0);assert(!h.has('pig'),'retries of one sentence do not count as five first errors');
}
{
 const f=fixture();for(let i=0;i<10;i++)f.complete(i,'typing',{helped:true});assert(!f.has('fox'));assert(!f.has('butterfly'));
 const g=fixture();g.speaking(0);assert(!g.has('fox'),'manual speaking completion cannot satisfy first correct submission');
 const legacy=fixture();legacy.saved[legacy.courses[0].id]={results:Object.fromEntries(Array.from({length:10},(_,i)=>[i,{modes:{speaking:{complete:true}}}]))};legacy.api();for(let i=0;i<10;i++)legacy.complete(i);assert(legacy.has('fox'),'prior speaking does not consume the first graded submission');
 const h=fixture();const event={type:'attempt',courseId:h.courses[0].id,index:0,mode:'typing',correct:false,helped:false,practiceId:'dedupe',id:'duplicate'};h.api('event',event);h.api('event',event);assert.equal(h.storage.getItem(create.KEY).rows['english-test-0:0'].errors,1);
 const before=JSON.stringify(h.storage.getItem(create.KEY));assert.throws(()=>h.api('event',{...event,index:999}));assert.equal(JSON.stringify(h.storage.getItem(create.KEY)),before,'invalid event cannot mutate state');
}
{
 const f=fixture();for(let i=0;i<10;i++)f.complete(i,'typing');assert(!f.has('crab'));for(let i=0;i<24;i++)f.complete(i,'dictation');assert(!f.has('crab'),'typing completed before full dictation does not count');f.setDate('2026-10-06T12:00:00');for(let i=0;i<9;i++)f.complete(i,'typing');assert(!f.has('crab'));f.complete(9,'typing');earned(f,'crab');
 const state=f.storage.getItem(create.KEY),older=structuredClone(state);older.rows['english-test-0:0'].modes.typing='2026-10-05T01:00:00Z';assert.equal(create.merge(older,state).rows['english-test-0:0'].modes.typing,state.rows['english-test-0:0'].modes.typing,'backup keeps later typing evidence');
}
{
 const f=fixture();f.act.history=[{date:'2026-09-20',seconds:20,sentences:1}];for(let i=0;i<9;i++)f.speaking(i);assert(!f.has('penguin'));f.speaking(9);earned(f,'penguin');
 const g=fixture();g.act.history=[{date:'2026-09-21',seconds:20,sentences:1}];for(let i=0;i<10;i++)g.speaking(i);assert(!g.has('penguin'),'only thirteen full inactive days');
}
{
 const f=fixture();for(let i=0;i<5;i++)f.event('favorite',i,{value:true});f.setDate('2026-10-11T12:00:00');for(let i=0;i<5;i++)f.speaking(i);assert(!f.has('raccoon'));f.setDate('2026-10-12T12:00:00');for(let i=0;i<5;i++)f.speaking(i);earned(f,'raccoon');
 const g=fixture();for(let i=0;i<7;i++){g.setDate('2026-10-'+String(1+i*2).padStart(2,'0')+'T12:00:00');g.speaking(0)}earned(g,'snail');
}
{
 const f=fixture();for(const mode of ['dictation','typing','puzzle','speaking'])for(let i=0;i<5;i++)mode==='speaking'?f.speaking(i):f.complete(i,mode);earned(f,'bee');
 const g=fixture();for(const mode of ['dictation','typing','puzzle'])for(let i=0;i<5;i++)g.complete(i,mode);g.setDate('2026-10-12T12:00:00');for(let i=0;i<5;i++)g.speaking(i);assert(!g.has('bee'),'natural week boundaries are respected');
}
{
 const f=fixture();f.saved[f.courses[0].id]={results:Object.fromEntries(Array.from({length:10},(_,i)=>[i,{notes:'My expression '+i,modes:{}}]))};earned(f,'giraffe');
 for(let i=0;i<10;i++){f.event('recording',i,{recordingId:'first-'+i});f.event('playback',i,{recordingId:'unrelated'});}assert(!f.has('dolphin'));
 for(let i=0;i<10;i++)f.event('playback',i,{recordingId:'first-'+i});earned(f,'dolphin');
 f.setDate('2026-10-08T12:00:00');for(let i=0;i<5;i++){f.event('recording',i,{recordingId:'second-'+i,previousAvailable:true});f.event('playback',i,{recordingId:'second-'+i});}earned(f,'parrot');
 const imported=create.merge(null,f.storage.getItem(create.KEY));assert.equal(imported.rows['english-test-0:0'].current.available,false,'portable evidence never claims media files are available');
 assert(imported.rows['english-test-0:0'].compared,'portable evidence keeps actual completed comparisons');f.event('recording',0,{recordingId:'third',previousAvailable:true});assert(f.storage.getItem(create.KEY).rows['english-test-0:0'].compared,'re-recording never revokes an achieved comparison');
}
{
 const data=store(),api=createService(data);const c=api.save({title:'Preserve progress',sentences:['We compare soil communities.']},true);api.saveProgress(c.id,{seconds:12,results:{0:{notes:'keep',favorite:true,modes:{dictation:{complete:true}}}}});const progress=JSON.stringify(api.progress(c.id));api.achievements();assert.equal(JSON.stringify(api.progress(c.id)),progress);
 const backup=api.exportFullBackup();assert(backup.data[create.KEY]);assert(!backup.data['english-course-badges-v1']);const target=createService(store());target.restoreFullBackup(backup);assert.deepEqual(target.achievements().earned.map(b=>b.id),api.achievements().earned.map(b=>b.id));target.restoreFullBackup(backup);assert.equal(target.courseBadges().length,1,'backup merge never duplicates awards');
 const invalid=structuredClone(backup);invalid.data[create.KEY].awards.unknown={date:'2026-10-29',reason:'bad'};assert.throws(()=>target.restoreFullBackup(invalid),/成就/);
 target.restoreFullBackup({format:'research-english-web-backup-v1',data:{'english-course-badges-v1':[{number:1,courseId:c.id,title:'Old owl',count:1,date:'2026-10-01T12:00:00Z'}]}});assert.equal(target.courseBadges().length,1,'old backups cannot resurrect retired awards');
}
assert.equal(covered.size,24,'every badge has a positive behavioral test');
console.log('PASS all 24 badge conditions, hidden clues, chronology, midnight, natural weeks, first attempts, retries, recovery, recording identity, deduplication, old-award retirement, persistence and full backup.');
