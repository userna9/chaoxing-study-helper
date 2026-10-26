  // Read Unicode coverage from the embedded sfnt font, rather than comparing
  // browser fallback fonts. Matching fallback glyphs do not prove coverage.
  function fontUnicodeGlyphs(buffer){
    const view=new DataView(buffer),size=view.byteLength;
    const require=(offset,length)=>{if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||offset+length>size)throw new Error('字体字符目录损坏');};
    require(0,12);
    const signature=view.getUint32(0);
    if(![0x00010000,0x4f54544f,0x74727565].includes(signature))throw new Error('字体格式暂不支持精确识别');
    const count=view.getUint16(4);require(12,count*16);
    let base=-1,length=0;
    for(let i=0;i<count;i++){const p=12+i*16;if(view.getUint32(p)===0x636d6170){base=view.getUint32(p+8);length=view.getUint32(p+12);break;}}
    if(base<0)throw new Error('字体缺少 Unicode 字符目录');require(base,length);if(length<4)throw new Error('字体字符目录损坏');
    const end=base+length,entries=view.getUint16(base+2);if(base+4+entries*8>end)throw new Error('字体字符目录损坏');
    const coverage=new Map(),visited=new Set();let supported=false;
    const add=(cp,glyph)=>{if(cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)&&cp!==0xffff)coverage.set(cp,glyph);};
    for(let i=0;i<entries;i++){
      const p=base+4+i*8,platform=view.getUint16(p),encoding=view.getUint16(p+2);
      if(platform!==0&&!(platform===3&&(encoding===1||encoding===10)))continue;
      const sub=base+view.getUint32(p+4);if(sub<base||sub+2>end)throw new Error('字体字符目录损坏');if(visited.has(sub))continue;visited.add(sub);
      const format=view.getUint16(sub);
      if(format===4){
        if(sub+16>end)throw new Error('字体字符目录损坏');
        const len=view.getUint16(sub+2),segments=view.getUint16(sub+6)/2,limit=sub+len;
        if(!Number.isInteger(segments)||segments<1||segments>32768||limit>end||len<16+segments*8)throw new Error('字体字符目录损坏');
        const ends=sub+14,starts=ends+segments*2+2,deltas=starts+segments*2,ranges=deltas+segments*2;let previous=-1;
        for(let j=0;j<segments;j++){
          const first=view.getUint16(starts+j*2),last=view.getUint16(ends+j*2),delta=view.getInt16(deltas+j*2),range=view.getUint16(ranges+j*2);
          if(first>last||first<=previous||range%2)throw new Error('字体字符目录范围无效');previous=last;
          for(let cp=first;cp<=last&&cp!==0xffff;cp++){
            let glyph;
            if(!range)glyph=(cp+delta)&0xffff;
            else{const at=ranges+j*2+range+(cp-first)*2;if(at<ranges||at+2>limit)throw new Error('字体字符目录索引无效');glyph=view.getUint16(at);if(glyph)glyph=(glyph+delta)&0xffff;}
            if(glyph)add(cp,glyph);
          }
        }supported=true;
      }else if(format===12){
        if(sub+16>end)throw new Error('字体字符目录损坏');
        const len=view.getUint32(sub+4),groups=view.getUint32(sub+12);if(len<16||sub+len>end||groups>100000||16+groups*12>len)throw new Error('字体字符目录损坏');
        let previous=-1,total=0;
        for(let j=0;j<groups;j++){
          const at=sub+16+j*12,first=view.getUint32(at),last=view.getUint32(at+4),glyph=view.getUint32(at+8);
          if(first>last||first<=previous||last>0x10ffff||(total+=last-first+1)>200000)throw new Error('字体字符目录范围无效');previous=last;
          for(let cp=first;cp<=last;cp++)if(glyph+cp-first!==0)add(cp,glyph+cp-first);
        }supported=true;
      }
    }
    if(!supported)throw new Error('字体没有受支持的 Unicode 字符目录');return coverage;
  }
  function fontUnicodeCoverage(buffer){return new Set(fontUnicodeGlyphs(buffer).keys());}
  async function verifiedFontGlyph(buffer,ch,glyphs){
    // These are glyph identities verified against the rendered page, never
    // course answers or substitutions based solely on a random code point.
    const verified={'1000:28fcac30e652f56b218e0389ca6f68bd289829b4f6481855238df8df67a0a062':'面'};
    try{
      if(typeof crypto==='undefined'||!crypto.subtle)return null;
      const view=new DataView(buffer),size=view.byteLength,glyph=(glyphs||fontUnicodeGlyphs(buffer)).get(ch.codePointAt(0));
      if(!glyph)return null;
      const table=tag=>{for(let i=0;i<view.getUint16(4);i++){const p=12+i*16;if(p+16>size)return null;let name='';for(let j=0;j<4;j++)name+=String.fromCharCode(view.getUint8(p+j));if(name===tag){const offset=view.getUint32(p+8),length=view.getUint32(p+12);return offset+length<=size?{offset,length}:null;}}return null;};
      const head=table('head'),loca=table('loca'),glyf=table('glyf'),maxp=table('maxp');
      if(!head||head.length<54||!loca||!glyf||!maxp||maxp.length<6||glyph>=view.getUint16(maxp.offset+4))return null;
      const format=view.getInt16(head.offset+50);if(![0,1].includes(format))return null;const stride=format?4:2;
      if((glyph+2)*stride>loca.length)return null;
      const offset=index=>format?view.getUint32(loca.offset+index*4):view.getUint16(loca.offset+index*2)*2;
      const start=offset(glyph),end=offset(glyph+1);if(end<=start||end>glyf.length||end-start>65536||end-start<10)return null;
      const digest=await crypto.subtle.digest('SHA-256',buffer.slice(glyf.offset+start,glyf.offset+end));
      const hex=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      return verified[view.getUint16(head.offset+18)+':'+hex]||null;
    }catch{return null;}
  }
