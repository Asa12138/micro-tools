const createStore=require('./storage'),createServices=require('./services'),createAudio=require('./audio'),createRelay=require('./relay'),createPublicTranslation=require('./public-translation');
const {catalogRequest,request}=require('./network'),C=require('../../features/english/english-core');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
const download=(name,value)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
async function installRelaySettings(api,$){
 const section=$('enPrefPane-sound'),box=el('fieldset',null,'form-stack');box.id='enSpeechRelay';box.hidden=true;box.append(el('legend','跨浏览器语音服务'));
 const address=el('input'),token=el('input');address.id='enSpeechRelayURL';address.type='url';address.placeholder='https://你的语音服务/api/speech';token.id='enSpeechRelayToken';token.type='password';token.autocomplete='off';
 for(const [label,input]of [['服务地址',address],['访问口令（如服务要求）',token]]){const wrap=el('label',label);wrap.append(input);box.append(wrap);}
 box.append(el('p','配置后，未缓存的句子会发送给此服务，再由 Microsoft 或 Google 生成音频。地址保存在此浏览器，口令仅保存在当前标签页。','help-text'));
 const row=el('div',null,'action-row'),save=el('button','保存语音服务','secondary'),test=el('button','测试微软连接','secondary'),clear=el('button','停用语音服务','text-button'),status=el('p',null,'help-text');status.id='enSpeechRelayStatus';status.setAttribute('role','status');row.append(save,test,clear);box.append(row,status);section.insertBefore(box,$('enSoundOptionsHome'));
 async function refresh(){const c=await api.speechRelayConfig();address.value=c.endpoint;token.value='';token.placeholder=c.hasToken?'口令已保存；留空保持':'可选';$('enVoice').dispatchEvent(new Event('change'));}
 async function apply(){await api.speechRelayConfig({endpoint:address.value,...(token.value?{token:token.value}:{})});await refresh();}
 save.onclick=async()=>{try{await apply();status.textContent='语音服务配置已保存。'}catch(e){status.textContent=e.message;}};
 clear.onclick=async()=>{try{await api.speechRelayConfig({endpoint:'',token:''});await refresh();status.textContent='已停用语音服务。'}catch(e){status.textContent=e.message;}};
 test.onclick=async()=>{test.disabled=true;try{if((await api.settings()).allowOnline===false)throw Error('请先开启在线语音再测试。');await apply();status.textContent='正在生成测试句音频…';await api.speech('We compare different samples.','andrew');status.textContent='Microsoft Andrew 音频生成成功，可进入课程播放。';}catch(e){status.textContent=e.message;}finally{test.disabled=false;}};
 await refresh();
}
function installVoiceGuide($){
 const section=$('enPrefPane-sound'),note=section.querySelector(':scope > p.help-text'),guide=el('div',null,'en-voice-guide');guide.id='enWebVoiceGuide';
 const link=(label,url)=>{const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
 const recommendation=el('p');recommendation.append(el('strong','推荐使用电脑上的 Microsoft Edge，或使用 '),link('ZTools 插件版 ↗','https://github.com/Asa12138/micro-tools'),'。');guide.append(recommendation);
 const list=el('ol');
 const microsoft=el('li');microsoft.append(el('strong','Microsoft 音色：'),'优先尝试 Edge 直连；连接失败或使用其他浏览器时，自动通过公共语音服务生成。无需安装 Edge，也无需登录。公共服务每个 IP 每天最多 30 次，北京时间零点重置，同一网络可能共用额度；另受服务总额度限制。后台预生成只尝试直连，不使用公共额度。ZTools 插件版无需安装 Edge。',link(' 打开本站 Vercel 语音服务 ↗','https://asa-voice-lab-beta.vercel.app/'));
 const google=el('li');google.append(el('strong','Google 发音：'),'需要能正常访问 Google。如果无法直连，请确认网络代理可用；先打开 ',link('Google 翻译 ↗','https://translate.google.com/'),' 检查能否访问，再点击「试听声音」。');
 const local=el('li');local.append(el('strong','本机语音：'),'以上在线语音都不可用时，选择「本机浏览器英语声音」。使用电脑已安装的英语声音，不需要联网，自然度可能较低。');
 list.append(microsoft,google,local);guide.append(list);const quota=el('p','Edge 直连和本地缓存播放不占公共额度；通过公共接口受理的请求计 1 次，生成失败或命中服务器缓存也计数。','help-text');quota.id='enPublicVoiceStatus';quota.setAttribute('role','status');guide.append(quota);section.insertBefore(guide,note);
 note.textContent='「试听声音」会实时请求所选在线音色，不使用本地预录样音；通过公共服务试听也计入每日额度。下方会显示实际连接结果。课程缓存和配套音频仍照常使用。';
 const practice=$('enSound').querySelector('p');practice.replaceChildren('Microsoft 音色优先 Edge 直连，失败后使用公共语音（每 IP 每天 30 次，失败也计数；北京时间零点重置）。本地缓存不占额度，后台不会调用公共服务。无法在线生成时可使用本机声音。声音选择与设置页同步。');const status=el('p',null,'help-text');status.id='enPracticePublicVoiceStatus';status.setAttribute('role','status');practice.after(status);
}
const validateBackup=require('../../features/english/english-backup').validate;
async function boot(){
 const $=id=>document.getElementById(id);
 try{
  const store=await createStore(),relay=createRelay(store.storage),translationEndpoint=window.RESEARCH_ENGLISH_BUILD.translationRelayEndpoint,googleTranslation=translationEndpoint?createPublicTranslation({endpoint:translationEndpoint}):null,services=createServices(store.storage,{relay,googleTranslation}),audio=await createAudio();
  if(window.RESEARCH_ENGLISH_LOCAL_RELAY)await store.run(()=>relay.config(window.RESEARCH_ENGLISH_LOCAL_RELAY));
  else if(!store.storage.getItem('web-speech-relay')&&window.RESEARCH_ENGLISH_BUILD.speechRelayEndpoint)await store.run(()=>relay.config({endpoint:window.RESEARCH_ENGLISH_BUILD.speechRelayEndpoint}));
  const dictionary=require('../../features/english/english-dictionary')({request:(req)=>request(req.url,req)});
  let service;await store.run(()=>{service=require('../../features/english/english-service')(store.storage,{translation:services.translation,dictionary,audio,activityStorage:store.storage,catalogRequest,communityRequest:catalogRequest})});
  const api={platform:'browser'};for(const [name,fn]of Object.entries(service))if(typeof fn==='function')api[name]=(...args)=>store.run(()=>fn(...args));
  // Public metadata downloads must not hold the browser's global data-write lock.
  const communityReader=require('../../features/english/english-community-service')({storage:{getItem:key=>store.storage.getItem(key),setItem:(key,value)=>store.run(()=>store.storage.setItem(key,value))},request:catalogRequest});
  api.communityList=async input=>{const result=await communityReader.list(input);return store.run(()=>{const installed=store.storage.getItem('english-community-installed-v1')||{},courses=service.list(),books=service.wordbooks();return {...result,packs:result.packs.map(p=>{const saved=installed[p.id+':'+p.sha256],valid=saved&&(saved.type==='wordbook'?books:courses).some(x=>x.id===saved.id);return {...p,installed:!!valid,installedId:valid?saved.id:null}})}})};
  const directSpeech=require('./speech');
  api.speech=require('./public-speech')({direct:directSpeech,relay,onStatus:status=>{api.speechLastStatus=status;for(const id of ['enPublicVoiceStatus','enPracticePublicVoiceStatus'])if($(id))$(id).textContent=status.message;}});
  api.speechRelayConfig=patch=>store.run(()=>relay.config(patch));
  Object.defineProperty(api,'speechCapabilities',{get:()=>api.speech.capabilities()});
  window.englishApi=api;window.microToolsVersion=window.RESEARCH_ENGLISH_BUILD.version;window.ResearchEnglishWeb={api,store,validateBackup};
  window.researchApi={...services.research,config:(patch)=>store.run(()=>services.research.config(patch)),checkAvailability:options=>store.run(()=>services.research.checkAvailability(options)),call:services.research.call,cancel:services.research.cancel};
  window.openExternal=url=>{const u=new URL(url);if(['https:','http:'].includes(u.protocol))window.open(u.href,'_blank','noopener,noreferrer')};
  window.copyToClipboard=async text=>{try{await navigator.clipboard.writeText(text)}catch{const box=el('textarea');box.value=text;document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();if(!ok)throw Error('复制失败，请允许浏览器访问剪贴板')}};
  window.showView=view=>{if(view==='settings')openAI();else window.EnglishUI?.onView('english')};
  const version=$('webVersion');version.textContent='v'+window.RESEARCH_ENGLISH_BUILD.version+' · '+window.RESEARCH_ENGLISH_BUILD.sourceHash.slice(0,8);version.title='与 ZTools 英语源码同步 · '+window.RESEARCH_ENGLISH_BUILD.builtAt;
  for(const script of window.RESEARCH_ENGLISH_BUILD.scripts)await new Promise((resolve,reject)=>{const s=el('script');s.src=script;s.onload=resolve;s.onerror=()=>reject(Error('加载失败：'+script));document.body.append(s)});
  $('webLoading').remove();await window.EnglishUI.onView('english');
  document.querySelectorAll('[data-open-settings]').forEach(b=>b.onclick=openAI);
  $('webAbout').onclick=()=>{$('enSettingsTab').click();$('enPrefTab-backup').click()};
  const guideImage=document.querySelector('#enPrefPane-agent img[src$="agent-guide-prompt.png"]');if(guideImage){guideImage.src='assets/images/agent-guide-prompt-web.png';guideImage.closest('a').href=guideImage.src}document.querySelector('#enPrefPane-agent .en-mcp-help').hidden=true;
  $('enRefresh').textContent='↻ 刷新题库';document.querySelector('#view-english .ai-check-note').textContent='自动检查仅核对已保存配置，不发送请求；点击「测试连接」才调用一次模型。';document.querySelector('#enCreate .privacy-note').textContent='PDF 在本机提取；点击「AI 整理」才将正文发送给已配置的模型。';
  await installRelaySettings(api,$);
  installVoiceGuide($);
  $('enGoogleNetwork').value='direct';$('enOnlineVoice').closest('label').querySelector('small').textContent='微软声音优先直连 Microsoft，失败后将句子经本站 Vercel 公共服务转发并缓存；自定义服务已配置时优先使用该服务回退。Google 兼容发音将句子发送给 Google。本机回退仅使用设备上的英语声音。关闭后仍可播放本地音频。';$('enCloud').parentElement.lastChild.textContent='为本课启用在线语音（按声音设置发送至 Microsoft 或 Google）';
  const panel=$('enPrefPane-backup'),section=el('section',null,'en-mcp en-settings-section');section.append(el('h4','浏览器数据与同步'));
  section.append(el('p','课程、单词本、掌握状态、学习足迹和设置保存在此浏览器的 IndexedDB。不会自动同步到 ZTools、其他设备或其他浏览器。清除网站数据会删除它们；隐私模式中的数据通常随窗口关闭而清除。','help-text'));
  section.append(el('p','上方双端完整备份包含课程、练习记录、单词本、设置与学习足迹；不含密钥、录音、下载音频和网络缓存。录音请在口语练习中单独下载。','help-text'));
  const actions=el('div',null,'action-row'),persist=el('button','申请保留本地数据','secondary'),status=el('p',null,'help-text');status.setAttribute('role','status');actions.append(persist);section.append(actions,status);panel.append(section);
  const safe=fn=>async()=>{try{await fn()}catch(e){status.textContent=e.message}};
  persist.onclick=safe(async()=>{const ok=await navigator.storage?.persist?.();await storageStatus();status.textContent+=(ok?' 已获得持久存储许可。':' 浏览器未授予持久存储；请定期下载备份。')});
  async function storageStatus(){const estimate=await navigator.storage?.estimate?.(),persistent=await navigator.storage?.persisted?.();status.textContent=(persistent?'已申请持久存储':'浏览器默认存储策略')+(estimate?' · 此域名合计约 '+(estimate.usage/1024/1024).toFixed(1)+' MB / '+(estimate.quota/1024/1024/1024).toFixed(1)+' GB':'')+'。清除网站数据仍会删除本地内容。'}await storageStatus();
  const update=el('p','当前网页与 ZTools 版本同步为 v'+window.microToolsVersion+'，源码指纹 '+window.RESEARCH_ENGLISH_BUILD.sourceHash.slice(0,12)+'。','help-text');panel.prepend(update);
  let dialog;
  async function openAI(){
   dialog?.remove();dialog=el('dialog',null,'en-editor panel web-ai-dialog');dialog.append(el('h3','AI 模型接口'));
   const presets=services.research.presets,c=await window.researchApi.config(),fields={};
   function field(key,label,options){const wrap=el('label',label),input=el(options?'select':'input');input.id='webAI'+key[0].toUpperCase()+key.slice(1);if(options)for(const [value,text]of options){const o=el('option',text);o.value=value;input.append(o)}else{input.type=key==='apiKey'?'password':'text';input.autocomplete='off'}input.value=c[key]||'';wrap.append(input);dialog.append(wrap);fields[key]=input;return input}
   field('provider','模型平台',Object.entries(presets).map(([id,p])=>[id,p.label]));
   field('protocol','API 协议',[['openai','OpenAI Chat Completions'],['anthropic','Anthropic Messages'],['gemini','Google Gemini']]);
   field('baseUrl','API Base URL');field('model','模型 ID');field('apiKey','API key（当前标签页会话）');
   const guide=el('p',null,'help-text'),message=el('p');message.setAttribute('role','status');dialog.append(guide);
   function hint(){guide.replaceChildren(presets[fields.provider.value]?.guide||'');const url=presets[fields.provider.value]?.url;if(url){const a=el('a',' 官方配置文档 ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';guide.append(a)}}hint();
   fields.apiKey.placeholder=c.hasKey?'此接口已保存，留空保持':'填写当前接口的 key';
   fields.provider.onchange=()=>{const p=presets[fields.provider.value];fields.protocol.value=p.protocol;fields.baseUrl.value=p.baseUrl;fields.model.value='';fields.apiKey.value='';fields.apiKey.placeholder='填写此接口的 key';hint()};
   for(const key of ['baseUrl','protocol'])fields[key].addEventListener('input',()=>{fields.apiKey.value='';fields.apiKey.placeholder='凭据按接口隔离，请填写当前接口的 key'});
   dialog.append(el('p','与插件共用平台预设及协议。网页请求仍需接口允许 CORS；本机 Ollama 还需浏览器允许访问本机。接口地址和协议不同的密钥分别保存；密钥不进入备份。','help-text'));
   const row=el('div',null,'action-row'),save=el('button','保存接口','primary'),test=el('button','测试连接','secondary'),clear=el('button','清除当前接口密钥','text-button'),close=el('button','关闭','secondary');
   const values=()=>Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,n.value.trim()]));
   const apply=async()=>{const result=await window.researchApi.config(values());fields.apiKey.value='';fields.apiKey.placeholder=result.hasKey?'此接口已保存，留空保持':'填写当前接口的 key';window.AIConnection?.invalidate();return result};
   save.onclick=async()=>{try{await apply();await window.AIConnection?.refresh();message.textContent='配置已保存，未发送模型请求。密钥仅当前标签页会话有效。'}catch(e){message.textContent=e.message}};
   test.onclick=async()=>{test.disabled=true;try{await apply();message.textContent='正在测试（会调用一次你的模型）…';const r=await window.researchApi.checkAvailability({force:true});if(!r.ok)throw Error(r.message);message.textContent='连接成功，模型已返回文本。';await window.AIConnection?.refresh()}catch(e){message.textContent=e.message}finally{test.disabled=false}};
   clear.onclick=async()=>{try{await window.researchApi.config({...values(),apiKey:'',clear:true});fields.apiKey.value='';fields.apiKey.placeholder='填写当前接口的 key';window.AIConnection?.invalidate();message.textContent='已清除当前接口密钥。'}catch(e){message.textContent=e.message}};
   close.onclick=()=>dialog.close();row.append(save,test,clear,close);dialog.append(row,message);document.body.append(dialog);dialog.showModal();
  }

 }catch(error){(document.getElementById('webLoading')||document.body.appendChild(el('p'))).textContent='启动失败：'+error.message+'。请刷新重试。';console.error(error)}
}
module.exports={boot,validateBackup};
