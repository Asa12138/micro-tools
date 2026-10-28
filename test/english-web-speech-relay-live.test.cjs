// Opt-in: small real Microsoft/Google requests using isolated browser profiles.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const app=process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:53785/apps/research-english/';
const executablePath=process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
(async()=>{const browser=await chromium.launch({executablePath,headless:true});try{
 const page=await browser.newPage(),errors=[],requests=[];let sockets=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',()=>sockets++);page.on('request',r=>{if(new URL(r.url()).pathname==='/api/speech'&&r.method()==='POST')requests.push(r.postDataJSON());});
 await page.addInitScript(()=>{const NativeAudio=Audio;window.testAudio=[];window.Audio=class extends NativeAudio{constructor(...args){super(...args);testAudio.push(this);this.addEventListener('playing',()=>{this.testPlayed=true;});}};});
 const boot=async()=>{await page.goto(app);await page.evaluate(()=>ResearchEnglishReady);};await boot();
 assert.equal(await page.evaluate(()=>englishApi.speechCapabilities.available),true);
 const title='Cross-browser relay fixture';
 await page.evaluate(async title=>{await englishApi.settings({...await englishApi.settings(),voice:'andrew',autoPlay:false,preload:false});await englishApi.communityImport({manifest:{type:'course'},content:{title,sentences:[{en:'We compare samples collected at different times.',zh:'我们比较不同时间采集的样本。'}]}});},title);await boot();
 const open=async()=>{await page.locator('#enCourses .en-course').filter({hasText:title}).click();await page.locator('#enAnswer input').first().waitFor();};await open();
 await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enAudioStatus').textContent.includes('Microsoft Andrew')&&testAudio.some(a=>a.testPlayed),{},{timeout:55000});
 assert.equal(requests.length,1);assert.equal(requests[0].engine,'microsoft');assert.equal(sockets,0);console.log('PASS real Microsoft Andrew via relay and browser MP3 playback');
 await page.locator('#enPlay').click();await boot();await open();await page.locator('#enPlay').click();await page.waitForFunction(()=>testAudio.some(a=>a.testPlayed));assert.equal(requests.length,1);console.log('PASS IndexedDB audio reuse after reload');
 await page.locator('#enPlay').click();await page.evaluate(async()=>{await englishApi.translationConfig({pronunciation:'youdao'});await englishApi.settings({...await englishApi.settings(),voice:'google'});});await boot();await open();
 await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enAudioStatus').textContent.includes('Google 兼容发音 · 在线播放')&&testAudio.some(a=>a.testPlayed),{},{timeout:55000});
 assert.equal(requests.at(-1).engine,'google');assert.equal(await page.evaluate(()=>englishApi.translationConfig().then(c=>c.pronunciation)),'youdao');console.log('PASS real Google sentence audio while word source remains Youdao');
 await page.locator('#enPlay').click();await page.locator('#enPracticeBack').click();await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-sound').click();await page.locator('#enVoicePreview').click();await page.waitForFunction(()=>document.querySelector('#enVoiceStatus').textContent.includes('Google 兼容发音 · 在线试听'),{},{timeout:55000});assert.equal(requests.at(-1).engine,'google');console.log('PASS Google settings preview playback');
 assert.deepEqual(errors,[]);console.log('PASS no page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
