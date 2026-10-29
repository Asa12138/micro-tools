// Real browser, isolated development stores, mocked speech and AI responses.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const webURL=process.env.PARITY_WEB_URL||'http://127.0.0.1:53821/research-english/',desktopURL=process.env.PARITY_DESKTOP_URL||'http://127.0.0.1:53822/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 const errors=[],calls=[];let exported;
 try{for(const [kind,url]of [['web',webURL],['desktop',desktopURL]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>{errors.push(kind+': '+e.message);console.log('PAGE ERROR',e.message)});console.log(kind,'startup');
  await context.route('https://**/*',route=>{const req=route.request();if(req.url().startsWith('https://ai.fixture/')){calls.push({url:req.url(),headers:req.headers(),body:req.postDataJSON()});return route.fulfill({contentType:'application/json',body:JSON.stringify({content:[{type:'text',text:'OK'}],choices:[{message:{content:'OK'}}]})});}return route.abort()});
  await page.addInitScript(()=>{
   window.__spoken=[];window.__pronounced=[];
   const voices=[{lang:'en-US',name:'Remote fixture',localService:false},{lang:'en-US',name:'Local fixture',localService:true}];
   Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,cancel(){},speak(u){window.__spoken.push({text:u.text,local:u.voice.localService});u.onstart?.()},addEventListener(){},removeEventListener(){}}});
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
   HTMLMediaElement.prototype.play=async function(){};HTMLMediaElement.prototype.pause=function(){};
  });
  await page.goto(url);if(kind==='web')await page.waitForFunction(()=>window.ResearchEnglishWeb&&document.getElementById('webLoading')===null);else await page.waitForFunction(()=>window.EnglishUI&&window.englishApi);
  await page.evaluate(async()=>{await englishApi.settings({preload:false,autoPlay:false,voice:'andrew',allowOnline:true,browserFallback:true});englishApi.speech=Object.assign(async()=>{throw Error('fixture Microsoft failure')},{capabilities:englishApi.speech.capabilities});englishApi.pronounce=async input=>{window.__pronounced.push(input);return {url:'https://audio.fixture/test.mp3',source:'Google fixture'}}});
  if(kind==='desktop'){await page.locator('[data-open="english"]').first().click();await page.locator('#enCourses .en-course').first().waitFor()}
  assert(await page.locator('#enVoice option[value="google"]').count());assert.equal(await page.locator('#enBrowserFallback').evaluate(e=>e.hidden),false);
  console.log(kind,'translation and voice controls');await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-translation').click();assert.equal(await page.locator('#enTranslator option').count(),14);
  await page.locator('#enPrefTab-sound').click();await page.locator('#enVoice').selectOption('google');await page.locator('#enVoicePreview').click();await page.waitForFunction(()=>window.__pronounced.length>0);assert.equal(await page.evaluate(()=>__pronounced.at(-1).engine),'google');
  await page.locator('#enVoice').selectOption('system');await page.locator('#enVoicePreview').click();await page.waitForFunction(()=>window.__spoken.length>0);assert.equal(await page.evaluate(()=>__spoken.at(-1).local),true);
  if(kind==='web'){
   console.log(kind,'AI settings');await page.evaluate(()=>showView('settings'));await page.locator('#webAIProvider').selectOption('anthropic');assert.equal(await page.locator('#webAIProtocol').inputValue(),'anthropic');await page.locator('#webAIBaseUrl').fill('https://ai.fixture/v1');await page.locator('#webAIModel').fill('fixture');await page.locator('#webAIApiKey').fill('fake-ui-key');
   await page.getByRole('button',{name:'保存接口',exact:true}).click();await page.getByText('配置已保存，未发送模型请求。密钥仅当前标签页会话有效。',{exact:true}).waitFor();assert.equal(calls.length,0);
   await page.getByRole('button',{name:'测试连接',exact:true}).click();await page.getByText('连接成功，模型已返回文本。',{exact:true}).waitFor();assert.equal(calls.length,1);assert.equal(calls[0].headers['x-api-key'],'fake-ui-key');assert.equal(calls[0].body.model,'fixture');assert(calls[0].url.endsWith('/messages'));
   await page.getByRole('button',{name:'关闭',exact:true}).last().click();
  }
  console.log(kind,'practice fallback');
  // A new, uncached sentence must use strict local fallback after Microsoft fails.
  await page.evaluate(async()=>{const saved=await englishApi.save({title:'UI parity '+Date.now(),sentences:[{en:'We verify a new sentence for cross platform fallback.',zh:'我们验证新的跨端回退句子。'}]});window.__testLesson=saved.id});
  await page.locator('#enVoice').selectOption('andrew');await page.locator('#enCustomTab').click();await page.locator('#enCourses .en-course').filter({hasText:'UI parity'}).last().click();await page.locator('#enPlay').click();await page.waitForFunction(()=>document.getElementById('enAudioStatus').textContent.includes('已改用本机声音'));assert.equal(await page.evaluate(()=>__spoken.at(-1).local),true);await page.locator('#enPlay').click();
  await page.locator('#enSoundToggle').click();await page.locator('#enPracticeVoice').selectOption('google');await page.locator('#enSoundClose').click();await page.locator('#enPlay').click();await page.waitForFunction(()=>document.getElementById('enAudioStatus').textContent.includes('Google 兼容发音'));assert.equal(await page.evaluate(()=>__pronounced.at(-1).engine),'google');await page.locator('#enPlay').click();
  await page.locator('#enReveal').click();
  // Selection lookup's local button must skip the remote voice even with online speech off.
  await page.evaluate(async()=>{await englishApi.settings({allowOnline:false});englishApi.translate=async()=>({translation:'验证'});englishApi.dictionary=async()=>({});const panel=document.getElementById('enAnalysis'),span=document.createElement('span');span.textContent='privacy';span.className='en-lookup-text';panel.append(span);const range=document.createRange();range.selectNodeContents(span);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);panel.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}))});
  await page.getByRole('button',{name:'本机朗读',exact:true}).click();assert.equal(await page.evaluate(()=>__spoken.at(-1).local),true);
  await page.locator('#enPracticeBack').click();await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-backup').click();
  if(kind==='desktop'){await page.locator('#enFullBackupImport').setInputFiles({name:'web.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByText(/完整备份已合并/).waitFor();assert(await page.evaluate(()=>englishApi.list().then(x=>x.some(c=>c.title==='Browser transfer fixture'))))}
  else await page.evaluate(()=>englishApi.save({title:'Browser transfer fixture',sentences:[{en:'We preserve the study record.',zh:'我们保留学习记录。'}]}));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#enFullBackupExport').click()]);const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.format,'research-english-full-backup-v1');assert(!JSON.stringify(backup).includes('fake-ui-key'));if(kind==='web')exported=backup;
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await context.close();console.log('PASS '+kind+' UI: 14 translators, Google sentence voice, strict local preview/fallback, full-backup controls and narrow layout');
 }
 assert.deepEqual(errors,[]);console.log('PASS web AI presets/protocol controls, explicit request count and browser backup imported through desktop UI.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
