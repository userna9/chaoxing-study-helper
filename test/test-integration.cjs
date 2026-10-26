const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
const {document,window}=parseHTML('<html><body><ul><li id="dct1" cardid="101" title="视频" class="active">视频</li><li id="dct2" cardid="102" title="章节测验">章节测验</li></ul><iframe id="iframe"></iframe><div id="cur1" class="posCatalog_select posCatalog_active"><span onclick="getTeacherAjax()">第一章</span></div><div id="cur2" class="posCatalog_select"><span onclick="getTeacherAjax()">第二章</span></div></body></html>');
Object.defineProperty(document,'scripts',{get:()=>document.querySelectorAll('script')});
window.Element.prototype.getClientRects=function(){for(let p=this;p;p=p.parentElement)if(p.style?.display==='none')return [];return [{}]};
let now=0,sequence=0,chapter=1,tab=0,cardDoc,cardWindow;
const recovery=process.argv.includes('--recover-player');let injectedFailure=false;
const backgroundMode=process.argv.includes('--background');if(backgroundMode){document.hidden=true;document.visibilityState='hidden';}
const observed=new Set();
class Observer{constructor(callback){this.callback=callback}observe(target){this.target=target;observed.add(this)}disconnect(){observed.delete(this)}}
const scheduled=new Map(),store=new Map(),session=new Map(),server=new Set(),calls=[];
let pendingConfirmation;
const confirm=require('./fixture-submit-ui.cjs')(document,()=>pendingConfirmation());
function schedule(fn,ms,repeat=false){const id=++sequence;scheduled.set(id,{fn,due:now+ms,ms,repeat});return id;}
const timeout=(fn,ms=0)=>schedule(fn,ms),interval=(fn,ms)=>schedule(fn,ms,true),clear=id=>scheduled.delete(id);
function virtualWindow(doc,url){Object.defineProperty(doc,'scripts',{get:()=>doc.querySelectorAll('script')});if(backgroundMode){doc.hidden=true;doc.visibilityState='hidden';}const w={document:doc,location:{href:url},frames:[],top:window,parent:window,Event:window.Event,getComputedStyle:()=>({visibility:'visible'}),addEventListener(){},removeEventListener(){}};return w;}
function loadCard(){
 const identity=chapter+':'+tab,c=chapter,t=tab;
 const result=parseHTML('<html><body></body></html>');cardDoc=result.document;
 const url=`https://mooc1.chaoxing.com/mooc-ans/knowledge/cards?courseid=c&knowledgeid=${chapter}&num=${tab}`;
 cardWindow=virtualWindow(cardDoc,url);cardWindow.location.reload=()=>loadCard();
 const jobId='job-'+identity;
 cardWindow.mArg={defaults:{cardid:chapter*100+tab+1,knowledgeid:chapter,clazzId:'cl',userid:'u'},attachments:[{jobid:jobId,job:!server.has(identity),isPassed:server.has(identity),type:tab===0?'video':'work',property:tab===0?{objectid:'video-'+chapter,module:'insertvideo',name:'课程视频 '+chapter}:{module:'work'}}]};
 const nested=cardDoc.createElement('iframe');cardDoc.body.append(nested);
 if(tab===0){
  nested.setAttribute('src','/ananas/modules/video/index.html');nested.setAttribute('data',JSON.stringify({objectid:'video-'+chapter,jobid:jobId}));
  let pwin;
  function mountPlayer(){
  const player=parseHTML('<html><body><video></video><div class="tkTopic"><div class="tkTopic_title">判断题</div><div class="tkItem"><div class="tkItem_title">第'+chapter+'章视频内问答</div><ul><li class="ans-videoquiz-opt"><label><input type="radio">A、对</label></li><li class="ans-videoquiz-opt"><label><input type="radio">B、错</label></li></ul></div><button id="videoquiz-submit">提交</button><button id="videoquiz-continue" style="display:none">继续</button></div></body></html>');
  if(!pwin)pwin=virtualWindow(player.document,'https://mooc1.chaoxing.com/ananas/modules/video/index.html');else{Object.defineProperty(player.document,'scripts',{get:()=>player.document.querySelectorAll('script')});pwin.document=player.document;}
  pwin.frameElement=nested;
  const video=player.document.querySelector('video');Object.assign(video,{duration:3,currentTime:0,paused:true,ended:false,muted:false,playbackRate:1});
  let continued=false,playing=false,backgroundPaused=false;
  video.pause=()=>{video.paused=true};video.play=()=>{
   calls.push('play:'+identity);video.paused=false;
   if(recovery&&!injectedFailure){injectedFailure=true;video.error={code:2};queueMicrotask(()=>video.dispatchEvent(new window.Event('error')));return Promise.resolve();}
   if(!continued){video.currentTime=1;video.dispatchEvent(new window.Event('timeupdate'));video.paused=true;return Promise.resolve();}
   if(!playing){playing=true;timeout(()=>{assert.equal(video.paused,false,'video must resume after background pause before it can end');video.currentTime=3;video.dispatchEvent(new window.Event('timeupdate'));video.ended=true;server.add(identity);nested.parentElement.classList.add('ans-job-finished');video.dispatchEvent(new window.Event('ended'));},1000);}
   if(backgroundMode&&!backgroundPaused){backgroundPaused=true;queueMicrotask(()=>{calls.push('background-pause:'+identity);video.paused=true;video.dispatchEvent(new window.Event('pause'))});}
   return Promise.resolve();
  };
  const inputs=[...player.document.querySelectorAll('input')];inputs.forEach(input=>input.addEventListener('click',()=>inputs.forEach(other=>other.checked=other===input)));
  player.document.getElementById('videoquiz-submit').addEventListener('click',()=>{calls.push('inline-submit:'+identity);assert(inputs[0].checked);player.document.getElementById('videoquiz-continue').style.display='block'});
  player.document.getElementById('videoquiz-continue').addEventListener('click',()=>{continued=true;player.document.querySelector('.tkTopic').style.display='none';calls.push('inline-continue:'+identity)});
  }
  mountPlayer();Object.defineProperty(nested,'src',{set(value){calls.push('reload-player:'+identity);mountPlayer();for(const observer of observed)if(observer.target===cardDoc.documentElement)observer.callback([{target:nested}]);}});
  Object.defineProperty(nested,'contentWindow',{get:()=>pwin});Object.defineProperty(nested,'contentDocument',{get:()=>pwin.document});cardWindow.frames=[pwin];
 }else{
  nested.id='frame_content';nested.setAttribute('src','https://mooc1.chaoxing.com/api/work?courseId=c&workId=w'+chapter);
  const work=parseHTML('<html><body><div id="question'+chapter+'23456"><div class="TiMu" data="0"><div class="Zy_TItle"><div class="clearfix">第'+chapter+'章章节测验</div></div><ul><li role="radio" qid="'+chapter+'23456"><span data="A">A</span><a class="after">错误选项</a></li><li role="radio" qid="'+chapter+'23456"><span data="B">B</span><a class="after">正确选项</a></li></ul><input id="answer'+chapter+'23456" value=""></div></div><a class="btnSubmit">提交</a></body></html>');
  const wwin=virtualWindow(work.document,nested.getAttribute('src'));
  for(const li of work.document.querySelectorAll('li'))li.addEventListener('click',()=>work.document.getElementById('answer'+c+'23456').value=li.querySelector('span').getAttribute('data'));
  work.document.querySelector('.btnSubmit').addEventListener('click',()=>{assert.equal(work.document.getElementById('answer'+c+'23456').value,'B');calls.push('quiz-submit:'+identity);pendingConfirmation=()=>{server.add(identity);calls.push('quiz-confirm:'+identity)};confirm.show()});
  wwin.submitCheckTimes=()=>{throw Error('must confirm through visible top-window modal')};
  Object.defineProperty(nested,'contentWindow',{get:()=>wwin});Object.defineProperty(nested,'contentDocument',{get:()=>wwin.document});cardWindow.frames=[wwin];
 }
 window.frames=[cardWindow];
 for(const [i,node]of [...document.querySelectorAll('li[cardid]')].entries()){node.setAttribute('cardid',String(chapter*100+i+1));node.classList.toggle('active',i===tab);}
 for(const node of document.querySelectorAll('.posCatalog_select')){node.classList.toggle('posCatalog_active',node.id==='cur'+chapter);const ch=Number(node.id.slice(3));if(server.has(ch+':0')&&server.has(ch+':1')&&!node.querySelector('.icon_Completed')){const icon=document.createElement('i');icon.className='icon_Completed';node.append(icon);}}
 for(const observer of observed)if(observer.target===document.documentElement)observer.callback([{target:mainFrame}]);
}
window.location={href:'https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=c&clazzid=cl&chapterId=1',origin:'https://mooc1.chaoxing.com',pathname:'/mycourse/studentstudy'};
window.top=window;window.getComputedStyle=()=>({visibility:'visible'});
const mainFrame=document.getElementById('iframe');Object.defineProperty(mainFrame,'contentWindow',{get:()=>cardWindow});Object.defineProperty(mainFrame,'contentDocument',{get:()=>cardDoc});
document.querySelectorAll('li[cardid]').forEach((node,i)=>node.addEventListener('click',()=>{tab=i;calls.push('tab:'+chapter+':'+tab);loadCard()}));
window.getTeacherAjax=(course,clazz,id)=>{chapter=Number(id);tab=0;calls.push('chapter:'+chapter);loadCard()};
store.set('cx-ai-settings-v1',{enabled:true,endpoint:'https://model.example/v1/chat/completions',model:'test-model',minConfidence:0.8,timeout:90});store.set('cx-ai-key-v1','integration-only-key');
loadCard();
const ctx={window,document,unsafeWindow:window,location:window.location,URL,URLSearchParams,TextEncoder,MutationObserver:Observer,Date:class extends Date{static now(){return now}},performance:{now:()=>now},navigator:{onLine:true,locks:{request:async(name,options,callback)=>callback({name})}},
 setTimeout:timeout,clearTimeout:clear,setInterval:interval,clearInterval:clear,
 sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},GM_getValue:(k,f)=>store.has(k)?store.get(k):f,GM_setValue:(k,v)=>store.set(k,v),
 GM_xmlhttpRequest:options=>{assert.equal(options.url,'https://model.example/v1/chat/completions');const q=JSON.parse(JSON.parse(options.data).messages[1].content);calls.push('ai:'+q.question);queueMicrotask(()=>options.onload({status:200,finalUrl:options.url,responseText:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answers:[q.type==='judgement'?'A':'B'],confidence:0.95})}}]})}));return {abort(){options.onabort?.()}}},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/chaoxing-study-helper.user.js','utf8'),ctx);
