  // Scoped background playback support. Never changes visibility getters,
  // browser power settings, playback position or task completion data.
  function createBackgroundPlayback({windows,media,isCurrent,enabled,isBlocked,play,onWake=()=>{}}){
    const contexts=[...new Set(windows.filter(Boolean))],bindings=[];
    let stopped=false,away=false,frozen=false,queued=false,timer=null,lastAttempt=-Infinity;
    function hidden(){return contexts.some(win=>{try{return win.document.hidden===true||win.document.visibilityState==='hidden'}catch{return false}})}
    function valid(){return !stopped&&isCurrent()&&enabled()&&!frozen&&!isBlocked()&&!media.ended&&media.paused;}
    function resume(waking=false){
      if(!valid()||(!waking&&!hidden()&&!away)||queued||timer!==null)return;
      const wait=2000-(Date.now()-lastAttempt);
      if(wait>0){timer=setTimeout(()=>{timer=null;resume(waking)},wait);return;}
      queued=true;
      Promise.resolve().then(()=>{
        queued=false;if(!valid()||(!waking&&!hidden()&&!away))return;
        lastAttempt=Date.now();play();
      });
    }
    function listen(target,type,callback){
      if(typeof target?.addEventListener!=='function')return;
      target.addEventListener(type,callback,true);bindings.push([target,type,callback]);
    }
    function wake(){const wasAway=away||frozen;away=false;frozen=false;if(wasAway)onWake();resume(true);}
    function leaving(type,win,event){
      if(stopped||!isCurrent()||!enabled())return;
      // Capture on window also sees blur from inputs; those are ordinary editing.
      if(type==='blur'&&event.target&&event.target!==win)return;
      if(type==='mouseout'&&event.relatedTarget!=null)return;
      if(type==='visibilitychange'&&!hidden()){wake();return;}
      away=true;event.stopImmediatePropagation?.();resume();
    }
    for(const win of contexts){
      for(const type of ['blur','mouseout','visibilitychange'])listen(win,type,event=>leaving(type,win,event));
      listen(win,'focus',event=>{if(!event.target||event.target===win)wake()});
      try{
        // freeze/resume do not bubble. Capture on document and do not suppress them.
        listen(win.document,'freeze',()=>{frozen=true;clearTimeout(timer);timer=null;});
        listen(win.document,'resume',wake);
        listen(win.document,'visibilitychange',event=>leaving('visibilitychange',win,event));
      }catch{}
    }
    listen(media,'pause',()=>resume());
    return {hidden,resume,stop(){
      stopped=true;clearTimeout(timer);timer=null;
      for(const [target,type,callback]of bindings)target.removeEventListener(type,callback,true);
      bindings.length=0;
    }};
  }
