// Offline checks: real sound synthesis + real exercise events. No speakers/network required.
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const root=require('node:path').join(__dirname,'..'),create=require('../features/english/english-service');
const wait=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,$=id=>w.document.getElementById(id),contexts=[],played=[],errors=[];
 try{
 w.addEventListener('error',e=>errors.push(e.message));
 let now=1000;w.Date.now=()=>now+=300;
 class Context{
  constructor(){contexts.push(this);this.sampleRate=48000;this.currentTime=0;this.state='running';this.destination={}}
  createGain(){return {gain:{value:1,setValueAtTime(v){this.value=v}},connect(){}}}
  createBuffer(_,length,rate){const data=new Float32Array(length);return {duration:length/rate,getChannelData:()=>data}}
  createBufferSource(){return {connect(){},disconnect(){},stop(){this.stopped=true},start(){played.push(this);queueMicrotask(()=>this.onended?.())}}}
  async resume(){this.state='running'}
 }
 w.AudioContext=Context;w.eval(fs.readFileSync(root+'/features/english/english-sounds.js','utf8'));
 const effects=w.EnglishSounds.create();assert.equal(contexts.length,0,'audio context must be lazy');
 for(const kind of ['key','correct','incorrect'])assert.equal(await effects.play(kind),true);
 assert.equal(contexts.length,1);
 const durations={soft:.045,mechanical:.065,typewriter:.085,bubble:.10};for(const [keySound,length]of Object.entries(durations)){effects.configure({keySound});assert.equal(await effects.play('key'),true);assert(Math.abs(played.at(-1).buffer.duration-length)<=1/48000)}effects.configure({});
 for(const source of played){const a=source.buffer.getChannelData(0);assert(a.some(x=>Math.abs(x)>.01));assert(a.every(x=>Number.isFinite(x)&&Math.abs(x)<.6));assert(Math.abs(a[0])<.0001);assert(Math.abs(a[a.length-1])<.001)}
 effects.configure({enabled:false});assert.equal(await effects.play('key'),false);effects.configure({typing:false});assert.equal(await effects.play('key'),false);assert.equal(await effects.play('correct'),true);
 effects.configure({volume:0});assert.equal(await effects.play('correct'),false);effects.configure({});
 contexts[0].state='suspended';let resume;contexts[0].resume=()=>new Promise(r=>resume=()=>{contexts[0].state='running';r()});const pending=effects.play('key');effects.stop();resume();assert.equal(await pending,false,'stopped sounds cannot reappear after resume');
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,structuredClone(v))},api=create(storage);api.settings({voice:'system',preload:false,autoPlay:false});w.englishApi=api;
 w.HTMLMediaElement.prototype.pause=function(){};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 for(const f of ['english-core.js','english-audio-loader.js','english-wordbook-ui.js','english-extras.js','english-ui.js'])w.eval(fs.readFileSync(root+'/features/english/'+f,'utf8'));
 await w.EnglishUI.onView('english');$('enCourses').firstChild.click();await wait();const inputs=[...$('enAnswer').querySelectorAll('input')];
 let start=played.length;inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'a',bubbles:true}));assert.equal(played.length,start+1);assert.equal(played.at(-1).buffer.duration,.045);
 start=played.length;inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}));inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'a',isComposing:true,bubbles:true}));assert.equal(played.length,start);
 inputs[0].value='wrong';inputs[0].dispatchEvent(new w.Event('input'));assert.equal(played.length,start,'typing never reveals correctness');$('enCheck').click();assert.equal(played.at(-1).buffer.duration,.30);
 const words=w.EnglishCore.words(api.get(api.list()[0].id).sentences[0].en);inputs.forEach((n,i)=>{n.value=words[i];n.dispatchEvent(new w.Event('input'))});start=played.length;$('enCheck').click();assert.equal(played.length,start+1);assert.equal(played.at(-1).buffer.duration,.36);
 Object.defineProperty($('enRecorded'),'paused',{value:false,configurable:true});start=played.length;inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'a',bubbles:true}));assert.equal(played.length,start,'recorded speech suppresses typing sounds');Object.defineProperty($('enRecorded'),'paused',{value:true,configurable:true});
 $('enRecord').disabled=true;inputs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'a',bubbles:true}));assert.equal(played.length,start,'microphone startup suppresses sounds');$('enRecord').disabled=false;
 $('enPracticeBack').click();await wait();$('enSettingsTab').click();await wait();$('enSoundVolume').value='55';$('enSoundVolume').dispatchEvent(new w.Event('input'));$('enSoundVolume').dispatchEvent(new w.Event('change'));$('enTypingSound').click();$('enSoundsEnabled').click();await wait();const saved=create(storage).settings().sounds;assert.equal(saved.volume,55);assert.equal(saved.typing,false);assert.equal(saved.enabled,false);assert($('enTestCorrect').disabled);
 // Word practice uses the same sound instance, settings and pronunciation suppression.
 $('enSoundsEnabled').click();$('enTypingSound').click();$('enKeySound').value='mechanical';$('enKeySound').dispatchEvent(new w.Event('change'));await wait();assert.equal(create(storage).settings().sounds.keySound,'mechanical');
 const book=api.wordbooks('import',{title:'Sound fixture',rows:[['soil','土壤'],['cell','细胞']],preview:false});
 $('enWordsTab').click();await wait();[...$('enWordbookContent').querySelectorAll('.en-course')].find(b=>b.textContent.includes('Sound fixture')).click();await wait();[...$('enWordbookContent').querySelectorAll('button')].find(b=>b.textContent==='开始打字练习').click();await wait();
 const stage=$('enWordPractice'),wordInput=stage.querySelector('input'),button=text=>[...stage.querySelectorAll('button')].find(b=>b.textContent===text);
 start=played.length;wordInput.dispatchEvent(new w.KeyboardEvent('keydown',{key:'s',bubbles:true}));assert.equal(played.length,start+1);assert.equal(played.at(-1).buffer.duration,.065);
 start=played.length;for(const opts of [{key:'ArrowLeft'},{key:'a',isComposing:true},{key:'v',metaKey:true}])wordInput.dispatchEvent(new w.KeyboardEvent('keydown',opts));assert.equal(played.length,start);
 wordInput.value='x';wordInput.dispatchEvent(new w.Event('input'));assert.equal(played.length,start);wordInput.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));assert.equal(played.at(-1).buffer.duration,.30);
 wordInput.value='soil';wordInput.dispatchEvent(new w.Event('input'));assert.equal(played.at(-1).buffer.duration,.36);assert.equal(contexts.length,2,'sentence and word practice share one UI audio context');
 start=played.length;button('暂停').click();wordInput.dispatchEvent(new w.KeyboardEvent('keydown',{key:'a'}));assert.equal(played.length,start);button('继续').click();
 let finishPronunciation;api.pronounce=()=>new Promise(resolve=>finishPronunciation=resolve);button('▶ 美式发音').click();await wait();start=played.length;wordInput.dispatchEvent(new w.KeyboardEvent('keydown',{key:'a'}));assert.equal(played.length,start,'pending word pronunciation suppresses typing');
 button('‹ 返回单词本').click();await wait();finishPronunciation({base64:'YQ==',mime:'audio/mpeg',source:'fixture'});await wait();assert($('enWordPractice').hidden);
 $('enSettingsTab').click();await wait();$('enSoundsEnabled').click();await wait();$('enWordsTab').click();await wait();[...$('enWordbookContent').querySelectorAll('.en-course')].find(b=>b.textContent.includes('Sound fixture')).click();await wait();[...$('enWordbookContent').querySelectorAll('button')].find(b=>b.textContent==='开始打字练习').click();await wait();start=played.length;stage.querySelector('input').dispatchEvent(new w.KeyboardEvent('keydown',{key:'a'}));assert.equal(played.length,start,'global mute also applies to word practice');
 assert.deepEqual(errors,[]);console.log('PASS local sounds: lazy synthesis, bounded PCM, mute and resume cancellation, keyboard filtering, whole-sentence feedback, recording protection, durable settings, shared word-practice sounds and pronunciation suppression.');
 }finally{dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
