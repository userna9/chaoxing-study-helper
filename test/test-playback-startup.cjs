const assert=require('node:assert/strict');
const {harness,player,flush}=require('./fixtures/media-harness.cjs');
const denied=()=>Object.assign(new Error('autoplay denied'),{name:'NotAllowedError'});
const watch=h=>[...h.intervals.values()].find(t=>t.ms===1000).fn();
const scan=h=>h.runTimer(1000);
async function complete(h,p,promise){p.currentTime=5;p.emit('timeupdate');p.currentTime=p.duration;p.emit('ended');assert.equal((await promise).ok,true);assert.equal(h.bridge.media.state().busy,false);}
(async()=>{
 const p=player({currentTime:0});let clicks=0;const initialized=harness({media:p,playButton:{click(){clicks++}}});scan(initialized);const initializedRun=initialized.bridge.media.play(0);assert.equal(clicks,1);assert.equal(p.plays,1);initialized.bridge.media.stop();await initializedRun;
 console.log('PASS a visible platform start button is initialized even when metadata is already available');
 const lazyNode=player({currentTime:0});let lazyClicks=0,reloads=0;
 const noNode=harness({playButton:{click(){lazyClicks++;noNode.setMedia(lazyNode)}}});noNode.child.frameElement={getAttribute:()=>'/ananas/modules/video/index.html',set src(value){reloads++}};scan(noNode);
 const noNodeRun=noNode.bridge.media.play(0);await flush();assert.equal(lazyClicks,1);assert.equal(reloads,0);assert.equal(lazyNode.plays,1);await complete(noNode,lazyNode,noNodeRun);
 console.log('PASS a platform button that creates the first video is clicked once without a forced frame reload');

 const slow=player({duration:NaN,currentTime:0});slow.play=function(){this.plays++;if(!Number.isFinite(this.duration))return Promise.reject(denied());assert.equal(this.muted,true);this.paused=false;return Promise.resolve()};
 const loading=harness({media:slow,playButton:{click(){}}});scan(loading);const slowRun=loading.bridge.media.play(0);await flush();loading.runTimer(350);await flush();assert.equal(slow.plays,2);assert.equal(loading.bridge.media.state().waitingForGesture,false);
 slow.duration=616;slow.readyState=3;slow.emit('loadedmetadata');await flush();assert.equal(slow.plays,3);assert.equal(slow.paused,false);assert(![...loading.timers.values()].some(t=>[350,1000,2000,4000,8000].includes(t.ms)));await complete(loading,slow,slowRun);
 console.log('PASS delayed metadata cancels a pending retry and starts the ready video without a user click');

 const old=player({currentTime:0}),replacement=player({currentTime:0});let swap;
 const swapped=harness({media:old,playButton:{click(){if(!swap){swap=true;swapped.setMedia(replacement)}}}});scan(swapped);const swappedRun=swapped.bridge.media.play(0);await flush();assert.equal(old.plays,0);assert.equal(old.listenerCount,0);assert.equal(replacement.plays,1);assert.equal(replacement.muted,true);await complete(swapped,replacement,swappedRun);
 console.log('PASS platform initialization replacing the video binds and plays only the new node');

 let rejectOld;const pendingOld=player({currentTime:0});pendingOld.play=function(){this.plays++;return new Promise((resolve,reject)=>{rejectOld=reject})};const fresh=player({currentTime:0});
 const late=harness({media:pendingOld,withObserver:true});scan(late);const lateRun=late.bridge.media.play(0);late.setMedia(fresh);late.signalMutation();await flush();rejectOld(denied());await flush();assert.equal(fresh.plays,1);assert.equal(late.bridge.media.state().waitingForGesture,false);assert(![...late.timers.values()].some(t=>t.ms===350));assert.equal(pendingOld.listenerCount,0);await complete(late,fresh,lateRun);assert.equal(late.observers.size,0);
 console.log('PASS a late rejection from a detached video cannot pause or retry its replacement; observers are cleaned up');

 const gapOld=player({currentTime:0}),gapNew=player({currentTime:0});const gap=harness({media:gapOld});scan(gap);const gapRun=gap.bridge.media.play(0);await flush();gap.setMedia(null);watch(gap);assert.equal(gap.bridge.media.state().active,true);gap.now(1000);gap.setMedia(gapNew);watch(gap);await flush();assert.equal(gapNew.plays,1);assert.equal(gapOld.listenerCount,0);await complete(gap,gapNew,gapRun);
 console.log('PASS a temporary gap between removed and inserted media nodes is handled without reloading the chapter');

 let allowed=false;const stateful=player({currentTime:0});stateful.play=function(){this.plays++;if(!allowed)return Promise.reject(denied());this.paused=false;return Promise.resolve()};
 const readyAgain=harness({media:stateful});scan(readyAgain);const readyRun=readyAgain.bridge.media.play(0);await flush();for(const ms of [350,1000,2000,4000,8000]){readyAgain.runTimer(ms);await flush();}assert.equal(readyAgain.bridge.media.state().waitingForGesture,true);
 allowed=true;stateful.currentSrc='https://media.example/fixture.mp4';stateful.readyState=3;stateful.emit('canplay');await flush();assert.equal(readyAgain.bridge.media.state().waitingForGesture,false);assert.equal(stateful.paused,false);await complete(readyAgain,stateful,readyRun);
 console.log('PASS a genuinely new source/readiness state resumes an earlier policy wait automatically');

 const aborting=player({currentTime:0});aborting.play=function(){this.plays++;if(this.plays===1)return Promise.reject(Object.assign(new Error('source changing'),{name:'AbortError'}));this.paused=false;return Promise.resolve()};
 const interrupted=harness({media:aborting});scan(interrupted);const abortRun=interrupted.bridge.media.play(0);await flush();assert.equal(interrupted.bridge.media.state().active,true);interrupted.runTimer(350);await flush();assert.equal(aborting.plays,2);await complete(interrupted,aborting,abortRun);
 console.log('PASS a play request interrupted by asynchronous source initialization retries the existing player');

 let resolvePlay;const serial=player({duration:NaN,currentTime:0});serial.play=function(){this.plays++;return new Promise(resolve=>{resolvePlay=()=>{this.paused=false;resolve()}})};
 const one=harness({media:serial});scan(one);const oneRun=one.bridge.media.play(0);serial.duration=616;serial.readyState=3;serial.emit('loadedmetadata');serial.emit('canplay');assert.equal(serial.plays,1);resolvePlay();await flush();await complete(one,serial,oneRun);
 console.log('PASS metadata and canplay events do not create parallel play calls for the same node');
 const pausedDuringPlay=player({currentTime:0});pausedDuringPlay.play=function(){this.plays++;if(this.plays===1){this.paused=true;this.emit('pause')}else this.paused=false;return Promise.resolve()};
 const wake=harness({media:pausedDuringPlay});wake.context.document.hidden=true;scan(wake);const wakeRun=wake.bridge.media.play(0);await flush();assert.equal(pausedDuringPlay.plays,2);assert.equal(pausedDuringPlay.paused,false);await complete(wake,pausedDuringPlay,wakeRun);
 console.log('PASS a background resume arriving before play resolves is retained and executed after that request settles');

 let waiting=false;const remuted=player({currentTime:0});remuted.play=function(){this.plays++;if(!waiting)return Promise.reject(denied());assert.equal(this.muted,true);this.paused=false;return Promise.resolve()};
 const mute=harness({media:remuted});scan(mute);const muteRun=mute.bridge.media.play(0);await flush();remuted.muted=false;remuted.emit('volumechange');assert.equal(remuted.muted,true);waiting=true;mute.runTimer(350);await flush();await complete(mute,remuted,muteRun);
 console.log('PASS an asynchronous mute reset during startup is corrected before the next play attempt');

 const gatedPlayer=player({currentTime:0});const gated=harness({media:gatedPlayer,verification:true});scan(gated);const gatedRun=gated.bridge.media.play(0);assert.equal(gatedPlayer.plays,0);watch(gated);gated.setVerification(false);watch(gated);await flush();assert.equal(gatedPlayer.plays,1);await complete(gated,gatedPlayer,gatedRun);
 console.log('PASS startup waits for platform verification to clear before making a playback request');

 const emptyOld=player({currentTime:0});const empty=harness({media:emptyOld});scan(empty);const emptyRun=empty.bridge.media.play(0);empty.setMedia(null);watch(empty);empty.now(21000);watch(empty);const noReplacement=await emptyRun;assert.equal(noReplacement.ok,false);assert.equal(noReplacement.retryable,true);assert.equal(emptyOld.listenerCount,0);
 console.log('PASS an indefinitely missing replacement node exits with a retryable result and removes old listeners');
})().catch(error=>{console.error(error);process.exitCode=1});
