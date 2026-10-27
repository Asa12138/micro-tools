/* Opt-in real Edge/Microsoft/Google smoke test; isolated browser data only. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const app=process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:53781/apps/research-english/';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.ENGLISH_WEB_CHROME||'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 try{
  const page=await browser.newPage(),errors=[],materialAudio=[];let sockets=0;
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});page.on('websocket',ws=>{if(new URL(ws.url()).hostname==='speech.platform.bing.com')sockets++});
  page.on('request',r=>{if(/\/materials\/.*audio/.test(r.url()))materialAudio.push(r.url())});
  await page.addInitScript(()=>{const NativeAudio=Audio;window.testAudio=[];window.Audio=class extends NativeAudio{constructor(...args){super(...args);testAudio.push(this);this.addEventListener('playing',()=>{this.testPlayed=true});}};});
  const boot=async()=>{await page.goto(app);await page.waitForFunction(()=>window.ResearchEnglishReady);await page.evaluate(()=>ResearchEnglishReady)};await boot();
  const title='On-demand community speech fixture';
  await page.evaluate(async title=>{const api=englishApi;await api.settings({...await api.settings(),voice:'andrew',autoPlay:false,preload:false});await api.communityImport({manifest:{type:'course'},content:{title,sentences:[{en:'This lesson has no prepared recording.',zh:'这个课程没有预制录音。'}]}})},title);
  await boot();const openCourse=async()=>{await page.locator('#enCourses .en-course').filter({hasText:title}).click();await page.locator('#enAnswer input').first().waitFor()};await openCourse();
  assert.equal(sockets,0,'preload disabled');
  await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enAudioStatus').textContent.includes('Microsoft Andrew'),{},{timeout:50000});
  assert.equal(sockets,1);assert(await page.evaluate(()=>testAudio.some(a=>a.testPlayed&&a.currentSrc.startsWith('blob:'))),'actual media playback');
  await page.waitForFunction(()=>testAudio.some(a=>a.testPlayed&&a.ended));
  await page.locator('#enPlay').click();await page.waitForFunction(()=>testAudio.some(a=>!a.paused));assert.equal(sockets,1,'same sentence reuses cache');await page.locator('#enPlay').click();
  await boot();await openCourse();await page.locator('#enPlay').click();await page.waitForFunction(()=>testAudio.some(a=>a.testPlayed));assert.equal(sockets,1,'cache survives reload');await page.locator('#enPlay').click();
  console.log('PASS real Andrew generation, playback, reload cache, no audio-pack download');
  // Focused input, target-phase interception, IME and held-key behavior.
  const input=page.locator('#enAnswer input').first();await input.focus();await input.evaluate(n=>n.addEventListener('keydown',e=>e.stopPropagation()));await page.keyboard.press('Alt+a');assert(await page.locator('#enAnalysis').isVisible());
  await input.dispatchEvent('keydown',{key:'a',code:'KeyA',altKey:true,repeat:true});assert(await page.locator('#enAnalysis').isVisible());
  await page.keyboard.press('F8');assert(await page.locator('#enAnalysis').isHidden());
  await input.dispatchEvent('keydown',{key:'a',code:'KeyA',altKey:true,isComposing:true});assert(await page.locator('#enAnalysis').isHidden());
  await input.dispatchEvent('keydown',{key:'a',altKey:true});assert(await page.locator('#enAnalysis').isVisible());
  await page.locator('.en-answer-sentence .en-lookup-word').first().click();await page.locator('.en-lookup').waitFor();
  await page.getByRole('button',{name:'▶ 美式发音',exact:true}).click();await page.waitForFunction(()=>testAudio.some(a=>a.testPlayed&&a.currentSrc.includes('translate_tts')),{},{timeout:30000});
  assert.match(await page.locator('.en-word-pronunciation [role=status]').innerText(),/Google/);console.log('PASS Alt+A capture, F8, repeat/IME guards, live Google word playback');
  await page.evaluate(async()=>englishApi.settings({...await englishApi.settings(),voice:'ava'}));await boot();await openCourse();await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enAudioStatus').textContent.includes('Microsoft Ava'),{},{timeout:50000});assert.equal(sockets,2);console.log('PASS voice change generates Ava instead of using Andrew cache');
  await page.evaluate(async()=>englishApi.settings({...await englishApi.settings(),voice:'ryan',allowOnline:false}));await boot();await openCourse();await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enAudioStatus').textContent.includes('在线语音已关闭'));assert.equal(sockets,2,'online opt-out stops uncached TTS');
  assert.deepEqual(materialAudio,[]);assert.deepEqual(errors,[]);console.log('PASS online opt-out, zero audio-pack requests, no page errors');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
