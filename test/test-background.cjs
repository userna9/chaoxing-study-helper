const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function target(){const events=new Map();return {events,addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn)},removeEventListener(type,fn){events.get(type)?.delete(fn);if(!events.get(type)?.size)events.delete(type)},emit(type,extra={}){const event={target:this,type,stopped:0,stopImmediatePropagation(){this.stopped++},...extra};for(const fn of [...events.get(type)||[]])fn(event);return event}};}
function fixture(){
 let now=10000,active=true,enabled=true,blocked=false,plays=0,wakes=0,next=0;const timers=new Map();
 const main=target(),child=target();main.document=Object.assign(target(),{hidden:false,visibilityState:'visible'});child.document=Object.assign(target(),{hidden:false,visibilityState:'visible'});
 const media=Object.assign(target(),{paused:true,ended:false});
 const make=vm.runInNewContext(fs.readFileSync('src/background-module.js','utf8')+'\ncreateBackgroundPlayback',{Date:{now:()=>now},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});
 const controller=make({windows:[main,child,child],media,isCurrent:()=>active,enabled:()=>enabled,isBlocked:()=>blocked,play:()=>{plays++;media.paused=false},onWake:()=>wakes++});
 return {main,child,media,controller,timers,get plays(){return plays},get wakes(){return wakes},hide(){main.document.hidden=true;main.document.visibilityState='hidden'},setActive:v=>active=v,setEnabled:v=>enabled=v,setBlocked:v=>blocked=v,advance(ms){now+=ms;for(const [id,t]of [...timers]){timers.delete(id);t.fn()}}};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve()}
(async()=>{
 const h=fixture();h.hide();const hidden=h.main.emit('visibilitychange');await flush();assert.equal(hidden.stopped,1);assert.equal(h.plays,1);assert.equal(h.main.document.hidden,true);
 console.log('PASS switching to a hidden tab captures visibility pause and resumes actual media without falsifying document visibility');
 const nested=fixture();const blur=nested.child.emit('blur');nested.media.emit('pause');await flush();assert.equal(blur.stopped,1);assert.equal(nested.plays,1);
 console.log('PASS player iframe blur and pause events share one coalesced resume request');
 const edit=fixture();assert.equal(edit.main.emit('blur',{target:{tagName:'INPUT'}}).stopped,0);await flush();assert.equal(edit.plays,0);
 console.log('PASS ordinary input focus changes do not trigger the window-leaving guard');
 const disabled=fixture();disabled.setEnabled(false);disabled.hide();assert.equal(disabled.main.emit('visibilitychange').stopped,0);disabled.media.emit('pause');await flush();assert.equal(disabled.plays,0);
 console.log('PASS turning background playback off prevents both interception and automatic background resume');
 const blocked=fixture();blocked.hide();blocked.setBlocked(true);blocked.main.emit('visibilitychange');blocked.media.emit('pause');await flush();assert.equal(blocked.plays,0);blocked.setBlocked(false);blocked.main.emit('focus');await flush();assert.equal(blocked.plays,1);
 console.log('PASS inline questions and platform verification block auto-resume until their blocking state is cleared');
 const canceled=fixture();canceled.hide();canceled.media.emit('pause');canceled.controller.stop();await flush();assert.equal(canceled.plays,0);assert.equal(canceled.media.events.size,0);assert.equal(canceled.main.events.size,0);assert.equal(canceled.child.document.events.size,0);
 console.log('PASS stop removes listeners and invalidates an already queued resume microtask');
 const stale=fixture();stale.hide();stale.setActive(false);stale.media.emit('pause');await flush();assert.equal(stale.plays,0);stale.setActive(true);stale.media.ended=true;stale.media.emit('pause');await flush();assert.equal(stale.plays,0);
 console.log('PASS stale and ended media cannot be restarted by background handlers');
 const frozen=fixture();frozen.hide();frozen.child.document.emit('freeze');frozen.media.emit('pause');await flush();assert.equal(frozen.plays,0);frozen.child.document.emit('resume');await flush();assert.equal(frozen.plays,1);assert.equal(frozen.wakes,1);
 console.log('PASS frozen lifecycle is respected; browser resume rebases the watchdog and resumes current media');
 const rate=fixture();rate.hide();rate.media.emit('pause');await flush();rate.media.paused=true;for(let i=0;i<20;i++)rate.media.emit('pause');await flush();assert.equal(rate.plays,1);assert.equal(rate.timers.size,1);rate.advance(2000);await flush();assert.equal(rate.plays,2);
 console.log('PASS repeated platform pause events are coalesced and rate-limited instead of creating a busy loop');
 const timerStop=fixture();timerStop.hide();timerStop.media.emit('pause');await flush();timerStop.media.paused=true;timerStop.media.emit('pause');assert.equal(timerStop.timers.size,1);timerStop.controller.stop();assert.equal(timerStop.timers.size,0);timerStop.advance(3000);await flush();assert.equal(timerStop.plays,1);
 console.log('PASS stop cancels a delayed background retry without a later accidental restart');
})().catch(error=>{console.error(error);process.exitCode=1});
