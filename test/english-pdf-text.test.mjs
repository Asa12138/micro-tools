// Typography reconstruction only: no spelling guesses, OCR, model calls or external requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from '../vendor/pdfjs/english-pdf-vendor.mjs';
import {textFromItems,extractPDF} from '../features/english/english-pdf.mjs';
const item=(str,x,width,{y=0,eol=false}={})=>({str,transform:[10,0,0,10,x,y],height:10,width,dir:'ltr',hasEOL:eol});
assert.equal(textFromItems([item('in',0,7),item('ﬂ',6.9,5),item('uences',11.8,25)]),'influences');
assert.equal(textFromItems([item('ef',0,7),item('ﬁ',6.9,5),item('cacy',11.8,20)]),'efficacy');
assert.equal(textFromItems([item('in',0,7),item('flow',11,16)]),'in flow');
assert.equal(textFromItems([item('of',0,8),item('ﬁne',12,20)]),'of fine');
assert.equal(textFromItems([item('in',0,7),item(' ',7,0),item('flow',7,16)]),'in flow','explicit spaces survive even at touching coordinates');
assert.equal(textFromItems([item('antibiotic',0,40,{eol:true}),item('response',0,35,{y:-12})]),'antibiotic\nresponse');
assert.equal(textFromItems([item('10',0,10),item('µM',14,12)]),'10 µM','units are not normalized by NFKC');
assert.equal(textFromItems([item('x²',0,10)]),'x²');
assert.equal(textFromItems([{str:'plain'},{str:'text'}]),'plain text','unknown geometry does not guess word joins');
assert.equal(textFromItems([{type:'beginMarkedContent'},item('two words',0,30)]),'two words');
assert.equal(textFromItems([item('under stress 1–3',0,60,{eol:true}),item('. A prominent example follows.',0,100,{y:-12})]),'under stress 1–3. A prominent example follows.');
assert.equal(textFromItems([item('single-cell resolution 9–14',0,100,{eol:true}),item(', offering new opportunities.',0,100,{y:-12})]),'single-cell resolution 9–14, offering new opportunities.');
assert.equal(textFromItems([item('A preceding paragraph',0,100,{eol:true}),{str:'',hasEOL:true},item('. A separate paragraph',0,100,{y:-24})]),'A preceding paragraph. A separate paragraph','empty PDF items do not fabricate paragraph boundaries');
assert.equal(textFromItems([item('Paragraph.\n\n',0,30),item('. Another paragraph',0,100,{y:-24})]),'Paragraph.\n\n. Another paragraph','explicit blank paragraph gaps stay intact');
assert.equal(textFromItems([item('Value 10',0,30,{eol:true}),item('.5',0,10,{y:-12})]),'Value 10\n.5','a leading decimal is not attached to the previous number');
assert.equal(textFromItems([item('Results',0,30,{eol:true}),item('We observed no difference.',0,100,{y:-12})]),'Results\nWe observed no difference.','headings keep their line boundary');
const fixture=await extractPDF(fs.readFileSync(new URL('./fixtures/english-source.pdf',import.meta.url)));assert.match(fixture,/soil communities/);
if(process.env.ENGLISH_PDF_SAMPLE){
 const sample=path.resolve(process.env.ENGLISH_PDF_SAMPLE),reportDir=process.env.ENGLISH_PDF_REPORTS;
 const task=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(sample)),isEvalSupported:false,useSystemFonts:false,disableFontFace:true});
 try{
  const doc=await task.promise,page=await doc.getPage(1),content=await page.getTextContent(),raw=await page.getTextContent({disableNormalization:true});
  const before=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''),after=textFromItems(raw.items),expand=s=>s.replace(/[\ufb00-\ufb06]/g,c=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl','ﬅ':'st','ﬆ':'st'})[c]);
  const contentPreserved=after.replace(/\s/g,'')===expand(raw.items.map(x=>x.str||'').join('')).replace(/\s/g,'');assert(contentPreserved);
  const cases=[['in fl uences','influences'],['ef fi cacy','efficacy'],['signi fi cance','significance'],['pro fi ling','profiling'],[' fi ndings',' findings'],['speci fi c','specific']];
  for(const [bad,good]of cases){assert(before.includes(bad),bad);assert(after.includes(good),good);assert(!after.includes(bad),bad+' persists')}
  for(const phrase of ['how it','antibiotic survival','by modulating','biological significance'])assert(after.includes(phrase),phrase+' must keep natural spaces');
  assert(after.includes('under stress 1–3. A prominent example'));assert(after.includes('single-cell resolution 9–14, offering'));assert(!/^[ \t]*[.,;:!?](?=[ \t]|$)/m.test(after));
  const leading=s=>(s.match(/^[ \t]*[.,;:!?](?=[ \t]|$)/gm)||[]).length;
  const metrics={leadingPunctuationLinesBefore:leading(before),leadingPunctuationLinesAfter:leading(after),sample:path.basename(sample),pagesTested:[1],beforeChars:before.length,afterChars:after.length,ligatureGlyphs:raw.items.reduce((n,x)=>n+(x.str?.match(/[\ufb00-\ufb06]/g)?.length||0),0),nonWhitespaceContentPreserved:contentPreserved,beforeAfterNonWhitespaceEqual:before.replace(/\s/g,'')===after.replace(/\s/g,''),cases:cases.map(([before,after])=>({before,after,passed:true})),normalSpaceChecksPassed:true};
  if(reportDir){fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'before.txt'),before);fs.writeFileSync(path.join(reportDir,'after.txt'),after);fs.writeFileSync(path.join(reportDir,'metrics.json'),JSON.stringify(metrics,null,2));
   const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
   fs.writeFileSync(path.join(reportDir,'comparison.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF 第一页提取对照</title><style>body{max-width:1400px;margin:30px auto;padding:0 20px;font:15px/1.75 system-ui;color:#25334a}main{display:grid;grid-template-columns:1fr 1fr;gap:22px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8fb;border:1px solid #dce4ee;padding:20px;font:14px/1.9 system-ui}table{border-collapse:collapse}td,th{padding:6px 28px 6px 0;text-align:left}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>PDF 第一页：提取前后对照</h1><p>重建文字片段之间的间距、展开拉丁连字，并将孤立在行首的标点接回上一行；不使用词典猜词或 AI。原始 PDF 未修改。</p><table><tr><th>修复前</th><th>修复后</th></tr>'+cases.map(([a,b])=>'<tr><td>'+esc(a)+'</td><td>'+esc(b)+'</td></tr>').join('')+'</table><p>6 个连字字形恢复为普通字母；去除空白后，与原始文字片段的字符一致。</p><main><section><h2>修复前</h2><pre>'+esc(before)+'</pre></section><section><h2>修复后</h2><pre>'+esc(after)+'</pre></section></main></html>');
  }
  console.log(JSON.stringify(metrics));
 }finally{await task.destroy()}
}
console.log('PASS PDF line-leading punctuation and text-run spacing: ligatures, real word gaps, explicit spaces, line breaks, units, unknown geometry and first-page content preservation.');
