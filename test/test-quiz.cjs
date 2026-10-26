const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync('dist/chaoxing-study-helper.user.js','utf8').split('// === CHAPTER QUIZ MODULE ===')[1].split('// === CONTINUOUS FLOW MODULE ===')[0];
function fixture({remoteResponse,remoteStatus=200,aiResponse,aiStatus=200,aiEnabled=false,holdAi=false,initialStorage,modalInParent=false,confirmation='normal'}={}){
 const {document,window}=parseHTML(`<html><head></head><body>
 <div id="question900100519"><div class="TiMu newTiMu" data="1"><div class="Zy_TItle"><div class="clearfix font-cxsecret">【多选题】PPT屳际屲屰了敳屾屴重屮屮素？</div></div>
 <ul>${['内容','页数','形式','主题'].map((v,i)=>`<li role="checkbox" qid="900100519" qtype="1"><span data="${'ABCD'[i]}">${'ABCD'[i]}</span><a class="after">${v}</a></li>`).join('')}</ul><input id="answer900100519" value="B"></div></div>
 <div id="question900100518"><div class="TiMu newTiMu" data="0"><div class="Zy_TItle"><div class="clearfix font-cxsecret">【单选题】屵据课屶介屷，敳一屼工具可以直接让大纲变成炫屸充满图屻的PPT？</div></div>
 <ul>${['Python','Java','岃动屽岄','Gamma'].map((v,i)=>`<li role="radio" qid="900100518" qtype="0"><span data="${'ABCD'[i]}">${'ABCD'[i]}</span><a class="after">${v}</a></li>`).join('')}</ul><input id="answer900100518" value=""></div></div>
 <a class="btnSave">暂时保存</a><a class="btnSubmit">提交</a></body></html>`);
 const events=[],remote=[],delays=[],aiRequests=[],storage=new Map(initialStorage);
 storage.set('cx-quiz-bank-v1',[{courseId:'900000001',questionId:'900100519',answers:['内容','形式']},{courseId:'900000001',questionId:'900100518',answers:['Gamma']},{courseId:'900000001',question:'这是一个测试用判断题。',answers:['对']}]);
 if(aiEnabled){storage.set('cx-ai-settings-v1',{enabled:true,endpoint:'https://model.example/v1/chat/completions',model:'fixture-model',minConfidence:0.8,timeout:90});storage.set('cx-ai-key-v1','private-fixture-key');}
 for(const li of document.querySelectorAll('li[qid]'))li.addEventListener('click',()=>{
  const id=li.getAttribute('qid'),input=workDocument.getElementById('answer'+id),letter=li.querySelector('span').getAttribute('data');
  if(li.getAttribute('qtype')==='1')input.value=input.value.includes(letter)?input.value.replace(letter,''):[...input.value,letter].sort().join('');else input.value=letter;
 });
 document.querySelector('.btnSave').addEventListener('click',()=>events.push('save'));
 const confirm=require('./fixture-submit-ui.cjs')(document,()=>events.push('confirm-submit'),{stuck:confirmation==='stuck',message:confirmation==='other'?'确认删除？':'确认提交？'});
 document.querySelector('.btnSubmit').addEventListener('click',()=>{events.push('submit');if(confirmation!=='missing')confirm.show()});
 window.location={href:'https://mooc1.chaoxing.com/mooc-ans/work/doHomeWorkNew?courseId=900000001&workId=900000003'};
 window.frames=[];window.top=window;
 window.submitCheckTimes=()=>{throw Error('must click the visible confirmation instead of invoking hidden callback')};
 let workDocument=document,workWindow=window;
 if(modalInParent){
  const work=parseHTML('<html><head></head><body></body></html>');workDocument=work.document;
  for(const node of [...document.body.childNodes])if(node!==confirm.box)workDocument.body.append(node);
  workWindow={document:workDocument,location:{href:window.location.href},frames:[],top:window,parent:window,Event:window.Event,getComputedStyle:window.getComputedStyle};
  window.frames=[workWindow];
 }
 const host=document.createElement('div');host.id='cx-progress-experiment';document.body.append(host);
 const root=host.attachShadow({mode:'open'});root.innerHTML='<section></section>';
 const closedRoots=[];const attachShadow=window.Element.prototype.attachShadow;
 window.Element.prototype.attachShadow=function(options){const shadow=attachShadow.call(this,options);if(options.mode==='closed')closedRoots.push(shadow);return shadow};
 const context={window,unsafeWindow:window,document,location:window.location,URL,Map,Set,WeakMap,Date,console,
  GM_getValue:(k,f)=>storage.has(k)?storage.get(k):f,GM_setValue:(k,v)=>storage.set(k,v),
  GM_xmlhttpRequest:opts=>{
   if(opts.url.startsWith('https://model.example/')){aiRequests.push(opts);if(!holdAi)queueMicrotask(()=>opts.onload({status:aiStatus,finalUrl:opts.url,responseText:JSON.stringify(aiResponse?aiResponse(JSON.parse(opts.data)):{choices:[{finish_reason:'stop',message:{content:JSON.stringify({answers:['A'],confidence:0.95})}}]})}));}
   else{remote.push(opts);if(remoteResponse)queueMicrotask(()=>opts.onload({status:remoteStatus,responseText:JSON.stringify(remoteResponse(JSON.parse(opts.data)))}));}
   return {abort(){opts.onabort?.()}};
  },
  setTimeout:(fn,ms)=>{delays.push(ms);queueMicrotask(fn);return 1},clearTimeout(){},
  fetch(){throw Error('unexpected network')}
 };
 vm.createContext(context);try{vm.runInContext(source,context)}finally{window.Element.prototype.attachShadow=attachShadow}
 const el=id=>root.getElementById(id);
 return {document,window,workDocument,workWindow,confirm,root,el,events,remote,aiRequests,storage,delays,closedRoots,bridge:host.__cxRuntime,click:id=>el(id).click()};
}
function inlineFixture({wrong=false,continued=false}={}){
 const {document,window}=parseHTML(`<html><body><div class="tkTopic"><div class="tkTopic_title">判断题</div><div class="tkItem"><div class="tkItem_title">这是一个测试用判断题。</div><ul><li class="ans-videoquiz-opt"><label><input type="radio" name="answer">A、对</label></li><li class="ans-videoquiz-opt"><label><input type="radio" name="answer">B、错</label></li></ul></div><a id="videoquiz-submit">提交</a><a id="videoquiz-continue" style="display:none">继续学习</a><span id="spanNot" style="display:none">未答对</span></div></body></html>`);
 const events=[],inputs=[...document.querySelectorAll('input')];
 window.getComputedStyle=()=>({visibility:'visible'});
 window.Element.prototype.getClientRects=function(){for(let el=this;el;el=el.parentElement)if(el.style?.display==='none')return [];return [{}]};
 inputs.forEach(input=>{input.checked=false;input.addEventListener('click',()=>inputs.forEach(n=>{n.checked=n===input}))});
 const next=document.getElementById('videoquiz-continue');
 document.getElementById('videoquiz-submit').addEventListener('click',()=>{events.push('submit');if(wrong)document.getElementById('spanNot').style.display='block';else next.style.display='block'});
 next.addEventListener('click',()=>{events.push('continue');document.querySelector('.tkTopic').style.display='none'});
 if(continued)next.style.display='block';
 return {document,window,events,inputs};
}
async function flush(){for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));}
(async()=>{
 const h=fixture();h.click('quiz-scan');
 assert.equal(h.root.querySelectorAll('[data-quiz-answer]').length,2);
 assert.match(h.el('quiz-status').textContent,/识别 2 题/);
 assert.equal(h.remote.length,0);
 console.log('PASS real-form selectors recognize both encrypted questions without duplication or network');
 h.click('quiz-search');await flush();
 const editors=[...h.root.querySelectorAll('[data-quiz-answer]')];
 assert.equal(editors[0].value,'A#C');assert.equal(editors[1].value,'D');
 assert.equal(h.document.getElementById('answer900100519').value,'B','matching does not yet fill form');
 console.log('PASS scoped local answers match by question ID and option text');
 h.click('quiz-fill');await flush();
 assert.equal(h.document.getElementById('answer900100519').value,'AC');
 assert.equal(h.document.getElementById('answer900100518').value,'D');
 assert.deepEqual(h.events,[]);
 console.log('PASS fill removes unwanted multi choice and selects exact answers without submitting');
 h.click('quiz-save');await flush();assert.deepEqual(h.events,['save']);
 console.log('PASS save invokes platform action');
 h.click('quiz-submit');await flush();assert.deepEqual(h.events,['save','submit','confirm-submit']);
 console.log('PASS submit follows the platform confirmation chain');
 const parent=fixture({modalInParent:true});const parentResult=await parent.bridge.quiz.run();assert.equal(parentResult.ok,true,parentResult.message);assert.deepEqual(parent.events,['submit','confirm-submit']);assert.equal(parent.confirm.box.style.display,'none');
 console.log('PASS nested quiz clicks the actual top-window confirmation button and closes its modal without calling submitCheckTimes');
 const interrupted=fixture({modalInParent:true});const cancelOnce=()=>interrupted.bridge.quiz.stop();interrupted.workDocument.querySelector('.btnSubmit').addEventListener('click',cancelOnce,{once:true});
 assert.equal((await interrupted.bridge.quiz.run()).ok,false);assert.deepEqual(interrupted.events,['submit']);assert.equal(interrupted.bridge.quiz.inspect().submitted,false);
 assert.equal((await interrupted.bridge.quiz.run()).ok,true);assert.deepEqual(interrupted.events,['submit','confirm-submit']);assert.equal(interrupted.bridge.quiz.inspect().submitted,true);
 console.log('PASS a persisted initial submission resumes its visible pending confirmation without rematching answers or submitting twice');
 const absentModal=fixture({confirmation:'missing'});assert.equal((await absentModal.bridge.quiz.run()).ok,false);assert.match(absentModal.el('quiz-log').textContent,/未出现可识别/);assert.equal((await absentModal.bridge.quiz.run()).pending,true);assert.deepEqual(absentModal.events,['submit']);
 console.log('PASS missing confirmation pauses with a durable pending record and never falls back to a hidden submit function');
 const stuckModal=fixture({confirmation:'stuck'});assert.equal((await stuckModal.bridge.quiz.run()).ok,false);assert.match(stuckModal.el('quiz-log').textContent,/弹窗仍未关闭/);assert.equal((await stuckModal.bridge.quiz.run()).pending,true);assert.deepEqual(stuckModal.events,['submit','confirm-submit']);
 console.log('PASS a final confirmation that stays open is clicked only once, including on repeated automation runs');
 const unrelated=fixture({confirmation:'other'});assert.equal((await unrelated.bridge.quiz.run()).ok,false);assert.deepEqual(unrelated.events,['submit']);
 console.log('PASS an unrelated top-window confirmation is never accepted');

 const missing=fixture();missing.click('quiz-scan');missing.click('quiz-submit');await flush();
 assert.equal(missing.events.length,0);assert.match(missing.el('quiz-log').textContent,/没有答案/);
 assert.equal(missing.document.getElementById('answer900100519').value,'B');
 console.log('PASS incomplete answers cause no partial fill or submission');

 const stale=fixture();stale.click('quiz-scan');stale.window.location.href+='&changed=1';stale.click('quiz-save');await flush();
 assert.equal(stale.events.length,0);assert.match(stale.el('quiz-log').textContent,/页面已变化/);
 console.log('PASS stale quiz cannot be saved or submitted');

 const unknown=fixture();unknown.window.location.href=unknown.window.location.href.replace('900000001','other-course');unknown.click('quiz-scan');unknown.click('quiz-search');await flush();
 assert.match(unknown.el('quiz-log').textContent,/未还原|未命中/);assert.equal(unknown.remote.length,0);
 console.log('PASS local question IDs do not leak across courses; remote bank stays off');

 const optional=fixture({remoteResponse:q=>({code:0,result:{success:true,answers:q.type===1?['内容','形式']:['Gamma']}})});
 optional.window.location.href=optional.window.location.href.replace('900000001','other-course');
 optional.document.querySelectorAll('.font-cxsecret').forEach(e=>e.classList.remove('font-cxsecret'));
 optional.click('quiz-scan');optional.el('quiz-remote').checked=true;optional.click('quiz-search');await flush();
 assert.equal(optional.remote.length,2);
 assert.deepEqual(Object.keys(JSON.parse(optional.remote[0].data)).sort(),['options','question','type']);
 assert.equal(optional.remote[0].anonymous,true);
 assert.equal(optional.root.querySelector('[data-quiz-answer]').value,'A#C');
 assert(optional.delays.some(ms=>ms>1500),'remote questions are spaced rather than sent in a burst');
 console.log('PASS opt-in free-bank contract supports multi-answer arrays without account or URL fields');

 const finish=fixture();finish.click('quiz-scan');finish.click('quiz-finish');await flush();
 assert.deepEqual(finish.events,['submit','confirm-submit']);
 console.log('PASS one-click completion matches, fills, and submits fully resolved local questions');

 const inline=inlineFixture(),qh=fixture();
 const result=await qh.bridge.quiz.inline(inline.window,{courseId:'900000001',isCurrent:()=>true});
 assert.equal(result.ok,true);assert.deepEqual(inline.events,['submit','continue']);assert.equal(inline.inputs[0].checked,true);
 assert.equal(qh.remote.length,0);
 console.log('PASS observed video inline judgement matches scoped answer, selects, submits and continues after feedback');

 const unknownInline=inlineFixture(),unknownQh=fixture();
 const absent=await unknownQh.bridge.quiz.inline(unknownInline.window,{courseId:'other-course',isCurrent:()=>true});
 assert.equal(absent.ok,false);assert.deepEqual(unknownInline.events,[]);
 console.log('PASS video inline missing answer pauses without selection or submission');

 const rejected=inlineFixture({wrong:true}),rejectQh=fixture();
 const rejectedResult=await rejectQh.bridge.quiz.inline(rejected.window,{courseId:'900000001',isCurrent:()=>true});
 assert.equal(rejectedResult.ok,false);assert.deepEqual(rejected.events,['submit']);
 console.log('PASS incorrect video inline feedback prevents continuation');

 const completed=inlineFixture({continued:true}),completeQh=fixture();
 assert.equal((await completeQh.bridge.quiz.inline(completed.window,{courseId:'other-course',isCurrent:()=>true})).ok,true);
 assert.deepEqual(completed.events,['continue']);assert.equal(completeQh.remote.length,0);
 console.log('PASS already-confirmed video inline feedback continues without reanswering');

 let current=true;const movedInline=inlineFixture(),movedQh=fixture({remoteResponse:()=>{current=false;return {code:0,result:{success:true,answers:['对']}}}});
 movedQh.el('quiz-remote').checked=true;
 assert.equal((await movedQh.bridge.quiz.inline(movedInline.window,{courseId:'other-course',isCurrent:()=>current})).ok,false);
 assert.deepEqual(movedInline.events,[]);
 console.log('PASS stale video inline request cannot select or submit after its player is stopped');

 const limited=fixture({remoteResponse:()=>({}),remoteStatus:429});
 limited.window.location.href=limited.window.location.href.replace('900000001','other-course');limited.document.querySelectorAll('.font-cxsecret').forEach(e=>e.classList.remove('font-cxsecret'));
 limited.click('quiz-scan');limited.el('quiz-remote').checked=true;limited.click('quiz-search');await flush();
 assert.equal(limited.remote.length,3);assert.match(limited.el('quiz-log').textContent,/HTTP 429/);assert.deepEqual(limited.events,[]);
 console.log('PASS busy remote bank makes at most two spaced retries without submission');

 const aiInline=inlineFixture(),aiQh=fixture({aiEnabled:true});aiInline.document.querySelector('.tkItem_title').textContent='软件对视频进行文字搜索。';
 const aiInlineResult=await aiQh.bridge.quiz.inline(aiInline.window,{courseId:'other-course',isCurrent:()=>true});
 assert.equal(aiInlineResult.ok,true);assert.deepEqual(aiInline.events,['submit','continue']);assert.equal(aiQh.aiRequests.length,1);
 assert(!aiQh.root.innerHTML.includes('private-fixture-key'));assert(!aiQh.el('quiz-log').textContent.includes('private-fixture-key'));
 console.log('PASS unknown inline question uses configured AI and completes the actual answer/feedback chain without exposing the key');

 const bankBusyAi=inlineFixture(),bankBusyQh=fixture({aiEnabled:true,remoteResponse:()=>({}),remoteStatus:429});bankBusyAi.document.querySelector('.tkItem_title').textContent='软件对视频进行文字搜索。';
 bankBusyQh.el('quiz-remote').checked=true;
 assert.equal((await bankBusyQh.bridge.quiz.inline(bankBusyAi.window,{courseId:'other-course',isCurrent:()=>true})).ok,true);
 assert.equal(bankBusyQh.remote.length,1);assert.equal(bankBusyQh.aiRequests.length,1);
 console.log('PASS third-party bank HTTP 429 falls back to AI instead of stopping before AI');

 const aiChapter=fixture({aiEnabled:true,aiResponse:body=>{const q=JSON.parse(body.messages[1].content);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({answers:q.type==='multiple'?['A','C']:['D'],confidence:0.9})}}]}}});
 aiChapter.window.location.href=aiChapter.window.location.href.replace('900000001','other-course');aiChapter.document.querySelectorAll('.font-cxsecret').forEach(e=>e.classList.remove('font-cxsecret'));
 const chapterResult=await aiChapter.bridge.quiz.run();
 assert.equal(chapterResult.ok,true);assert.equal(aiChapter.aiRequests.length,2);assert.deepEqual(aiChapter.events,['submit','confirm-submit']);
 assert.equal(aiChapter.document.getElementById('answer900100519').value,'AC');assert.equal(aiChapter.document.getElementById('answer900100518').value,'D');
 console.log('PASS chapter multiple/single questions use AI, validate all answers, fill and submit');

 const lowInline=inlineFixture(),lowQh=fixture({aiEnabled:true,aiResponse:()=>({choices:[{finish_reason:'stop',message:{content:'{"answers":["A"],"confidence":0.2}'}}]})});
 lowInline.document.querySelector('.tkItem_title').textContent='未知题目';
 assert.equal((await lowQh.bridge.quiz.inline(lowInline.window,{courseId:'other-course',isCurrent:()=>true})).ok,false);assert.deepEqual(lowInline.events,[]);
 console.log('PASS low-confidence AI answer cannot select or submit an inline question');

 const localBeforeAi=fixture({aiEnabled:true});localBeforeAi.click('quiz-scan');localBeforeAi.click('quiz-search');await flush();
 assert.equal(localBeforeAi.aiRequests.length,0);
 console.log('PASS scoped local answers take priority without calling AI');

 const uiCase=fixture({aiResponse:()=>({choices:[{finish_reason:'stop',message:{content:'{"answers":["B"],"confidence":0.95}'}}]})});
 const settings=uiCase.closedRoots.find(r=>r.getElementById('ai-settings')),keyRoot=uiCase.closedRoots.find(r=>r.querySelector('input[type="password"]'));
 settings.getElementById('ai-endpoint').value='https://model.example/v1';settings.getElementById('ai-model').value='fixture-model';settings.getElementById('ai-enabled').checked=true;keyRoot.querySelector('input').value='private-ui-key';
 settings.getElementById('ai-save').click();
 assert.equal(uiCase.storage.get('cx-ai-connection-v2').secret,'private-ui-key');assert.equal(keyRoot.querySelector('input').value,'');assert.equal(uiCase.storage.get('cx-ai-connection-v2').config.enabled,true);
 assert.equal(uiCase.el('ai-settings'),null,'private settings controls do not appear in the page shadow tree');
 settings.getElementById('ai-test').click();await flush();
 assert.match(uiCase.el('quiz-log').textContent,/测试通过/);assert.deepEqual(uiCase.events,[]);assert.equal(uiCase.aiRequests.length,1);
 settings.getElementById('ai-forget').click();assert.equal(uiCase.storage.get('cx-ai-key-v1'),'');assert.equal(uiCase.storage.get('cx-ai-settings-v1').enabled,false);
 console.log('PASS private settings UI saves without key echo, tests only a synthetic question and clears the key on request');

 const stopAiInline=inlineFixture(),stopAiQh=fixture({aiEnabled:true,holdAi:true});stopAiInline.document.querySelector('.tkItem_title').textContent='未知题目';
 const stopAiResult=stopAiQh.bridge.quiz.inline(stopAiInline.window,{courseId:'other-course',isCurrent:()=>true});stopAiQh.bridge.quiz.stop();
 assert.equal((await stopAiResult).ok,false);assert.deepEqual(stopAiInline.events,[]);assert.equal(stopAiQh.aiRequests.length,1);
 console.log('PASS stopping an AI-backed inline question aborts its request before any platform selection or submission');
 const duplicate=fixture();assert.equal((await duplicate.bridge.quiz.run()).ok,true);assert.equal((await duplicate.bridge.quiz.run()).pending,true);
 assert.deepEqual(duplicate.events,['submit','confirm-submit']);assert(duplicate.storage.get('cx-quiz-submit-journal-v1').length===1);
 duplicate.click('quiz-reset-submit');assert.equal((await duplicate.bridge.quiz.run()).ok,true);assert.deepEqual(duplicate.events,['submit','confirm-submit','submit','confirm-submit']);
 const reload=fixture({initialStorage:duplicate.storage});assert.equal((await reload.bridge.quiz.run()).pending,true);assert.deepEqual(reload.events,[]);
 console.log('PASS persisted submission journal prevents duplicate automatic submission; explicit reset permits a retry');
 const newLayout=fixture();
 for(const node of newLayout.document.querySelectorAll('.TiMu')){node.classList.remove('TiMu');node.removeAttribute('data');const old=node.querySelector('.Zy_TItle');old.className='newZy_TItle';old.querySelector('.clearfix').className='fontLabel';}
 newLayout.click('quiz-scan');assert.match(newLayout.el('quiz-status').textContent,/识别 2 题/);assert.equal((await newLayout.bridge.quiz.run()).ok,true);
 console.log('PASS newTiMu/fontLabel/newZy_TItle layout and qtype fallback retain both question types');
 const imageQuiz=fixture({aiEnabled:true});imageQuiz.window.location.href=imageQuiz.window.location.href.replace('900000001','other-course');imageQuiz.document.querySelectorAll('.font-cxsecret').forEach(e=>e.classList.remove('font-cxsecret'));
 imageQuiz.document.querySelector('.Zy_TItle .clearfix').innerHTML='<img src="https://mooc1.chaoxing.com/figure.png">';imageQuiz.el('quiz-remote').checked=true;
 const imageResult=await imageQuiz.bridge.quiz.run();assert.equal(imageResult.ok,false);assert.match(imageResult.message,/启用图片题/);assert.equal(imageQuiz.remote.length,0);assert.equal(imageQuiz.aiRequests.length,0);assert.deepEqual(imageQuiz.events,[]);
 console.log('PASS image-only question is detected and never silently sent as empty text or auto-submitted without vision consent');
 const preset=fixture(),presetSettings=preset.closedRoots.find(r=>r.getElementById('ai-settings'));presetSettings.getElementById('ai-doubao').click();assert.equal(presetSettings.getElementById('ai-endpoint').value,'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
 console.log('PASS Doubao preset populates the endpoint without configuring or sending a secret');
 const nextInline=inlineFixture();nextInline.document.querySelector('.tkItem_title').textContent='题库冷却期间的新问题';
 assert.equal((await bankBusyQh.bridge.quiz.inline(nextInline.window,{courseId:'other-course',isCurrent:()=>true})).ok,true);assert.equal(bankBusyQh.remote.length,1);assert.equal(bankBusyQh.aiRequests.length,2);
 console.log('PASS rate-limited bank enters cooldown and subsequent questions go directly to configured AI');
 const dynamic=fixture();const firstKey=dynamic.bridge.quiz.inspect().key;const style=dynamic.document.createElement('style');style.textContent="@font-face{font-family:font-cxsecret;src:url(data:font/ttf;base64,AAAA)}";dynamic.document.head.append(style);
 const fontKey=dynamic.bridge.quiz.inspect().key;assert.notEqual(fontKey,firstKey);
 const image=dynamic.document.createElement('img');image.setAttribute('src','https://mooc1.chaoxing.com/first.png');dynamic.document.querySelector('.Zy_TItle').append(image);const imageKey=dynamic.bridge.quiz.inspect().key;assert.notEqual(imageKey,fontKey);image.setAttribute('src','https://mooc1.chaoxing.com/second.png');assert.notEqual(dynamic.bridge.quiz.inspect().key,imageKey);
 const stableKey=dynamic.bridge.quiz.inspect().key;dynamic.document.getElementById('answer900100519').value='AC';assert.equal(dynamic.bridge.quiz.inspect().key,stableKey);
 console.log('PASS late font and image resources change the detection fingerprint while answer selection alone cannot trigger another automatic submission');
})();
