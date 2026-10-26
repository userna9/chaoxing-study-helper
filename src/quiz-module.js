
// === CHAPTER QUIZ MODULE ===
(() => {
  'use strict';
  if (window !== window.top) return;
  const host = document.getElementById('cx-progress-experiment');
  const root = host?.shadowRoot;
  if (!root) return;
  const section = root.querySelector('section');
  section.style.maxHeight = '82vh'; section.style.overflowY = 'auto'; section.style.width = '350px';
  const details = document.createElement('details');
  details.id = 'cx-quiz'; details.open = false;
  details.innerHTML = `<summary><b>章节测验</b></summary>
    <small id="quiz-status">等待识别测验。</small>
    <label><input id="quiz-auto-enabled" type="checkbox" style="width:auto">自动检测并完成章节测验</label><small id="quiz-auto-status">等待自动检测器启动。</small>
    <button id="quiz-scan">识别测验</button><button id="quiz-search">匹配答案</button>
    <button id="quiz-font">还原题面</button><button id="quiz-open">单独打开测验</button>
    <div id="quiz-questions"></div>
    <button id="quiz-fill">填写答案</button><button id="quiz-save">填答并保存</button><button id="quiz-finish">匹配并完成</button>
    <button id="quiz-submit">填答并提交</button><button id="quiz-stop">停止测验操作</button><button id="quiz-reset-submit">清除本测验待确认记录</button>
    <label style="display:block"><input id="quiz-remote" type="checkbox" style="width:auto">启用第三方查题</label>
    <small>启用后，手动匹配和连续学习会将题干、选项、题型发送到 lyck6.cn；默认关闭。</small>
    <details><summary>本地题库 JSON</summary>
      <textarea id="quiz-bank" style="width:100%;height:100px" placeholder='[{"questionId":"题号","courseId":"课程号","answers":["A"]}]'></textarea>
      <button id="quiz-import">保存本地题库</button>
    </details><pre id="quiz-log" style="max-height:140px"></pre>`;
  section.append(details);
  const el = id => root.getElementById(id);
  let quiz = null, busy = false, epoch = 0, cancellation = 0, ai = null;
  let sourceRevision=0,documentSequence=0;const documentIds=new WeakMap();
  function sourceChanged(){sourceRevision++;root.dispatchEvent(new window.Event('cx-quiz-source-change'));}
  const requests = new Set(), fontMaps = new WeakMap();
  const inlineSubmitted=new WeakMap();
  const journalKey='cx-quiz-submit-journal-v1';
  function journal(test,write=false,confirmed=false){
    let entries=typeof GM_getValue==='function'?GM_getValue(journalKey,[]):[];if(!Array.isArray(entries))entries=[];
    const identity=JSON.stringify([test.courseId,test.workId,test.questions.map(q=>[q.id,q.type,q.options.length,/^\d{5,}$/.test(q.id)?'':q.text])]);
    const entry=entries.find(e=>e.id===identity&&e.at>Date.now()-7*86400000),hit=Boolean(entry);
    if(write&&typeof GM_setValue==='function'){
      if(!hit)GM_setValue(journalKey,[...entries.filter(e=>e.at>Date.now()-7*86400000).slice(-199),{id:identity,at:Date.now(),confirmedAt:confirmed?Date.now():null}]);
      else if(confirmed)GM_setValue(journalKey,entries.map(e=>e===entry?{...e,confirmedAt:Date.now()}:e));
    }
    return {hit,confirmed:entry?.confirmedAt!=null,identity,entries};
  }
  const key = 'cx-quiz-bank-v1';
  let bank = typeof GM_getValue === 'function' ? GM_getValue(key,[]) : [];
  if (!Array.isArray(bank)) bank = [];
  el('quiz-remote').checked=typeof GM_getValue==='function'&&GM_getValue('cx-quiz-remote-enabled',false)===true;
  el('quiz-remote').addEventListener('change',()=>{if(typeof GM_setValue==='function')GM_setValue('cx-quiz-remote-enabled',el('quiz-remote').checked);sourceChanged();});
  el('quiz-bank').value = JSON.stringify(bank,null,2);
  const notes = [];
  function note(message) {
    notes.push(message); if (notes.length > 8) notes.shift();
    el('quiz-log').textContent = notes.join('\n');
  }
  function lock(value) {
    busy = value;
    for (const id of ['quiz-scan','quiz-search','quiz-font','quiz-fill','quiz-save','quiz-finish','quiz-submit','quiz-import','quiz-remote','quiz-reset-submit']) el(id).disabled = value;
    for (const field of root.querySelectorAll('[data-quiz-answer]')) field.disabled = value;
    ai?.setBusy(value);
  }
  const clean = s => String(s ?? '').normalize('NFKC').replace(/\s+/g,'').replace(/[，。；：、“”‘’,.!?！？;:'"()（）]/g,'').toLowerCase();
  function truthValue(value) {
    if(/^(正确|对|是|true|√|1)$/i.test(String(value).trim()))return true;
    if(/^(错误|错|否|false|×|x|0)$/i.test(String(value).trim()))return false;
    return undefined;
  }
  function walkDocuments(win, action, depth=0, seen=new Set()) {
    if (depth>8 || seen.has(win)) return;
    seen.add(win);
    try {
      const doc=win.document; action(win,doc);
      for(let i=0;i<win.frames.length;i++) walkDocuments(win.frames[i],action,depth+1,seen);
    } catch { /* 仅处理同源文档。 */ }
  }
  function questionText(node,doc) {
    const record=fontMaps.get(doc),chars=new Set(),unresolved=new Set();let encrypted=false;
    function read(current){
      if(current.nodeType===3){
        const raw=current.nodeValue||'',secret=Boolean(current.parentElement?.closest('.font-cxsecret'));
        if(!secret)return raw;
        for(const ch of raw){chars.add(ch);if(!record||(record.coverage.has(ch.codePointAt(0))&&!Object.hasOwn(record.map,ch))){encrypted=true;unresolved.add(ch);}}
        return record?[...raw].map(ch=>record.map[ch]??ch).join(''):raw;
      }
      if(current.nodeType!==1||['SCRIPT','STYLE','INPUT','TEXTAREA'].includes(current.tagName))return '';
      return [...current.childNodes].map(read).join('');
    }
    return {text:node?read(node):'',encrypted,chars,unresolved};
  }
  function selected(q,o) {
    const answer=q.node.querySelector(`input[id="answer${q.id}"]`);
    if (answer?.value) {
      const value=answer.value.trim();
      if (/^[A-Z]+$/.test(value)) return value.includes(o.label);
      if (q.type==='judgement' && truthValue(value)!==undefined) return truthValue(value)===truthValue(o.text);
    }
    return o.node.getAttribute('aria-checked')==='true' || Boolean(o.node.querySelector('input:checked,.check_answer,.check_answer_dx,.selected'));
  }
  function imageRefs(node,doc){
    if(!node)return [];
    return [...node.querySelectorAll('img')].map(img=>{
      const raw=img.getAttribute('src')||img.getAttribute('data-src')||'';
      if(!raw)return null;
      try{const url=new URL(raw,doc.baseURI||location.href);return url.protocol==='https:'&&/\.(?:png|jpe?g|gif|webp)(?:$|[/?])/i.test(url.pathname)||url.protocol==='https:'&&/(^|\.)chaoxing\.com$/i.test(url.hostname)?url.href:/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)&&raw.length<1500000?raw:null}catch{return null}
    }).filter(Boolean).slice(0,10);
  }
  function extractQuestion(node,doc,index) {
    const wrap=node.closest('[id^="question"]');
    const id=wrap?.id.replace(/^question/,'') || node.querySelector('[qid]')?.getAttribute('qid') || String(index);
    const hidden=node.querySelector('input[id^="answertype"]');
    const raw=node.getAttribute('data') ?? hidden?.value ?? node.querySelector('[qtype]')?.getAttribute('qtype');
    const kind=node.querySelector('.newZy_TItle,.Zy_TItle,.colorShallow')?.textContent||node.getAttribute('typename')||'';
    const type=(raw!=null?({0:'single',1:'multiple',2:'completion',3:'judgement'})[Number(raw)]:null)||(/多选/.test(kind)?'multiple':/判断/.test(kind)?'judgement':/单选/.test(kind)?'single':/填空/.test(kind)?'completion':'unsupported');
    const title=node.querySelector('.fontLabel') || node.querySelector('.Zy_TItle .clearfix') || node.querySelector('.Zy_TItle') || node.querySelector('h3');
    const titleInfo=questionText(title,doc),infos=[titleInfo];
    const text=titleInfo.text.trim().replace(/^[\s\d.、]*【[^】]+】/,'').trim();
    const options=[...node.querySelectorAll('li[qid],li[role="radio"],li[role="checkbox"],[class*="before-after"]')].filter((li,i,list)=>!list.some(other=>other!==li&&other.contains(li))).map((li,i)=>{
      const marker=li.querySelector('span[data]');
      const info=questionText(li.querySelector('.after'),doc);infos.push(info);
      let text=info.text.trim();
      if (type==='judgement' && !text) text=li.querySelector('.ri') ? '正确' : '错误';
      const label=marker?.getAttribute('data'),images=imageRefs(li,doc);
      return {node:li,label:/^[A-Z]$/.test(label||'')?label:String.fromCharCode(65+i),text,images,imageIssue:li.querySelectorAll('img').length!==images.length};
    });
    const fields=[...node.querySelectorAll('textarea')];
    const images=imageRefs(title,doc);
    return {id,type,text,options,fields,node,images,imageIssue:(title?.querySelectorAll('img').length||0)!==images.length||options.some(o=>o.imageIssue),encrypted:infos.some(info=>info.encrypted),fontChars:new Set(infos.flatMap(info=>[...info.chars])),fontUnresolved:new Set(infos.flatMap(info=>[...info.unresolved]))};
  }
  function scanQuiz(silent=false) {
    if (busy) return;
    const old=quiz;
    const previous=new Map((old?.questions||[]).map(q=>[q.id,q.editor?.value || '']));
    const found=[];
    walkDocuments(unsafeWindow,(win,doc)=>{
      const nodes=[...doc.querySelectorAll('.TiMu,.newTiMu')].filter((n,i,list)=>!list.some(other=>other!==n&&other.contains(n)));
      if (nodes.length) {
        const url=new URL(win.location.href);
        const course=new URL(location.href).searchParams;
        found.push({win,doc,base:url.href,courseId:url.searchParams.get('courseId') || url.searchParams.get('courseid') || course.get('courseId') || course.get('courseid') || '',workId:url.searchParams.get('workId') || url.searchParams.get('workid') || doc.querySelector('input[name="workId"]')?.value || '',questions:nodes.map((n,i)=>extractQuestion(n,doc,i))});
      }
    });
    quiz=found[0] || null;
    el('quiz-questions').replaceChildren();
    if (!quiz) { el('quiz-status').textContent='未发现已加载的题目。若测验框架空白，可单独打开。'; if(!silent)note('没有题目；不会判定为已完成。'); return; }
    for(const [i,q] of quiz.questions.entries()) {
      const box=document.createElement('div');box.style.cssText='border-top:1px solid #ddd;margin:8px 0;padding-top:6px';
      const title=document.createElement('div');title.textContent=`${i+1}. [${q.type}] ${q.text}${q.images.length||q.options.some(o=>o.images.length)?' [含图片]':''}`;
      const opts=document.createElement('small');opts.textContent=q.options.map(o=>`${o.label}. ${o.text}`).join(' / ');
      const answer=document.createElement('textarea');answer.style.cssText='width:100%;height:42px';answer.setAttribute('data-quiz-answer',q.id);
      answer.placeholder=q.type==='completion'?'每个空一行':'选项字母或选项原文；多选用 # 分隔';
      if(q.type!=='completion') answer.value=q.options.filter(o=>selected(q,o)).map(o=>o.label).join('#');
      if(old?.doc===quiz.doc && previous.get(q.id))answer.value=previous.get(q.id);
      box.append(title,opts,answer); el('quiz-questions').append(box);q.editor=answer;
    }
    el('quiz-status').textContent=`识别 ${quiz.questions.length} 题；${quiz.questions.some(q=>q.encrypted)?'题面存在混淆字体，可先还原。':'题面可读取。'}`;
    if(!silent)note('测验已识别；填写答案或匹配本地题库。');
  }
  function ensureQuiz() {
    if(!quiz || quiz.win.document!==quiz.doc || quiz.win.location.href!==quiz.base) throw new Error('测验页面已变化，请重新识别。');
    return quiz;
  }
  function findLocal(test,q) {
    return bank.find(e=>{
      if(e.courseId && String(e.courseId)!==test.courseId)return false;
      if(e.workId && String(e.workId)!==test.workId)return false;
      if(e.questionId)return String(e.questionId)===q.id && Boolean(e.courseId || e.workId);
      return !q.encrypted && e.question && clean(e.question)===clean(q.text) && (!e.options || clean(e.options.join('|'))===clean(q.options.map(o=>o.text).join('|')));
    });
  }
  function planAnswer(q,raw) {
    const values=(Array.isArray(raw)?raw:String(raw ?? '').split(/[#\n]+/)).map(v=>String(v).trim()).filter(Boolean);
    if(!values.length)throw new Error(`题 ${q.id} 没有答案`);
    if(q.type==='completion') {
      if(q.fields.length!==values.length)throw new Error(`题 ${q.id} 填空数量不符`);
      if(q.node.querySelector('iframe'))throw new Error('富文本填空暂需手动处理，已停止');
      return {q,values};
    }
    if(!['single','multiple','judgement'].includes(q.type))throw new Error('当前题型尚未适配');
    let parts=values;
    if(values.length===1 && /^[A-H、,，;；\s]{1,30}$/i.test(values[0]) && !q.options.some(o=>clean(o.text)===clean(values[0])))parts=[...values[0].toUpperCase().replace(/[、,，;；\s]/g,'')];
    const options=parts.map(value=>{
      let matches=q.options.filter(o=>clean(o.text)===clean(value));
      if(!matches.length && /^[A-H]$/i.test(value)) matches=q.options.filter(o=>o.label===value.toUpperCase());
      if(!matches.length && q.type==='judgement') {
        const truth=/^(正确|对|是|true|√|1)$/i.test(value),falsy=/^(错误|错|否|false|×|x|0)$/i.test(value);
        if(truth || falsy)matches=q.options.filter(o=>truth?/正确|对|true|√/i.test(o.text):/错误|错|false|×/i.test(o.text));
      }
      if(matches.length!==1)throw new Error(`题 ${q.id} 的答案无法唯一匹配：${value}`);
      return matches[0];
    });
    const unique=[...new Set(options)];
    if(q.type!=='multiple'&&unique.length!==1)throw new Error(`题 ${q.id} 只能有一个选项`);
    return {q,options:unique};
  }
  function candidates(response) {
    const value=response?.result?.answers ?? response?.answer?.allAnswer ?? response?.answers ?? response?.answer ?? [];
    if(response?.result?.success===true && Array.isArray(value))return [value];
    return (Array.isArray(value)?value:[value]).map(v=>Array.isArray(v)?v:['string','boolean','number'].includes(typeof v)?String(v):v?.answer).filter(v=>v!==undefined && v!==null && v!=='');
  }
  function remote(q) {
    return new Promise((resolve,reject)=>{
      let handle,settled=false,watchdog;
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(watchdog);requests.delete(handle);fn(value)};
      handle=GM_xmlhttpRequest({method:'POST',url:'https://lyck6.cn/scriptService/api/autoFreeAnswer',anonymous:true,redirect:'error',
        headers:{'Content-Type':'application/json;charset=utf-8',Version:'__VERSION__'},
        data:JSON.stringify({question:q.text,options:q.options.map(o=>o.text),type:({single:0,multiple:1,completion:2,judgement:3})[q.type]}),timeout:15000,
        onload:r=>{try{
          if(r.finalUrl&&new URL(r.finalUrl).href!=='https://lyck6.cn/scriptService/api/autoFreeAnswer')throw new Error('题库发生重定向');
          if(r.status!==200){const e=new Error(r.status===429?'题库繁忙（HTTP 429）':`题库 HTTP ${r.status}`);e.retryable=r.status===429||r.status>=500;throw e;}
          const json=JSON.parse(r.responseText);if(json.code!==0)throw new Error('题库未返回可用结果');finish(resolve,candidates(json));
        }catch(e){finish(reject,e)}},
        onerror:()=>finish(reject,Object.assign(new Error('题库连接失败'),{retryable:true})),ontimeout:()=>finish(reject,Object.assign(new Error('题库超时'),{retryable:true})),onabort:()=>finish(reject,new Error('查题已停止'))
      });if(!settled){requests.add(handle);watchdog=setTimeout(()=>{if(!settled){finish(reject,Object.assign(new Error('题库超时'),{retryable:true}));handle?.abort()}},16000);}
    });
  }
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitVerification(run){
    let blocked;
    do{
      if(run!==epoch)throw new Error('已停止');blocked=false;
      walkDocuments(unsafeWindow,(win,doc)=>{if([...doc.querySelectorAll('#fcqrimg,.chapterVideoFaceMaskDiv,.yidun_popup,.geetest_panel')].some(inlineVisible))blocked=true;});
      if(blocked){el('quiz-status').textContent='等待平台验证，完成后自动继续。';await delay(500);}
    }while(blocked);
  }
  let nextRemoteAt=0,remoteCooldown=0;
  async function pacedRemote(q,run){
    if(remoteCooldown>Date.now()&&ai?.enabled())throw new Error('题库冷却中');
    const pause=nextRemoteAt-Date.now();if(pause>0)await delay(pause);
    if(run!==epoch)throw new Error('已停止');
    try{
      for(let attempt=0;;attempt++)try{return await remote(q)}catch(e){
        if(!e.retryable||attempt>=2||run!==epoch||ai?.enabled()){if(e.retryable)remoteCooldown=Date.now()+60000;throw e;}
        note(`题库临时故障，等待后重试 ${attempt+1}/2……`);await delay(attempt===0?3000:8000);if(run!==epoch)throw new Error('已停止');
      }
    }finally{nextRemoteAt=Date.now()+2000}
  }
  function uniquePlan(q,answers){
    const distinct=new Map();
    for(const answer of answers)try{const plan=planAnswer(q,answer);distinct.set(plan.options?plan.options.map(o=>o.label).sort().join(''):plan.values.join('#'),plan)}catch{}
    return distinct.size===1?[...distinct.values()][0]:null;
  }
  function needsFont(q,test){
    if(!q.encrypted)return false;
    const entry=findLocal(test,q);
    if(entry)return !uniquePlan(q,[entry.answers]);
    return true;
  }
  async function resolvePlan(test,q,run,check=()=>{}){
    const assert=()=>{if(run!==epoch)throw new Error('已停止');check()};assert();
    const entry=findLocal(test,q);
    if(entry){const plan=uniquePlan(q,[entry.answers]);if(!plan)throw new Error(`题 ${q.id} 的本地答案无法匹配，请检查题面或还原字体`);if(entry.source)note(`题 ${q.id}：${entry.source}`);return plan;}
    if(q.imageIssue)throw new Error('题目含尚未加载或不支持的图片，无法完整识别，已暂停');
    if(!q.text&&!q.images?.length)throw new Error('题干为空或尚未加载，已暂停');
    if(q.encrypted){
      if(ai?.enabled()&&ai.visionEnabled()){
        const image=await renderFontQuestionImage(test,q,assert);assert();
        let preview=q.editor?.parentElement?.querySelector('[data-font-preview]');
        if(!preview&&q.editor?.parentElement){preview=document.createElement('details');preview.setAttribute('data-font-preview','');preview.innerHTML='<summary>本题字形兜底图片</summary>';const img=document.createElement('img');img.alt='仅含本题题干与选项的字形兜底图片';img.style.maxWidth='100%';preview.append(img);q.editor.parentElement.append(preview);}
        if(preview)preview.querySelector('img').src=image;
        const visual={...q,encrypted:false,text:'题干和各选项原文见题图。请根据题图作答，并返回选项字母。',images:[image,...q.images],options:q.options.map(o=>({...o,text:`选项 ${o.label}，原文见题图。`}))};
        note(`题 ${q.id}：字形尚未完全还原，改用仅含本题的图片调用 AI……`);
        const result=await ai.solve(visual,{assertCurrent:assert});assert();note(`题 ${q.id}：字形图片已匹配，自评置信度 ${result.confidence.toFixed(2)}。`);return result.plan;
      }
      q.matchFailure=`题 ${q.id} 仍有 ${q.fontUnresolved?.size||'部分'} 个字体字符未还原；${ai?.enabled()?'可在 AI 配置中启用“图片题和字形兜底”并保存（需视觉模型）':'请先配置 AI 答案来源'}`;
      note(q.matchFailure);return null;
    }
    const hasImages=Boolean(q.images?.length||q.options.some(o=>o.images?.length));
    if(el('quiz-remote').checked&&!hasImages){
      try{const answers=await pacedRemote(q,run);assert();const plan=uniquePlan(q,answers);if(plan)return plan;note(`题 ${q.id}：第三方题库未返回唯一可用答案。`);}
      catch(e){assert();if(!ai?.enabled())throw e;note(e.message+'，改用 AI 兜底。');}
    }
    assert();
    if(ai?.enabled()){
      note(`题 ${q.id}：正在调用已配置的 AI 接口……`);
      const result=await ai.solve(q,{assertCurrent:assert});assert();
      note(`题 ${q.id}：AI ${result.cached?'缓存命中':'已匹配'}，自评置信度 ${result.confidence.toFixed(2)}。`);
      return result.plan;
    }
    return null;
  }
  async function searchAnswers() {
    if(busy)return;
    const cancelAtStart=cancellation;
    try{const test=ensureQuiz();if(test.questions.some(q=>needsFont(q,test)))await restoreFont();if(cancelAtStart!==cancellation)return {error:'已停止'};}catch(e){note(e.message);return {error:e.message};}
    const run=++epoch;lock(true);
    try {
      const test=ensureQuiz();let matched=0;const missing=[];
      for(const q of test.questions) {
        if(run!==epoch)throw new Error('已停止');ensureQuiz();
        const plan=await resolvePlan(test,q,run,()=>ensureQuiz());
        if(!plan){
          try{planAnswer(q,q.editor.value);matched++;continue;}catch{}
          const reason=q.matchFailure||`题 ${q.id} 的题库未命中，AI 兜底未启用；请启用并保存 AI 配置`;
          missing.push(reason);note(reason);continue;
        }
        q.editor.value=plan.options?plan.options.map(o=>o.label).join('#'):plan.values.join('\n'); matched++;
        await delay(100);
      }
      note(`已匹配 ${matched}/${test.questions.length} 题；尚未填入或提交。`);
      return {matched,total:test.questions.length,missing};
    }catch(e){note(e.message);return {error:e.message};}finally{lock(false)}
  }
  async function fillAnswers(test,run) {
    // 先检查全部题目，缺少答案时不产生部分填写或提交。
    const plans=test.questions.map(q=>planAnswer(q,q.editor.value));
    for(const plan of plans) {
      if(run!==epoch)throw new Error('已停止');ensureQuiz();
      const {q}=plan;
      await waitVerification(run);ensureQuiz();
      if(plan.options) {
        const wanted=new Set(plan.options);
        for(const o of q.options) if(selected(q,o)!==wanted.has(o)) {
          if(q.type==='multiple'||wanted.has(o))o.node.click();
        }
        await delay(100);
        if(q.options.some(o=>selected(q,o)!==wanted.has(o)))throw new Error(`题 ${q.id} 页面选择状态未同步，已停止`);
      } else for(let i=0;i<q.fields.length;i++) {
        q.fields[i].value=plan.values[i];
        q.fields[i].dispatchEvent(new test.win.Event('input',{bubbles:true}));
        q.fields[i].dispatchEvent(new test.win.Event('change',{bubbles:true}));
      }
    }
  }
  function submissionConfirmation(test){
    // The course places its confirmation in the top document, outside the quiz iframe.
    const matches=[],seen=new Set();let win=test.win;
    for(let depth=0;win&&depth<9&&!seen.has(win);depth++){
      seen.add(win);
      try{
        const box=win.document.getElementById('workpop'),button=box?.querySelector('#popok');
        const message=box?.querySelector('.popWord')?.textContent||box?.textContent||'';
        if(inlineVisible(box)&&inlineVisible(button)&&/确认提交\s*[？?]/.test(message)&&/^(提交|确认提交|确定)$/.test(button.textContent.trim())&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')matches.push({box,button});
        if(win===win.top)break;win=win.parent;
      }catch{break;}
    }
    return matches.length===1?matches[0]:null;
  }
  async function confirmSubmission(test,run,{resume=false}={}){
    for(let attempt=0;attempt<24;attempt++){
      if(run!==epoch)throw new Error('已停止后续操作；已发出的提交无法撤回');
      if(test.win.document!==test.doc||test.win.location.href!==test.base)return {ok:true,submitted:true,pending:true};
      await waitVerification(run);
      if(run!==epoch)throw new Error('已停止后续操作；已发出的提交无法撤回');
      if(test.win.document!==test.doc||test.win.location.href!==test.base)return {ok:true,submitted:true,pending:true};
      const dialog=submissionConfirmation(test);
      if(dialog){
        // Persist before clicking: a delayed response must never cause a second confirmation.
        if(journal(test).confirmed)return {ok:true,submitted:true,pending:true};
        journal(test,true,true);dialog.button.click();
        note(resume?'已接续上次提交，点击平台“确认提交”。':'已点击平台确认弹窗的“提交”，等待平台结果。');
        for(let i=0;i<16;i++){
          await delay(250);
          if(run!==epoch)throw new Error('已停止后续操作；已发出的提交无法撤回');
          if(test.win.document!==test.doc||test.win.location.href!==test.base)return {ok:true,submitted:true,pending:true};
          if(!inlineVisible(dialog.box))return {ok:true,submitted:true,pending:true};
        }
        throw new Error('已点击最终提交，但弹窗仍未关闭；请核对平台提示，脚本不会重复交卷');
      }
      if(resume)return {ok:true,submitted:true,pending:true};
      await delay(250);
    }
    throw new Error('未出现可识别的提交确认或结果；已保留待确认记录，请核对平台提示');
  }
  async function runQuiz(mode) {
    if(busy)return {ok:false,message:'测验正在运行'};const run=++epoch;lock(true);
    try {
      const test=ensureQuiz();
      if(mode==='submit'&&journal(test).hit){note('此测验已经发起过提交，接续确认并核对平台状态。');return await confirmSubmission(test,run,{resume:true});}
      await fillAnswers(test,run);
      if(run!==epoch)throw new Error('已停止');ensureQuiz();
      await waitVerification(run);ensureQuiz();
      if(mode==='fill'){note('全部答案已填入，尚未保存或提交。');return {ok:true,filled:true};}
      const button=test.doc.querySelector(mode==='save'?'a.btnSave':'a.btnSubmit');
      if(!button)throw new Error('未找到平台保存／提交按钮，请在原页面处理。');
      if(mode!=='save')journal(test,true);
      button.click();
      if(mode==='save'){note('已调用平台“暂时保存”；请核对平台提示。');return {ok:true,saved:true};}
      note('已调用平台提交，等待确认界面。');
      return await confirmSubmission(test,run);
    }catch(e){note(e.message);return {ok:false,message:e.message};}finally{lock(false)}
  }
  function stopQuiz(){epoch++;cancellation++;for(const r of requests)r.abort();requests.clear();note('已停止后续操作；已发出的保存或提交无法撤回。');}
  function inlineVisible(node){
    if(!node)return false;
    try{return node.getClientRects().length>0&&node.ownerDocument.defaultView.getComputedStyle(node).visibility!=='hidden'}catch{return false}
  }
  async function answerInline(win,{courseId,isCurrent}){
    if(busy)return {ok:false,message:'测验模块正在运行，请稍后继续视频内问答'};
    const run=++epoch;lock(true);
    const assertCurrent=()=>{if(run!==epoch||!isCurrent())throw new Error('视频内问答操作已取消')};
    try{
      assertCurrent();const doc=win.document,box=doc.querySelector('.tkTopic');
      if(!inlineVisible(box))return {ok:true};
      const rejected=()=>['spanNot','spanNotBack','spanNotBackPoint'].some(id=>inlineVisible(doc.getElementById(id)));
      if(rejected())throw new Error('平台提示视频内问答未通过，请手动核对');
      const continuing=doc.getElementById('videoquiz-continue');
      if(inlineVisible(continuing)){assertCurrent();continuing.click();return {ok:true};}
      if(inlineSubmitted.has(box))throw new Error('视频内问答已提交但反馈未确认；为避免重复提交，已暂停');
      const title=box.querySelector('.tkTopic_title')?.textContent||'';
      const type=title.includes('判断')?'judgement':title.includes('多选')?'multiple':title.includes('单选')?'single':'unsupported';
      if(type==='unsupported')throw new Error('视频内问答题型尚未适配');
      const questions=[...box.querySelectorAll('.tkItem')].map((node,i)=>({
        id:'inline-'+i,type,node,text:node.querySelector('.tkItem_title')?.textContent.trim()||'',images:imageRefs(node.querySelector('.tkItem_title'),doc),
        options:[...node.querySelectorAll('li.ans-videoquiz-opt')].map((li,j)=>({node:li,label:String.fromCharCode(65+j),text:li.textContent.trim().replace(/^[A-Z][、.．]\s*/,''),images:imageRefs(li,doc)}))
      }));
      for(const q of questions)q.imageIssue=q.node.querySelectorAll('img').length!==q.images.length+q.options.reduce((n,o)=>n+o.images.length,0);
      if(!questions.length||questions.some(q=>(!q.text&&!q.images.length)||q.options.length<2))throw new Error('视频内问答内容不完整');
      if(typeof GM_getValue==='function'){const latest=GM_getValue(key,bank);if(Array.isArray(latest))bank=latest;}
      const plans=[];
      for(const q of questions){
        assertCurrent();const plan=await resolvePlan({courseId},q,run,assertCurrent);
        if(!plan)throw new Error(`视频内问答未匹配到唯一答案：${q.text}`);
        plans.push(plan);
      }
      await waitVerification(run);assertCurrent();
      for(const plan of plans)for(const o of plan.q.options){
        assertCurrent();const input=o.node.querySelector('input');
        if(!input)throw new Error('视频内问答缺少选项控件');
        if(Boolean(input.checked)!==plan.options.includes(o)&&(type==='multiple'||plan.options.includes(o)))input.click();
      }
      for(const plan of plans)if(plan.q.options.some(o=>Boolean(o.node.querySelector('input').checked)!==plan.options.includes(o)))throw new Error('视频内问答选项状态未同步');
      assertCurrent();const submit=doc.getElementById('videoquiz-submit');
      if(!inlineVisible(submit))throw new Error('没有可用的视频内问答提交按钮');
      inlineSubmitted.set(box,true);submit.click();note(`已提交 ${plans.length} 道视频内问答，等待平台反馈。`);
      for(let attempt=0;attempt<20;attempt++){
        await delay(500);assertCurrent();
        if(rejected())throw new Error('平台提示视频内问答未通过，请手动核对');
        const next=doc.getElementById('videoquiz-continue');
        if(inlineVisible(next)){next.click();note('视频内问答已确认，继续实际播放。');return {ok:true};}
        if(!inlineVisible(box))return {ok:true};
      }
      throw new Error('视频内问答反馈等待超时');
    }catch(e){note(e.message);return {ok:false,message:e.message}}finally{lock(false)}
  }
  function openQuiz() {
    let source;
    walkDocuments(unsafeWindow,(win,doc)=>{if(!source)source=doc.querySelector('iframe#frame_content[src*="/api/work"],iframe#frame_content[src*="/work/"]')?.getAttribute('src')});
    if(!source){note('未找到平台生成的测验链接。请先进入章节测验。');return;}
    const url=new URL(source,location.href);
    if(url.origin!==location.origin){note('测验链接跨源，请在平台内手动打开。');return;}
    window.open(url.href,'_blank','noopener');
  }
  function importBank(){
    try{
      const value=JSON.parse(el('quiz-bank').value);
      if(!Array.isArray(value)||value.length>5000||value.some(e=>!Array.isArray(e.answers)||!e.answers.length||(!e.question&&!e.questionId)||(e.questionId&&!e.courseId&&!e.workId)))throw new Error('题库必须为数组；每项需 answers，以及题干或带课程范围的题号。');
      bank=value;if(typeof GM_setValue==='function')GM_setValue(key,bank);note(`已保存 ${bank.length} 条本地题库。`);sourceChanged();
    }catch(e){note(`题库导入失败：${e.message}`)}
  }
  async function restoreFont() {
    if(busy)return;const run=++epoch;lock(true);
    try {
      const test=ensureQuiz(),assertCurrent=()=>{if(run!==epoch||test.win.document!==test.doc||test.win.location.href!==test.base)throw new Error('字体识别已停止或测验页面已变化');};
      note('读取字体实际字符目录，只还原题干和选项中的替换字符……');
      const buffer=extractFontFromStyle(test.doc,'font-cxsecret');
      if(!buffer)throw new Error('没有找到内嵌字体，暂无法还原题面。');
      const glyphs=fontUnicodeGlyphs(buffer),coverage=new Set(glyphs.keys()),old=fontMaps.get(test.doc),map={...(old?.map||{})},uncertain=new Set();
      const chars=[...new Set(test.questions.flatMap(q=>[...q.fontChars]))].filter(ch=>coverage.has(ch.codePointAt(0))&&!Object.hasOwn(map,ch));
      if(!chars.length){assertCurrent();fontMaps.set(test.doc,{coverage,map});lock(false);scanQuiz();note('题干和选项没有待还原的替换字符，直接匹配答案。');return;}
      const table=await loadRefTable('https://cdn.ocsjs.com/resources/font/font_ref_cx.bin');
      assertCurrent();
      const family='cx-quiz-font-'+Date.now();const face=new FontFace(family,buffer);
      await face.load();assertCurrent();document.fonts.add(face);
      try{
        for(const ch of chars){
          assertCurrent();
          const verified=await verifiedFontGlyph(buffer,ch,glyphs);assertCurrent();
          if(verified){map[ch]=verified;note(`字体字符 ${ch} 已通过已核对的字形指纹还原。`);continue;}
          const feat=renderGlyph(family,ch,table);if(!feat){uncertain.add(ch);continue;}
          const result=crackChar(table,feat);
          if(!Number.isFinite(result.margin)||result.margin<0.3||typeof result.ch!=='string'||[...result.ch].length!==1)uncertain.add(ch);else map[ch]=result.ch;
          await delay(0);
        }
      }finally{document.fonts.delete(face)}
      assertCurrent();fontMaps.set(test.doc,{coverage,map});
      lock(false);scanQuiz();
      const pending=quiz.questions.filter(q=>q.encrypted);
      note(`字体目录含 ${coverage.size} 个替换字符，本次确认 ${chars.length-uncertain.size}/${chars.length} 个；可读取 ${quiz.questions.length-pending.length}/${quiz.questions.length} 题。`);
      note(pending.length?`仅题 ${pending.map(q=>q.id).join('、')} 仍有未确认字符，其他题目可以继续匹配。`:'题干和选项已还原，继续题库／AI 匹配。');
    }catch(e){note(e.message)}finally{lock(false)}
  }
  el('quiz-scan').addEventListener('click',()=>scanQuiz());
  el('quiz-search').addEventListener('click',searchAnswers);
  el('quiz-font').addEventListener('click',restoreFont);
  el('quiz-open').addEventListener('click',openQuiz);
  el('quiz-import').addEventListener('click',importBank);
  el('quiz-reset-submit').addEventListener('click',()=>{if(busy)return;try{const record=journal(ensureQuiz());if(typeof GM_setValue==='function')GM_setValue(journalKey,record.entries.filter(e=>e.id!==record.identity));note('已清除本测验待确认记录；下次运行允许重新提交。')}catch(e){note(e.message)}});
  el('quiz-fill').addEventListener('click',()=>runQuiz('fill'));
  el('quiz-save').addEventListener('click',()=>runQuiz('save'));
  el('quiz-finish').addEventListener('click',async()=>{
    if(busy)return;const before=cancellation;
    const result=await searchAnswers();
    if(cancellation!==before||result?.error)return;
    if(result?.missing?.length){note(`已识别 ${result.total} 题、匹配 ${result.matched} 题；`+result.missing.join('；'));return;}
    await runQuiz('submit');
  });
  el('quiz-submit').addEventListener('click',()=>runQuiz('submit'));
  el('quiz-stop').addEventListener('click',stopQuiz);
  setTimeout(()=>scanQuiz(true),1500);
  document.addEventListener('load',e=>{if(e.target.tagName==='IFRAME'&&!busy)setTimeout(()=>scanQuiz(true),500)},true);
  window.addEventListener('pagehide',stopQuiz,{once:true});
  const bridge=host.__cxRuntime ||= {};
  bridge.quiz={
    inspect:()=>{
      let found;
      const signature=text=>{let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return text.length+':'+(hash>>>0);};
      walkDocuments(unsafeWindow,(win,doc)=>{
        if(found)return;const nodes=[...doc.querySelectorAll('.TiMu,.newTiMu')].filter((n,i,list)=>!list.some(other=>other!==n&&other.contains(n)));
        if(!nodes.length)return;
        if(!documentIds.has(doc))documentIds.set(doc,++documentSequence);
        const url=new URL(win.location.href),parent=new URL(location.href).searchParams;
        const test={win,doc,courseId:url.searchParams.get('courseId')||url.searchParams.get('courseid')||parent.get('courseId')||'',workId:url.searchParams.get('workId')||url.searchParams.get('workid')||'',questions:nodes.map((n,i)=>extractQuestion(n,doc,i))};
        const fontSignature=signature([...doc.head.querySelectorAll('style')].filter(style=>style.textContent.includes('font-cxsecret')).map(style=>style.textContent).join('\n'));
        const record=journal(test);
        found={found:true,busy,revision:sourceRevision,submitted:record.hit&&(record.confirmed||!submissionConfirmation(test)),key:JSON.stringify([documentIds.get(doc),url.href,fontSignature,test.questions.map(q=>[q.id,q.type,q.node.textContent,[...q.node.querySelectorAll('img')].map(img=>signature(img.getAttribute('src')||img.getAttribute('data-src')||''))])])};
      });
      return found||{found:false,busy,revision:sourceRevision};
    },
    inline:answerInline,
    scan:()=>{scanQuiz(true);return {found:Boolean(quiz),busy,questions:quiz?.questions.length||0};},
    state:()=>({busy,found:Boolean(quiz)}),
    run:async()=>{
      const cancelAtStart=cancellation;
      try{
        if(busy)return {ok:false,message:'测验正在运行'};
        scanQuiz(true);ensureQuiz();
        if(journal(ensureQuiz()).hit)return await runQuiz('submit');
        const result=await searchAnswers();
        if(cancelAtStart!==cancellation)throw new Error('已停止');
        if(result?.error)return {ok:false,message:result.error};
        if(result?.missing?.length)return {ok:false,message:`已识别 ${result.total} 题、匹配 ${result.matched} 题；`+result.missing.join('；')};
        ensureQuiz().questions.forEach(q=>planAnswer(q,q.editor.value));
        return await runQuiz('submit');
      }catch(e){note(e.message);return {ok:false,message:e.message};}
    },
    stop:stopQuiz
  };
  /* AI FALLBACK MODULE */
  ai=createAiFallback({root,document,
    getValue:(k,f)=>typeof GM_getValue==='function'?GM_getValue(k,f):f,
    setValue:(k,v)=>{if(typeof GM_setValue==='function')GM_setValue(k,v)},
    request:options=>GM_xmlhttpRequest(options),requests,note,validate:planAnswer,
    isBusy:()=>busy,setBusy:lock,getEpoch:()=>epoch,onChanged:sourceChanged
  });
  /* FONT COVERAGE MODULE */
  /* FONT IMAGE MODULE */
  /* OCS FONT HELPERS */
})();
