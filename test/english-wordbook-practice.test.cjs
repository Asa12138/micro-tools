// Shared wordbook UI against the Node preview and built browser runtime.
// All learning data is isolated; pronunciation is recorded locally without network audio.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const work=fs.mkdtempSync(path.join(os.tmpdir(),'research-wordbooks-'));
let preview,staticServer,browser,previewFile;
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port))});
async function startDesktop(){
 const reservation=http.createServer(),port=await listen(reservation);await new Promise(r=>reservation.close(r));
 previewFile=path.join(os.tmpdir(),'micro-tools-english-preview-'+port+'.json');assert(!fs.existsSync(previewFile),'preview storage must be fresh');
 preview=spawn(process.execPath,[path.join(root,'test/english-preview.js')],{cwd:root,env:{...process.env,ENGLISH_PREVIEW_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let err='';const timer=setTimeout(()=>reject(Error('desktop preview startup timeout: '+err)),10000);preview.stderr.on('data',b=>err+=b);preview.once('error',reject);preview.once('exit',code=>{clearTimeout(timer);reject(Error('desktop preview exited '+code+': '+err))});preview.stdout.on('data',b=>{if(String(b).includes('English development preview:')){clearTimeout(timer);resolve()}})});
 return 'http://127.0.0.1:'+port+'/';
}
async function startWeb(){
 const site=path.join(work,'research-english');const build=spawnSync(process.execPath,['scripts/build-english-web.cjs',site],{cwd:root,encoding:'utf8'});assert.equal(build.status,0,build.stderr||build.stdout);
 staticServer=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(site,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(site+path.sep)){res.writeHead(403);return res.end()}const bytes=fs.readFileSync(file),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(bytes)}catch{res.writeHead(404);res.end()}});
 return 'http://127.0.0.1:'+(await listen(staticServer))+'/';
}
async function ready(page,kind,url){
 await page.goto(url);await page.waitForFunction(()=>window.EnglishUI&&window.englishApi);
 if(kind==='web')await page.evaluate(()=>ResearchEnglishReady);
 else await page.evaluate(()=>showView('english'));
 await page.locator('#enWordsTab').waitFor({state:'visible'});
}
async function mockPronunciation(page){
 await page.evaluate(()=>{
  window.__wordPronunciations=[];
  window.englishApi.pronounce=async input=>{window.__wordPronunciations.push({...input});return {base64:'SUQz',mime:'audio/mpeg',source:'本地测试发音'};};
  HTMLMediaElement.prototype.play=function(){return Promise.resolve()};
  const wordbooks=englishApi.wordbooks;englishApi.wordbooks=(...args)=>args[0]==='catalog'?Promise.resolve({wordbooks:[]}):wordbooks(...args);
 });
}
const calls=page=>page.evaluate(()=>window.__wordPronunciations);
async function openBook(page,title){await page.locator('#enWordsTab').click();const card=page.locator('.en-wordbook-card').filter({hasText:title});await card.waitFor();await card.click();await page.getByRole('button',{name:'开始打字练习',exact:true}).waitFor()}
async function openPracticeSettings(page){const auto=page.locator('[data-word-auto-pronounce]');await auto.evaluate(n=>{const details=n.closest('details');if(details)details.open=true});return auto}
async function checkPlatform(kind,url){
 const context=await browser.newContext({viewport:{width:1360,height:1050}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // No remote resources are needed by this UI regression.
 await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/,r=>r.abort());
 try{
  await ready(page,kind,url);await mockPronunciation(page);
  const fixtures=await page.evaluate(async()=>{
   const specs=[['A 练习中',[['bleed','出血'],['blood','血液'],['bloom','开花']]],['B 未开始',[['study','学习'],['learn','学会']]],['C 已完成',[['review','复习']]],['D 速记练习',[['card','卡片'],['memory','记忆']]]],result={};
   for(const [title,rows]of specs){const saved=await englishApi.wordbooks('import',{title,rows,preview:false});result[title]=await englishApi.wordbooks('get',{id:saved.id})}
   const a=result['A 练习中'],c=result['C 已完成'];await englishApi.wordbooks('progress',{id:a.id,value:{index:0,seconds:20,completed:[a.words[0].id],order:'sequential',sequence:a.words.map(w=>w.id)}});await englishApi.wordbooks('progress',{id:c.id,value:{index:0,completed:[c.words[0].id]}});
   await englishApi.wordbooks('opened',{id:result['B 未开始'].id});await new Promise(r=>setTimeout(r,10));await englishApi.wordbooks('opened',{id:result['D 速记练习'].id});
   return result;
  });
  assert.equal(await page.evaluate(async()=>(await englishApi.wordbooks('preferences')).autoPronounce),true);
  assert.equal(await page.evaluate(async()=>(await englishApi.wordbooks('preferences')).pronunciationAccent),'en-US');
  await page.locator('#enWordsTab').click();await page.locator('.en-wordbook-groups').waitFor();
  const states=await page.locator('.en-wordbook-groups > [data-state]').evaluateAll(ns=>ns.map(n=>n.dataset.state));assert.deepEqual(states,['learning','new','done']);
  const learningCard=page.locator('.en-wordbook-card').filter({hasText:'A 练习中'});assert.match(await learningCard.innerText(),/1\s*\/\s*3/);assert.equal(await learningCard.locator('.en-course-meter').count(),1);
  const search=page.getByRole('searchbox',{name:'搜索单词本',exact:true}),sort=page.getByRole('combobox',{name:'单词本排序',exact:true}),domain=page.getByRole('combobox',{name:'单词本领域',exact:true});
  const newTitles=()=>page.locator('.en-wordbook-groups > [data-state="new"] .en-wordbook-card > strong').allTextContents();
  let titles=await newTitles();assert(titles.indexOf('D 速记练习')<titles.indexOf('B 未开始'),'default sort follows most recently opened books');
  await sort.selectOption('title');await page.waitForFunction(async()=>(await englishApi.wordbooks('preferences')).wordbookSort==='title');titles=await newTitles();assert(titles.indexOf('B 未开始')<titles.indexOf('D 速记练习'),'name sort changes the order within each state');
  await search.fill('A 练习中');assert.equal(await page.locator('.en-wordbook-groups .en-wordbook-card').count(),1);await search.fill('');
  await domain.selectOption('personal');assert.equal(await page.locator('.en-wordbook-groups .en-wordbook-card').count(),1);assert.match(await page.locator('.en-wordbook-groups').innerText(),/收藏词汇/);await domain.selectOption('');
  await page.locator('[aria-label="单词本状态"] [data-state="new"]').click();assert.deepEqual(await page.locator('.en-wordbook-groups > [data-state]').evaluateAll(ns=>ns.map(n=>n.dataset.state)),['new']);await page.locator('[aria-label="单词本状态"] [data-state="all"]').click();await sort.selectOption('recent');
  if(kind==='desktop'&&process.env.ENGLISH_WORD_CHECKS_DIR){fs.mkdirSync(process.env.ENGLISH_WORD_CHECKS_DIR,{recursive:true});await page.locator('#enWordbookContent').screenshot({path:path.join(process.env.ENGLISH_WORD_CHECKS_DIR,'wordbook-groups-progress.png')})}
  await openBook(page,'A 练习中');await page.getByRole('button',{name:'开始打字练习',exact:true}).click();
  await page.waitForFunction(()=>window.__wordPronunciations.length===1);assert.deepEqual((await calls(page)).map(x=>[x.text,x.accent]),[['bleed','en-US']]);
  const input=page.getByRole('textbox',{name:'输入当前单词或短语',exact:true});await input.fill('blxed');assert.equal(await page.locator('.en-word-target .is-wrong').innerText(),'x');assert.equal(await page.locator('.en-word-target').innerText(),'blxed');assert.equal(await input.inputValue(),'blxed');
  if(kind==='desktop'&&process.env.ENGLISH_WORD_CHECKS_DIR)await page.locator('#enWordPractice').screenshot({path:path.join(process.env.ENGLISH_WORD_CHECKS_DIR,'word-typing-actual-error.png')});
  await input.fill('bleed');await page.getByRole('button',{name:'提交 / 下一词',exact:true}).click();await page.waitForFunction(()=>window.__wordPronunciations.length===2);assert.equal((await calls(page))[1].text,'blood');
  const auto=await openPracticeSettings(page);await auto.uncheck();await page.waitForFunction(async()=>(await englishApi.wordbooks('preferences')).autoPronounce===false);
  await page.getByRole('button',{name:'跳过 →',exact:true}).click();assert.equal((await calls(page)).length,2,'disabled automatic pronunciation does not run on the next word');
  await openPracticeSettings(page);await page.locator('[data-word-pronunciation-accent]').selectOption('en-GB');await auto.check();await page.waitForFunction(async()=>{const p=await englishApi.wordbooks('preferences');return p.autoPronounce&&p.pronunciationAccent==='en-GB'});
  await page.getByRole('button',{name:'‹ 返回单词本',exact:true}).click();await openBook(page,'A 练习中');const before=(await calls(page)).length;await page.getByRole('button',{name:'开始打字练习',exact:true}).click();await page.waitForFunction(n=>window.__wordPronunciations.length===n+1,before);assert.equal((await calls(page)).at(-1).accent,'en-GB');
  await page.getByRole('button',{name:'‹ 返回单词本',exact:true}).click();
  await openBook(page,'D 速记练习');const cardBook=fixtures['D 速记练习'];const typingBefore=await page.evaluate(id=>englishApi.wordbooks('progress',{id}),cardBook.id);const startCalls=(await calls(page)).length;
  await page.getByRole('button',{name:'卡片速记',exact:true}).click();await page.waitForFunction(n=>window.__wordPronunciations.length===n+1,startCalls);
  await page.locator('.en-flashcard').click();await page.getByRole('checkbox',{name:'已掌握当前词条',exact:true}).check();await page.getByRole('combobox',{name:'卡片正面内容',exact:true}).selectOption('meaning');await page.waitForTimeout(100);assert.equal((await calls(page)).length,startCalls+1,'flips, mastery and card face changes do not replay audio');
  await page.getByRole('button',{name:'下一张 →',exact:true}).click();await page.waitForFunction(n=>window.__wordPronunciations.length===n+2,startCalls);
  await page.getByRole('button',{name:'‹ 返回单词本',exact:true}).click();
  const cardState=await page.evaluate(async id=>({progress:await englishApi.wordbooks('progress',{id}),list:(await englishApi.wordbooks()).find(b=>b.id===id)}),cardBook.id);
  for(const key of ['index','order','sequence','completed','seconds'])assert.deepEqual(cardState.progress[key],typingBefore[key],'flashcards preserve typing '+key);assert.equal(cardState.list.completedCount,1,'revealing a card contributes one studied word');
  await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-practice').click();assert.equal(await page.locator('#enWordAutoPronounce').isChecked(),true);assert.equal(await page.locator('#enWordPronunciationAccent').inputValue(),'en-GB');await page.locator('#enWordAutoPronounce').uncheck();await page.waitForFunction(async()=>(await englishApi.wordbooks('preferences')).autoPronounce===false);
  await ready(page,kind,url);await mockPronunciation(page);assert.deepEqual(await page.evaluate(async()=>{const p=await englishApi.wordbooks('preferences');return {auto:p.autoPronounce,accent:p.pronunciationAccent}}),{auto:false,accent:'en-GB'});
  await page.locator('#enWordsTab').click();await page.locator('.en-wordbook-groups').waitFor();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'wordbook groups fit a narrow screen');
  assert.deepEqual(errors,[]);console.log('PASS '+kind+': grouped progress/search/state/domain/sort, wrong input letters, single automatic word playback, accent/off persistence, flashcard study without typing-progress changes, narrow layout.');
 }finally{await context.close()}
}
(async()=>{
 try{const desktop=await startDesktop(),web=await startWeb();browser=await chromium.launch({headless:true,executablePath:chrome});await checkPlatform('desktop',desktop);await checkPlatform('web',web)}
 finally{await browser?.close();if(preview&&preview.exitCode===null){const exit=new Promise(r=>preview.once('exit',r));preview.kill();await exit}if(staticServer)await new Promise(r=>{staticServer.close(r);staticServer.closeAllConnections?.()});if(previewFile&&fs.existsSync(previewFile))fs.unlinkSync(previewFile);fs.rmSync(work,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
