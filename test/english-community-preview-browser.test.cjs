// Delayed catalog response: cards/local settings stay usable; installs and probes are isolated fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright');
const app=process.env.ENGLISH_WEB_TEST_URL||'http://127.0.0.1:53922/apps/research-english/';
const audio=fs.readFileSync(path.join(__dirname,'fixtures/speech.mp3'));
const rows=['科研写作 · 精简示例','学术交流 · 会议讨论','论文阅读 · 证据与结论'].map((title,i)=>{
 const body=JSON.stringify({title,description:'这段简介只在预览详情中展示。',sentences:[{en:'We compare different samples.',zh:'我们比较不同样本。'}]});
 return {id:'fixture-'+i,manifest:{type:'course',title,description:'这段简介只在预览详情中展示。',domain:'科研写作',author:'科研小盒',tags:['学术英语']},body,item_count:1,bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex')};
});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Users/asa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];let release,catalogCalls=0,speechCalls=0,failSpeech=false;
  const pending=new Promise(r=>release=r);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rest/v1/community_packs?**',async route=>{
   const url=new URL(route.request().url()),id=url.searchParams.get('id');
   if(!id){catalogCalls++;await pending}
   await route.fulfill({json:id?rows.filter(r=>'eq.'+r.id===id):rows});
  });
  await page.route('**/rest/v1/rpc/community_download',r=>r.fulfill({json:{download_count:1}}));
  await page.route('**/api/public/speech',async r=>{speechCalls++;assert.equal(r.request().postDataJSON().fresh,true);await r.fulfill(failSpeech?{status:502,json:{error:{message:'连接测试失败'}}}:{contentType:'audio/mpeg',headers:{'X-Quota-Remaining':'28','X-Quota-Limit':'30'},body:audio})});
  await page.goto(app);await page.evaluate(()=>ResearchEnglishReady);
  const start=Date.now();await page.locator('#enCommunityTab').click();await page.locator('.en-community-card').first().waitFor();const initialMs=Date.now()-start;
  assert.equal(await page.locator('.en-community-card').count(),24);assert(initialMs<2000,'first cards must not wait for the network');
  // A pending catalog must not monopolize IndexedDB's global API lock.
  await page.waitForFunction(()=>document.querySelector('.en-community-count').textContent.includes('正在检查更新'));
  assert.equal(await page.evaluate(()=>Promise.race([englishApi.settings().then(()=>true),new Promise(r=>setTimeout(()=>r(false),1500))])),true);
  release();await page.waitForFunction(()=>document.querySelectorAll('.en-community-card').length===3);
  const first=page.locator('.en-community-card').first();assert.equal(await first.locator('.en-community-description').count(),0);
  await first.getByRole('button',{name:'预览内容',exact:true}).click();await page.locator('.en-community-sentence').waitFor();assert.match(await page.locator('.en-community-detail').textContent(),/这段简介只在预览详情中展示/);
  await page.getByRole('button',{name:'‹ 返回素材广场',exact:true}).click();await first.getByRole('button',{name:'加入科研英语',exact:true}).click();await first.getByRole('button',{name:'打开学习 →',exact:true}).waitFor();
  assert.equal(await first.locator('.en-community-install small').textContent(),'✓ 已加入');assert.equal(await first.locator('.en-community-install button').getAttribute('class'),'secondary');
  assert.equal(await page.locator('.en-community-card').nth(1).locator('.en-community-install button').getAttribute('class'),'primary');
  const height=(await first.boundingBox()).height;assert(height<340);
  const checks=process.env.ENGLISH_CHECKS_DIR;if(checks){fs.mkdirSync(checks,{recursive:true});await page.locator('.en-community-grid').screenshot({path:path.join(checks,'cards-desktop.png')})}
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  if(checks)await page.locator('.en-community-grid').screenshot({path:path.join(checks,'cards-mobile.png')});
  await page.reload();await page.evaluate(()=>ResearchEnglishReady);await page.locator('#enCommunityTab').click();await page.locator('.en-community-card').first().waitFor();assert.equal(catalogCalls,1,'fresh cache should survive reload');assert.equal(await page.locator('.is-installed').count(),1);
  await page.locator('#enSettingsTab').click();await page.locator('#enPrefTab-sound').click();
  assert.equal(await page.locator('#enWebVoiceGuide a').filter({hasText:'本站 Vercel'}).getAttribute('href'),'https://asa-voice-lab-beta.vercel.app/');
  for(let i=1;i<=2;i++){await page.locator('#enVoicePreview').click();await page.waitForFunction(()=>document.querySelector('#enVoiceStatus').textContent.includes('实时连接成功'));assert.equal(speechCalls,i)}
  failSpeech=true;await page.locator('#enVoicePreview').click();await page.waitForFunction(()=>document.querySelector('#enVoiceStatus').textContent.includes('连接测试失败'));assert.equal(speechCalls,3);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,initialCardsMs:initialMs,compactCardHeight:height,catalogCalls,speechCalls,checks:['snapshot before network','settings unblocked','compact desktop/mobile','detail description','install state and persistence','live preview on every click','failure visible','Vercel link']}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
