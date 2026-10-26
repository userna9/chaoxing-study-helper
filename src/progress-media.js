// ==UserScript==
// @name         学习通进度协议实验助手
// @namespace    local.cx.progress.experiment
// @version      __VERSION__
// @description  自动识别视频和章节测验、连续切换、实际播放与可配置 AI 兜底
// @match        https://*.chaoxing.com/mycourse/studentstudy*
// @match        https://*.chaoxing.com/mooc-ans/mycourse/studentstudy*
// @match        https://*.chaoxing.com/knowledge/cards*
// @match        https://*.chaoxing.com/mooc-ans/knowledge/cards*
// @match        https://*.chaoxing.com/mooc-ans/work/doHomeWorkNew*
// @match        https://*.chaoxing.com/work/doHomeWorkNew*
// @run-at       document-idle
// @noframes
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      lyck6.cn
// @connect      *
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  if (window !== window.top || document.getElementById('cx-progress-experiment')) return;
  // 独立实现 MD5，不加载远端代码。
  function md5(input) {
    const bytes = new TextEncoder().encode(input);
    const n = Math.ceil((bytes.length + 9) / 64) * 64;
    const buffer = new Uint8Array(n);
    buffer.set(bytes); buffer[bytes.length] = 128;
    const view = new DataView(buffer.buffer);
    view.setUint32(n - 8, (bytes.length * 8) >>> 0, true);
    view.setUint32(n - 4, Math.floor(bytes.length / 536870912), true);
    const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
    const constants = Array.from({length:64}, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
    let h = [0x67452301,0xefcdab89,0x98badcfe,0x10325476];
    for (let offset = 0; offset < n; offset += 64) {
      let [a,b,c,d] = h;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5*i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3*i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7*i) % 16; }
        const x = (a + f + constants[i] + view.getInt32(offset + g*4, true)) | 0;
        const s = shifts[Math.floor(i/16)*4 + i%4];
        [a,b,c,d] = [d, (b + ((x << s) | (x >>> (32-s)))) | 0, b, c];
      }
      h = h.map((v,i) => (v + [a,b,c,d][i]) | 0);
    }
    return h.map(v => Array.from({length:4}, (_, i) => ((v >>> (8*i)) & 255).toString(16).padStart(2,'0')).join('')).join('');
  }
  const page = unsafeWindow;
  let timer, active = false, inFlight = false, generation = 0, pendingRequest, autoWaiter, nativeState;
  let tasks = [], current = null;
  let backgroundEnabled=typeof GM_getValue==='function'?GM_getValue('cx-media-background-v1',true)!==false:true;
  const history = [];
  // 页面可能只在内联脚本中保留 mArg。只读 JSON，不执行页面源码。
  function readArgument(doc, win) {
    try {
      if (win.mArg && typeof win.mArg === 'object' && Array.isArray(win.mArg.attachments)) return win.mArg;
    } catch { /* 沙箱访问失败时读取同一文档中的 JSON。 */ }
    for (const script of doc.scripts) {
      const source = script.textContent || '';
      const pattern = /\bmArg\s*=\s*\{/g;
      let match;
      while ((match = pattern.exec(source))) {
        const start = source.indexOf('{', match.index);
        let depth = 0, quoted = false, escaped = false;
        for (let i = start; i < source.length; i++) {
          const c = source[i];
          if (quoted) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') quoted = false;
          } else if (c === '"') quoted = true;
          else if (c === '{') depth++;
          else if (c === '}' && --depth === 0) {
            try {
              const arg = JSON.parse(source.slice(start,i+1));
              if (arg.defaults && Array.isArray(arg.attachments)) return arg;
            } catch { /* 非 JSON 赋值不作执行或求值。 */ }
            break;
          }
        }
      }
    }
    return null;
  }
  function mediaType(item) {
    const kinds = [item.type, item.property?.module].map(v => String(v || '').toLowerCase());
    if (kinds.some(v => v === 'video' || v === 'insertvideo')) return 'video';
    if (kinds.some(v => v === 'audio' || v === 'insertaudio')) return 'audio';
    return null;
  }
  function resumeSeconds(item, duration) {
    // 真实 cards 页面中的 headOffset / playTime 都以毫秒存储。
    const ms = Number(item.headOffset ?? item.playTime ?? 0);
    return Math.min(duration, Math.max(0, Math.floor(Number.isFinite(ms) ? ms / 1000 : 0)));
  }
  const host = document.createElement('div');
  host.id = 'cx-progress-experiment';
  host.style.cssText = 'position:fixed;right:16px;top:90px;z-index:2147483647';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
    section{font:13px/1.6 system-ui;background:#fff;color:#222;border:1px solid #ccc;border-radius:10px;padding:14px;width:300px;box-shadow:0 5px 24px #0002}
    b{font-size:15px} select,input,button{font:inherit;margin:5px 0;padding:5px;box-sizing:border-box}select{width:100%}input{width:65px}button{cursor:pointer;margin-right:6px}pre{white-space:pre-wrap;overflow:auto;max-height:160px;font:12px/1.5 system-ui}small{display:block;color:#666}
  </style><section><b>学习助手 · __VERSION__</b>
  <small>支持连续学习；完成状态以平台为准。</small>
  <details id="media-advanced"><summary>音视频诊断与实验功能</summary><select id="jobs"><option>等待自动识别</option></select>
  <label>模拟倍率 <input id="rate" type="number" min="1" max="16" value="1"></label>
  <div><button id="scan">重新识别</button><button id="probe">检测接口</button><button id="start">实验上报</button><button id="stop">停止</button><button id="diagnose">诊断</button></div></details>
  <small id="summary">正在读取章节参数……</small>
  <pre id="log">等待识别。请关闭其他会同时上报进度的脚本。</pre></section>`;
  document.documentElement.append(host);
  const el = id => root.getElementById(id);
  function log(s) {
    history.push(`${new Date().toLocaleTimeString()} ${s}`);
    if (history.length > 12) history.shift();
    el('log').textContent = history.join('\n\n');
    el('log').scrollTop = el('log').scrollHeight;
  }
  function controls() {
    const busy = active || inFlight || Boolean(nativeState);
    for (const id of ['start','scan','jobs','rate','probe']) el(id).disabled = busy;
  }
  function summarizeResponse(result) {
    if (!result || typeof result !== 'object') return `返回类型 ${typeof result}`;
    return Object.entries(result).filter(([key,value]) => ['isPassed','success','status','error','code','result'].includes(key) && (typeof value === 'number' || typeof value === 'boolean' || (typeof value === 'string' && /^[\w-]{0,25}$/.test(value)))).map(([k,v]) => `${k}=${v}`).join(', ') || `返回字段：${Object.keys(result).slice(0,8).join(', ')}`;
  }
  function allowed(url) {
    const u = new URL(url, location.href);
    if (u.protocol !== 'https:' || !/(^|\.)chaoxing\.com$/i.test(u.hostname)) throw new Error('拒绝非超星 HTTPS 地址');
    return u;
  }
  function request(url, task, stage) {
    return new Promise((resolve, reject) => {
      const target = allowed(url);
      if (target.origin !== new URL(task.base).origin) {
        reject(new Error(`${stage}：目标不在当前页面同源范围，已停止`)); return;
      }
      // 使用播放器所在窗口的原生请求上下文，交由浏览器携带当前会话。
      const context = task.requestWin || task.win;
      const xhr = new context.XMLHttpRequest();
      pendingRequest = xhr;
      xhr.open('GET',target.href,true);
      xhr.withCredentials = true;
      xhr.timeout = 20000;
      xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
      if (stage === '进度上报') xhr.setRequestHeader('Content-Type','application/json');
      xhr.onload = () => {
        try {
          if (xhr.responseURL) allowed(xhr.responseURL);
          if (xhr.status < 200 || xhr.status >= 300) throw new Error(`${stage}：HTTP ${xhr.status}${xhr.status === 403 ? '，平台拒绝访问，已停止' : ''}`);
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { throw new Error(`${stage}：HTTP ${xhr.status}，响应不是 JSON（可能是登录页或验证页）`); }
        } catch(e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error(`${stage}：同源请求失败`));
      xhr.ontimeout = () => reject(new Error(`${stage}：请求超时`));
      xhr.onabort = () => reject(new Error('请求已取消'));
      xhr.send();
    });
  }
  function stop(message = '已停止；已发出的请求无法撤回。', passed = false, allowPlayback = false) {
    active = false; generation++; clearTimeout(timer);
    if (inFlight) pendingRequest?.abort();
    if(nativeState)nativeState.finish(false,message);
    if(passed && current){current.item.isPassed=true;current.item.headOffset=current.duration*1000;}
    if(autoWaiter){const resolve=autoWaiter;autoWaiter=null;resolve({ok:passed,message,allowPlayback});}
    controls();
    log(message);
  }
  function scan(silent = false) {
    if (active || inFlight || nativeState) return;
    tasks = [];
    const seen = new Set(), visited = new Set();
    function walk(w, depth = 0) {
      if (depth > 8 || visited.has(w)) return;
      visited.add(w);
      try {
        const doc = w.document;
        const arg = readArgument(doc, w);
        const attachments = arg?.attachments || w.attachments;
        const defaults = arg?.defaults;
        if (Array.isArray(attachments) && defaults) {
          for (const item of attachments) {
            const p = item.property || {};
            const objectId = p.objectid || item.objectId;
            const jobid = item.jobid || p._jobid || p.jobid;
            const type = mediaType(item);
            if (!objectId || !jobid || !type) continue;
            const key = `${defaults.clazzId}:${jobid}:${objectId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            let requestWin = w;
            for (const frame of doc.querySelectorAll('iframe')) {
              try {
                const data = JSON.parse(frame.getAttribute('data') || '{}');
                if (String(data.objectid || '') === String(objectId) && /\/ananas\/modules\/(video|audio)\//.test(frame.getAttribute('src') || '')) {
                  // document 访问检查同源性，不修改播放器的任何配置。
                  if (frame.contentWindow.document) requestWin = frame.contentWindow;
                  break;
                }
              } catch { /* 使用可访问的章节窗口。 */ }
            }
            tasks.push({item, defaults, objectId, jobid, type, doc, win:w, requestWin, base:w.location.href, title:p.name || p.title || String(objectId)});
          }
        }
        for (let i=0;i<w.frames.length;i++) walk(w.frames[i], depth+1);
      } catch { /* 跨源文档不越权访问；在诊断中显示缺少的参数。 */ }
    }
    walk(page);
    el('jobs').replaceChildren();
    tasks.forEach((task,i) => {
      const option = document.createElement('option'); option.value = String(i);
      option.textContent = `${task.item.isPassed ? '已完成 · ' : ''}${task.title}`;
      el('jobs').append(option);
    });
    showTask();
    if(!silent)log(tasks.length ? `识别到 ${tasks.length} 个音视频任务。选择任务后开始。` : '未发现可用参数。请先打开视频章节，再点重新识别；点诊断查看所在环节。');
  }
  function showTask() {
    const task = tasks[Number(el('jobs').value)];
    el('summary').textContent = task ? `${task.type} · 已保存位置 ${resumeSeconds(task.item,Infinity)} 秒 / ${task.item.attDuration || '?'} 秒 · 上报间隔 ${intervalSeconds(task)} 秒` : '没有可运行的音视频任务';
  }
  function intervalSeconds(t) {
    const interval = Number(t.defaults.reportTimeInterval);
    return Number.isFinite(interval) && interval >= 10 && interval <= 300 ? interval : 60;
  }
  function sameChapter(t) {
    try { return t.win.document === t.doc && t.win.location.href === t.base; }
    catch { return false; }
  }
  function signature(t, time) {
    return md5(`[${t.defaults.clazzId}][${t.defaults.userid}][${t.jobid}][${t.objectId}][${time*1000}][d_yHJ!$pdA~5][${t.duration*1000}][${clipTime(t)}]`);
  }
  function clipTime(t) {
    const start = Number(t.item.property?.vbegin || t.item.begins || 0);
    const end = Number(t.item.property?.vend || t.item.ends || t.duration);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > t.duration) throw new Error('视频片段范围无效，已停止');
    return `${start}_${end}`;
  }
  function metadataUrl(t) {
    const url = new URL(`/ananas/status/${encodeURIComponent(t.objectId)}`,t.base);
    let fid;
    const match = (t.requestWin || t.win).document.cookie.match(/(?:^|;\s*)fid=([^;]*)/);
    if (match) fid = decodeURIComponent(match[1]);
    if (!fid) fid = t.defaults.fid;
    url.searchParams.set('k',String(fid || ''));
    url.searchParams.set('flag','normal');
    url.searchParams.set('ro','0');
    return url;
  }
  async function report(t, time, isdrag) {
    const endpoint = allowed(new URL(t.defaults.reportUrl, t.base));
    endpoint.pathname = endpoint.pathname.replace(/\/$/,'') + '/' + encodeURIComponent(t.dtoken);
    // 官方代码把 otherInfo 作为查询片段拼接，其中还包含独立的 courseId。
    const other = new URLSearchParams(`otherInfo=${t.item.otherInfo || ''}`);
    for (const [key,value] of other) endpoint.searchParams.set(key,value);
    const params = {
      clazzId:t.defaults.clazzId, playingTime:time, duration:t.duration, clipTime:clipTime(t),
      objectId:t.objectId, jobid:t.jobid,
      userid:t.defaults.userid, isdrag, view:'pc', enc:signature(t,time), rt:0.9,
      dtype:t.type === 'audio' ? 'Audio' : 'Video', _t:Date.now(), courseEngineInfo:false
    };
    if (t.type === 'video') Object.assign(params,{
      videoFaceCaptureEnc:t.item.videoFaceCaptureEnc || '',
      attDuration:t.item.attDuration ?? 0,
      attDurationEnc:t.item.attDurationEnc || ''
    });
    Object.entries(params).forEach(([k,v]) => endpoint.searchParams.set(k,String(v)));
    return request(endpoint.href,t,'进度上报');
  }
  async function start() {
    if (active || inFlight || nativeState) return;
    const selected = tasks[Number(el('jobs').value)];
    if (!selected) { log('请先识别并选择任务。'); return; }
    if (!sameChapter(selected)) { log('章节已变化，请重新识别。'); return; }
    const d = selected.defaults;
    if (!d.reportUrl || !d.clazzId || !d.userid) { log('缺少 reportUrl / clazzId / userid，无法上报。'); return; }
    const rate = Number(el('rate').value);
    if (!Number.isFinite(rate) || rate < 1 || rate > 16) { log('倍率需要在 1–16 之间。'); return; }
    active = true; const run = ++generation;
    current = selected;
    controls();
    inFlight = true;
    try {
      log('正在获取视频元数据……');
      log('元数据：使用播放器窗口的同源会话请求（k / flag / ro）。');
      const metadata = await request(metadataUrl(selected).href,selected,'视频元数据');
      if (!active || run !== generation) return;
      const duration = Math.floor(Number(metadata.duration));
      if (metadata.status && metadata.status !== 'success') throw new Error(`元数据未就绪：${summarizeResponse(metadata)}`);
      if (!Number.isFinite(duration) || duration <= 0 || !metadata.dtoken) throw new Error('元数据缺少有效 duration 或 dtoken');
      current = {...selected, duration, dtoken:metadata.dtoken};
      const task = current;
      const interval = intervalSeconds(task);
      let time = resumeSeconds(selected.item, duration);
      let last = performance.now();
      const first = await report(task,time,3);
      if (!active || run !== generation) return;
      const check = result => {
        log(`上报响应：${summarizeResponse(result)}`);
        if (!result || typeof result !== 'object') throw new Error('返回值不是对象，停止实验');
        if (result.error || result.success === false) throw new Error('接口明确返回错误，停止实验');
        if (result.hasJobLimit === true || result.videoTimeLimit === true) throw new Error('平台返回任务或时长限制，已停止');
        if (typeof result.isPassed !== 'boolean') throw new Error('返回中缺少布尔值 isPassed，不能判定进度是否被接受；已停止');
      };
      check(first);
      if (first.isPassed) { stop('接口返回 isPassed=true。请刷新课程页核对任务状态。',true); return; }
      log(`${task.title}\n从 ${time}/${duration} 秒开始。模拟 ${rate} 倍；每 ${interval} 秒上报一次。`);
      async function tick() {
        if (!active || run !== generation) return;
        inFlight = true;
        try {
          if (!sameChapter(task)) throw new Error('章节已切换，停止旧任务');
          const now = performance.now();
          // 浏览器后台节流或休眠时不补报长时间跨度。
          time = Math.min(duration, time + Math.floor(Math.min(interval,(now-last)/1000)*rate));
          last = now;
          const result = await report(task,time,time >= duration ? 4 : 0);
          if (!active || run !== generation) return;
          check(result);
          log(`${task.title}\n模拟进度 ${time}/${duration} 秒\nisPassed=${result.isPassed}`);
          if (result.isPassed || time >= duration) {
            stop(result.isPassed ? '接口返回 isPassed=true。请刷新课程页核对。' : '已到视频末尾，但接口未确认通过；已停止。',result.isPassed,!result.isPassed);
          } else timer = setTimeout(tick,interval*1000);
        } catch(e) { if (run === generation) stop(e.message); }
        finally { inFlight = false; controls(); }
      }
      timer = setTimeout(tick,interval*1000);
    } catch(e) { if (run === generation) stop(e.message); }
    finally { inFlight = false; controls(); }
  }
  async function probe() {
    if (active || inFlight || nativeState) return;
    const task = tasks[Number(el('jobs').value)];
    if (!task || !sameChapter(task)) { log('请先重新识别当前章节。'); return; }
    inFlight = true; const run = ++generation; controls();
    try {
      log('仅检测元数据接口，不发出进度上报……');
      const metadata = await request(metadataUrl(task).href,task,'视频元数据');
      if (run !== generation) return;
      log(`元数据响应：${summarizeResponse(metadata)}；duration=${Number(metadata?.duration) || 0}；dtoken=${metadata?.dtoken ? '存在' : '缺少'}。尚未发送进度上报。`);
    } catch(e) { if (run === generation) log(e.message); }
    finally { inFlight = false; controls(); }
  }
  el('scan').addEventListener('click',()=>scan());
  el('probe').addEventListener('click',probe);
  el('start').addEventListener('click',start);
  el('stop').addEventListener('click',() => stop());
  el('jobs').addEventListener('change',showTask);
  el('diagnose').addEventListener('click',() => {
    const task = tasks[Number(el('jobs').value)];
    log(`版本 __VERSION__；同源 XHR；任务数 ${tasks.length}；状态 ${active ? '运行' : inFlight ? '取消中' : '空闲'}\n` + (task ? `module=${task.item.property?.module}；type=${task.item.type}；headOffset=${Number(task.item.headOffset) || 0} 毫秒\nreportUrl=${task.defaults.reportUrl ? '存在' : '缺少'}；fid=${task.defaults.fid ? '存在' : '缺少'}；clazzId=${task.defaults.clazzId ? '存在' : '缺少'}；userid=${task.defaults.userid ? '存在' : '缺少'}；页面=${sameChapter(task) ? '有效' : '已变化'}` : '没有识别到 mArg 视频任务。'));
  });
  window.addEventListener('pagehide',() => stop());
  setTimeout(scan,1000);
  const chapterMonitor = setInterval(() => {
    if (active && current && !sameChapter(current)) stop('章节内容已变化，旧任务已停止。请重新识别。');
  },1500);
  window.addEventListener('pagehide',() => clearInterval(chapterMonitor),{once:true});
  /* BACKGROUND PLAYBACK MODULE */
  async function loadAndPlayNative(task,index,force=false){
    const frame=task.requestWin.frameElement;
    if(!frame)return {ok:false,message:'未找到实际播放器入口'};
    const url=allowed(new URL(frame.getAttribute('src'),task.base));
    if(url.origin!==new URL(task.base).origin||!/^\/ananas\/modules\/(video|audio)\/index\.html$/.test(url.pathname))return {ok:false,message:'实际播放器入口不受支持'};
    const run=++generation;inFlight=true;controls();
    try{
      const oldDoc=task.requestWin.document;
      log(force?'重新加载平台播放器以恢复临时故障……':'播放器入口为空，重新加载平台播放器……');frame.src=url.href;
      let deadline=Date.now()+20000,lastPoll=Date.now();
      for(;;){
        const now=Date.now(),gap=now-lastPoll;lastPoll=now;
        if(backgroundEnabled&&page.document.hidden&&gap>15000)deadline+=gap;
        if(run!==generation)return {ok:false,message:'播放器加载已取消'};
        if(!sameChapter(task))return {ok:false,message:'播放器加载时任务已变化'};
        if((!force||task.requestWin.document!==oldDoc)&&task.requestWin.document.querySelector('video,audio')){
          inFlight=false;return await playNative(index);
        }
        if(Date.now()>=deadline)break;
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      return {ok:false,message:'平台播放器加载超时，请检查页面状态',retryable:true};
    }catch{return {ok:false,message:'平台播放器重新加载失败'}}
    finally{inFlight=false;controls()}
  }
  function playNative(index){
    if(active||inFlight||nativeState)return Promise.resolve({ok:false,message:'音视频正在运行'});
    const task=tasks[index];
    if(!task||!sameChapter(task))return Promise.resolve({ok:false,message:'实际播放器所在任务已变化'});
    const media=task.requestWin.document.querySelector('video,audio');
    if(!media)return loadAndPlayNative(task,index);
    if(typeof media.play!=='function')return Promise.resolve({ok:false,message:'未找到实际播放器'});
    let resolveDone,watch,prepared=false,progressed=false,startPosition=0,lastLog=0,pausedAt=0,openedPlayer=false,inlinePending=false;
    let playPending=false,autoplayRetries=0,autoplayTimer=null,waitingForGesture=false;
    let resumeAttempts=0,lastResume=0,lastPosition=media.currentTime||0,lastProgress=Date.now(),blockedAt=0,lastWatch=Date.now(),background;
    let deadline=Date.now()+30000;
    const mutedBefore=media.muted,defaultMutedBefore=media.defaultMuted;
    const promise=new Promise(resolve=>{resolveDone=resolve});
    const notify=()=>{if(typeof root.dispatchEvent==='function'&&typeof window.Event==='function')root.dispatchEvent(new window.Event('cx-media-state'));};
    const finish=(ok,message,retryable=false)=>{
      if(!nativeState||nativeState.promise!==promise)return;
      clearInterval(watch);clearTimeout(autoplayTimer);background?.stop();media.removeEventListener('loadedmetadata',prepare);media.removeEventListener('timeupdate',update);media.removeEventListener('ended',ended);media.removeEventListener('error',failed);media.removeEventListener('playing',playing);
      task.requestWin.document.removeEventListener?.('click',userPlay,true);
      nativeState=null;
      try{media.pause();media.defaultMuted=defaultMutedBefore;media.muted=mutedBefore}catch{}
      controls();log(message);resolveDone({ok,message,retryable});
    };
    function silence(){media.defaultMuted=true;media.muted=true;}
    function playing(){
      if(nativeState?.promise!==promise||media.paused)return;
      if(waitingForGesture){waitingForGesture=false;nativeState.waitingForGesture=false;pausedAt=0;lastProgress=Date.now();log('实际播放器已开始，自动接续当前任务。');notify();}
    }
    function userPlay(event){
      if(waitingForGesture&&event.isTrusted===true&&event.target?.closest?.('.vjs-big-play-button,.vjs-play-control,video,audio'))tryPlay();
    }
    function playError(error){
      if(nativeState?.promise!==promise)return;
      playPending=false;
      if(error?.name==='NotAllowedError'){
        if(autoplayRetries++===0){
          log('浏览器拒绝自动播放，重新设置静音后重试……');
          autoplayTimer=setTimeout(()=>{autoplayTimer=null;tryPlay();},150);return;
        }
        waitingForGesture=true;nativeState.waitingForGesture=true;
        log('浏览器仍要求点击播放；已保留当前任务，点击视频播放后自动接续。');notify();return;
      }
      finish(false,`实际播放启动失败（${error?.name||'播放错误'}），请检查播放器提示`,error?.name==='AbortError');
    }
    const tryPlay=()=>{
      if(nativeState?.promise!==promise||playPending||!sameChapter(task))return;
      playPending=true;
      try{
        // 平台播放器在首次点击时才装入媒体源；直接对空 video 调用 play 会失败。
        const button=task.requestWin.document.querySelector('.vjs-big-play-button');
        silence();
        if(!prepared&&!openedPlayer&&button){openedPlayer=true;log('通过平台播放按钮初始化媒体源……');button.click();}
        // Platform initialization may reset mute; apply it after its click handler too.
        silence();
        Promise.resolve(media.play()).then(()=>{if(nativeState?.promise===promise){playPending=false;playing();}},playError);
      }catch(error){playError(error)}
    };
    function blocked(){
      return [page.document,task.doc,task.requestWin.document].some(doc=>[...doc.querySelectorAll('#fcqrimg,.chapterVideoFaceMaskDiv,.yidun_popup,.geetest_panel')].some(node=>node.getClientRects().length>0));
    }
    function prepare(){
      if(prepared||!Number.isFinite(media.duration)||media.duration<=0)return;
      prepared=true;
      try{
        // 位置已到末尾但任务未通过时，重新实际播放；否则沿用播放器可恢复的位置。
        if(media.currentTime>=media.duration-1)media.currentTime=0;
        startPosition=media.currentTime||0;
        deadline=Date.now()+(media.duration-startPosition)*1000+180000;
        log(`实际播放：${task.title}；使用平台播放器速度 ${media.playbackRate||1} 倍。`);
        tryPlay();
      }catch{finish(false,'实际播放器暂时不能恢复位置，请在平台中重新播放')}
    }
    function update(){
      if(!prepared)return;
      if(media.currentTime>startPosition+0.1)progressed=true;
      if(Date.now()-lastLog>10000){lastLog=Date.now();log(`实际播放 ${Math.floor(media.currentTime)}/${Math.floor(media.duration)} 秒`);}
    }
    function ended(){if(prepared&&progressed)finish(true,'实际视频已播放结束，等待核对平台完成状态。')}
    function failed(){finish(false,'实际播放器发生加载错误，请检查平台提示',media.error?.code!==4)}
    nativeState={promise,finish,waitingForGesture:false,title:task.title};current=task;controls();
    background=createBackgroundPlayback({windows:[page,task.win,task.requestWin],media,
      isCurrent:()=>nativeState?.promise===promise&&sameChapter(task),enabled:()=>backgroundEnabled,
      isBlocked:()=>{try{const box=task.requestWin.document.querySelector('.tkTopic');return waitingForGesture||inlinePending||blocked()||Boolean(box&&box.getClientRects().length)}catch{return true}},play:tryPlay,
      onWake:()=>{const now=Date.now(),gap=now-lastWatch;if(backgroundEnabled&&gap>15000){deadline+=gap;lastProgress+=gap;if(pausedAt)pausedAt+=gap;}lastWatch=now;}});
    media.addEventListener('loadedmetadata',prepare);media.addEventListener('timeupdate',update);media.addEventListener('ended',ended);media.addEventListener('error',failed);media.addEventListener('playing',playing);
    task.requestWin.document.addEventListener?.('click',userPlay,true);
    watch=setInterval(()=>{
      try{
      if(!sameChapter(task)){finish(false,'实际播放时章节已切换');return;}
      const now=Date.now(),gap=now-lastWatch;lastWatch=now;
      // A throttled/frozen hidden tab did not spend that interval actively waiting.
      // Only adjust local watchdog budgets; media time remains the player's value.
      if(backgroundEnabled&&background.hidden()&&gap>15000){deadline+=gap;lastProgress+=gap;if(pausedAt)pausedAt+=gap;}
      if(blocked()){if(!blockedAt){blockedAt=Date.now();log('等待平台验证，验证完成后自动恢复。');}return;}
      if(blockedAt){deadline+=Date.now()-blockedAt;lastProgress=Date.now();blockedAt=0;pausedAt=0;resumeAttempts=0;tryPlay();}
      if(task.requestWin.frameElement?.parentElement?.classList.contains('ans-job-finished')){finish(true,'平台播放器已标记任务完成。');return;}
      if(waitingForGesture){
        deadline+=gap;lastProgress=now;pausedAt=0;
        if(media.paused)return;
        playing();
      }
      if(!inlinePending&&Date.now()>deadline){finish(false,'实际播放等待超时，请检查播放器状态');return;}
      if(inlinePending)return;
      const quizBox=task.requestWin.document.querySelector('.tkTopic');
      if(quizBox&&quizBox.getClientRects().length>0){
        const handler=host.__cxRuntime?.quiz?.inline;
        if(!handler){finish(false,'检测到视频内问答，当前测验模块尚未就绪');return;}
        inlinePending=true;pausedAt=0;const started=Date.now();
        log('检测到视频内问答，正在匹配并等待平台反馈……');
        Promise.resolve(handler(task.requestWin,{courseId:new URL(task.base).searchParams.get('courseid')||new URL(location.href).searchParams.get('courseId')||'',isCurrent:()=>nativeState?.promise===promise&&sameChapter(task)})).then(result=>{
          if(nativeState?.promise!==promise)return;
          if(!result?.ok){finish(false,result?.message||'视频内问答未完成');return;}
          deadline+=Date.now()-started;tryPlay();
        }).catch(()=>finish(false,'视频内问答处理失败')).finally(()=>{inlinePending=false;if(nativeState?.promise===promise)background?.resume();});
        return;
      }
      if(media.paused&&!media.ended){
        if(!pausedAt)pausedAt=Date.now();
        if((backgroundEnabled||!background.hidden())&&Date.now()-pausedAt>=3000&&Date.now()-lastResume>=5000&&resumeAttempts<3){resumeAttempts++;lastResume=Date.now();tryPlay();}
        if(Date.now()-pausedAt>20000)finish(false,'实际播放器已暂停，请在平台继续播放后重新开启连续学习');
      }else{pausedAt=0;resumeAttempts=0;}
      if(media.currentTime>lastPosition+0.1){lastPosition=media.currentTime;lastProgress=Date.now();}
      else if(prepared&&!media.paused&&!media.ended&&Date.now()-lastProgress>60000)finish(false,'实际播放器缓冲停滞，等待重试',true);
      }catch{finish(false,'播放器页面已变化或不可访问，已停止');}
    },1000);
    silence();prepare();if(!prepared)tryPlay();
    return promise;
  }
  if(typeof GM_getValue==='function')el('rate').value=String(GM_getValue('cx-media-rate',1));
  el('rate').addEventListener('change',()=>{
    const value=Number(el('rate').value);
    if(Number.isFinite(value)&&value>=1&&value<=16&&typeof GM_setValue==='function')GM_setValue('cx-media-rate',value);
  });
  const bridge=host.__cxRuntime ||= {};
  bridge.media={
    state:()=>({busy:active||inFlight||Boolean(nativeState),active:active||Boolean(nativeState),waitingForGesture:nativeState?.waitingForGesture===true,title:nativeState?.title||''}),
    scan:()=>{scan(true);return tasks.map((t,i)=>({index:i,id:String(t.jobid),title:t.title,passed:t.item.isPassed===true,required:t.item.job!==false}));},
    cards:()=>{
      const list=[],visited=new Set();
      function walk(w,depth=0){
        if(depth>8||visited.has(w))return;visited.add(w);
        try{
          const arg=readArgument(w.document,w);
          if(arg?.defaults && Array.isArray(arg.attachments))list.push({arg,doc:w.document,win:w,url:w.location.href});
          for(let i=0;i<w.frames.length;i++)walk(w.frames[i],depth+1);
        }catch{}
      }
      walk(page);return list;
    },
    run:index=>new Promise(resolve=>{
      if(active||inFlight||nativeState){resolve({ok:false,message:'音视频正在运行'});return;}
      el('jobs').value=String(index);showTask();autoWaiter=resolve;
      start().then(()=>{if(!active&&autoWaiter){const done=autoWaiter;autoWaiter=null;done({ok:false,message:'音视频未能启动，请查看日志'});}}).catch(e=>stop(e.message));
    }),
    wait:()=>new Promise(resolve=>{
      if(nativeState){nativeState.promise.then(resolve);return;}
      if(!active){resolve({ok:false,message:'没有正在运行的音视频'});return;}
      if(autoWaiter){resolve({ok:false,message:'已有等待中的音视频任务'});return;}
      autoWaiter=resolve;
    }),
    play:playNative,
    background:{enabled:()=>backgroundEnabled,setEnabled(value){backgroundEnabled=value===true;if(typeof GM_setValue==='function')GM_setValue('cx-media-background-v1',backgroundEnabled);}},
    reload:index=>{const task=tasks[index];return !task||active||inFlight||nativeState?Promise.resolve({ok:false,message:'播放器暂不可重新加载'}):loadAndPlayNative(task,index,true)},
    stop:()=>stop('连续学习已停止。')
  };
})();
