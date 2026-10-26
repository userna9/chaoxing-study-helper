const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const suites=[['syntax',['--check','dist/chaoxing-study-helper.user.js']],['font',['test/test-font.cjs']],['fontImage',['test/test-font-image.cjs']],['background',['test/test-background.cjs']],['media',['test/test-progress.cjs']],['quiz',['test/test-quiz.cjs']],['quizAuto',['test/test-quiz-auto.cjs']],['ai',['test/test-ai.cjs']],['flow',['test/test-flow.cjs']],['integration',['test/test-integration.cjs']],['integrationRecovery',['test/test-integration.cjs','--recover-player']],['integrationBackground',['test/test-integration.cjs','--background']]];
const results=suites.map(([name,args])=>{
 const run=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'}),checks=(run.stdout||'').split(/\r?\n/).filter(line=>line.startsWith('PASS ')).map(line=>line.slice(5));
 const passed=run.status===0&&(name==='syntax'||checks.length>0);
 console.log(name+': '+(passed?'passed':'FAILED')+' ('+checks.length+' scenarios)');
 if(!passed)console.error(run.stderr||run.stdout||String(run.error));
 return {name,passed,checks};
});
const artifact=fs.readFileSync(path.join(root,'dist/chaoxing-study-helper.user.js'));
const report={version:require('../package.json').version,allPassed:results.every(r=>r.passed),scenarioCount:results.reduce((n,r)=>n+r.checks.length,0),artifact:{bytes:artifact.length,sha256:crypto.createHash('sha256').update(artifact).digest('hex')},suites:results,scope:'Offline DOM fixtures, simulated platform state, Canvas/FontFace drawing-command checks and mocked APIs. No browser accounts or live AI calls.',limitations:['Does not establish actual rendered image readability or model answer accuracy.','Does not establish live platform completion or compatibility across every course.']};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});fs.writeFileSync(path.join(root,'reports/test-results.json'),JSON.stringify(report,null,2)+'\n');
console.log('Total: '+report.scenarioCount+' scenarios; '+(report.allPassed?'all passed':'failures found'));
if(!report.allPassed)process.exitCode=1;
