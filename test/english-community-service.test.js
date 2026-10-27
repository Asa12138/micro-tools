// Public native listings and downloads use exact manifests and never read private packs.
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),create=require('../features/english/english-service');
const bytes=Buffer.from(JSON.stringify({title:'Published course',sentences:[{en:'We evaluate the evidence.',zh:'我们评估证据。'}]}));
const words=Buffer.from(JSON.stringify({title:'Public words',words:[{term:'cohort',meaning:'队列',usphone:'ˈkoʊhɔːrt'}]}));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),id='9c058d34-4e07-455a-bcc4-571291200a64';
const course={id:'public-course',type:'course',title:'Published course',count:1,bytes:bytes.length,sha256:digest(bytes),url:'materials/public-course/1.0.0.json'};
const cloud={id,manifest:{type:'wordbook',title:'Public words'},item_count:1,bytes:words.length,sha256:digest(words),body:words.toString()};
(async()=>{
 let offline=false,corrupt=false,published=true;const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,structuredClone(v))};
 const request=async(value,options={})=>{if(offline)throw Error('offline');const u=new URL(value);if(u.pathname==='/config.json')return Buffer.from(JSON.stringify({supabase:{url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'}}));if(u.pathname==='/community-index.json')return Buffer.from(JSON.stringify({version:1,packs:[course]}));if(u.pathname.startsWith('/materials/'))return corrupt?Buffer.from('corrupt'):bytes;assert.equal(u.hostname,'fixture.supabase.co');assert.equal(u.pathname,'/rest/v1/community_packs');assert.equal(options.headers.apikey,'sb_publishable_fixture');assert.equal(u.searchParams.get('status'),'eq.published');assert(!u.searchParams.has('owner_id'));return Buffer.from(JSON.stringify(u.searchParams.has('id')?(published?[cloud]:[]):[cloud]))};
 const api=create(storage,{communityRequest:request});let list=await api.communityList();assert.equal(list.packs.length,2);assert(list.packs.every(p=>!p.installed));
 const installed=await api.communityDownload({id:course.id});assert.equal(installed.type,'course');assert.equal(installed.lesson.library,'builtin');api.saveProgress(installed.id,{seconds:42});assert.equal((await api.communityDownload({id:course.id})).id,installed.id);assert.equal(api.progress(installed.id).seconds,42);
 const book=await api.communityDownload({id:'cloud-'+id});assert.equal(book.type,'wordbook');assert.equal(api.wordbooks('get',{id:book.id}).words[0].meaning,'队列');assert.equal((await api.communityList()).packs.filter(p=>p.installed).length,2);
 api.trash(installed.id);assert(!(await api.communityList()).packs[0].installed);await api.communityDownload({id:course.id});assert.equal(api.progress(installed.id).seconds,42);
 offline=true;list=await api.communityList({refresh:true});assert.equal(list.packs.length,1);assert(list.packs.every(p=>p.cloud));assert(list.warning);offline=false;
 const fresh=()=>create(storage,{communityRequest:request});corrupt=true;await assert.rejects(()=>fresh().communityGet({id:course.id}),/校验失败/);corrupt=false;
 published=false;await assert.rejects(()=>fresh().communityGet({id:'cloud-'+id}),/下架/);await assert.rejects(()=>api.communityList({offset:-1}),/页码/);
 console.log('PASS public-only REST contract, official/community catalogs, SHA/size validation, course/wordbook install, dedup/progress, restore, cached fallback and withdrawn material rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
