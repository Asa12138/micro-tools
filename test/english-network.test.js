// Proxy parsing, persisted preferences, pronunciation contracts; no network calls.
const assert=require('node:assert/strict');
const network=require('../features/english/english-network');
const create=require('../features/english/english-translation');
(async()=>{
 assert.equal(network.macProxy('HTTPEnable : 1\nHTTPProxy : 127.0.0.1\nHTTPPort : 7897'),'http://127.0.0.1:7897');
 assert.equal(network.macProxy('HTTPEnable : 0\nHTTPProxy : localhost\nHTTPPort : 7897'),'');
 assert.equal(network.winProxy('ProxyEnable REG_DWORD 0x1\nProxyServer REG_SZ http=localhost:7890;https=localhost:7897'),'http://localhost:7897');
 assert.equal(network.winProxy('ProxyEnable REG_DWORD 0x0\nProxyServer REG_SZ localhost:7897'),'');
 for(const proxy of ['socks5://localhost:7897','http://name:secret@localhost:7897','https://example.com/path'])assert.throws(()=>network.normalizeProxy(proxy));
 assert.equal((await network.route({mode:'direct'})).proxy,'');
 const audioBytes=Buffer.from([0xff,0xfb,0,10,13,20]);
 const responseBytes=Buffer.concat([Buffer.from('HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 429 Too Many Requests\r\nRetry-After: 120\r\n\r\n'),audioBytes]);
 const parsed=network.splitHeaders(responseBytes);assert.equal(parsed.retryAfter,'120');assert.deepEqual(parsed.body,audioBytes);
 assert.throws(()=>network.splitHeaders(Buffer.from('HTTP/1.1 200 incomplete')),/格式/);

 await assert.rejects(()=>network.request({url:'https://example.com/'}),/无效/);
 const data={},storage={getItem:k=>data[k],setItem:(k,v)=>data[k]=v};
 let calls=0,finish;
 const service=create(storage,{audioTransport:(req,settings)=>{calls++;assert.equal(settings.mode,'manual');assert.equal(new URL(req.url).searchParams.get('q'),'research');return new Promise(resolve=>finish=resolve)}});
 service.config({googleNetwork:{mode:'manual',proxy:'http://localhost:7897'}});
 assert.deepEqual(create(storage).config().googleNetwork,{mode:'manual',proxy:'http://localhost:7897'});
 const a=service.pronounce({text:'research'}),b=service.pronounce({text:'research'});assert.equal(calls,1);
 finish({status:200,body:Buffer.alloc(200,1),contentType:'audio/mpeg'});
 assert.equal((await a).base64,(await b).base64);
 assert.equal((await service.pronounce({text:'research'})).cached,true);assert.equal(calls,1);
 const uk=service.pronounce({text:'research',accent:'en-GB'});assert.equal(calls,2);finish({status:200,body:Buffer.alloc(200,2),contentType:'audio/mpeg'});assert.equal((await uk).accent,'en-GB');
 await assert.rejects(()=>service.pronounce({text:'a'.repeat(201)}),/200/);
 await assert.rejects(()=>service.pronounce({text:'research',accent:'fr-FR'}),/美式/);
 const failed=create(storage,{audioTransport:async()=>({status:200,body:Buffer.alloc(200),contentType:'text/html'})});
 await assert.rejects(()=>failed.pronounce({text:'research'}),/有效发音/);
 await assert.rejects(()=>failed.pronounce({text:'research'}),/有效发音/);
 // A Google 429 backs off new queries, retains cached answers, and does not block audio or other engines.
 let clock=1000000,queries=0,rateLimited=false;
 const limited=create(null,{now:()=>clock,transport:async req=>{queries++;return req.url.includes('transmart')?{status:200,body:{auto_translation:['研究']}}:rateLimited?{status:429,body:'',retryAfter:'120',route:'HTTP 代理 localhost:7897'}:{status:200,body:[[['研究']]]}},audioTransport:async()=>({status:200,body:Buffer.alloc(200),contentType:'audio/mpeg'})});
 await limited.translate({text:'research'});rateLimited=true;
 await assert.rejects(()=>limited.translate({text:'ecology'}),/HTTP 429.*localhost:7897.*120 秒/);
 const afterLimit=queries;
 await assert.rejects(()=>limited.translate({text:'biology'}),/暂停/);assert.equal(queries,afterLimit);
 assert.equal((await limited.translate({text:'research'})).cached,true);assert.equal(queries,afterLimit);
 assert.ok((await limited.pronounce({text:'research'})).base64);
 assert.equal((await limited.translate({text:'research',engine:'transmart'})).translation,'研究');
 clock+=120001;rateLimited=false;assert.equal((await limited.translate({text:'ecology'})).translation,'研究');
 const dateLimit=create(null,{now:()=>clock,transport:async()=>({status:429,body:'',retryAfter:new Date(clock+90000).toUTCString()})});
 await assert.rejects(()=>dateLimit.translate({text:'research'}),/90 秒/);
 const defaultLimit=create(null,{transport:async()=>({status:429,body:''})});
 await assert.rejects(()=>defaultLimit.translate({text:'research'}),/60 秒/);
 console.log('PASS proxy parsing, network preference persistence, destination restriction, pronunciation dedup/cache/accent and invalid audio rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
