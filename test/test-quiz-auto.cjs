const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
function fixture({course=false,nonChapter=false,submitted=false,missing=false,held=false,flowEnabled=false,flowStopped=false,auto=true,lockDenied=false}={}){
 const {document,window}=parseHTML('<html><body></body></html>');window.top=window;
 const url=course?'https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=c&clazzid=cl':'https://mooc1.chaoxing.com/mooc-ans/work/doHomeWorkNew?courseId=c&classId=cl&workId=w'+(nonChapter?'':'&api=1&knowledgeid=k&jobid=work-x');window.location={href:url};
 const host=document.createElement('div');host.id='cx-progress-experiment';document.body.append(host);const root=host.attachShadow({mode:'open'});root.innerHTML='<section><input id="quiz-auto-enabled" type="checkbox"><small id="quiz-auto-status"></small><button id="quiz-stop"></button><button id="flow-stop"></button><button id="flow-start"></button><input id="flow-auto" type="checkbox"></section>';
 let revision=0,key='q1',found=true,busy=false,flowPhase=flowStopped?'stopped':'paused',running=flowEnabled,runs=0,starts=0,stops=0,resolveRun;
 const store=new Map([['cx-quiz-auto:c:cl',auto]]),timers=new Map(),intervals=new Map();let timerId=0;
 const bridge={quiz:{inspect:()=>({found,key,revision,busy,submitted}),state:()=>({busy}),stop(){stops++;busy=false;resolveRun?.({ok:false,message:'已停止'})},run:async()=>{runs++;busy=true;if(held)return new Promise(resolve=>resolveRun=value=>{busy=false;resolve(value)});busy=false;return missing?{ok:false,message:'没有答案'}:{ok:true,submitted:true}}},media:{state:()=>({busy:false})}};
 if(course)bridge.flow={state:()=>({enabled:running,phase:flowPhase}),start(){starts++;running=true;flowPhase='detecting'},stop(){running=false;flowPhase='stopped'}};
 host.__cxRuntime=bridge;
 const ctx={window,document,location:window.location,URL,navigator:{locks:{request:async(name,options,callback)=>callback(lockDenied?null:{name})}},GM_getValue:(k,f)=>store.has(k)?store.get(k):f,GM_setValue:(k,v)=>store.set(k,v),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{const id=++timerId;intervals.set(id,{fn,ms});return id},clearInterval:id=>intervals.delete(id)};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/quiz-auto.js','utf8'),ctx);
 async function pump(){for(let i=0;i<10;i++){for(const [id,t]of [...timers]){timers.delete(id);t.fn()}for(let j=0;j<10;j++)await Promise.resolve();}}
 return {window,root,bridge,store,timers,intervals,pump,get runs(){return runs},get starts(){return starts},get stops(){return stops},update(){revision++;root.dispatchEvent(new window.Event('cx-quiz-source-change'))},change(){key+='x';bridge.quiz.auto.notify()},setFlowEnabled:v=>running=v,setFound:v=>found=v,resolve:value=>resolveRun?.(value),status:()=>root.getElementById('quiz-auto-status').textContent};
}
(async()=>{
 const direct=fixture();await direct.pump();assert.equal(direct.runs,1);for(let i=0;i<10;i++)direct.bridge.quiz.auto.notify();await direct.pump();assert.equal(direct.runs,1);
 console.log('PASS chapter quiz opens and runs automatically once, without scan/match/fill clicks or repeated calls from duplicate events');
 const owner=fixture({course:true,flowEnabled:true});await owner.pump();assert.equal(owner.runs,0);assert.equal(owner.starts,0);owner.setFlowEnabled(false);owner.update();await owner.pump();assert.equal(owner.starts,1);assert.equal(owner.runs,0);
 console.log('PASS course coordinator retains ownership; changed answer configuration resumes the paused course instead of starting a competing quiz runner');
 const missing=fixture({missing:true});await missing.pump();assert.equal(missing.runs,1);missing.bridge.quiz.auto.notify();await missing.pump();assert.equal(missing.runs,1);missing.update();await missing.pump();assert.equal(missing.runs,2);
 console.log('PASS missing-answer failure waits for a changed API/bank configuration and never spins on the same task');
 const changed=fixture();await changed.pump();changed.change();await changed.pump();assert.equal(changed.runs,2);
 console.log('PASS a changed question set is automatically detected as a new task');
 const stopped=fixture({held:true});await stopped.pump();assert.equal(stopped.runs,1);stopped.root.getElementById('quiz-stop').click();stopped.resolve({ok:true});await stopped.pump();assert.equal(stopped.bridge.quiz.auto.state().enabled,false);assert.match(stopped.status(),/已停止/);assert.equal(stopped.store.get('cx-quiz-auto:c:cl'),false);
 console.log('PASS explicit stop cancels the in-flight quiz, persists the preference, and rejects late completion');
 for(const options of [{nonChapter:true},{submitted:true},{auto:false},{course:true,flowStopped:true}]){const excluded=fixture(options);await excluded.pump();assert.equal(excluded.runs,0);assert.equal(excluded.starts,0);}
 console.log('PASS general homework, previously submitted tests, disabled automation and stopped course flows never auto-submit');
 const lock=fixture({lockDenied:true});await lock.pump();assert.equal(lock.runs,0);assert.match(lock.status(),/待机/);
 console.log('PASS a second same-course tab waits when the course Web Lock is unavailable');
 const delayed=fixture();delayed.setFound(false);await delayed.pump();assert.equal(delayed.runs,0);delayed.setFound(true);delayed.bridge.quiz.auto.notify();await delayed.pump();assert.equal(delayed.runs,1);
 console.log('PASS asynchronously loaded questions are detected and started after the original empty page');
 const disposed=fixture();disposed.window.dispatchEvent(new disposed.window.Event('pagehide'));await disposed.pump();assert.equal(disposed.runs,0);assert.equal(disposed.timers.size,0);assert.equal(disposed.intervals.size,0);
 console.log('PASS leaving the page clears polling and pending automatic detection before it can submit');
})().catch(e=>{console.error(e);process.exitCode=1});
