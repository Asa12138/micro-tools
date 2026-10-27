// Simulates delayed OS voice discovery; real network playback is checked separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),create=require('../features/english/english-service');
const tick=()=>new Promise(r=>setTimeout(r,40));
(async()=>{const db=new Map(),api=create({getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,structuredClone(v))});api.platform='browser';api.settings({autoPlay:false,preload:false});
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),spoken=[],errors=[];try{
w.englishApi=api;w.addEventListener('error',e=>errors.push(e.message));w.HTMLMediaElement.prototype.pause=function(){};
let voices=[];const synth=new w.EventTarget();Object.assign(synth,{speaking:false,getVoices:()=>voices,cancel(){this.speaking=false},speak(u){this.speaking=true;spoken.push(u);u.onstart?.()}});w.speechSynthesis=synth;w.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
w.LessonAudioCache=class{set(){}prioritize(){}async get(){throw Error('Microsoft connection unavailable')}};
for(const f of ['english-core.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
await w.EnglishUI.onView('english');$('enCourses').firstChild.click();await tick();$('enPlay').click();await tick();assert.equal(spoken.length,0);voices=[{name:'Local English',lang:'en-US',localService:true}];synth.dispatchEvent(new w.Event('voiceschanged'));await tick();assert.equal(spoken.length,1);assert.match($('enAudioStatus').textContent,/已改用本机声音/);assert.equal($('enPlay').getAttribute('aria-pressed'),'true');assert.equal(api.settings().voice,'andrew','fallback preserves selected voice');$('enPlay').click();assert.equal(synth.speaking,false);
// A delayed voiceschanged callback cannot resurrect playback after Stop.
voices=[];$('enPlay').click();await tick();$('enPlay').click();voices=[{name:'Local English',lang:'en-US',localService:true}];synth.dispatchEvent(new w.Event('voiceschanged'));await tick();assert.equal(spoken.length,1);assert.equal($('enPlay').getAttribute('aria-pressed'),'false');
$('enFallbackSpeech').click();await tick();$('enPlay').click();await tick();assert.equal(spoken.length,1);assert.match($('enAudioStatus').textContent,/Microsoft connection unavailable/);assert.equal(api.settings().browserFallback,false);
// Recording always blocks demonstration playback.
$('enRecord').disabled=true;$('enPlay').click();assert.match($('enAudioStatus').textContent,/先结束录音/);$('enRecord').disabled=false;
assert.deepEqual(errors,[]);console.log('PASS browser fallback: delayed voices, local-only selection, stop cancellation, saved opt-out and recording protection.');
}finally{await tick();dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
