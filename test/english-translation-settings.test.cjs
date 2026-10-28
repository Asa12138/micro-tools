/* Settings integration against isolated desktop + static browser previews. External calls use fixtures. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const output=process.env.ENGLISH_SETTINGS_REPORTS||'/Users/asa/WorkBuddy/Ztools/reports/translation-settings-preview';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 try{for(const [name,url]of [['desktop',process.env.ENGLISH_DESKTOP_TEST_URL||'http://127.0.0.1:8791'],['web',process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:8792/research-english/']]){
  const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.englishApi&&window.EnglishUI);
  await page.evaluate(async()=>{await englishApi.translationConfig({engine:'google',pronunciation:'youdao',googleNetwork:{mode:'direct',proxy:''},clearCredentials:['google-cloud']});await window.showView?.('english')});
  await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-translation').click();await page.waitForFunction(()=>document.querySelectorAll('#enTranslator option').length>1);
  assert.equal(await page.locator('#enPronunciation').inputValue(),'youdao');assert.equal(await page.locator('#enTranslator').inputValue(),'google');
  assert.equal(await page.locator('#enTranslationClear').isVisible(),false);
  await page.locator('#enTranslator').selectOption('mymemory');assert.equal(await page.locator('#enGoogleNetworkSection').isVisible(),false);assert.equal(await page.locator('#enTranslateFields input').count(),0);
  await page.locator('#enPronunciation').selectOption('google');assert.equal(await page.locator('#enGoogleNetworkSection').isVisible(),true);
  if(name==='desktop'){
   await page.locator('#enGoogleNetwork').selectOption('manual');await page.locator('#enGoogleProxy').fill('http://127.0.0.1:7897');
  }else{assert.equal(await page.locator('#enGoogleDesktopControls').isVisible(),false);assert.match(await page.locator('#enGoogleNetworkNote').innerText(),/浏览器.*系统|系统.*浏览器/)}
  await page.locator('#enTranslationSave').click();await page.waitForFunction(()=>document.getElementById('enTranslationStatus').textContent.includes('已保存'));
  let saved=await page.evaluate(()=>englishApi.translationConfig());assert.equal(saved.engine,'mymemory');assert.equal(saved.pronunciation,'google');if(name==='desktop')assert.equal(saved.googleNetwork.proxy,'http://127.0.0.1:7897');
  // Switching providers keeps unsaved field drafts. Blank passwords preserve an existing credential.
  await page.locator('#enTranslator').selectOption('google-cloud');await page.locator('[data-field="apiKey"]').fill('preview-only-key');
  await page.locator('#enTranslator').selectOption('mymemory');await page.locator('#enTranslator').selectOption('google-cloud');assert.equal(await page.locator('[data-field="apiKey"]').inputValue(),'preview-only-key');
  assert.match(await page.locator('#enTranslationSignup').innerText(),/官网.*免费/);await page.locator('#enTranslationSave').click();await page.waitForFunction(()=>document.querySelector('[data-field="apiKey"]').value==='');
  await page.locator('#enTranslationSave').click();await page.waitForFunction(async()=>!!(await englishApi.translationConfig()).providers['google-cloud'].has.apiKey);
  await page.locator('#enTranslationClear').click();await page.waitForFunction(async()=>!(await englishApi.translationConfig()).providers['google-cloud'].has.apiKey);
  if(name==='web'){
   let queries=0;await context.route('https://api.mymemory.translated.net/get?**',route=>{queries++;const u=new URL(route.request().url());assert.equal(u.searchParams.get('q'),'research');assert.equal(u.searchParams.get('langpair'),'en|zh-CN');return route.fulfill({contentType:'application/json',body:JSON.stringify({responseStatus:200,responseData:{translatedText:'研究'}})})});
   await page.locator('#enTranslator').selectOption('mymemory');await page.locator('#enTranslationTest').click();await page.waitForFunction(()=>document.getElementById('enTranslationStatus').textContent.includes('测试成功：研究'));assert.equal(queries,1);
   assert.equal(await page.evaluate(()=>englishApi.translate({text:'research'}).then(r=>r.cached)),true);assert.equal(queries,1);
   const rejected=await page.evaluate(()=>englishApi.translate({text:'é'.repeat(251)}).then(()=>false,e=>e.message));assert.match(rejected,/500 UTF-8/);
   await page.evaluate(()=>englishApi.translationConfig({pronunciation:'youdao'}));const us=await page.evaluate(()=>englishApi.pronounce({text:'research & development'}));assert.equal(new URL(us.url).hostname,'dict.youdao.com');assert.equal(new URL(us.url).searchParams.get('type'),'2');assert.equal(new URL(us.url).searchParams.get('audio'),'research & development');
   const uk=await page.evaluate(()=>englishApi.pronounce({text:'research',accent:'en-GB'}));assert.equal(new URL(uk.url).searchParams.get('type'),'1');
   await page.evaluate(()=>englishApi.translationConfig({pronunciation:'google'}));assert.equal(new URL((await page.evaluate(()=>englishApi.pronounce({text:'research'}))).url).hostname,'translate.google.com');
   // HTTP-success error payloads must not be shown as translations.
   await context.unroute('https://api.mymemory.translated.net/get?**');await context.route('https://api.mymemory.translated.net/get?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({responseStatus:200,quotaFinished:true,responseData:{translatedText:'QUOTA EXCEEDED'}})}));
   assert.match(await page.evaluate(()=>englishApi.translate({text:'biology'}).then(()=>'',e=>e.message)),/额度/);
  }
  // Return to the requested defaults for the delivered preview.
  await page.evaluate(()=>englishApi.translationConfig({engine:'google',pronunciation:'youdao',googleNetwork:{mode:'auto',proxy:''}}));await page.reload();await page.waitForFunction(()=>window.englishApi&&window.EnglishUI);await page.evaluate(()=>window.showView?.('english'));await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-translation').click();await page.waitForFunction(()=>document.querySelectorAll('#enTranslator option').length>1);
  assert.equal(await page.locator('#enPronunciation').inputValue(),'youdao');assert.equal(await page.locator('#enTranslator').inputValue(),'google');
  fs.mkdirSync(output,{recursive:true});await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/'+name+'-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no horizontal overflow');
  assert.deepEqual(errors,[]);console.log('PASS '+name+': settings/defaults, provider grouping, proxy capability, save/reload, credential drafts/clear, narrow layout'+(name==='web'?', MyMemory request/cache/quota/UTF-8 bounds, Youdao/Google URLs':''));await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
