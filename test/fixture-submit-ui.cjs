// Reproduce the real course's top-window #workpop confirmation, not its hidden JS callback.
module.exports=function mountConfirmation(doc,onConfirm,{message='确认提交？',stuck=false}={}){
 const win=doc.defaultView;
 win.getComputedStyle=()=>({visibility:'visible'});
 win.Element.prototype.getClientRects=function(){for(let e=this;e;e=e.parentElement)if(e.style?.display==='none')return [];return [{}]};
 const box=doc.createElement('div');box.id='workpop';box.className='maskDiv';box.style.display='none';
 box.innerHTML='<div class="popDiv wid440 Marking"><div class="popHead" id="workpopFocus">提示</div><p class="popWord"></p><div class="popBottom"><a role="button" id="popok" aria-label="确定">提交</a><a id="popno">取消</a></div></div>';
 box.querySelector('.popWord').textContent=message;doc.body.append(box);
 box.querySelector('#popok').addEventListener('click',()=>{if(!stuck)box.style.display='none';onConfirm()});
 return {box,show:()=>{box.style.display='block'},button:box.querySelector('#popok')};
};
