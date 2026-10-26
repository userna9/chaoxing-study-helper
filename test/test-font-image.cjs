const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync('src/font-image-module.js','utf8');
function fixture({hold=false,canvasMissing=false,oversize=false,missingFont=false}={}){
 const {document}=parseHTML('<html><body><header>ACCOUNT_PRIVATE_SECRET</header><div id="question"><div class="Zy_TItle"><span>【单选题】</span><span class="font-cxsecret">嚍CNKI 的模式</span></div><ul><li><a class="after font-cxsecret">嚓问答</a></li><li><a class="after">English 选项</a></li></ul><input value="INPUT_PRIVATE_SECRET"></div></body></html>');
 const faces=new Set(),drawn=[],created=[];let release,current=true;
 document.fonts={add:f=>faces.add(f),delete:f=>faces.delete(f)};
 const createElement=document.createElement.bind(document);
 document.createElement=tag=>{if(tag!=='canvas')return createElement(tag);const canvas={width:0,height:0,getContext:()=>canvasMissing?null:context,toDataURL:()=>oversize?'data:image/png;base64,'+'A'.repeat(1500000):'data:image/png;base64,AAAA'};const context={font:'',measureText:()=>({width:24}),fillRect(){},fillText(ch,x,y){drawn.push({ch,x,y,font:this.font})}};created.push(canvas);return canvas};
 const api=vm.runInNewContext(source+'\n({renderFontQuestionImage,drawFontQuestionImage})',{document,FontFace:class{async load(){if(hold)await new Promise(resolve=>release=resolve);return this}},extractFontFromStyle:()=>missingFont?null:new ArrayBuffer(8)});
 const q={node:document.getElementById('question'),options:[...document.querySelectorAll('li')].map((node,i)=>({node,label:'AB'[i],text:'decoded text must not be drawn'}))};
 const assertCurrent=()=>{if(!current)throw Error('stale question')};
 return {api,q,document,drawn,created,faces,assertCurrent,cancel:()=>current=false,release:()=>release?.()};
}
(async()=>{
 const h=fixture();assert.match(await h.api.renderFontQuestionImage({doc:h.document},h.q,h.assertCurrent),/^data:image\/png/);const text=h.drawn.map(p=>p.ch).join('');assert(text.includes('嚍CNKI'));assert(text.includes('A.'));assert(text.includes('B.'));assert(!text.includes('PRIVATE_SECRET'));assert(!text.includes('decoded text'));assert(h.drawn.find(p=>p.ch==='嚍').font.includes('cx-question-image-'));assert.equal(h.faces.size,0);
 console.log('PASS question image draws original coded glyphs with their embedded font, labels every option, excludes page/account/input data and releases its font');
 const wrap=fixture();wrap.q.node.querySelector('.Zy_TItle').textContent='测试'.repeat(500);await wrap.api.renderFontQuestionImage({doc:wrap.document},wrap.q,wrap.assertCurrent);assert(wrap.created[0].height>500);assert(wrap.drawn.every(p=>p.x>=28&&p.x<=932&&p.y<=wrap.created[0].height));
 console.log('PASS long question text wraps within the canvas instead of clipping the right edge');
 const huge=fixture();huge.q.node.querySelector('.Zy_TItle').textContent='字'.repeat(10001);await assert.rejects(()=>huge.api.renderFontQuestionImage({doc:huge.document},huge.q,huge.assertCurrent),/过长/);assert.equal(huge.faces.size,0);
 console.log('PASS excessive text is rejected without silently truncating a question or leaking a temporary font');
 const stale=fixture({hold:true});const pending=stale.api.renderFontQuestionImage({doc:stale.document},stale.q,stale.assertCurrent);stale.cancel();stale.release();await assert.rejects(()=>pending,/stale/);assert.equal(stale.faces.size,0);assert.equal(stale.drawn.length,0);
 console.log('PASS navigation or Stop while loading the embedded font prevents rendering a stale question');
 for(const settings of [{missingFont:true},{canvasMissing:true},{oversize:true}]){const failed=fixture(settings);await assert.rejects(()=>failed.api.renderFontQuestionImage({doc:failed.document},failed.q,failed.assertCurrent));assert.equal(failed.faces.size,0);}
 console.log('PASS missing fonts, unavailable canvas and oversized image data stop safely and release resources');
})().catch(e=>{console.error(e);process.exitCode=1});
