const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync('src/flow-module.js','utf8');
function fixture({missingQuiz=false,unconfirmed=false,holdMedia=false,unsupported=false,restore=false,dropJobs=false,blockedTab=false,refused=false,terminalFailure=false,mediaMode='hybrid',nativeFailure=false,blankEntry=false,nativeNavigation=false,blockedChapter=false,auto=false,locks,transientNative=false,mixed=false,verification=false,hiddenDirectory=false,filteredDirectory=false,changedDirectoryClass=false,nextButtonMismatch=false,nextButtonBlocked=false,policyWait=false}={}){
 const {document,window}=parseHTML(`<html><body>
 <ul><li id="dct1" cardid="101" title="视频" class="active">视频</li><li id="dct2" cardid="102" title="章节测验">测验</li></ul>
 <iframe id="iframe"></iframe>
 <div class="posCatalog_select posCatalog_active" id="cur1"><span onclick="getTeacherAjax('c','cl','1')">章节一</span></div>
 <div class="posCatalog_select" id="cur2"><span onclick="getTeacherAjax('c','cl','2')">章节二</span></div>
 </body></html>`);
 const calls=[],store=new Map();let chapter='1',tab=0,clock=0,pendingResolve,workLoaded=false;
 window.getComputedStyle=()=>({visibility:'visible'});window.Element.prototype.getClientRects=function(){return this.style?.display==='none'?[]:[{}]};
 const mask=verification?document.createElement('div'):null;if(mask){mask.id='fcqrimg';document.body.append(mask);}
 const server={};let current;
 const frame=document.getElementById('iframe');
 const tabNodes=[document.getElementById('dct1'),document.getElementById('dct2')];
 const directoryNodes=[document.getElementById('cur1'),document.getElementById('cur2')];
 let nextButton,search;
 if(hiddenDirectory||filteredDirectory){
  nextButton=document.createElement('div');nextButton.id='prevNextFocusNext';nextButton.textContent='下一节';nextButton.setAttribute('onclick',`PCount.next('2','${nextButtonMismatch?'999':'1'}','900000001','900000002','',true)`);document.body.append(nextButton);
  search=document.createElement('input');search.id='searchChapterListByName';search.value=filteredDirectory?'model-name':'';document.body.append(search);
 }
 const mediaState={busy:false,active:false};
 function key(){return chapter+':'+tab;}
 function load(){
  const {document:doc}=parseHTML('<html><body></body></html>');
  workLoaded=false;
  if(tab===1&&blankEntry){
   const wrapper=doc.createElement('iframe');wrapper.setAttribute('src','/ananas/modules/work/index.html?v=fixture');doc.body.append(wrapper);
   const {document:inner}=parseHTML('<html><body></body></html>');Object.defineProperty(wrapper,'contentDocument',{value:inner});
   Object.defineProperty(wrapper,'src',{set(value){
    calls.push('load-wrapper:'+key());const work=inner.createElement('iframe');work.id='frame_content';work.setAttribute('src','https://mooc1.chaoxing.com/api/work?fixture=1');inner.body.append(work);
    Object.defineProperty(work,'src',{set(value){calls.push('load-work:'+key());workLoaded=true}});
   }});
  }
  const id=key();
  const arg={defaults:{knowledgeid:chapter,cardid:Number(chapter)*100+tab+1},attachments:[{jobid:'job-'+id,type:unsupported&&tab===0?'document':tab===0?'video':'work',job:!server[id],isPassed:server[id]===true}]};
  if(mixed){arg.attachments[0].type='video';arg.attachments.push({jobid:'work-'+id,type:'work',job:!server[id],isPassed:server[id]===true});}
  if(dropJobs&&server[id])arg.attachments=[];
  current={arg,doc,win:{document:doc,frames:[]},url:`https://mooc1.chaoxing.com/mooc-ans/knowledge/cards?knowledgeid=${chapter}&num=${tab}`};
  tabNodes.forEach((node,i)=>{node.setAttribute('cardid',String(Number(chapter)*100+i+1));node.classList.toggle('active',i===tab)});
  for(const el of directoryNodes)el.classList.toggle('posCatalog_active',el.id==='cur'+chapter);
  if(nextButton){nextButton.style.display=chapter==='1'?'block':'none';if(chapter==='2')search.value='';}
  if(hiddenDirectory)for(const node of directoryNodes){if(chapter==='1')node.remove();else if(!node.parentElement)document.body.append(node);}
  if(server[chapter+':0']&&server[chapter+':1']){
   const node=directoryNodes.find(e=>e.id==='cur'+chapter);
   if(!node.querySelector('.icon_Completed')){const done=document.createElement('span');done.className='icon_Completed';node.append(done)}
   if(changedDirectoryClass)node.classList.remove('posCatalog_select');
  }
 }
 load();
 Object.defineProperty(frame,'contentDocument',{get:()=>current.doc});
 Object.defineProperty(frame,'contentWindow',{value:{location:{reload(){calls.push('reload:'+key());load()}}}});
 tabNodes.forEach((node,i)=>node.addEventListener('click',()=>{calls.push('tab:'+i);if(!blockedTab){tab=i;load()}}));
 const chapterClick=()=>{calls.push('chapter:2');if(!blockedChapter){chapter='2';tab=0;load()}};
 directoryNodes[1].querySelector('[onclick]').addEventListener('click',chapterClick);
 nextButton?.addEventListener('click',()=>{calls.push('native-next');if(!nextButtonBlocked)chapterClick()});
 window.top=window;window.location={href:'https://mooc1.chaoxing.com/mycourse/studentstudy?'+(nextButton?'courseId=900000001&clazzid=900000002':'courseId=c&clazzid=cl'),origin:'https://mooc1.chaoxing.com',pathname:'/mycourse/studentstudy',assign:url=>calls.push('full:'+url)};
 window.changeDisplayContent=undefined;window.getTeacherAjax=undefined;
 if(nativeNavigation){
  tabNodes.forEach((node,i)=>node.setAttribute('onclick',`changeDisplayContent(${i+1},2,'1','266','154','');`));
  window.changeDisplayContent=(index)=>{calls.push('native-tab:'+index);tabNodes[index-1].click()};
  window.getTeacherAjax=(course,clazz,chapter)=>{calls.push('native-chapter:'+chapter);chapterClick()};
 }
 const host=document.createElement('div');host.id='cx-progress-experiment';document.body.append(host);
 const root=host.attachShadow({mode:'open'});root.innerHTML='<section><button id="stop"></button><button id="quiz-stop"></button></section>';
 const bridge={media:{
  state:()=>mediaState,cards:()=>[current],
  scan:()=>[{index:0,id:current.arg.attachments[0].jobid,title:'视频',passed:current.arg.attachments[0].isPassed}],
  run:async()=>{
   calls.push('media:'+key());
   if(refused)return {ok:false,message:'视频元数据：HTTP 403'};
   if(terminalFailure)return {ok:false,allowPlayback:true,message:'视频到末尾但未通过'};
   if(holdMedia&&calls.filter(c=>c.startsWith('media:')).length===1){mediaState.active=true;mediaState.busy=true;return new Promise(resolve=>{pendingResolve=value=>{mediaState.active=false;mediaState.busy=false;resolve(value)}})}
   if(!unconfirmed)server[key()]=true;
   return {ok:true};
  },
  play:async()=>{calls.push('native:'+key());if(policyWait&&key()==='1:0'){
   Object.assign(mediaState,{active:true,busy:true,waitingForGesture:true,title:'等待手势的视频'});root.dispatchEvent(new window.Event('cx-media-state'));
   return new Promise(resolve=>{pendingResolve=()=>{mediaState.waitingForGesture=false;root.dispatchEvent(new window.Event('cx-media-state'));mediaState.active=false;mediaState.busy=false;server[key()]=true;resolve({ok:true})}});
  }if(transientNative&&calls.filter(c=>c==='native:'+key()).length<2)return {ok:false,message:'缓冲故障',retryable:true};if(nativeFailure)return {ok:false,message:'实际播放器无法启动'};if(!unconfirmed)server[key()]=true;return {ok:true}},
  stop:()=>{calls.push('stop-media')},wait:()=>new Promise(resolve=>{pendingResolve=resolve})
 },quiz:{
  scan:()=>({found:(mixed||tab===1)&&(!blankEntry||workLoaded),busy:false}),state:()=>({busy:false}),
  run:async()=>{calls.push('quiz:'+key());if(missingQuiz)return {ok:false,message:'题目没有答案'};server[key()]=true;return {ok:true,submitted:true}},
  stop:()=>{calls.push('stop-quiz')}
 }};
 host.__cxRuntime=bridge;
 const sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 if(restore){server['1:0']=true;load();store.set('cx-flow-v1:c:cl',JSON.stringify({enabled:true,done:['1:101']}));}
 const intervals=new Map();let nextInterval=0;
 const context={window,unsafeWindow:window,document,location:window.location,sessionStorage,URL,Set,Map,navigator:{onLine:true,locks},GM_getValue:(k,f)=>k==='cx-flow-media-mode-v2'?mediaMode:k.startsWith('cx-flow-auto:')?auto:f,GM_setValue:(k,v)=>store.set(k,v),Date:class extends Date{static now(){return clock}},
  setTimeout:(fn,ms)=>{queueMicrotask(()=>{if(mask&&ms===500&&mask.style.display!=='none'){calls.push('verify-wait');mask.style.display='none';}clock+=ms;fn()});return 1},clearTimeout(){},setInterval:(fn,ms)=>{const id=++nextInterval;intervals.set(id,{fn,ms});return id},clearInterval:id=>intervals.delete(id),console};
 vm.createContext(context);vm.runInContext(source,context);
 return {bridge,calls,root,store,server,frame,context,intervals,get key(){return key()},manualTab(i){tabNodes[i].click()},resolveMedia(value){pendingResolve?.(value)},status:()=>root.getElementById('flow-status').textContent};
}
async function flush(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));}
(async()=>{
 const all=fixture();all.bridge.flow.start();all.bridge.flow.start();await flush();
 assert.deepEqual(all.calls.filter(c=>/^(media|quiz|chapter):/.test(c)),['media:1:0','quiz:1:1','chapter:2','media:2:0','quiz:2:1']);
 assert(all.calls.includes('reload:1:0'));assert(all.calls.includes('reload:1:1'));
 assert.equal(all.bridge.flow.state().enabled,false);assert.match(all.status(),/处理完毕/);
 console.log('PASS two chapters: detect media, verify saved progress, quiz, switch card, switch chapter, finish');
 const hidden=fixture({hiddenDirectory:true});hidden.bridge.flow.start();await flush();assert.match(hidden.status(),/处理完毕/);assert.equal(hidden.calls.filter(c=>c==='native-next').length,1);assert(hidden.calls.includes('quiz:2:1'));
 console.log('PASS a missing directory uses the validated platform Next section button once and starts the following chapter');
 const filtered=fixture({filteredDirectory:true});filtered.bridge.flow.start();await flush();assert.match(filtered.status(),/处理完毕/);assert.equal(filtered.calls.filter(c=>c==='native-next').length,1);
 console.log('PASS a filtered directory cannot skip chapters or falsely finish; navigation uses the platform Next section control');
 const classChanged=fixture({changedDirectoryClass:true});classChanged.bridge.flow.start();await flush();assert.match(classChanged.status(),/处理完毕/);assert(classChanged.calls.includes('quiz:2:1'));
 console.log('PASS completion changing the current directory class does not lose its position');
 const mismatch=fixture({hiddenDirectory:true,nextButtonMismatch:true});mismatch.bridge.flow.start();await flush();assert.match(mismatch.status(),/未找到可用/);assert(!mismatch.calls.includes('native-next'));
 console.log('PASS a Next section control belonging to another chapter is never clicked');
 const stalledNext=fixture({hiddenDirectory:true,nextButtonBlocked:true});stalledNext.bridge.flow.start();await flush();assert.match(stalledNext.status(),/等待超时/);assert.equal(stalledNext.calls.filter(c=>c==='native-next').length,1);assert(!stalledNext.calls.some(c=>c.startsWith('full:')));
 console.log('PASS a stalled native Next section action pauses after one click without guessing destination URLs');

 const missing=fixture({missingQuiz:true});missing.bridge.flow.start();await flush();
 assert.equal(missing.key,'1:1');assert.match(missing.status(),/没有答案/);
 assert(!missing.calls.includes('chapter:2'));
 console.log('PASS missing quiz answers pause without advancing');

 const pending=fixture({unconfirmed:true});pending.bridge.flow.start();await flush();
 assert.match(pending.status(),/尚未确认/);assert(!pending.calls.some(c=>c.startsWith('tab:')));
 assert.equal(pending.calls.filter(c=>c==='media:1:0').length,1);
 console.log('PASS successful API response without persisted completion cannot advance or rerun indefinitely');

 const stopped=fixture({holdMedia:true});stopped.bridge.flow.start();await flush();stopped.bridge.flow.stop();
 stopped.resolveMedia({ok:true});await flush();
 assert.equal(stopped.bridge.flow.state().enabled,false);assert(!stopped.calls.some(c=>c.startsWith('tab:')));
 assert(stopped.calls.includes('stop-media')&&stopped.calls.includes('stop-quiz'));
 console.log('PASS stop cancels both modules and stale completion cannot navigate');

 const restored=fixture({restore:true});await flush();
 assert(!restored.calls.includes('media:1:0'));assert(restored.calls.includes('quiz:1:1'));
 console.log('PASS per-tab persisted state resumes after refresh without repeating completed media');

 const unknown=fixture({unsupported:true});unknown.bridge.flow.start();await flush();
 assert.match(unknown.status(),/尚未自动适配/);assert(!unknown.calls.some(c=>c.startsWith('media:')));
 console.log('PASS unsupported task pauses explicitly instead of skipping');

 const empty=fixture({dropJobs:true});empty.bridge.flow.start();await flush();
 assert.match(empty.status(),/尚未确认/);assert(!empty.calls.some(c=>c.startsWith('tab:')));
 console.log('PASS disappearing task records are not mistaken for persisted completion');

 const blocked=fixture({blockedTab:true});blocked.bridge.flow.start();await flush();
 assert.match(blocked.status(),/等待超时/);assert.equal(blocked.calls.filter(c=>c.startsWith('tab:')).length,1);
 console.log('PASS blocked navigation pauses after one click instead of looping');

 const auth=fixture({refused:true});auth.bridge.flow.start();await flush();
 assert.match(auth.status(),/HTTP 403/);assert.equal(auth.calls.filter(c=>c.startsWith('media:')).length,1);
 assert(!auth.calls.some(c=>c.startsWith('native:')));
 console.log('PASS platform refusal stops without retries or next-task navigation');

 const fallback=fixture({terminalFailure:true});fallback.bridge.flow.start();await flush();
 assert.deepEqual(fallback.calls.filter(c=>/^(media|native):/.test(c)),['media:1:0','native:1:0','media:2:0','native:2:0']);
 assert.match(fallback.status(),/处理完毕/);assert(fallback.calls.includes('reload:1:0'));
 console.log('PASS terminal unaccepted simulation falls back once to actual playback and verifies platform state');

 const direct=fixture({mediaMode:'native'});direct.bridge.flow.start();await flush();
 assert(!direct.calls.some(c=>c.startsWith('media:')));assert(direct.calls.includes('native:2:0'));
 assert.match(direct.status(),/处理完毕/);
 console.log('PASS native mode uses actual playback for every new media task');

 const only=fixture({mediaMode:'protocol',terminalFailure:true});only.bridge.flow.start();await flush();
 assert(!only.calls.some(c=>c.startsWith('native:')));assert.match(only.status(),/未通过/);
 console.log('PASS protocol-only mode does not start actual playback after unaccepted simulation');

 const playbackDenied=fixture({terminalFailure:true,nativeFailure:true});playbackDenied.bridge.flow.start();await flush();
 assert.match(playbackDenied.status(),/实际播放器无法启动/);assert(!playbackDenied.calls.some(c=>c.startsWith('tab:')));
 console.log('PASS actual player failure pauses without next-task navigation');
 const gesture=fixture({mediaMode:'native',policyWait:true});gesture.bridge.flow.start();await flush();assert.equal(gesture.bridge.flow.state().enabled,true);assert.equal(gesture.bridge.flow.state().phase,'waiting-play');assert.match(gesture.status(),/播放后会自动接续/);assert(!gesture.calls.some(c=>c.startsWith('quiz:')));
 gesture.resolveMedia();await flush();assert.match(gesture.status(),/处理完毕/);assert(gesture.calls.includes('quiz:2:1'));assert.equal(gesture.calls.filter(c=>c==='native:1:0').length,1);
 console.log('PASS browser autoplay policy keeps the coordinator waiting, then continues quizzes and the next chapter without another Start click');

 const blank=fixture({blankEntry:true});blank.bridge.flow.start();await flush();
 assert.match(blank.status(),/处理完毕/);
 assert(blank.calls.includes('load-wrapper:1:1')&&blank.calls.includes('load-work:1:1'));
 assert(blank.calls.includes('load-wrapper:2:1')&&blank.calls.includes('quiz:2:1'));
 console.log('PASS blank quiz wrapper reloads the platform entry then its generated work frame before submitting');

 const platform=fixture({nativeNavigation:true});platform.bridge.flow.start();await flush();
 assert.match(platform.status(),/处理完毕/);assert(platform.calls.includes('native-tab:2')&&platform.calls.includes('native-chapter:2'));
 console.log('PASS platform task and chapter functions are called when page-defined navigation is available');

 const wholePage=fixture({blockedChapter:true});wholePage.bridge.flow.start();await flush();
 const destination=wholePage.calls.find(c=>c.startsWith('full:'));
 assert(destination);assert.equal(new URL(destination.slice(5)).searchParams.get('chapterId'),'2');
 assert.equal(wholePage.bridge.flow.state().navigating,true);assert.equal(JSON.parse(wholePage.store.get('cx-flow-v1:c:cl')).enabled,true);
 assert.equal(wholePage.calls.filter(c=>c.startsWith('full:')).length,1);
 console.log('PASS stalled chapter content falls back once to same-course full navigation with enabled session preserved');

 const resumed=fixture({holdMedia:true});resumed.bridge.flow.start();await flush();resumed.bridge.flow.stop();resumed.bridge.flow.start();resumed.resolveMedia({ok:false,message:'stopped'});await flush();
 assert.match(resumed.status(),/处理完毕/);assert(resumed.calls.includes('quiz:2:1'));
 console.log('PASS immediate stop/resume waits for the old run to exit and then starts one new run');

 const moved=fixture({holdMedia:true});moved.bridge.flow.start();await flush();moved.manualTab(1);moved.resolveMedia({ok:true});await flush();
 assert.match(moved.status(),/任务已切换/);assert(!moved.calls.some(c=>c.startsWith('reload:')));
 console.log('PASS manual task change cannot cause an old completion to reload a different task');
 const automatic=fixture({auto:true,mediaMode:'old-invalid-setting'});await flush();assert.match(automatic.status(),/处理完毕/);assert.equal(automatic.calls.filter(c=>c.startsWith('native:')).length,2);assert(!automatic.calls.some(c=>c.startsWith('media:')));
 automatic.bridge.flow.stop();assert.equal(automatic.store.get('cx-flow-auto:c:cl'),false);
 console.log('PASS entering the course automatically runs native playback without start clicks; stop disables persistent autostart');
 const retry=fixture({auto:true,mediaMode:'native',transientNative:true});await flush();assert.match(retry.status(),/处理完毕/);assert.equal(retry.calls.filter(c=>c==='native:1:0').length,2);
 console.log('PASS transient native playback failure retries before moving to later tasks');
 const integrated=fixture({auto:true,mediaMode:'native',mixed:true});await flush();assert.match(integrated.status(),/处理完毕/);assert(integrated.calls.indexOf('native:1:0')<integrated.calls.indexOf('quiz:1:0'));
 console.log('PASS media and quiz jobs on the same card are processed serially and verified together');
 const gated=fixture({auto:true,mediaMode:'native',verification:true});await flush();assert.match(gated.status(),/处理完毕/);assert(gated.calls.indexOf('verify-wait')<gated.calls.indexOf('native:1:0'));
 console.log('PASS visible platform verification waits and resumes automatically after the mask disappears');
 const standby=fixture({auto:true,locks:{request:async(name,options,callback)=>callback(null)}});await flush();assert.equal(standby.bridge.flow.state().phase,'standby');assert(!standby.calls.some(c=>/^(media|quiz|native):/.test(c)));
 const lockRun=fixture({auto:true,mediaMode:'native',locks:{request:async(name,options,callback)=>{assert.equal(name,'cx-course:c:cl');assert.equal(options.ifAvailable,true);return callback({name})}}});await flush();assert.match(lockRun.status(),/处理完毕/);
 console.log('PASS an unavailable Web Lock leaves the second tab idle; the lock holder alone executes tasks');
})();
