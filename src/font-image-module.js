  let fontImageSequence=0;
  async function renderFontQuestionImage(test,q,assertCurrent){
    assertCurrent();
    const buffer=extractFontFromStyle(test.doc,'font-cxsecret');
    if(!buffer)throw new Error('没有找到当前测验的内嵌字体，无法生成可靠题图');
    const family='cx-question-image-'+(++fontImageSequence),face=new FontFace(family,buffer);
    await face.load();assertCurrent();document.fonts.add(face);
    try{return drawFontQuestionImage(q,family,assertCurrent)}finally{document.fonts.delete(face)}
  }
  function drawFontQuestionImage(q,family,assertCurrent){
    // Draw only the original title and option text, never the page, account UI or inputs.
    const runs=node=>{
      const result=[];
      function visit(el){
        if(el.nodeType===3){result.push({text:(el.nodeValue||'').replace(/\s+/g,' '),secret:Boolean(el.parentElement?.closest('.font-cxsecret'))});return;}
        if(el.nodeType!==1||['SCRIPT','STYLE','INPUT','TEXTAREA','BUTTON','IMG'].includes(el.tagName))return;
        if(el.tagName==='BR')result.push({text:'\n',secret:false});
        for(const child of el.childNodes)visit(child);
      }
      if(node)visit(node);return result;
    };
    const title=q.node.querySelector('.fontLabel,.Zy_TItle .clearfix,.Zy_TItle,.newZy_TItle,h3');
    const blocks=[runs(title),...q.options.map(o=>[{text:o.label+'. ',secret:false},...(o.node.querySelector('.after')?runs(o.node.querySelector('.after')):[{text:o.text,secret:false}])])];
    const length=blocks.reduce((n,b)=>n+b.reduce((m,r)=>m+r.text.length,0),0);
    if(!blocks[0].some(r=>r.text.trim())||length>10000)throw new Error('题目文字为空或过长，无法生成完整题图');
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(!context)throw new Error('浏览器无法创建题图画布');
    const width=960,pad=28,lineHeight=36,commands=[];let x=pad,y=pad+27;
    for(const block of blocks){
      assertCurrent();
      for(const run of block){
        const font=run.secret?`24px "${family}", sans-serif`:'24px sans-serif';context.font=font;
        for(const ch of run.text.replace(/\r\n?/g,'\n')){
          if(ch==='\n'){x=pad;y+=lineHeight;continue;}
          const advance=context.measureText(ch).width;
          if(!Number.isFinite(advance)||advance<0||advance>width-pad*2)throw new Error('题图字形尺寸不可用');
          if(x+advance>width-pad){x=pad;y+=lineHeight;}
          commands.push({ch,font,x,y});x+=advance;
        }
      }
      x=pad;y+=lineHeight*1.6;
      if(y>4000-pad)throw new Error('题目过长，题图无法完整展示，已暂停');
    }
    canvas.width=width;canvas.height=Math.ceil(y+pad);
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#111';context.textBaseline='alphabetic';
    for(const command of commands){context.font=command.font;context.fillText(command.ch,command.x,command.y);}
    assertCurrent();const url=canvas.toDataURL('image/png');
    if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url)||url.length>1500000)throw new Error('生成的题图不可用或过大');
    return url;
  }
