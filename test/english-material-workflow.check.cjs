// Browser smoke checks for both local previews. Model output is a fixture, never a paid request.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const output='/Users/asa/WorkBuddy/Ztools/reports/translation-settings-preview';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 try{for(const [name,url]of [['desktop','http://127.0.0.1:8791/'],['web','http://127.0.0.1:8792/research-english/']]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.englishApi&&window.EnglishUI);await page.evaluate(()=>window.showView?.('english'));
  await page.locator('#enLibraryTab').click();await page.locator('#enSort').waitFor();
  assert.equal(await page.locator('#enSort').inputValue(),'recent');
  const domains=await page.locator('#enDomain option').allTextContents();assert(domains.includes('基础入门'));
  await page.screenshot({path:output+'/'+name+'-library.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'mobile library fits');await page.setViewportSize({width:1440,height:1000});
  await page.locator('#enCourses button.en-course').first().click();await page.locator('#enDirectoryToggle').click();await page.locator('#enFilter').selectOption('incomplete');
  assert(await page.locator('#enOutline button').count()>0);assert.doesNotMatch(await page.locator('#enOutline').innerText(),/✓/);
  await page.screenshot({path:output+'/'+name+'-unfinished.png',fullPage:true});await page.locator('#enPracticeBack').click();
  await page.locator('#enCustomTab').click();await page.locator('#enHubNav [data-pane=custom]').click();await page.locator('#enCreateTab').click();
  await page.evaluate(async()=>{
   window.researchApi={checkAvailability:async()=>({ok:true,state:'ready',message:'本地流程验证 · 模拟模型返回'}),cancel(){},async call(messages){const payload=JSON.parse(messages[1].content);return JSON.stringify({description:'围绕土壤研究，练习比较不同地点的群落与解释研究结果。',sentences:[{en:'We compare soil communities across the selected sampling sites.',zh:'我们比较所选采样地点的土壤群落。',note:'compare across 用于描述跨地点的比较。',source_id:payload.sources[0].id,chunks:[{en:'We',role:'主语',zh:'我们'},{en:'compare',role:'谓语',zh:'比较'},{en:'soil communities',role:'宾语',zh:'土壤群落'},{en:'across the selected sampling sites.',role:'状语',zh:'在所选采样地点之间'}]}]})}};
   await window.AIConnection.refresh(true);
  });
  await page.locator('#enTitle').fill('科研表达 · 本地流程验证');await page.locator('#enMaterial').fill('We compare soil communities across the selected sampling sites.');await page.locator('#enCount').fill('1');await page.locator('#enAI').click();
  await page.waitForFunction(()=>document.getElementById('enNotice').textContent.includes('AI 草稿已生成'));
  assert.equal(await page.locator('#enAgentJson').inputValue(),await page.locator('#enDraftJson').inputValue());assert.equal(await page.locator('#enImportAgent').isVisible(),false);assert.equal(await page.locator('#enAgentFilePath').isVisible(),false);
  assert.match(await page.locator('#enPreview').innerText(),/围绕土壤研究/);assert.equal(await page.locator('#enSave').isEnabled(),true);
  await page.locator('#enAgentReturn').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/'+name+'-ai-return.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'mobile import fits');
  assert.deepEqual(errors,[]);console.log('PASS '+name+': library/unfinished filter, automatic AI JSON and description preview, no manual import step, responsive layout; model call was a stub.');await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