(async()=>{
 const bridge=document.getElementById('cx-progress-experiment').__cxRuntime;
 for(let step=0;step<700;step++){
  for(let i=0;i<12;i++)await Promise.resolve();
  if(!bridge.flow.state().enabled&&!bridge.flow.state().running)break;
  const next=[...scheduled].sort((a,b)=>a[1].due-b[1].due||a[0]-b[0])[0];assert(next,'automation must have a pending event');
  const [id,item]=next;now=item.due;if(item.repeat)item.due+=item.ms;else scheduled.delete(id);item.fn();
 }
 assert.match(bridge.flow.state().message,/处理完毕/);assert.equal(server.size,4);
 for(const c of [1,2]){assert.equal(calls.filter(x=>x==='inline-submit:'+c+':0').length,1);assert.equal(calls.filter(x=>x==='quiz-submit:'+c+':1').length,1);assert(calls.indexOf('inline-continue:'+c+':0')<calls.indexOf('quiz-submit:'+c+':1'));}
 assert.equal(calls.filter(x=>x.startsWith('ai:')).length,4);assert.equal(store.get('cx-quiz-submit-journal-v1').length,2);
 assert.equal((await bridge.quiz.run()).pending,true);assert.equal(calls.filter(x=>x.startsWith('quiz-submit:')).length,2);
 assert(observed.size<=6,'detached frame observers are removed while navigating');
 window.dispatchEvent(new window.Event('pagehide'));assert.equal(scheduled.size,0);assert.equal(observed.size,0);
 if(recovery){assert.equal(calls.filter(x=>x.startsWith('reload-player:')).length,1);console.log('PASS actual native reload path recovers a network media error using a new player document, without duplicate answers');}
  if(backgroundMode){assert.equal(calls.filter(x=>x.startsWith('background-pause:')).length,2);for(const ch of [1,2])assert(calls.filter(x=>x==='play:'+ch+':0').length>=3);console.log('PASS complete two-chapter flow remains hidden and resumes each platform pause before continuing videos, inline AI and chapter quizzes');}
 console.log('PASS full built userscript: enter -> auto native playback -> inline AI/feedback -> chapter AI/submit -> server verification -> next chapter -> finish, with no manual clicks');
 console.log('PASS repeated completion does not resubmit; page exit releases every scheduled timer');
})().catch(error=>{console.error(error);process.exitCode=1});
