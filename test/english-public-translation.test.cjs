const assert=require('node:assert/strict'),create=require('../web/english/public-translation');
const endpoint='https://relay.example/api/public/translate';
(async()=>{
 let count=0,seen;
 const translation=create({endpoint,fetchImpl:async(url,options)=>{count++;seen={url,options};await new Promise(r=>setTimeout(r,5));return Response.json({translation:'研究'})}});
 assert.deepEqual(await Promise.all([translation('research'),translation('research')]),['研究','研究']);assert.equal(count,1);
 assert.equal(seen.url,endpoint);assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(seen.options.body),{text:'research',source:'en',target:'zh-CN'});
 await assert.rejects(translation(' '),/1–500/);await assert.rejects(translation('x'.repeat(501)),/1–500/);assert.equal(count,1);
 let time=1000,limited=0;const blocked=create({endpoint,now:()=>time,fetchImpl:async()=>{limited++;return Response.json({error:{code:'ip_daily_limit',message:'今日 100 次翻译额度已用完'}},{status:429,headers:{'Retry-After':'300'}})}});
 await assert.rejects(blocked('one'),/100 次/);await assert.rejects(blocked('two'),/100 次/);assert.equal(limited,1);time+=301000;await assert.rejects(blocked('two'),/100 次/);assert.equal(limited,2);
 const bad=create({endpoint,fetchImpl:async()=>Response.json({translation:'x'.repeat(70000)})});await assert.rejects(bad('research'),/大小限制/);
 await assert.rejects(create({endpoint,fetchImpl:async()=>Response.json({wrong:'研究'})})('research'),/有效译文/);
 await assert.rejects(create({endpoint,fetchImpl:async()=>new Response('missing',{status:404})})('research'),/尚未部署/);
 await assert.rejects(create({endpoint,fetchImpl:async()=>{throw new TypeError('CORS')}})('research'),/允许的网站来源/);
 for(const address of ['http://remote.example/api','https://key:secret@relay.example/api','https://relay.example/api?token=secret'])assert.throws(()=>create({endpoint:address}),/HTTPS/);
 console.log('PASS fixed translation request, no credentials, request coalescing, cooldown, input/response limits, endpoint validation and actionable errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
