const assert=require('node:assert/strict'),fs=require('node:fs');
const createHandler=require('../server/speech-relay.cjs'),speech=require('../web/english/speech');
const origin='https://example.test',bytes=fs.readFileSync(require('node:path').join(__dirname,'fixtures/speech.mp3'));
const payload={text:'We compare different samples.',voice:'andrew',engine:'microsoft'};
const request=(body=payload,headers={})=>new Request(origin+'/api/speech',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer test-token',...headers},body:JSON.stringify(body)});
(async()=>{
 for(const ua of ['Version/27.0 Safari/605.1.15','Chrome/143.0.0.0 Safari/537.36','Firefox/140.0','iPhone EdgiOS/143.0','Macintosh Version/27 Safari/605.1.15'])assert.equal(speech.capabilities(ua).direct,false,ua);
 for(const ua of ['Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','Android Chrome/143.0.0.0 EdgA/143.0.0.0'])assert.equal(speech.capabilities(ua).direct,true,ua);
 await assert.rejects(speech('Test sentence.'),/无法直连/);
 let calls=0;const handle=createHandler({origins:[origin],token:'test-token',synthesize:async input=>{calls++;assert.deepEqual(input,payload);return bytes;}});
 assert.equal((await handle(request(payload,{Origin:'https://other.test'}))).status,403);
 assert.equal((await handle(request(payload,{Authorization:'Bearer wrong'}))).status,401);
 assert.equal((await handle(request({...payload,voice:'unknown'}))).status,400);
 assert.equal((await handle(request({...payload,voice:{toString:null}}))).status,400);
 assert.equal((await handle(request({...payload,text:'x'.repeat(1001)}))).status,400);
 assert.equal((await handle(request({...payload,text:'x'.repeat(9000)}))).status,413);
 assert.equal(calls,0);
 const preflight=await handle(new Request(origin+'/api/speech',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 const response=await handle(request());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 for(let i=0;i<59;i++)assert.equal((await handle(request())).status,200);const limited=await handle(request());assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 const invalid=createHandler({origins:[origin],synthesize:async()=>Buffer.from('<html>not audio</html>')});assert.equal((await invalid(request())).status,502);
 const data=new Map(),service=require('../web/english/services')({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});
 // Sentence Google playback must not inherit the default Youdao word engine.
 const word=await service.translation.pronounce({text:'research'});assert.equal(new URL(word.url).hostname,'dict.youdao.com');
 const sentence=await service.translation.pronounce({text:payload.text,engine:'google'});assert.equal(new URL(sentence.url).hostname,'translate.google.com');
 let relayed;const routed=require('../web/english/services')({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},{relay:{config:()=>({endpoint:origin+'/api/speech'}),synthesize:async(...args)=>{relayed=args;return bytes.toString('base64');}}});
 const google=await routed.translation.pronounce({text:payload.text,engine:'google'});assert.deepEqual(relayed,[payload.text,'en-US','google']);assert.equal(google.base64,bytes.toString('base64'));assert.equal(google.url,undefined);
 console.log('PASS relay: browser detection, origin/token/input guards, bounded bodies, MP3 validation, Google engine isolation and relay routing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
