const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const source = fs.readFileSync('dist/chaoxing-study-helper.user.js','utf8');
// 来源于实际页面观察到的结构；账号、任务与令牌使用测试值。
const arg = {
  attachments:[{
    type:'video',headOffset:403000,playTime:403000,attDuration:616,
    jobid:'job-fixture',otherInfo:'node-fixture&courseId=course-fixture',
    attDurationEnc:'duration-signature',videoFaceCaptureEnc:'capture-signature',
    property:{module:'insertvideo',objectid:'object-fixture',name:'Fixture video'},
    isPassed:false
  }],
  defaults:{fid:'school-fixture',clazzId:'class-fixture',userid:'user-fixture',reportTimeInterval:60,
    reportUrl:'https://mooc1.chaoxing.com/mooc-ans/multimedia/log/a/fixture'}
};
function harness({status=200,body,hold=false,media=null,playButton=null,inlineBox=null}={}) {
  const elements = new Map(), requests=[], timers=new Map(),intervals=new Map(),pageEvents=new Map(),childEvents=new Map();
  let nextTimer=0, now=0, aborted=0;
  class Element {
    constructor() { this.style={};this.value='';this.textContent='';this.children=[];this.listeners={}; }
    addEventListener(name,fn) { this.listeners[name]=fn; }
    append(child) { this.children.push(child); if(this.children.length===1)this.value=child.value; }
    replaceChildren() { this.children=[];this.value=''; }
    attachShadow() { return {set innerHTML(value){
      for(const match of value.matchAll(/id="([^"]+)"/g)) elements.set(match[1],new Element());
      elements.get('rate').value='1';
    },getElementById(id){
      if(!elements.has(id))elements.set(id,new Element());
      return elements.get(id);
    }}; }
  }
  const childDoc={cookie:'',addEventListener:(name,fn)=>childEvents.set(name,fn),removeEventListener:name=>childEvents.delete(name),querySelector(selector){return selector==='video,audio'?media:selector==='.vjs-big-play-button'?playButton:selector==='.tkTopic'?inlineBox:null},querySelectorAll(){return []},scripts:[{textContent:`mArg = ''; try { mArg = ${JSON.stringify(arg)}; } catch(e) {}`}]};
  const child={document:childDoc,frames:[],location:{href:'https://mooc1.chaoxing.com/mooc-ans/knowledge/cards?fixture=1'}};
  const document={scripts:[],querySelectorAll(){return []},getElementById(){return null},createElement(){return new Element()},documentElement:new Element()};
  const window={document,frames:[child],location:{href:'https://mooc1.chaoxing.com/mycourse/studentstudy'},addEventListener(name,fn){pageEvents.set(name,fn)},removeEventListener(name){pageEvents.delete(name)}};
  window.top=window;
  child.XMLHttpRequest=class {
    constructor(){this.headers={}}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(name,value){this.headers[name]=value}
    send(){
      requests.push(this);
      if(!hold)queueMicrotask(()=>{
        this.status=status;this.responseURL=this.url;
        this.responseText=body ?? JSON.stringify(requests.length===1?{status:'success',duration:616,dtoken:'token-fixture'}:{isPassed:requests.length>=3});
        this.onload();
      });
    }
    abort(){aborted++;this.onabort()}
  };
  const context={window,unsafeWindow:window,document,location:window.location,TextEncoder,URL,URLSearchParams,Date,
    performance:{now:()=>now},Date:class extends Date{static now(){return now}},
    setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},
    setInterval(fn,ms){const id=++nextTimer;intervals.set(id,{fn,ms});return id},clearInterval(id){intervals.delete(id)}
  };
  vm.createContext(context);vm.runInContext(source,context);
  return {elements,requests,timers,intervals,pageEvents,childEvents,child,childDoc,context,bridge:document.documentElement.children[0].__cxRuntime,get aborted(){return aborted},
    setMedia(value){media=value},setInlineBox(value){inlineBox=value},now(value){now=value},runTimer(ms){const pair=[...timers].find(([id,t])=>t.ms===ms);assert(pair,`Timer ${ms} exists`);timers.delete(pair[0]);return pair[1].fn()},
    click(id){return elements.get(id).listeners.click()}};
}
function player({throws=false,rejects=false,duration=616,currentTime=616}={}){
  const listeners=new Map();
  return {duration,currentTime,playbackRate:1,muted:false,paused:true,ended:false,plays:0,
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
    emit(name){listeners.get(name)?.()},
    play(){this.plays++;if(throws)throw new Error('blocked');if(rejects)return Promise.reject(new Error('autoplay'));this.paused=false;return Promise.resolve()},
    pause(){this.paused=true}
  };
}
async function flush(){await new Promise(resolve=>setImmediate(resolve))}
(async()=>{
  const h=harness();h.runTimer(1000);
  assert.equal(h.requests.length,0,'recognition sends no network requests');
  assert.equal(h.elements.get('jobs').children.length,1,'insertvideo is recognized');
  assert.match(h.elements.get('summary').textContent,/403 秒 \/ 616 秒/,'millisecond resume position');
  h.elements.get('rate').value='4';
  await h.click('start');
  assert.equal(h.requests.length,2);
  const metadata=new URL(h.requests[0].url);
  assert.equal(metadata.searchParams.get('k'),'school-fixture');
  assert.equal(metadata.searchParams.get('flag'),'normal');
  assert.equal(metadata.searchParams.get('ro'),'0');
  assert.equal(h.requests[0].withCredentials,true);
  const initial=new URL(h.requests[1].url);
  assert.equal(initial.searchParams.get('playingTime'),'403');
  assert.equal(initial.searchParams.get('duration'),'616');
  assert.equal(initial.searchParams.get('isdrag'),'3');
  const expected=crypto.createHash('md5').update('[class-fixture][user-fixture][job-fixture][object-fixture][403000][d_yHJ!$pdA~5][616000][0_616]').digest('hex');
  assert.equal(initial.searchParams.get('enc'),expected,'signature uses correct resume units');
  assert.equal(initial.searchParams.get('otherInfo'),'node-fixture','otherInfo matches official query layout');
  assert.equal(initial.searchParams.get('courseId'),'course-fixture');
  assert.equal(initial.searchParams.get('clazzId'),'class-fixture');
  assert.equal(initial.searchParams.get('attDuration'),'616');
  assert.equal(initial.searchParams.get('attDurationEnc'),'duration-signature');
  assert.equal(initial.searchParams.get('videoFaceCaptureEnc'),'capture-signature');
  assert.equal(h.requests[1].headers['Content-Type'],'application/json');
  h.now(60000);await h.runTimer(60000);
  const final=new URL(h.requests[2].url);
  assert.equal(final.searchParams.get('playingTime'),'616');
  assert.equal(final.searchParams.get('isdrag'),'4');
  assert.match(h.elements.get('log').textContent,/isPassed=true/);
  assert.equal(h.elements.get('start').disabled,false);
  console.log('PASS actual-page structure: recognize, resume, sign, final report, controls');

  const changed=harness();changed.runTimer(1000);changed.child.document={scripts:[]};
  await changed.click('start');assert.equal(changed.requests.length,0);
  assert.match(changed.elements.get('log').textContent,/章节已变化/);
  console.log('PASS stale chapter cannot start');

  const err=harness({status:403,body:'denied'});err.runTimer(1000);await err.click('start');
  assert.match(err.elements.get('log').textContent,/HTTP 403/);
  assert.equal(err.elements.get('start').disabled,false);
  console.log('PASS HTTP errors retain status and release controls');

  const html=harness({body:'<html>login</html>'});html.runTimer(1000);await html.click('start');
  assert.match(html.elements.get('log').textContent,/不是 JSON/);
  console.log('PASS login/verification HTML is diagnosed');

  const cancel=harness({hold:true});cancel.runTimer(1000);
  const run=cancel.click('start');await flush();cancel.click('stop');await run;
  assert.equal(cancel.aborted,1);assert.equal(cancel.requests.length,1);
  assert.equal(cancel.elements.get('start').disabled,false);
  assert(![...cancel.timers.values()].some(t=>t.ms===60000));
  console.log('PASS stop aborts pending request without scheduling another report');

  const missing=harness({body:JSON.stringify({duration:616})});missing.runTimer(1000);await missing.click('start');
  assert.equal(missing.requests.length,1);assert.match(missing.elements.get('log').textContent,/dtoken/);
  console.log('PASS invalid metadata cannot create a report');

  const probe=harness();probe.runTimer(1000);await probe.click('probe');
  assert.equal(probe.requests.length,1,'probe never reports progress');
  assert.match(probe.elements.get('log').textContent,/dtoken=存在/);
  assert(!probe.elements.get('log').textContent.includes('token-fixture'));
  assert.equal(probe.elements.get('probe').disabled,false);
  console.log('PASS read-only probe sends metadata only and redacts token');

  const video=player(),native=harness({media:video});native.runTimer(1000);
  const actual=native.bridge.media.play(0);
  assert.equal(video.currentTime,0,'unpassed video saved at the end starts actual playback from zero');
  assert.equal(video.plays,1);assert.equal(video.muted,true);assert.equal(native.requests.length,0);
  video.ended=true;video.emit('ended');assert.equal(native.bridge.media.state().active,true,'ended without observed playback progress cannot complete');
  video.currentTime=5;video.emit('timeupdate');video.currentTime=616;video.emit('ended');
  assert.equal((await actual).ok,true);assert.equal(native.bridge.media.state().busy,false);
  assert.equal(video.muted,false);assert.equal(video.paused,true);
  assert(![...native.intervals.values()].some(t=>t.ms===1000));
  console.log('PASS actual player starts, requires observed progress, ends, restores mute and releases controls');

  const stoppedVideo=player({currentTime:20}),nativeStop=harness({media:stoppedVideo});nativeStop.runTimer(1000);
  const waiting=nativeStop.bridge.media.play(0);nativeStop.bridge.media.stop();
  assert.equal((await waiting).ok,false);assert.equal(stoppedVideo.paused,true);
  stoppedVideo.currentTime=616;stoppedVideo.emit('timeupdate');stoppedVideo.emit('ended');
  assert(![...nativeStop.intervals.values()].some(t=>t.ms===1000));
  console.log('PASS stop cancels actual playback and removes listeners and watchdog');

  for(const setting of [{throws:true},{rejects:true}]){
    const denied=harness({media:player(setting)});denied.runTimer(1000);
    const outcome=await denied.bridge.media.play(0);
    assert.equal(outcome.ok,false);assert.equal(denied.bridge.media.state().busy,false);
    assert(![...denied.intervals.values()].some(t=>t.ms===1000));
  }
  console.log('PASS synchronous play errors and autoplay rejection leave no running watchdog');

  const changedNative=harness({media:player()});changedNative.runTimer(1000);
  const oldPlay=changedNative.bridge.media.play(0);changedNative.child.document={scripts:[]};
  [...changedNative.intervals.values()].find(t=>t.ms===1000).fn();
  assert.equal((await oldPlay).ok,false);assert.equal(changedNative.bridge.media.state().busy,false);
  console.log('PASS actual playback stops on chapter change');

  const lazyVideo=player({duration:NaN,currentTime:0});let buttonClicks=0;
  const lazy=harness({media:lazyVideo,playButton:{click(){buttonClicks++;lazyVideo.duration=616;lazyVideo.emit('loadedmetadata')}}});lazy.runTimer(1000);
  const initialized=lazy.bridge.media.play(0);
  assert.equal(buttonClicks,1);assert.equal(lazyVideo.plays,1);
  let stoppedMouseout=0;
  lazy.pageEvents.get('mouseout')({relatedTarget:null,stopImmediatePropagation(){stoppedMouseout++}});
  lazy.pageEvents.get('mouseout')({relatedTarget:{},stopImmediatePropagation(){stoppedMouseout++}});
  assert.equal(stoppedMouseout,1,'only leaving the page is intercepted during native playback');
  lazy.bridge.media.stop();assert.equal((await initialized).ok,false);assert(!lazy.pageEvents.has('mouseout'));
  console.log('PASS lazy platform player initializes through its play button; leaving-page handler is scoped and removed on stop');
  const resettingVideo=player({duration:NaN,currentTime:0});resettingVideo.defaultMuted=false;
  resettingVideo.play=function(){this.plays++;assert.equal(this.muted,true);assert.equal(this.defaultMuted,true);this.paused=false;return Promise.resolve()};
  const resetting=harness({media:resettingVideo,playButton:{click(){resettingVideo.muted=false;resettingVideo.defaultMuted=false;resettingVideo.duration=616;resettingVideo.emit('loadedmetadata')}}});resetting.runTimer(1000);
  const resetRun=resetting.bridge.media.play(0);assert.equal(resettingVideo.plays,1);resetting.bridge.media.stop();assert.equal((await resetRun).ok,false);assert.equal(resettingVideo.muted,false);assert.equal(resettingVideo.defaultMuted,false);
  console.log('PASS a lazy platform button resetting mute is followed by one muted native play; original mute settings are restored on stop');
  let policyAllowed=false;const policyVideo=player({currentTime:20});policyVideo.play=function(){this.plays++;if(!policyAllowed)return Promise.reject(Object.assign(new Error('gesture required'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve()};
  const policy=harness({media:policyVideo});policy.runTimer(1000);const policyRun=policy.bridge.media.play(0);await flush();assert.equal(policyVideo.plays,1);policy.runTimer(150);await flush();
  assert.equal(policyVideo.plays,2);assert.equal(policy.bridge.media.state().waitingForGesture,true);assert.equal(policy.bridge.media.state().active,true);
  policy.now(2000000);[...policy.intervals.values()].find(t=>t.ms===1000).fn();assert.equal(policy.bridge.media.state().active,true);assert.equal(policyVideo.plays,2);
  policy.childEvents.get('click')({isTrusted:false,target:{closest:()=>({})}});assert.equal(policyVideo.plays,2);
  policyAllowed=true;policy.childEvents.get('click')({isTrusted:true,target:{closest:()=>({})}});await flush();assert.equal(policyVideo.plays,3);assert.equal(policy.bridge.media.state().waitingForGesture,false);
  policyVideo.currentTime=30;policyVideo.emit('timeupdate');policyVideo.currentTime=616;policyVideo.emit('ended');assert.equal((await policyRun).ok,true);assert(!policy.childEvents.has('click'));
  console.log('PASS persistent NotAllowedError waits without polling play or timing out, ignores synthetic clicks, then resumes the same task on a real player click');
  const retryVideo=player({currentTime:20});retryVideo.play=function(){this.plays++;return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}))};
  const retryStop=harness({media:retryVideo});retryStop.runTimer(1000);const retryRun=retryStop.bridge.media.play(0);await flush();assert([...retryStop.timers.values()].some(t=>t.ms===150));retryStop.bridge.media.stop();assert.equal((await retryRun).ok,false);assert(![...retryStop.timers.values()].some(t=>t.ms===150));assert(!retryStop.childEvents.has('click'));
  console.log('PASS stopping during the muted retry cancels its timer and removes gesture listeners');

  const blankNative=harness();blankNative.runTimer(1000);let reloads=0;
  blankNative.child.frameElement={getAttribute:()=>'/ananas/modules/video/index.html?v=fixture',set src(value){reloads++;blankNative.setMedia(player())}};
  const reloaded=blankNative.bridge.media.play(0);assert.equal(reloads,1);assert.equal(blankNative.bridge.media.state().active,true);
  blankNative.bridge.media.stop();assert.equal((await reloaded).ok,false);
  console.log('PASS blank native player entry reloads its existing platform URL once before actual playback');

  const loading=harness();loading.runTimer(1000);
  loading.child.frameElement={getAttribute:()=>'/ananas/modules/video/index.html?v=fixture',set src(value){}};
  const loadingRun=loading.bridge.media.play(0);assert.equal(loading.bridge.media.state().busy,true);
  loading.bridge.media.stop();loading.runTimer(500);await flush();
  assert.equal((await loadingRun).ok,false);assert.equal(loading.bridge.media.state().busy,false);
  console.log('PASS stopping during blank player loading prevents a later start');

  const inlineMedia=player({currentTime:20}),inlineRun=harness({media:inlineMedia,inlineBox:{getClientRects:()=>[{}]}});inlineRun.runTimer(1000);
  let resolveInline,inlineCalls=0;
  inlineRun.bridge.quiz={inline:()=>{inlineCalls++;return new Promise(resolve=>{resolveInline=resolve})}};
  const nativeInline=inlineRun.bridge.media.play(0),watchInline=[...inlineRun.intervals.values()].find(t=>t.ms===1000).fn;
  inlineMedia.paused=true;watchInline();watchInline();assert.equal(inlineCalls,1,'pending inline question is not submitted twice');
  inlineRun.setInlineBox(null);resolveInline({ok:true});await flush();assert.equal(inlineMedia.paused,false);
  inlineRun.bridge.media.stop();assert.equal((await nativeInline).ok,false);
  console.log('PASS native player waits for one inline handler and resumes playback after confirmed feedback');

  const staleInline=harness({media:player(),inlineBox:{getClientRects:()=>[{}]}});staleInline.runTimer(1000);let resolveOld;
  staleInline.bridge.quiz={inline:()=>new Promise(resolve=>{resolveOld=resolve})};
  const stoppedInline=staleInline.bridge.media.play(0);[...staleInline.intervals.values()].find(t=>t.ms===1000).fn();
  staleInline.bridge.media.stop();resolveOld({ok:true});await flush();assert.equal((await stoppedInline).ok,false);
  assert.equal(staleInline.bridge.media.state().busy,false);
  console.log('PASS late inline completion cannot restart a stopped native player');
  const hiddenPlayer=player({currentTime:20}),hiddenTab=harness({media:hiddenPlayer});hiddenTab.runTimer(1000);hiddenTab.context.document.hidden=true;
  const hiddenPlayback=hiddenTab.bridge.media.play(0);hiddenTab.now(1000000);[...hiddenTab.intervals.values()].find(t=>t.ms===1000).fn();
  assert.equal(hiddenTab.bridge.media.state().active,true);assert.equal(hiddenPlayer.currentTime,20);hiddenTab.bridge.media.stop();assert.equal((await hiddenPlayback).ok,false);
  console.log('PASS a large hidden-tab timer gap extends watchdog budgets without changing actual playback time');
  const wakePlayer=player({currentTime:20}),wakeTab=harness({media:wakePlayer});wakeTab.runTimer(1000);wakeTab.context.document.hidden=true;
  const waking=wakeTab.bridge.media.play(0);wakeTab.pageEvents.get('visibilitychange')({stopImmediatePropagation(){}});wakeTab.now(1000000);wakeTab.context.document.hidden=false;wakeTab.pageEvents.get('focus')({});[...wakeTab.intervals.values()].find(t=>t.ms===1000).fn();
  assert.equal(wakeTab.bridge.media.state().active,true);wakeTab.bridge.media.stop();assert.equal((await waking).ok,false);
  console.log('PASS returning from a suspended hidden tab rebases watchdogs before the visible-tab check');
})();
