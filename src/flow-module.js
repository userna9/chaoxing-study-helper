
// === CONTINUOUS FLOW MODULE ===
(() => {
  'use strict';
  if(window!==window.top)return;
  const host=document.getElementById('cx-progress-experiment');
  const bridge=host?.__cxRuntime,root=host?.shadowRoot;
  if(!bridge?.media||!bridge.quiz||!root)return;
  const section=root.querySelector('section'),panel=document.createElement('div');
  panel.id='cx-flow';panel.style.cssText='padding:8px 0;border-bottom:1px solid #ddd;margin-bottom:8px';
  panel.innerHTML='<b>自动连续学习 · __VERSION__</b><small id="flow-status">等待课程加载……</small><label><input id="flow-auto" type="checkbox" style="width:auto">进入本课程自动运行</label><label style="display:block"><input id="flow-background" type="checkbox" style="width:auto">允许切换网页后继续播放</label><div><button id="flow-start">开启连续学习</button><button id="flow-stop">停止全部</button><button id="flow-collapse">收起面板</button></div><small>自动识别视频、视频内问答和章节测验，确认平台完成后切换。后台播放需将课程网站加入浏览器“始终保持活动”列表。</small><details id="flow-advanced"><summary>高级音视频设置</summary><label>音视频方式<select id="flow-media-mode"><option value="native">实际播放（推荐）</option><option value="hybrid">先尝试上报，未通过则实际播放</option><option value="protocol">仅尝试模拟上报（实验）</option></select></label></details>';
  section.prepend(panel);
  const el=id=>root.getElementById(id);
  el('flow-background').checked=bridge.media.background?.enabled()!==false;
  el('flow-background').addEventListener('change',()=>bridge.media.background?.setEnabled(el('flow-background').checked));
  const validModes=['hybrid','native','protocol'];
  // Migration: old installations defaulted to simulated reporting. Use native playback
  // for this release unless the user subsequently changes the advanced setting.
  const storedMode=typeof GM_getValue==='function'?GM_getValue('cx-flow-media-mode-v2','native'):'native';
  let mediaMode=validModes.includes(storedMode)?storedMode:'native';
  for(const option of el('flow-media-mode').options)option.selected=option.value===mediaMode;
  const topParams=new URL(location.href).searchParams;
  const scope=`${topParams.get('courseId')||topParams.get('courseid')||''}:${topParams.get('clazzid')||topParams.get('classId')||''}`;
  const storeKey='cx-flow-v1:'+scope;
  const autoKey='cx-flow-auto:'+scope;
  const coursePage=/\/studentstudy\/?$/.test(location.pathname);
  const autoSetting=typeof GM_getValue==='function'?GM_getValue(autoKey,true):true;
  el('flow-auto').checked=autoSetting===true;
  let saved;
  try{saved=JSON.parse(sessionStorage.getItem(storeKey)||'null')}catch{}
  let enabled=coursePage&&(saved?.enabled===true||autoSetting===true),runId=0,running=false,navigating=false,phase='idle';
  let disposed=false,observerTimer,leaseTimer,leaseLost=false,ownsLease=false,hasWebLock=false;
  const owner=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),leaseKey='cx-flow-lease:'+scope;
  const observed=new Map();
  const done=new Set(Array.isArray(saved?.done)?saved.done:[]);
  let lastMessage='';
  function persist(){try{sessionStorage.setItem(storeKey,JSON.stringify({enabled,done:[...done].slice(-1000)}))}catch{}}
  function status(text,nextPhase=phase){phase=nextPhase;lastMessage=text;el('flow-status').textContent=text;el('flow-start').disabled=enabled;el('flow-media-mode').disabled=enabled;}
  function assertRun(id){if(!enabled||id!==runId||disposed)throw new Error('连续学习已停止');if(leaseLost)throw new Error('同课程另一个标签页已接管，当前页已停止');}
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function rest(ms,id){for(let remaining=ms;remaining>0;remaining-=500){assertRun(id);await delay(Math.min(500,remaining));}assertRun(id);}
  function visible(node){
    if(!node)return false;
    try{return node.getClientRects().length>0&&node.ownerDocument.defaultView.getComputedStyle(node).visibility!=='hidden'}catch{return false;}
  }
  function verification(){
    let found=false;const seen=new Set();
    function walk(win,depth=0){if(depth>8||seen.has(win))return;seen.add(win);try{
      if([...win.document.querySelectorAll('#fcqrimg,.chapterVideoFaceMaskDiv,.yidun_popup,.geetest_panel')].some(visible))found=true;
      for(let i=0;i<win.frames.length;i++)walk(win.frames[i],depth+1);
    }catch{}}
    walk(unsafeWindow);return found;
  }
  function checkVerification(){if(verification())throw new Error('检测到平台身份验证，等待验证完成');}
  async function ready(id){
    assertRun(id);let waiting=false;
    while(verification()||(typeof navigator!=='undefined'&&navigator.onLine===false)){
      waiting=true;status(verification()?'等待平台身份验证完成；完成后自动恢复。':'网络离线，等待连接恢复……','waiting');
      await rest(1000,id);
    }
    if(waiting)status('阻塞已解除，恢复任务……','detecting');
  }
  function readLease(){try{return JSON.parse(localStorage.getItem(leaseKey)||'null')}catch{return null}}
  function writeLease(){try{localStorage.setItem(leaseKey,JSON.stringify({owner,expires:Date.now()+20000}));return true}catch{return false}}
  function releaseLease(){clearInterval(leaseTimer);if(ownsLease&&readLease()?.owner===owner)try{localStorage.removeItem(leaseKey)}catch{}ownsLease=false;}
  async function acquireLease(id){
    // Web Locks is authoritative on supported browsers. The lease is a fallback
    // for older browsers, reconciled before every mutation and periodically.
    if(hasWebLock)return true;
    const previous=readLease();
    if(previous&&previous.owner!==owner&&previous.expires>Date.now())return false;
    if(!writeLease())return true;
    await rest(200,id);if(readLease()?.owner!==owner)return false;
    ownsLease=true;leaseLost=false;
    leaseTimer=setInterval(()=>{
      if(readLease()?.owner!==owner){leaseLost=true;bridge.media.stop();bridge.quiz.stop();clearInterval(leaseTimer);return;}
      writeLease();
    },4000);return true;
  }
  function observeDocuments(){
    if(disposed||typeof MutationObserver==='undefined')return;
    const seen=new Set(),live=new Set();
    function walk(win,depth=0){if(depth>8||seen.has(win))return;seen.add(win);try{
      const doc=win.document;live.add(doc);
      if(!observed.has(doc)){
        const observer=new MutationObserver(records=>{if(records.some(r=>r.target!==host&&!host.contains(r.target)))scheduleObservation();});
        observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','class','style']});
        const listener=e=>{if(e.target.tagName==='IFRAME')scheduleObservation()};doc.addEventListener('load',listener,true);observed.set(doc,{observer,listener});
      }
      for(let i=0;i<win.frames.length;i++)walk(win.frames[i],depth+1);
    }catch{}}
    walk(unsafeWindow);
    for(const [doc,binding]of observed)if(!live.has(doc)){binding.observer.disconnect();doc.removeEventListener('load',binding.listener,true);observed.delete(doc);}
  }
  function scheduleObservation(){clearTimeout(observerTimer);observerTimer=setTimeout(()=>{observeDocuments();if(!bridge.quiz.state().busy)bridge.quiz.scan();bridge.quiz.auto?.notify();},300);}
  function mutationGuard(id){assertRun(id);checkVerification();if(ownsLease&&readLease()?.owner!==owner){leaseLost=true;assertRun(id);}}
  function cardSnapshot(){
    const tabs=[...document.querySelectorAll('li[id^="dct"][cardid]')];
    const active=tabs.find(t=>t.classList.contains('active'));
    const frame=document.getElementById('iframe');
    const cards=bridge.media.cards();
    const card=cards.find(c=>active&&String(c.arg.defaults.cardid)===active.getAttribute('cardid'))||(!tabs.length?cards[0]:null);
    if(!card)return null;
    const chapter=String(card.arg.defaults.knowledgeid||document.querySelector('.posCatalog_active[id^="cur"]')?.id.slice(3)||'');
    const cardid=String(card.arg.defaults.cardid||active?.getAttribute('cardid')||'');
    const key=`${chapter}:${cardid}`;
    const jobs=card.arg.attachments.filter(a=>a.job===true||Boolean(a.jobid||a.property?._jobid||a.property?.jobid)).map(a=>{
      const id=String(a.jobid||a.property?._jobid||a.property?.jobid||''),kind=String(a.type||a.property?.module||'').toLowerCase();
      let passed=a.isPassed===true;
      if(!passed)for(const iframe of card.doc.querySelectorAll('iframe[data]')){
        try{
          const data=JSON.parse(iframe.getAttribute('data'));
          if(String(data.jobid||data._jobid||'')===id&&iframe.parentElement?.classList.contains('ans-job-finished'))passed=true;
        }catch{}
      }
      return {id,kind,passed,required:a.job!==false||a.isPassed===true};
    });
    return {key,chapter,cardid,card,tabs,active,frame,jobs,title:active?.getAttribute('title')||card.arg.knowledgename||'当前任务'};
  }
  async function waitFor(test,id,timeout=20000){
    let started=Date.now(),lastPoll=Date.now();
    for(;;){
      assertRun(id);const now=Date.now(),gap=now-lastPoll;lastPoll=now;
      if(document.hidden&&bridge.media.background?.enabled()!==false&&gap>15000)started+=gap;
      const pausedAt=Date.now();await ready(id);started+=Date.now()-pausedAt;
      const value=test();if(value)return value;
      if(Date.now()-started>=timeout)break;await rest(500,id);
    }
    throw new Error('页面或任务状态等待超时，请检查平台提示后继续');
  }
  function chapterPassed(chapter){return Boolean(document.getElementById('cur'+chapter)?.querySelector('.icon_Completed'));}
  async function reloadAndVerify(before,id){
    if(chapterPassed(before.chapter))return true;
    const current=cardSnapshot();
    if(current&&current.key!==before.key)throw new Error('任务已切换，旧任务尚未核对完成；请在目标页面继续');
    if(!before.frame)throw new Error('缺少章节内容框架，无法核对完成状态');
    for(let attempt=0;attempt<2;attempt++){
      mutationGuard(id);status('核对平台保存的任务状态……','confirming');
      const oldDoc=cardSnapshot()?.card.doc||before.card.doc;
      before.frame.contentWindow.location.reload();
      const fresh=await waitFor(()=>{
        const s=cardSnapshot();
        return s&&s.key===before.key&&s.card.doc!==oldDoc?s:null;
      },id);
      const targetIds=new Set(before.jobs.filter(j=>j.required).map(j=>j.id));
      const matched=fresh.jobs.filter(j=>targetIds.has(j.id));
      if(chapterPassed(before.chapter)||(targetIds.size>0&&matched.length===targetIds.size&&matched.every(j=>j.passed)))return true;
      if(attempt===0)await rest(3000,id);
    }
    throw new Error('平台尚未确认任务完成；请检查提交确认或验证提示');
  }
  async function navigateTab(tab,id){
    mutationGuard(id);const target=tab.getAttribute('cardid');
    status(`切换任务：${tab.getAttribute('title')||tab.textContent.trim()}`,'navigating');
    const args=(tab.getAttribute('onclick')||'').match(/^changeDisplayContent\((\d+),(\d+),'(\d+)','(\d+)','(\d+)',''\);?$/);
    if(args&&typeof unsafeWindow.changeDisplayContent==='function')unsafeWindow.changeDisplayContent(Number(args[1]),Number(args[2]),args[3],args[4],args[5],'');
    else tab.click();
    return waitFor(()=>{const s=cardSnapshot();return s?.cardid===target?s:null},id);
  }
  async function nextFrom(snapshot,id){
    done.add(snapshot.key);persist();
    const other=snapshot.tabs.find(t=>!done.has(`${snapshot.chapter}:${t.getAttribute('cardid')}`));
    if(other){await navigateTab(other,id);return true;}
    const chapters=[...document.querySelectorAll('[id^="cur"]')].filter(c=>/^cur\d+$/.test(c.id)&&c.querySelector('[onclick^="getTeacherAjax"]'));
    const index=chapters.findIndex(c=>c.id==='cur'+snapshot.chapter);
    const filtered=Boolean(document.getElementById('searchChapterListByName')?.value.trim());
    if(index<0||filtered){
      const button=document.getElementById('prevNextFocusNext');
      const args=(button?.getAttribute('onclick')||'').match(/^PCount\.next\('([^']*)','(\d+)','(\d+)','(\d+)'(?:,.*)?\)\s*;?$/);
      if(!args||args[2]!==snapshot.chapter||args[3]!==String(topParams.get('courseId')||topParams.get('courseid'))||args[4]!==String(topParams.get('clazzid')||topParams.get('classId'))||!visible(button)||button.disabled||button.getAttribute('aria-disabled')==='true')throw new Error('目录受筛选或尚未加载，且未找到可用的下一节按钮');
      mutationGuard(id);status('目录不可用，正在通过平台“下一节”继续……','navigating');button.click();
      await waitFor(()=>{const s=cardSnapshot();return s?.chapter&&s.chapter!==snapshot.chapter?s:null;},id);
      return true;
    }
    const next=chapters.slice(index+1).find(c=>!c.querySelector('.icon_Completed'));
    if(!next){enabled=false;persist();status('当前章节及后续可见章节已处理完毕。','finished');return false;}
    const link=next.querySelector('[onclick^="getTeacherAjax"]');
    if(!link)throw new Error('下一章节没有可用的导航控件');
    const target=next.id.slice(3);mutationGuard(id);status(`进入下一章节：${next.textContent.trim()}`,'navigating');
    try{
      if(typeof unsafeWindow.getTeacherAjax==='function')unsafeWindow.getTeacherAjax(topParams.get('courseId')||topParams.get('courseid'),topParams.get('clazzid')||topParams.get('classId'),target,topParams.get('cpi')||0);
      else link.click();
      await waitFor(()=>{const s=cardSnapshot();return s?.chapter===target?s:null},id,6000);return true;
    }
    catch(e){
      assertRun(id);checkVerification();
      if(!/^\d+$/.test(target)||!document.getElementById('cur'+target)||!/\/studentstudy$/.test(location.pathname))throw e;
      const destination=new URL(location.href);destination.searchParams.set('chapterId',target);
      navigating=true;persist();status('章节正文未更新，正在整页进入下一章……');
      try{unsafeWindow.location.assign(destination.href)}catch{navigating=false;throw new Error('整页进入下一章失败，请检查平台提示')}
      return false;
    }
  }
  async function ensureQuizLoaded(id){
    if(bridge.quiz.scan().found)return;
    status('等待章节测验加载……');
    try{await waitFor(()=>bridge.quiz.scan().found,id,6000);return;}catch(e){assertRun(id);}
    let frame,wrapper;
    for(const card of bridge.media.cards()){
      const find=w=>{try{
        const candidate=w.document.querySelector('iframe#frame_content[src*="/api/work"],iframe#frame_content[src*="/work/"]');
        if(candidate)frame=candidate;
        const outer=w.document.querySelector('iframe[src*="/ananas/modules/work/index.html"]');
        if(outer)wrapper=outer;
        for(let i=0;!frame&&i<w.frames.length;i++)find(w.frames[i]);
      }catch{}};
      find(card.win);if(frame)break;
    }
    if(!frame&&wrapper){
      const url=new URL(wrapper.getAttribute('src'),location.href);
      if(url.origin!==location.origin)throw new Error('测验入口跨源，请手动打开后继续');
      assertRun(id);status('测验入口为空，重新加载平台入口……');wrapper.src=url.href;
      await waitFor(()=>{
        if(bridge.quiz.scan().found)return true;
        try{frame=wrapper.contentDocument?.querySelector('iframe#frame_content[src*="/api/work"],iframe#frame_content[src*="/work/"]')}catch{}
        return Boolean(frame);
      },id,20000);
      if(bridge.quiz.scan().found)return;
    }
    if(!frame)throw new Error('没有可加载的测验框架，请手动打开测验后继续');
    const url=new URL(frame.getAttribute('src'),location.href);
    if(url.origin!==location.origin)throw new Error('测验框架跨源，请手动打开后继续');
    assertRun(id);status('测验框架空白，重新加载平台生成的地址……');
    frame.src=url.href;
    await waitFor(()=>bridge.quiz.scan().found,id,20000);
  }
  async function processCard(snapshot,id){
    assertRun(id);await ready(id);
    const pending=snapshot.jobs.filter(j=>j.required&&!j.passed);
    if(done.has(snapshot.key)&&pending.length)done.delete(snapshot.key);
    if(!pending.length)return nextFrom(snapshot,id);
    if(!snapshot.tabs.length)throw new Error('连续学习需要课程学习页的任务与章节导航');
    const unsupported=pending.find(j=>!['video','audio','insertvideo','insertaudio','work','workid'].includes(j.kind));
    if(unsupported)throw new Error(`当前任务类型 ${unsupported.kind||'未知'} 尚未自动适配，请手动完成后继续`);
    const mediaJobs=pending.filter(j=>['video','audio','insertvideo','insertaudio'].includes(j.kind));
    for(const job of mediaJobs){
      assertRun(id);const state=bridge.media.state();let outcome;
      const findMedia=()=>{
        const target=bridge.media.scan().find(j=>j.id===job.id);
        if(!target)throw new Error('音视频参数未就绪，请等待页面加载后继续');
        return target;
      };
      if(state.active){status('等待当前音视频任务完成……');outcome=await bridge.media.wait();}
      else{
        if(state.busy)await waitFor(()=>!bridge.media.state().busy,id);
        const target=await waitFor(()=>bridge.media.scan().find(j=>j.id===job.id),id,45000);
        mutationGuard(id);status(`${mediaMode==='native'?'实际播放':'运行音视频'}：${target.title}`,'media');
        outcome=await (mediaMode==='native'?bridge.media.play(target.index):bridge.media.run(target.index));
      }
      assertRun(id);
      if(!outcome.ok&&outcome.allowPlayback&&mediaMode!=='protocol'){
        if(bridge.media.state().busy)await waitFor(()=>!bridge.media.state().busy,id);
        const target=findMedia();
        status(`模拟进度未通过，改用实际播放：${target.title}`);
        outcome=await bridge.media.play(target.index);
      }
      assertRun(id);
      if(!outcome.ok&&outcome.retryable&&mediaMode==='native'){
        for(let attempt=1;attempt<=2&&!outcome.ok;attempt++){
          status(`播放器临时故障，${attempt}/2 次重试……`,'retrying');await rest(attempt*3000,id);await ready(id);
          const target=await waitFor(()=>bridge.media.scan().find(j=>j.id===job.id),id,30000);
          mutationGuard(id);outcome=await (bridge.media.reload?bridge.media.reload(target.index):bridge.media.play(target.index));
          if(!outcome.retryable)break;
        }
      }
      assertRun(id);if(!outcome.ok)throw new Error(outcome.message||'音视频未完成');
    }
    if(pending.some(j=>['work','workid'].includes(j.kind))){
      if(bridge.quiz.auto?.state().enabled===false)throw new Error('自动测验已关闭，连续学习在测验任务处暂停');
      await ensureQuizLoaded(id);mutationGuard(id);status('自动匹配并完成章节测验……','quiz');
      const outcome=await bridge.quiz.run();assertRun(id);
      if(!outcome?.ok)throw new Error(outcome?.message||'测验答案不完整，已暂停');
    }
    await reloadAndVerify(snapshot,id);assertRun(id);
    const fresh=cardSnapshot();
    if(fresh&&fresh.key!==snapshot.key){done.add(snapshot.key);persist();return true;}
    return nextFrom(fresh||snapshot,id);
  }
  function pause(message){
    enabled=false;runId++;persist();bridge.media.stop();bridge.quiz.stop();status('已暂停：'+message,'paused');
  }
  async function run(){
    if(running||navigating||!enabled)return;
    running=true;leaseLost=false;const id=++runId;
    try{
      const execute=async()=>{
        while(enabled&&id===runId){
          status('自动识别当前任务……','detecting');await ready(id);
          const snapshot=await waitFor(cardSnapshot,id,45000);
          // A stable snapshot avoids treating the initial empty iframe as an empty card.
          await rest(300,id);const stable=cardSnapshot();if(!stable||stable.key!==snapshot.key)continue;
          if(!await processCard(stable,id))break;
          await rest(800,id);
        }
      };
      const locks=typeof navigator!=='undefined'?navigator.locks:null;
      if(locks?.request){
        await locks.request('cx-course:'+scope,{ifAvailable:true},async lock=>{
          if(!lock){status('同课程已在另一个标签页运行；当前页待机。','standby');return;}
          hasWebLock=true;try{await execute()}finally{hasWebLock=false}
        });
      }else if(await acquireLease(id))await execute();
      else status('同课程已在另一个标签页运行；当前页待机。','standby');
    }catch(e){if(enabled&&id===runId)pause(e.message)}finally{releaseLease();running=false;if(enabled&&id!==runId&&!navigating&&!disposed)setTimeout(()=>void run(),0);}
  }
  function start(){
    if(enabled)return;
    if(!document.querySelector('li[id^="dct"][cardid]')&&!document.getElementById('iframe')){status('请在课程学习页开启连续学习。');return;}
    enabled=true;persist();status('连续学习已开启，正在识别……');
    if(!running)void run();
  }
  function stop(){
    enabled=false;navigating=false;runId++;el('flow-auto').checked=false;
    if(typeof GM_setValue==='function')GM_setValue(autoKey,false);
    persist();bridge.media.stop();bridge.quiz.stop();releaseLease();status('已停止全部自动操作；已关闭本课程自动启动。','stopped');
  }
  el('flow-start').addEventListener('click',start);
  const mediaStateChanged=()=>{
    if(!enabled||!running)return;
    const state=bridge.media.state();
    if(state.waitingForGesture)status('浏览器要求点击视频播放；已保留任务，播放后会自动接续。','waiting-play');
    else if(phase==='waiting-play'&&state.active)status(`实际播放：${state.title||'当前视频'}`,'media');
  };
  root.addEventListener?.('cx-media-state',mediaStateChanged);
  el('flow-stop').addEventListener('click',stop);
  el('flow-media-mode').addEventListener('change',()=>{
    const value=el('flow-media-mode').value;
    if(!enabled&&validModes.includes(value)){
      mediaMode=value;
      if(typeof GM_setValue==='function')GM_setValue('cx-flow-media-mode-v2',value);
    }
  });
  el('stop').addEventListener('click',()=>{if(enabled)stop()});
  el('quiz-stop').addEventListener('click',()=>{if(enabled)stop()});
  el('flow-auto').addEventListener('change',()=>{
    if(typeof GM_setValue==='function')GM_setValue(autoKey,el('flow-auto').checked);
    if(el('flow-auto').checked)start();else stop();
  });
  let collapsed=false;el('flow-collapse').addEventListener('click',()=>{
    collapsed=!collapsed;for(const child of section.children)if(child!==panel)child.style.display=collapsed?'none':'';
    el('flow-advanced').style.display=collapsed?'none':'';el('flow-collapse').textContent=collapsed?'展开面板':'收起面板';
  });
  bridge.flow={start,stop,state:()=>({enabled,running,navigating,phase,message:lastMessage})};
  observeDocuments();
  const observationPoll=typeof setInterval==='function'?setInterval(()=>{observeDocuments();if(enabled&&!running&&!navigating&&phase==='standby')void run();},5000):null;
  window.addEventListener('pagehide',()=>{
    root.removeEventListener?.('cx-media-state',mediaStateChanged);
    disposed=true;runId++;persist();releaseLease();clearTimeout(observerTimer);clearInterval(observationPoll);
    for(const [doc,binding]of observed){binding.observer.disconnect();doc.removeEventListener('load',binding.listener,true);}observed.clear();
  },{once:true});
  if(enabled){status('自动运行已启用，等待课程任务……');setTimeout(()=>void run(),1500);}
  else status(coursePage?'已停止；开启连续学习可恢复。':'已自动识别题目；连续任务切换需在课程学习页运行。');
})();
