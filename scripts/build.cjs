const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
function insert(source,marker,file){if(!source.includes(marker))throw Error('Missing build marker: '+marker);return source.replace(marker,()=>read(file));}
function assemble(){
 let media=insert(read('src/progress-media.js'),'  /* BACKGROUND PLAYBACK MODULE */','src/background-module.js').trimEnd();
 let quiz=read('src/quiz-module.js');
 for(const [marker,file]of [['AI FALLBACK MODULE','ai-module.js'],['FONT COVERAGE MODULE','font-module.js'],['FONT IMAGE MODULE','font-image-module.js'],['OCS FONT HELPERS','vendor/ocs-font-helpers.js']])quiz=insert(quiz,'  /* '+marker+' */','src/'+file);
 const result=[media,quiz.trimEnd(),read('src/flow-module.js').trimEnd(),read('src/quiz-auto.js').trimEnd()].join('\n')+'\n';
 return result.replaceAll('__VERSION__',pkg.version);
}
const target=path.join(root,'dist/chaoxing-study-helper.user.js'),output=assemble();
if(!/^\d+\.\d+\.\d+$/.test(pkg.version)||output.includes('__VERSION__'))throw Error('Invalid release version');
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||read('dist/chaoxing-study-helper.user.js')!==output){console.error('dist is missing or stale. Run npm run build.');process.exitCode=1;}
 else console.log('Build is current: v'+pkg.version);
}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,output,'utf8');console.log('Built dist/chaoxing-study-helper.user.js v'+pkg.version+' ('+Buffer.byteLength(output)+' bytes)');}
