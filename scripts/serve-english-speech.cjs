#!/usr/bin/env node
// Local preview + authenticated fixed-provider relay, bound only to loopback.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto');
const createHandler=require('../server/speech-relay.cjs');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../dist')),port=Number(process.env.ENGLISH_SPEECH_PORT||53785),origin='http://127.0.0.1:'+port;
if(!fs.existsSync(path.join(root,'apps/research-english/index.html')))throw Error('请先运行 node scripts/build-english-web.cjs');
const token=randomBytes(24).toString('hex'),handle=createHandler({origins:[origin],token});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{try{
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);return res.end();}
 const url=new URL(req.url,origin);
 if(url.pathname==='/api/speech'){
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,String(value));
  const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
  const reply=await handle(request,req.socket.remoteAddress);res.writeHead(reply.status,Object.fromEntries(reply.headers));return res.end(Buffer.from(await reply.arrayBuffer()));
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 let data=fs.readFileSync(file);if(file===path.join(root,'apps/research-english/index.html'))data=Buffer.from(data.toString().replace('</head>','<script>window.RESEARCH_ENGLISH_LOCAL_RELAY='+JSON.stringify({endpoint:origin+'/api/speech',token})+';</script></head>'));
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch{if(!res.headersSent)res.writeHead(500);res.end('Local preview request failed');}
});
server.listen(port,'127.0.0.1',()=>console.log('本机语音预览：'+origin+'/apps/research-english/'));
