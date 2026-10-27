// A broken desktop preload must never show a fresh browser preview as the user's library.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
(async()=>{
 for(const withHost of [true,false]){
  const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;try{
   let fetched=0;w.fetch=()=>{fetched++;throw Error('Preview must not load')};if(withHost)w.ztools={dbStorage:{getItem(){throw Error('Unexpected host access')},setItem(){throw Error('Unexpected write')}}};else Object.defineProperty(w.navigator,'userAgent',{value:'Mozilla/5.0 Electron/40.0.0'});
   w.LessonAudioCache=class{set(){}prioritize(){}};w.HTMLMediaElement.prototype.pause=function(){};
   for(const file of ['english-core.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+file,'utf8'));
   await w.EnglishUI.onView('english');assert.equal(fetched,0);assert.equal(w.localStorage.length,0);assert(w.document.getElementById('enHub').hidden);assert(!w.document.getElementById('enStartupError').hidden);assert.match(w.document.getElementById('enStartupErrorText').textContent,/本机服务未能初始化/);
  }finally{w.close()}
 }
 console.log('PASS missing desktop preload shows an explicit error, never fetches preview data or writes temporary storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
