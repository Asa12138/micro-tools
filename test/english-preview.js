// Local development preview. Isolated storage; never touches the installed plugin database.
// node test/english-preview.js, then http://127.0.0.1:8767
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const port=Number(process.env.ENGLISH_PREVIEW_PORT||8767),origin='http://127.0.0.1:'+port;
const root=path.join(__dirname,'..'),file=path.join(os.tmpdir(),'micro-tools-english-preview'+(port===8767?'':'-'+port)+'.json'),token=crypto.randomBytes(24).toString('hex');
const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
const prepared=require('../features/english/english-prepared-audio')({directory:path.join(os.tmpdir(),'researchbox-preview-audio-'+port)});
const api=require('../features/english/english-service')({getItem:k=>data[k],setItem:(k,v)=>{data[k]=v;fs.writeFileSync(file,JSON.stringify(data))}},{audio:prepared,activityDirectory:path.join(os.tmpdir(),'researchbox-preview-activity-'+port)});api.speech=require('../features/english/english-speech');
const methods=['wordbooks','activity','dictionary','list','get','save','progress','saveProgress','settings','prepare','validateSession','speech','edit','trash','purge','trashList','vocabulary','translationProviders','translationConfig','translate','pronounce','catalogSettings','catalogList','catalogDownload','preparedAudio','preparedAudioAvailable','importURL'];
const allowed=new Set(['features/english/english-wordbook-ui.js','features/english/english-sheet-worker.js','vendor/sheetjs/xlsx.full.min.js','shared/ai-connection.js','features/english/english-sounds.js','test/english-recorder-fixture.html','plugin.json','features/english/english-recorder.js','index.html','index.js','index.css','assets/images/logo.png','features/english/english.css','features/english/english-core.js','features/english/english-generation.js','features/english/english-ui.js','features/english/english-extras.js','assets/data/english-seed.json','features/english/english-audio-loader.js','features/english/english-pdf.mjs','vendor/pdfjs/english-pdf-vendor.mjs','vendor/pdfjs/english-pdf-worker.mjs','features/research/research.css','features/research/research-ui.js','features/research/research-core.js','features/research/research-metrics.js','features/research/research-report.js','features/research/research-prompts.js']);
for(const voice of Object.keys(require('../features/english/english-core').voices))allowed.add('assets/audio/english-voice-samples/'+voice+'.mp3');
const inject=`<script>window.englishApi=Object.fromEntries(${JSON.stringify(methods)}.map(method=>[method,async(...args)=>{const r=await fetch('/api/'+method,{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':'${token}'},body:JSON.stringify(args)});const x=await r.json();if(!r.ok)throw Error(x.error);return x.value}]));</script>`;
http.createServer(async(req,res)=>{try{
 if(req.headers.host!==('127.0.0.1:'+port)){res.writeHead(403);return res.end()}
 const name=new URL(req.url,origin).pathname;
 if(req.method==='POST'&&name.startsWith('/api/')){const method=name.slice(5);if(req.headers['x-preview-token']!==token||!methods.includes(method)){res.writeHead(403);return res.end()}
  let body='';for await(const b of req){body+=b;if(body.length>2000000)throw Error('Request too large')}
  const args=JSON.parse(body);if(!Array.isArray(args))throw Error('Arguments must be an array');const value=await api[method](...args);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({value}))}
 const resource=name==='/'?'index.html':name.slice(1);if(req.method!=='GET'||!allowed.has(resource)){res.writeHead(404);return res.end()}
 const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg'}[path.extname(resource)];res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-store');let bytes=fs.readFileSync(path.join(root,resource));if(resource==='index.html')bytes=bytes.toString().replace('题库与学习记录保存在本机','浏览器开发预览 · 独立临时题库').replace('<script src="index.js"',inject+'<script src="index.js"');res.end(bytes);
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
}).listen(port,'127.0.0.1',()=>console.log('English development preview: '+origin+' (isolated temporary storage)'));
