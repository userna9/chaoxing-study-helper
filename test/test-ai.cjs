const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function fixture({status=200,result,hold=false,finalUrl,statuses,sharedStore,failWrites=false,failReadback=false}={}){
 let now=0,nextTimer=0;const timers=new Map(),store=sharedStore||new Map(),sent=[],requests=new Set(),notes=[];
 const make=vm.runInNewContext(fs.readFileSync('src/ai-module.js','utf8')+'\ncreateAiFallback',{URL,Map,Date:class extends Date{static now(){return now}},setTimeout:(fn,ms)=>{const id=++nextTimer;if(ms<=8000){now+=ms;queueMicrotask(fn)}else timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)});
 const ai=make({getValue:(k,f)=>failReadback&&k==='cx-ai-connection-v2'?null:store.has(k)?store.get(k):f,setValue:(k,v)=>{if(failWrites)throw Error('storage denied');store.set(k,v)},requests,note:s=>notes.push(s),
  validate:(q,answers)=>{if(q.type==='completion'){if(answers.length!==q.fields.length)throw Error('wrong count');return {q,values:answers}}const selected=answers.map(a=>q.options.find(o=>o.label===a||o.text===a));if(selected.some(o=>!o)||new Set(selected).size!==selected.length||(q.type!=='multiple'&&selected.length!==1))throw Error('invalid options');return {q,options:selected}},
  request:opts=>{sent.push(opts);const code=statuses?.[sent.length-1]??status;if(!hold)queueMicrotask(()=>opts.onload({status:code,finalUrl:finalUrl||opts.url,responseText:JSON.stringify(result||response(['A']))}));return {abort(){opts.onabort?.()}}}
 });
 const config={enabled:true,endpoint:'https://example.test/v1',model:'my-model',jsonMode:false,minConfidence:0.8,timeout:30};
 const q={id:'private-question-id',type:'judgement',text:'软件对视频进行文字搜索。',options:[{label:'A',text:'对'},{label:'B',text:'错'}]};
 return {ai,store,sent,requests,notes,timers,config,q};
}
function response(answers,confidence=0.95){return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({answers,confidence})}}]}}
(async()=>{
 const disabled=fixture();await assert.rejects(()=>disabled.ai.solve(disabled.q),/尚未启用/);assert.equal(disabled.sent.length,0);
 console.log('PASS AI is disabled and makes no request before explicit configuration');

 const h=fixture();h.ai.save(h.config,'secret-test-key');const solved=await h.ai.solve(h.q);
 assert.equal(solved.plan.options[0].label,'A');assert.equal(h.sent[0].url,'https://example.test/v1/chat/completions');
 assert.equal(h.sent[0].headers.Authorization,'Bearer secret-test-key');assert.equal(h.sent[0].anonymous,true);assert.equal(h.sent[0].redirect,'error');
 const payload=JSON.parse(h.sent[0].data),question=JSON.parse(payload.messages[1].content);
 assert.deepEqual(Object.keys(question).sort(),['options','question','type']);assert(!h.sent[0].data.includes('secret-test-key'));assert(!h.sent[0].data.includes('private-question-id'));
 assert.equal(payload.model,'my-model');assert.equal(payload.stream,false);assert.equal(payload.store,undefined);assert.equal(payload.response_format,undefined);assert.equal(h.requests.size,0);assert.equal(h.timers.size,0);
 const fresh={...h.q,options:[...h.q.options]};const cached=await h.ai.solve(fresh);assert.equal(cached.cached,true);assert.equal(cached.plan.q,fresh);assert.equal(h.sent.length,1);
 console.log('PASS configured endpoint and Bearer auth send only question data; cache validates against the fresh question and releases timers');

 const json=fixture();json.ai.save({...json.config,jsonMode:true},'key');await json.ai.solve(json.q);assert.equal(JSON.parse(json.sent[0].data).response_format.type,'json_object');
 console.log('PASS optional JSON mode is included only when enabled');

 assert.throws(()=>h.ai.save({...h.config,endpoint:'https://different.example/v1'},''),/更换 AI 域名/);
 h.ai.save({...h.config,endpoint:'https://different.example/v1'},'new-service-key');
 await h.ai.solve(h.q);assert.equal(h.sent.at(-1).headers.Authorization,'Bearer new-service-key');
 console.log('PASS a saved key cannot silently follow an endpoint change to another domain');

 for(const endpoint of ['http://remote.example/v1','https://user:pass@example.test/v1','https://example.test/v1?api_key=secret','https://example.test/v1/responses']){
  const invalid=fixture();assert.throws(()=>invalid.ai.save({...invalid.config,endpoint},'key'));assert.equal(invalid.sent.length,0);
 }
 const local=fixture();local.ai.save({...local.config,endpoint:'http://127.0.0.1:1234/v1'},'');await local.ai.solve(local.q);assert.equal(local.sent[0].headers.Authorization,undefined);
 console.log('PASS invalid remote endpoints are rejected; explicitly configured local no-key service is supported');

 for(const result of [response(['A'],0.1),response(['Z']),response(['A','B']),{choices:[{finish_reason:'length',message:{content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'答案是A'}}]},response(['A'],'0.9'),{choices:[{finish_reason:'tool_calls',message:{tool_calls:[{}]}}]}]){
  const bad=fixture({result});bad.ai.save(bad.config,'key');await assert.rejects(()=>bad.ai.solve(bad.q));assert.equal(bad.requests.size,0);
 }
 console.log('PASS low confidence, unknown/extra options, truncation, malformed JSON, invalid confidence and tool calls never produce an answer');

 const fenced=fixture({result:{choices:[{message:{content:'```json\n{"answers":["A"],"confidence":0.9}\n```'},finish_reason:'stop'}]}});fenced.ai.save(fenced.config,'key');assert.equal((await fenced.ai.solve(fenced.q)).plan.options[0].label,'A');
 const parts=fixture({result:{choices:[{message:{content:[{type:'text',text:'{"answers":["A"],"confidence":0.9}'}]},finish_reason:'stop'}]}});parts.ai.save(parts.config,'key');await parts.ai.solve(parts.q);
 console.log('PASS fenced JSON and text-part content are parsed without evaluating returned code');

 for(const code of [401,403,429,500]){const failed=fixture({status:code,result:{error:{message:'secret-test-key'}}});failed.ai.save(failed.config,'secret-test-key');await assert.rejects(()=>failed.ai.solve(failed.q),e=>e.message.includes(String(code))&&!e.message.includes('secret-test-key'));}
 const redirected=fixture({finalUrl:'https://other.example/chat/completions'});redirected.ai.save(redirected.config,'key');await assert.rejects(()=>redirected.ai.solve(redirected.q),/重定向/);
 console.log('PASS API errors and unexpected redirect report fixed messages without exposing response or key');

 const canceled=fixture({hold:true});canceled.ai.save(canceled.config,'key');const waiting=canceled.ai.solve(canceled.q);for(const request of canceled.requests)request.abort();await assert.rejects(()=>waiting,/停止/);assert.equal(canceled.requests.size,0);
 const timed=fixture({hold:true});timed.ai.save(timed.config,'key');const timeout=timed.ai.solve(timed.q);[...timed.timers.values()][0]();await assert.rejects(()=>timeout,/超时/);assert.equal(timed.requests.size,0);
 console.log('PASS stop and own timeout abort pending requests and clear tracked resources');

 const moved=fixture({hold:true});moved.ai.save(moved.config,'key');let current=true;const pending=moved.ai.solve(moved.q,{assertCurrent(){if(!current)throw Error('stale')}});current=false;moved.sent[0].onload({status:200,responseText:JSON.stringify(response(['A']))});await assert.rejects(()=>pending,/stale/);
 h.ai.forget();assert.equal(h.ai.enabled(),false);assert.equal(h.store.get('cx-ai-key-v1'),'');await assert.rejects(()=>h.ai.solve(h.q),/尚未启用/);
 console.log('PASS stale results cannot be used; clearing the key disables AI and clears stored secret');
 const recovered=fixture({statuses:[429,503,200]});recovered.ai.save(recovered.config,'key');await recovered.ai.solve(recovered.q);assert.equal(recovered.sent.length,3);
 const denied=fixture({status:401});denied.ai.save(denied.config,'key');await assert.rejects(()=>denied.ai.solve(denied.q),/401/);assert.equal(denied.sent.length,1);
 const exhausted=fixture({status:503});exhausted.ai.save(exhausted.config,'key');await assert.rejects(()=>exhausted.ai.solve(exhausted.q),/503/);assert.equal(exhausted.sent.length,3);
 console.log('PASS transient AI 429/503 recover with two bounded retries; authentication never retries');
 const picture=fixture();picture.q.images=['https://mooc1.chaoxing.com/figure.png'];picture.q.options[0].images=['data:image/png;base64,AAAA'];picture.ai.save(picture.config,'key');
 await assert.rejects(()=>picture.ai.solve(picture.q),/启用图片题/);assert.equal(picture.sent.length,0);
 picture.ai.save({...picture.config,vision:true},'');await picture.ai.solve(picture.q);
 const multimodal=JSON.parse(picture.sent[0].data).messages[1].content;assert.equal(multimodal.length,3);assert.equal(multimodal[1].type,'image_url');assert.equal(JSON.parse(multimodal[0].text.split('\n')[0]).imageNumbers[0],2);
 picture.q.images=['https://mooc1.chaoxing.com/different.png'];await picture.ai.solve(picture.q);assert.equal(picture.sent.length,2);
 console.log('PASS image questions require explicit opt-in, retain option/image numbering, and cache separately by image');
 const ark=fixture();ark.ai.save({...ark.config,endpoint:'https://ark.cn-beijing.volces.com/api/v3'},'key');await ark.ai.solve(ark.q);assert.equal(ark.sent[0].url,'https://ark.cn-beijing.volces.com/api/v3/chat/completions');assert.equal(JSON.parse(ark.sent[0].data).store,undefined);
 const openai=fixture();openai.ai.save({...openai.config,endpoint:'https://api.openai.com/v1'},'key');await openai.ai.solve(openai.q);assert.equal(JSON.parse(openai.sent[0].data).store,false);
 console.log('PASS Ark-compatible request omits optional OpenAI store field; OpenAI retains store=false');
 const saved=fixture();saved.ai.save(saved.config,'permanent-fixture-key');const reload=fixture({sharedStore:saved.store});assert.equal(reload.ai.enabled(),true);await reload.ai.solve(reload.q);assert.equal(reload.sent[0].headers.Authorization,'Bearer permanent-fixture-key');
 console.log('PASS fresh script instances after refresh or chapter navigation reload saved config and key without another save');
 reload.ai.save({...reload.config,model:'changed-model'},'');const upgraded=fixture({sharedStore:saved.store});await upgraded.ai.solve(upgraded.q);assert.equal(upgraded.sent[0].headers.Authorization,'Bearer permanent-fixture-key');assert.equal(JSON.parse(upgraded.sent[0].data).model,'changed-model');
 console.log('PASS saving settings with an empty key field retains the key across another fresh instance');
 const legacyStore=new Map([['cx-ai-settings-v1',saved.config],['cx-ai-key-v1','legacy-fixture-key']]),migrated=fixture({sharedStore:legacyStore});await migrated.ai.solve(migrated.q);assert.equal(migrated.sent[0].headers.Authorization,'Bearer legacy-fixture-key');assert.equal(legacyStore.get('cx-ai-connection-v2').secret,'legacy-fixture-key');
 console.log('PASS old-version GM settings and key migrate automatically to one durable connection record');
 for(const settings of [{failWrites:true},{failReadback:true}]){const failed=fixture(settings);assert.throws(()=>failed.ai.save(failed.config,'never-log-this-key'),e=>e.message.includes('持久存储')&&!e.message.includes('never-log-this-key'));assert.equal(failed.ai.enabled(),false);}
 console.log('PASS failed writes or readback never report durable-save success or enable an unsaved key');
 migrated.ai.forget();const forgotten=fixture({sharedStore:legacyStore});assert.equal(forgotten.ai.enabled(),false);assert.equal(legacyStore.get('cx-ai-key-v1'),'');assert.equal(legacyStore.get('cx-ai-connection-v2').secret,'');
 console.log('PASS explicit clear survives refresh and cannot resurrect the legacy key');
 const tampered=fixture();tampered.ai.save(tampered.config,'bound-fixture-key');tampered.store.get('cx-ai-connection-v2').config.endpoint='https://different.example/v1/chat/completions';const guarded=fixture({sharedStore:tampered.store});assert.equal(guarded.ai.enabled(),false);await assert.rejects(()=>guarded.ai.solve(guarded.q,{allowDisabled:true}),/域名不一致/);assert.equal(guarded.sent.length,0);
 console.log('PASS persisted keys remain origin-bound after reload and cannot follow a corrupted endpoint');
 const currentSource=fs.readFileSync('dist/chaoxing-study-helper.user.js','utf8'),identity=JSON.parse(fs.readFileSync('test/fixtures/metadata.json','utf8'));for(const tag of ['name','namespace'])assert.equal(currentSource.match(new RegExp('@'+tag+'\\s+([^\\r\\n]+)'))[1].trim(),identity[tag]);
 console.log('PASS original userscript name and namespace are retained for storage-preserving upgrades');
})();
