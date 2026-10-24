// Loopback protocol fixture: no Microsoft calls, real Node WebSocket, Electron-like globals.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const Cache=require('../features/english/english-audio-loader');
async function main(){
 const sandbox={exports:{},require:require('module').createRequire(require.resolve('../vendor/ms-edge-tts/english-speech-vendor.cjs')),window:{document:{}},console,process,URL,Buffer,ArrayBuffer,Uint8Array,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../vendor/ms-edge-tts/english-speech-vendor.cjs'),'utf8'),sandbox);
 const {MsEdgeTTS,OUTPUT_FORMAT}=sandbox.exports;
 const tts=new MsEdgeTTS({connectionTimeoutMs:2000,synthesisTimeoutMs:2000});
 assert.equal(tts._isBrowser,false,'Electron must retain Node headers');
 assert.match(await MsEdgeTTS.generateSecMsGec('fixture'),/^[0-9A-F]{16}-[0-9A-F]{64}$/);
 const token=require('../vendor/ms-edge-tts/english-speech-token');
 assert.equal(token(MsEdgeTTS.TRUSTED_CLIENT_TOKEN,1791888000),'492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876');
 assert.equal(token('fixture',1791888000),token('fixture',1791888299));
 assert.notEqual(token('fixture',1791888000),token('fixture',1791888300));
 const url=new URL(await MsEdgeTTS.getSynthUrl());
 assert.equal(url.hostname,'speech.platform.bing.com');
 assert.equal(url.searchParams.get('Sec-MS-GEC-Version'),'2-143.0.3650.75');
 assert.equal(url.searchParams.get('TrustedClientToken'),MsEdgeTTS.TRUSTED_CLIENT_TOKEN);
 assert.match(MsEdgeTTS.randomHex(16),/^[0-9a-f]{32}$/);
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});
 await new Promise(r=>server.once('listening',r));
 let headerSeen=false;const audio=Buffer.alloc(200,7);
 MsEdgeTTS.getSynthUrl=async()=>`ws://127.0.0.1:${server.address().port}`;
 server.on('connection',(ws,req)=>{
  assert.match(req.headers['user-agent'],/Edg\//);assert.match(req.headers.origin,/chrome-extension:/);headerSeen=true;
  ws.on('message',raw=>{const text=raw.toString();if(!text.includes('Path:ssml'))return;
   const id=/X-RequestId:([^\r]+)/.exec(text)[1];
   ws.send(`X-RequestId:${id}\r\nPath:turn.start\r\n\r\n`);
   const header=Buffer.from(`X-RequestId:${id}\r\nPath:audio\r\n`),prefix=Buffer.alloc(2);prefix.writeUInt16BE(header.length);
   ws.send(Buffer.concat([prefix,header,audio]));
   ws.send(`X-RequestId:${id}\r\nPath:turn.end\r\n\r\n`);
  });
 });
 try{
  await tts.setMetadata('en-US-AndrewMultilingualNeural',OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const stream=tts.toStream('A local fixture.').audioStream, chunks=[];
  await new Promise((r,j)=>{stream.on('data',b=>chunks.push(b));stream.on('end',r);stream.on('error',j)});
  assert(headerSeen);assert.deepEqual(Buffer.concat(chunks),audio);
 }finally{tts.close();for(const client of server.clients)client.terminate();await new Promise(r=>server.close(r))}
 const {speechError}=require('../features/english/english-speech');
 assert.match(speechError(Error('Unexpected server response: 200')),/HTTP 200/);assert.match(speechError(Error('ENOTFOUND')),/DNS/);assert.match(speechError(Error('certificate expired')),/证书/);
 assert.match(speechError(Error('Unexpected server response: 403')),/403/);
 assert.match(speechError(Error('connection timed out')),/超时/);
 assert(!speechError(Error('secret=https://private/token')).includes('private'));
 let calls=0,latest;let fail=true;
 const cache=new Cache({read:async()=>null,write:async()=>{},request:async()=>{calls++;if(fail)throw Error('DNS unavailable');return 'audio'},onProgress:x=>latest=x});
 cache.set(['a','b','c','d','e'],'andrew');await new Promise(r=>setTimeout(r,20));
 assert.equal(calls,3);assert.equal(latest.enabled,false);assert.equal(latest.lastError,'DNS unavailable');
 fail=false;cache.retry();await new Promise(r=>setTimeout(r,20));assert.equal(latest.ready,5);assert.equal(latest.lastError,'');
 console.log('PASS: Electron-like window without global crypto/TextEncoder; real loopback WebSocket headers and audio stream; safe error categories; 3-failure pause and retry. Windows hardware and Microsoft network not tested.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
