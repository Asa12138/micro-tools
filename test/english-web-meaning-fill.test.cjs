/* New web controls and real IndexedDB persistence; translation replies are fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const url=process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:53786/apps/research-english/';
const output=process.env.ENGLISH_FILL_REPORTS||path.resolve(__dirname,'../../reports/english-translation-fill-20261028');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 try{
  const context=await browser.newContext({viewport:{width:1360,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync(output,{recursive:true});
  let fail=true,allFail=false,slow=false,calls=[];
  await context.route('https://api.mymemory.translated.net/get?**',async route=>{const word=new URL(route.request().url()).searchParams.get('q');calls.push(word);if(slow)await new Promise(r=>setTimeout(r,800));return route.fulfill({status:allFail||word==='offline'&&fail?503:200,contentType:'application/json',body:JSON.stringify({responseStatus:200,responseData:{translatedText:'释义：'+word}})})});
  await page.goto(url);await page.waitForFunction(()=>window.EnglishUI&&window.ResearchEnglishWeb);await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-translation').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enTranslator option').length===14);
  assert.match(await page.locator('.web-header__notice').innerText(),/📢.*网页版/);assert.equal(await page.locator('.web-header__notice').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 245, 219)');
  await page.locator('#enTranslator').selectOption('baidu');assert.deepEqual(await page.locator('#enTranslateFields input').evaluateAll(ns=>ns.map(n=>n.dataset.field)),['appId','secretKey']);
  await page.locator('[data-field="appId"]').fill('fixture-app-id');await page.locator('[data-field="secretKey"]').fill('fixture-secret');await page.locator('#enTranslationSave').click();await page.waitForFunction(async()=>!!(await englishApi.translationConfig()).providers.baidu.has.secretKey);
  await page.locator('#enTranslator').selectOption('tencent');assert.equal(await page.locator('[data-field="region"]').inputValue(),'ap-guangzhou');assert.equal(await page.locator('[data-field="projectId"]').inputValue(),'0');
  await page.locator('#enTranslator').selectOption('baidu');assert.equal(await page.locator('[data-field="appId"]').inputValue(),'fixture-app-id');assert.match(await page.locator('[data-field="secretKey"]').getAttribute('placeholder'),/已保存/);
  await page.screenshot({path:path.join(output,'translation-presets.png'),fullPage:true});
  await page.locator('#enTranslator').selectOption('mymemory');await page.locator('#enTranslationSave').click();await page.waitForFunction(async()=>(await englishApi.translationConfig()).engine==='mymemory');
  await page.evaluate(async()=>{for(const term of ['population','offline','sample'])await englishApi.vocabulary('save',{term});await englishApi.vocabulary('save',{term:'research',meaning:'保留手工释义'})});
  async function openFavorites(){await page.locator('#enWordsTab').click();const card=page.locator('.en-wordbook-card').filter({hasText:'收藏词汇'});await card.waitFor();await card.click();await page.locator('.en-wordbook-fill').waitFor()}
  await openFavorites();await page.screenshot({path:path.join(output,'fill-before.png'),fullPage:true});
  await page.getByRole('button',{name:'一键补全释义（3）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.en-wordbook-fill [role="status"]').textContent.includes('已补全 2 个'));
  assert.match(await page.locator('.en-wordbook-fill [role="status"]').innerText(),/失败 1 个/);assert.equal(calls.includes('research'),false);assert.equal(await page.locator('.en-wordbook-entry').filter({hasText:'research'}).locator('p').innerText(),'保留手工释义');
  fail=false;await page.locator('.en-wordbook-entry').filter({hasText:'offline'}).getByRole('button',{name:'补全释义',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.en-wordbook-fill [role="status"]').textContent.includes('已补全 1 个'));
  assert.equal(await page.locator('.en-wordbook-entry').filter({hasText:'offline'}).locator('p').innerText(),'释义：offline');await page.screenshot({path:path.join(output,'fill-after.png'),fullPage:true});
  await page.reload();await page.waitForFunction(()=>window.EnglishUI&&window.ResearchEnglishWeb);assert.equal(await page.evaluate(async()=>(await englishApi.vocabulary()).filter(w=>w.meaning).length),4);assert.equal(await page.evaluate(async()=>(await englishApi.translationConfig()).providers.baidu.has.secretKey),true);
  await page.evaluate(async()=>{for(const term of ['cancel-a','cancel-b','cancel-c'])await englishApi.vocabulary('save',{term})});await openFavorites();slow=true;calls=[];await page.getByRole('button',{name:'一键补全释义（3）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.en-wordbook-fill [role="status"]').textContent.includes('cancel-c'));await page.getByRole('button',{name:'停止后续查询'}).click();await page.waitForFunction(()=>document.querySelector('.en-wordbook-fill [role="status"]').textContent.includes('已停止'));
  assert.equal(calls.length,1);assert.equal(await page.evaluate(async()=>(await englishApi.vocabulary()).filter(w=>!w.meaning).length),2);
  await page.getByRole('button',{name:'‹ 全部单词本',exact:true}).click();await page.evaluate(async()=>{for(const term of ['pause-a','pause-b'])await englishApi.vocabulary('save',{term})});await page.locator('.en-wordbook-card').filter({hasText:'收藏词汇'}).click();
  allFail=true;slow=false;calls=[];await page.getByRole('button',{name:'一键补全释义（4）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.en-wordbook-fill [role="status"]').textContent.includes('连续 3 次失败'));assert.equal(calls.length,3);assert.equal(await page.evaluate(async()=>(await englishApi.vocabulary()).filter(w=>!w.meaning).length),4);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'fill-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS UI: 14 presets, Baidu credentials/Tencent defaults, highlighted notice, partial failure and single-word retry, cancellation/three-failure pause, IndexedDB reload, 390px layout. '+output);
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
