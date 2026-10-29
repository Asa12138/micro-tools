// Real browser storage/playback; controlled gateway responses (no production quota).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const app=process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:53922/apps/research-english/';
const bytes=fs.readFileSync(path.join(__dirname,'fixtures/speech.mp3'));
(async()=>{
 const browser=await chromium.launch({executablePath:'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true});
 try{
  for(const edge of [false,true]){
   const context=await browser.newContext({...(edge?{userAgent:'Mozilla/5.0 Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'}:{})});
   const page=await context.newPage(),errors=[];let calls=0,limited=false;
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({edge})=>{
    window.testSockets=0;window.testSpoken=[];
    if(edge)window.WebSocket=class{constructor(){testSockets++;setTimeout(()=>this.onerror?.({}),20)}close(){}};
    const synth=new EventTarget();Object.assign(synth,{getVoices:()=>[{name:'Test local English',lang:'en-US',localService:true}],cancel(){},speak(u){testSpoken.push(u.text);u.onstart?.()}});
    Object.defineProperty(window,'speechSynthesis',{value:synth});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
   },{edge});
   await context.route('https://asa-voice-lab-beta.vercel.app/api/public/speech',async route=>{
    const headers={'Access-Control-Allow-Origin':new URL(app).origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'X-Quota-Remaining,X-Quota-Limit,Retry-After'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    calls++;assert.equal(route.request().headers().authorization,undefined);
    assert.equal(route.request().postDataJSON().voice,'en-US-AndrewMultilingualNeural');
    return route.fulfill(limited?{status:429,headers:{...headers,'Retry-After':'600','Content-Type':'application/json'},body:JSON.stringify({error:{code:'ip_daily_limit',message:'当前 IP 今日 30 次公共语音额度已用完'}})}:{status:200,headers:{...headers,'Content-Type':'audio/mpeg','X-Quota-Remaining':'29','X-Quota-Limit':'30'},body:bytes});
   });
   const boot=async()=>{await page.goto(app);await page.evaluate(()=>ResearchEnglishReady)};await boot();
   await page.evaluate(async()=>{await englishApi.settings({...await englishApi.settings(),voice:'andrew',autoPlay:false,preload:true});await englishApi.save({title:'Public gateway browser test',sentences:[{en:'A unique sentence for the public gateway test.',zh:'公共语音测试。'},{en:'Another unique sentence for quota fallback.',zh:'限额回退测试。'}]})});
   await boot();const open=async()=>{await page.locator('#enCustomTab').click();await page.locator('#enCourses .en-course').filter({hasText:'Public gateway browser test'}).click();await page.locator('#enPlay').waitFor()};await open();
   await page.waitForFunction(()=>document.querySelector('#enCacheText').textContent.includes('公共语音在播放时生成'));
   assert.equal(calls,0,'background must not consume public quota');
   await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enPlay').getAttribute('aria-pressed')==='true');
   assert.equal(calls,1);assert.match(await page.locator('#enPracticePublicVoiceStatus').textContent(),/29 \/ 30/);
   assert.equal(await page.evaluate(()=>testSockets),edge?1:0);
   await boot();await open();await page.locator('#enPlay').click();await page.waitForFunction(()=>document.querySelector('#enPlay').getAttribute('aria-pressed')==='true');assert.equal(calls,1,'IndexedDB cache survives reload');
   await page.locator('#enPlay').click();limited=true;
   await page.evaluate(async()=>{try{await englishApi.speech('A different uncached sentence.')}catch{}});
   assert.equal(calls,2);
   await page.locator('#enNext').click();await page.locator('#enPlay').click();await page.waitForFunction(()=>testSpoken.length>0);
   assert.equal(calls,2,'quota cooldown stops repeat requests');assert.match(await page.locator('#enAudioStatus').textContent(),/本机/);
   await page.locator('#enPracticeBack').click();await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-sound').click();
   assert.match(await page.locator('#enWebVoiceGuide').textContent(),/30 次/);
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   assert.deepEqual(errors,[]);console.log('PASS '+(edge?'Edge failure':'non-Edge')+': no background quota, MP3 playback, persistent cache, quota/local fallback, guide and mobile layout');await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
