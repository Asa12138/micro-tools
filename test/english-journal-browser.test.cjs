// Real IndexedDB, shared service/UI and PNG rendering; isolated browser profile, mocked clipboard only.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.ENGLISH_WEB_CHROME||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.ENGLISH_JOURNAL_TEST_URL||'http://127.0.0.1:49184/research-english/';
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
 try{
  await page.clock.setFixedTime(new Date(2026,9,29,12));
  await page.goto(url);await page.waitForFunction(()=>window.ResearchEnglishWeb&&!document.getElementById('webLoading'));
  const ids=await page.evaluate(async()=>{await englishApi.settings({...await englishApi.settings(),voice:'system',autoPlay:false,preload:false});const out=[];for(let i=0;i<2;i++){const c=await englishApi.save({title:'Persistent badge '+i,sentences:['We compare soil communities.']},true);await englishApi.saveProgress(c.id,{results:{0:{modes:{speaking:{complete:true,completedAt:new Date().toISOString()}}}}});out.push(c.id)}return out});
  const initial=await page.evaluate(()=>englishApi.courseBadges());assert.equal(initial.length,1);assert.equal(initial[0].id,'panda');
  assert.equal(await page.evaluate(()=>englishApi.activity().then(x=>x.goalMinutes)),30);
  await page.evaluate(async()=>{const {today}=await englishApi.activity();await englishApi.activity('record',{session:'test',totals:{[today]:1799}})});
  assert.equal(await page.evaluate(()=>englishApi.activity().then(x=>x.checkedToday)),false);
  await page.evaluate(async()=>{const {today}=await englishApi.activity();await englishApi.activity('record',{session:'test',totals:{[today]:1800}})});
  assert.equal(await page.evaluate(()=>englishApi.activity().then(x=>x.checkedToday)),true);
  await page.reload();await page.waitForFunction(()=>window.ResearchEnglishWeb&&!document.getElementById('webLoading'));
  await page.locator('#enSettingsTab').click();await page.locator('#enGoalMinutes').fill('40');await page.locator('#enGoalForm button').click();await page.waitForFunction(()=>document.querySelector('#enGoalStatus').textContent.includes('已保存'));
  await page.locator('#enCheckinCard').click();await page.getByRole('button',{name:'关闭完成卡片'}).click();
  await page.locator('#enEarnedBadges button').first().click();await page.evaluate(()=>{navigator.clipboard.write=async items=>{const blob=await items[0].getType('image/png');window.copiedPNG={type:blob.type,size:blob.size}}});await page.getByRole('button',{name:'复制卡片',exact:true}).click();await page.waitForFunction(()=>window.copiedPNG);
  const png=await page.evaluate(()=>copiedPNG);assert.equal(png.type,'image/png');assert(png.size>10000);await page.locator('#enNotice').filter({hasText:'卡片已复制'}).waitFor();assert.equal(await page.locator('.en-course-reward-card').count(),0);
  await page.reload();await page.waitForFunction(()=>window.ResearchEnglishWeb&&!document.getElementById('webLoading'));assert.equal(await page.evaluate(()=>englishApi.activity().then(x=>x.goalMinutes)),40);assert.deepEqual(await page.evaluate(()=>englishApi.courseBadges()),initial);
  const snapshot=await page.evaluate(()=>ResearchEnglishWeb.store.export());assert(snapshot['english-achievements-v1'].awards.panda);assert(!snapshot['english-course-badges-v1']);assert.equal(snapshot['english-activity-v1'].goalMinutes,40);
  await page.locator('#enSettingsTab').click();await page.locator('#enEarnedBadges button').first().click();await page.waitForTimeout(8300);assert.equal(await page.locator('.en-course-reward-card').count(),0,'card auto closes');
  // All theme choices remain usable and confined to English.
  await page.locator('#enPrefTab-theme').click();for(const accent of ['green','blue','violet','amber','cyan','rose','indigo','slate']){await page.locator('[data-en-accent="'+accent+'"]').click();assert.equal(await page.locator('#view-english').getAttribute('data-accent'),accent)}
  await page.locator('[data-en-mode="dark"]').click();await page.locator('#enPrefTab-activity').click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('PASS browser IndexedDB goal/badge reload, exact threshold, PNG copy/toast, eight-second dismissal, all accent themes and dark mobile layout; copied PNG bytes:',png.size);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
