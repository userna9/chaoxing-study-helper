const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {harness,player,flush}=require('./fixtures/media-harness.cjs');
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
  const policy=harness({media:policyVideo});policy.runTimer(1000);const policyRun=policy.bridge.media.play(0);await flush();assert.equal(policyVideo.plays,1);for(const ms of [350,1000,2000,4000,8000]){policy.runTimer(ms);await flush();}
  assert.equal(policyVideo.plays,6);assert.equal(policy.bridge.media.state().waitingForGesture,true);assert.equal(policy.bridge.media.state().active,true);
  policy.now(2000000);[...policy.intervals.values()].find(t=>t.ms===1000).fn();assert.equal(policy.bridge.media.state().active,true);assert.equal(policyVideo.plays,6);
  policy.childEvents.get('click')({isTrusted:false,target:{closest:()=>({})}});assert.equal(policyVideo.plays,6);
  policyAllowed=true;policy.childEvents.get('click')({isTrusted:true,target:{closest:()=>({})}});await flush();assert.equal(policyVideo.plays,7);assert.equal(policy.bridge.media.state().waitingForGesture,false);
  policyVideo.currentTime=30;policyVideo.emit('timeupdate');policyVideo.currentTime=616;policyVideo.emit('ended');assert.equal((await policyRun).ok,true);assert(!policy.childEvents.has('click'));
  console.log('PASS persistent NotAllowedError waits without polling play or timing out, ignores synthetic clicks, then resumes the same task on a real player click');
  const retryVideo=player({currentTime:20});retryVideo.play=function(){this.plays++;return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}))};
  const retryStop=harness({media:retryVideo});retryStop.runTimer(1000);const retryRun=retryStop.bridge.media.play(0);await flush();assert([...retryStop.timers.values()].some(t=>t.ms===350));retryStop.bridge.media.stop();assert.equal((await retryRun).ok,false);assert(![...retryStop.timers.values()].some(t=>t.ms===350));assert(!retryStop.childEvents.has('click'));
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
