const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
// Exact cmap observed in the current chapter, with no credentials or account data.
const cmap=Buffer.from('AAAAAQADAAEAAAAMAAQAiAAAABAAEAADAABWj1aUVphWpFanVq1Z4P//AABWjVaRVpZWmlamVqlZ4P//AAAAAAAAAAAAAAAApjoAAQAQABQAGgAeADIANAAAAAAAAwAXAAEABgAMAB0ACwAcAAoADgAYABIAGwAIAAIAFAAJAAcADQAVAAQAEAAFABYADwATABEAGQ==','base64');
const knownGlyph=Buffer.from('AAYAP/+0A6wC/wADAAcACwAPABMAJQAAASMRMyEzESMhIxUzAzM1IzcjFTMDBgchESM1IRUjESE2NyE1IRUDOJ2d/XWWlgGx3t7e3t7e3t5PEhcBlUP9dUEBNhQM/n0DbQH+/ikB13X+nnyveAHmQ0H9eDU1AohBQz8/AA==','base64');
function knownGlyphFont({mutate=false,longLoca=false}={}){
 const head=Buffer.alloc(54);head.writeUInt16BE(1000,18);head.writeInt16BE(longLoca?1:0,50);
 const maxp=Buffer.alloc(6);maxp.writeUInt16BE(31,4);const loca=Buffer.alloc(32*(longLoca?4:2));for(let i=30;i<32;i++)longLoca?loca.writeUInt32BE(knownGlyph.length,i*4):loca.writeUInt16BE(knownGlyph.length/2,i*2);
 const glyf=Buffer.from(knownGlyph);if(mutate)glyf[glyf.length-1]^=1;
 const tables=[['cmap',cmap],['head',head],['maxp',maxp],['loca',loca],['glyf',glyf]];let offset=12+tables.length*16;const entries=tables.map(([name,data])=>{const entry={name,data,offset};offset+=Math.ceil(data.length/4)*4;return entry});const bytes=Buffer.alloc(offset);bytes.writeUInt32BE(0x10000);bytes.writeUInt16BE(entries.length,4);entries.forEach((e,i)=>{const p=12+i*16;bytes.write(e.name,p);bytes.writeUInt32BE(e.offset,p+8);bytes.writeUInt32BE(e.data.length,p+12);e.data.copy(bytes,e.offset)});return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
}
function sfnt(table=cmap){const bytes=Buffer.alloc(28+table.length);bytes.writeUInt32BE(0x10000);bytes.writeUInt16BE(1,4);bytes.write('cmap',12);bytes.writeUInt32BE(28,20);bytes.writeUInt32BE(table.length,24);table.copy(bytes,28);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);}
const readCoverage=vm.runInNewContext(fs.readFileSync('src/font-module.js','utf8')+'\nfontUnicodeCoverage',{DataView,Set});
const actual=readCoverage(sfnt());assert.equal(actual.size,29);assert(actual.has('嚍'.codePointAt(0)));for(const ch of 'ExampleTool制作概念图。AB对错（）')assert(!actual.has(ch.codePointAt(0)));
console.log('PASS actual chapter cmap contains 29 replaced characters and excludes ordinary Chinese, punctuation, Latin text and option markers');
const malformed=Buffer.from(cmap);malformed.writeUInt32BE(0xffffffff,8);assert.throws(()=>readCoverage(sfnt(malformed)),/损坏/);assert.throws(()=>readCoverage(new ArrayBuffer(5)),/损坏/);
console.log('PASS truncated fonts and cmap offsets outside the supplied font fail safely');
const unicode12=Buffer.alloc(40);unicode12.writeUInt16BE(1,2);unicode12.writeUInt16BE(3,4);unicode12.writeUInt16BE(10,6);unicode12.writeUInt32BE(12,8);unicode12.writeUInt16BE(12,12);unicode12.writeUInt32BE(28,16);unicode12.writeUInt32BE(1,24);unicode12.writeUInt32BE(0x20000,28);unicode12.writeUInt32BE(0x20001,32);unicode12.writeUInt32BE(1,36);
assert.deepEqual([...readCoverage(sfnt(unicode12))],[0x20000,0x20001]);
console.log('PASS format 12 supplementary Unicode coverage is decoded without treating surrogate halves as characters');
const visibleMap=Object.fromEntries([...'嚍嚎嚏嚑嚒嚓嚔嚖嚗嚘嚚嚛嚜嚝嚞嚟嚠嚡嚢嚣嚤嚦嚧嚩嚪嚫嚬嚭姠'].map((ch,i)=>[ch,[...'作的下列念面快速形成稿样选可不概式发感灵便改修生据根文给能'][i]]));
const main=fs.readFileSync('dist/chaoxing-study-helper.user.js','utf8').split('// === CHAPTER QUIZ MODULE ===')[1].split('// === CONTINUOUS FLOW MODULE ===')[0];
const stub=`function extractFontFromStyle(){return fixtureFont}
async function loadRefTable(){fontEvents.push('table');return {}}
function renderGlyph(family,ch){fontEvents.push(ch);return {ch}}
function isCoveredByFont(){throw Error('fallback coverage must not be used')}
function crackChar(table,feat){return {ch:fixtureMap[feat.ch],margin:feat.ch===uncertainChar?0.1:0.99}}
`;
function fixture({uncertain='。',holdFont=false,normalOnly=false,automatic=false,verifiedGlyph=false,vision=false,visionReject=false}={}){
 const {document,window}=parseHTML(`<html><head></head><body>
 <div id="question900100560"><div class="TiMu newTiMu" data="0"><div class="Zy_TItle"><div class="clearfix font-cxsecret fontLabel">【单选题】关于ExampleTool在制嚍概嚒图方嚓嚎应用，嚏嚑说法中错误嚎是（）。</div></div><ul>${['嚔嚖嚗嚘初嚚','嚟嚒图嚛嚠嚞嚝嚜','激嚡嚣嚢','方嚤嚧嚦'].map((t,i)=>`<li class="font-cxsecret before-after" role="radio" qid="900100560" qtype="0"><span data="${'ABCD'[i]}">${'ABCD'[i]}</span><a class="after">${t}</a></li>`).join('')}</ul><input id="answer900100560" value=""></div></div>
 <div id="question900100561"><div class="TiMu" data="3"><div class="Zy_TItle"><div class="clearfix font-cxsecret fontLabel">【判断题】ExampleTool嚞姠嚫嚪嚭定主题嚩成嚬本。</div></div><ul><li class="font-cxsecret" role="radio" qid="900100561" qtype="3"><span data="true">A</span><a class="after">对</a></li><li class="font-cxsecret" role="radio" qid="900100561" qtype="3"><span data="false">B</span><a class="after">错</a></li></ul><input id="answer900100561" value=""></div></div><a class="btnSubmit">提交</a></body></html>`);
 if(normalOnly)for(const node of document.querySelectorAll('.font-cxsecret'))node.textContent=[...node.textContent].map(ch=>visibleMap[ch]||ch).join('');
 const store=new Map([['cx-ai-settings-v1',{enabled:true,vision,endpoint:'https://model.example/v1/chat/completions',model:'test-model',minConfidence:0.8,timeout:90}],['cx-ai-key-v1','fixture-key']]),events=[],requests=[],fontEvents=[],faces=new Set();let releaseFont;
 const makeElement=document.createElement.bind(document),drawn=[];
 document.createElement=tag=>{if(tag!=='canvas')return makeElement(tag);const context={measureText:()=>({width:24}),fillRect(){},fillText(ch){drawn.push(ch)}};return {getContext:()=>context,toDataURL:()=>('data:image/png;base64,'+Buffer.from('fixture-image').toString('base64'))}};
 document.fonts={add:face=>faces.add(face),delete:face=>faces.delete(face)};
 window.top=window;window.frames=[];window.location={href:'https://mooc1.chaoxing.com/mooc-ans/work/doHomeWorkNew?courseId=font-fixture&workId=napkin'};
 if(automatic)window.location.href+='&api=1&knowledgeid=k&jobid=work-font';
 for(const li of document.querySelectorAll('li[qid]'))li.addEventListener('click',()=>document.getElementById('answer'+li.getAttribute('qid')).value=li.querySelector('span').getAttribute('data'));
 const confirm=require('./fixture-submit-ui.cjs')(document,()=>events.push('confirm'));
 document.querySelector('.btnSubmit').addEventListener('click',()=>{events.push('submit');confirm.show()});window.submitCheckTimes=()=>{throw Error('unexpected hidden submission callback')};
 const host=document.createElement('div');host.id='cx-progress-experiment';document.body.append(host);const root=host.attachShadow({mode:'open'});root.innerHTML='<section></section>';
 const closedRoots=[],attachShadow=window.Element.prototype.attachShadow;window.Element.prototype.attachShadow=function(options){const shadow=attachShadow.call(this,options);if(options.mode==='closed')closedRoots.push(shadow);return shadow};
 const context={document,window,unsafeWindow:window,location:window.location,URL,Map,Set,WeakMap,Date,DataView,crypto:require('crypto').webcrypto,console,fixtureFont:verifiedGlyph?knownGlyphFont():sfnt(),fixtureMap:visibleMap,uncertainChar:uncertain,fontEvents,
 FontFace:class{async load(){if(holdFont)await new Promise(resolve=>releaseFont=resolve);return this}},
 GM_getValue:(k,f)=>store.has(k)?store.get(k):f,GM_setValue:(k,v)=>store.set(k,v),
 GM_xmlhttpRequest:options=>{requests.push(options);const content=JSON.parse(options.data).messages[1].content,q=JSON.parse(Array.isArray(content)?content[0].text.split('\n')[0]:content);assert(![...q.question].some(ch=>actual.has(ch.codePointAt(0))));queueMicrotask(()=>options.onload({status:visionReject&&Array.isArray(content)?400:200,finalUrl:options.url,responseText:JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"answers":["B"],"confidence":0.95}'}}]})}));return {abort(){options.onabort?.()}}},
 setTimeout:(fn)=>{queueMicrotask(fn);return 1},clearTimeout(){},setInterval:()=>1,clearInterval(){},fetch(){throw Error('unexpected network')}};
 vm.createContext(context);try{vm.runInContext(main.replace(/\}\)\(\);\s*$/,stub+'\n})();'),context)}finally{window.Element.prototype.attachShadow=attachShadow}
 if(automatic)vm.runInContext(fs.readFileSync('src/quiz-auto.js','utf8'),context);
 return {document,window,root,closedRoots,bridge:host.__cxRuntime,events,requests,fontEvents,faces,drawn,release:()=>releaseFont?.(),log:()=>root.getElementById('quiz-log').textContent};
}
(async()=>{
 const complete=fixture();const result=await complete.bridge.quiz.run();assert.equal(result.ok,true);assert.equal(complete.requests.length,2);assert.deepEqual(complete.events,['submit','confirm']);assert.equal(complete.document.getElementById('answer900100560').value,'B');assert.equal(complete.document.getElementById('answer900100561').value,'false');assert(!complete.fontEvents.includes('。'));assert.equal(complete.faces.size,0);
 console.log('PASS observed encrypted ExampleTool structure restores mapped glyphs, sends readable questions to AI, fills and submits single/judgement answers');
 const partial=fixture({uncertain:'嚍'});const incomplete=await partial.bridge.quiz.run();assert.equal(incomplete.ok,false);assert.equal(partial.requests.length,1);assert.deepEqual(partial.events,[]);assert.equal(partial.root.querySelector('[data-quiz-answer="900100561"]').value,'B');
 console.log('PASS one genuinely uncertain glyph blocks only its question; other questions reach AI, but an incomplete test is never submitted');
 assert.match(incomplete.message,/字体字符未还原/);assert.equal(partial.drawn.length,0);assert(!partial.requests.some(r=>Array.isArray(JSON.parse(r.data).messages[1].content)));
 console.log('PASS unresolved glyph failure names its real cause and never renders or sends an image before vision opt-in');
 const visual=fixture({uncertain:'嚍',vision:true});const visualResult=await visual.bridge.quiz.run();assert.equal(visualResult.ok,true);assert.equal(visual.requests.length,2);assert.deepEqual(visual.events,['submit','confirm']);assert(visual.drawn.includes('嚍'));assert.equal(visual.faces.size,0);
 const visualMessage=JSON.parse(visual.requests[0].data).messages[1].content;assert.equal(visualMessage[1].type,'image_url');assert(visual.root.querySelector('[data-font-preview] img'));assert(!JSON.stringify(visualMessage).includes('fixture-key'));
 console.log('PASS explicit vision opt-in draws the undecoded glyph in the original font, sends only the question image, then fills and confirms the complete quiz');
 const unsupported=fixture({uncertain:'嚍',vision:true,visionReject:true});const unsupportedResult=await unsupported.bridge.quiz.run();assert.equal(unsupportedResult.ok,false);assert.match(unsupportedResult.message,/400/);assert.deepEqual(unsupported.events,[]);assert.equal(unsupported.faces.size,0);
 console.log('PASS a provider rejecting image input cannot cause a partial fill or submission and temporary fonts are released');
 const recoveredBySetting=fixture({uncertain:'嚍',automatic:true});for(let i=0;i<25;i++)await new Promise(r=>setImmediate(r));assert.deepEqual(recoveredBySetting.events,[]);assert.match(recoveredBySetting.bridge.quiz.auto.state().message,/字体字符未还原/);
 const settings=recoveredBySetting.closedRoots.find(r=>r.getElementById('ai-settings'));settings.getElementById('ai-vision').checked=true;settings.getElementById('ai-save').click();for(let i=0;i<35;i++)await new Promise(r=>setImmediate(r));assert.deepEqual(recoveredBySetting.events,['submit','confirm']);assert.equal(recoveredBySetting.requests.length,3);recoveredBySetting.window.dispatchEvent(new recoveredBySetting.window.Event('pagehide'));
 console.log('PASS saving the vision opt-in after a font pause automatically retries the question and completes without another scan or Start click');
 const plain=fixture({normalOnly:true});plain.bridge.quiz.scan();plain.root.getElementById('quiz-font').click();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(plain.fontEvents.length,0);assert.match(plain.log(),/没有待还原/);
 console.log('PASS normal text styled with font-cxsecret needs no glyph table when outside the actual cmap');
 const stale=fixture({holdFont:true});const pending=stale.bridge.quiz.run();for(let i=0;i<10;i++)await Promise.resolve();stale.window.location.href+='&changed=1';stale.release();const canceled=await pending;assert.equal(canceled.ok,false);assert.equal(stale.requests.length,0);assert.deepEqual(stale.events,[]);assert.equal(stale.faces.size,0);
 console.log('PASS navigation during font loading cannot apply stale mapping, call AI or submit another page');
 const auto=fixture({automatic:true});for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(auto.requests.length,2);assert.deepEqual(auto.events,['submit','confirm']);assert.match(auto.bridge.quiz.auto.state().message,/已自动执行/);
 auto.window.dispatchEvent(new auto.window.Event('pagehide'));
 console.log('PASS opening the observed encrypted chapter route automatically detects, restores, calls AI, fills and submits without any manual scan or run call');
 const verify=vm.runInNewContext(fs.readFileSync('src/font-module.js','utf8')+'\nverifiedFontGlyph',{DataView,Map,Set,crypto:require('crypto').webcrypto});
 for(const longLoca of [false,true])assert.equal(await verify(knownGlyphFont({longLoca}),'嚓'),'面');assert.equal(await verify(knownGlyphFont(),'X',new Map([[88,29]])),'面');
 console.log('PASS actual verified glyph bytes restore 面 with either loca format and independently of the randomized character code');
 assert.equal(await verify(knownGlyphFont({mutate:true}),'嚓'),null);assert.equal(await verify(sfnt(),'嚓'),null);
 console.log('PASS a different outline or missing glyph tables cannot match the verified fingerprint');
 const recovered=fixture({uncertain:'嚓',verifiedGlyph:true,automatic:true});for(let i=0;i<40;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(recovered.requests.length,2);assert.deepEqual(recovered.events,['submit','confirm']);assert(!recovered.fontEvents.includes('嚓'));assert(recovered.root.getElementById('quiz-questions').textContent.includes('方面的应用'));recovered.window.dispatchEvent(new recovered.window.Event('pagehide'));
 console.log('PASS the real low-confidence 面 glyph is restored by its verified fingerprint and the complete automatic quiz/AI/submission chain resumes');
})().catch(error=>{console.error(error);process.exitCode=1});
