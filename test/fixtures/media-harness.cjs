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
function harness({status=200,body,hold=false,media=null,playButton=null,inlineBox=null,withObserver=false,verification=false}={}) {
  const elements = new Map(), requests=[], timers=new Map(),intervals=new Map(),pageEvents=new Map(),childEvents=new Map(),observers=new Set();
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
  const mask={getClientRects:()=>verification?[{}]:[]};
  const childDoc={cookie:'',documentElement:new Element(),addEventListener:(name,fn)=>childEvents.set(name,fn),removeEventListener:name=>childEvents.delete(name),querySelector(selector){return selector==='video,audio'?media:selector==='.vjs-big-play-button'?playButton:selector==='.tkTopic'?inlineBox:null},querySelectorAll(selector){return selector.includes('#fcqrimg')?[mask]:[]},scripts:[{textContent:`mArg = ''; try { mArg = ${JSON.stringify(arg)}; } catch(e) {}`}]};
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
  if(withObserver)context.MutationObserver=class{constructor(fn){this.fn=fn}observe(){observers.add(this)}disconnect(){observers.delete(this)}};
  vm.createContext(context);vm.runInContext(source,context);
  return {elements,requests,timers,intervals,pageEvents,childEvents,observers,child,childDoc,context,bridge:document.documentElement.children[0].__cxRuntime,get aborted(){return aborted},
    setMedia(value){media=value},signalMutation(){for(const observer of [...observers])observer.fn([])},setVerification(value){verification=value},setInlineBox(value){inlineBox=value},now(value){now=value},runTimer(ms){const pair=[...timers].find(([id,t])=>t.ms===ms);assert(pair,`Timer ${ms} exists`);timers.delete(pair[0]);return pair[1].fn()},
    click(id){return elements.get(id).listeners.click()}};
}
function player({throws=false,rejects=false,duration=616,currentTime=616}={}){
  const listeners=new Map();
  return {duration,currentTime,playbackRate:1,muted:false,paused:true,ended:false,plays:0,get listenerCount(){return listeners.size},
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
    emit(name){listeners.get(name)?.()},
    play(){this.plays++;if(throws)throw new Error('blocked');if(rejects)return Promise.reject(new Error('autoplay'));this.paused=false;return Promise.resolve()},
    pause(){this.paused=true}
  };
}
async function flush(){await new Promise(resolve=>setImmediate(resolve))}

module.exports={harness,player,flush};
