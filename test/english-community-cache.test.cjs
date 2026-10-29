const assert=require('node:assert/strict'),create=require('../features/english/english-community-service');
const fixture=require('../assets/data/english-community-preview.json').rows[0];
(async()=>{
 const values=new Map();let requests=0,pages=[];
 const storage={getItem:k=>values.get(k),setItem:async(k,v)=>{await new Promise(r=>setTimeout(r,5));values.set(k,v)}};
 const api=create({storage,request:async value=>{
  requests++;const u=new URL(value);
  if(u.pathname==='/config.json')return Buffer.from(JSON.stringify({supabase:{url:'https://test.supabase.co',publishableKey:'sb_publishable_fixture'},unifiedCatalog:true}));
  const offset=Number(u.searchParams.get('offset'));pages.push(offset);
  return Buffer.from(JSON.stringify(Array.from({length:offset?1:50},(_,i)=>({...fixture,id:'fixture-'+(offset+i),official_key:'fixture-'+(offset+i)}))));
 }});
 let list=await api.list({cachedOnly:true});assert.equal(requests,0);assert.equal(list.source,'bundled');assert(list.stale);assert(list.packs.length>0);
 list=await api.list();assert.equal(list.packs.length,50);assert.equal(list.nextOffset,50);assert.deepEqual(pages,[0]);
 list=await api.list({cachedOnly:true});assert.equal(list.source,'cache');assert.equal(list.stale,false);assert.equal(requests,2);
 await api.list({offset:50});assert.deepEqual(pages,[0,50]);
 list=await api.list({cachedOnly:true});assert.equal(list.packs.length,51);assert.equal(list.nextOffset,null);
 values.get('english-community-public-v1').updatedAt=Date.now()-301000;assert((await api.list({cachedOnly:true})).stale);
 console.log('PASS immediate bundled/cache listing, freshness, one network page per request, pagination and awaited cache persistence.');
})().catch(e=>{console.error(e);process.exitCode=1});
