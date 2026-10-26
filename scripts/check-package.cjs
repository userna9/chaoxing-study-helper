const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','package.json','package-lock.json','.gitignore','.github/workflows/ci.yml','dist/chaoxing-study-helper.user.js'];
const problems=[];
for(const name of required)if(!fs.existsSync(path.join(root,name)))problems.push('Missing '+name);
const patterns=[/sk-[A-Za-z0-9]{24,}/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/[?&](?:enc|openc|dtoken)=[0-9a-f]{16,}/i,/[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]/i];
let files=0;
function inspect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 if(['node_modules','.git','reports','coverage'].includes(entry.name))continue;
 const file=path.join(dir,entry.name),relative=path.relative(root,file);
 if(entry.isSymbolicLink()){problems.push('Do not publish symlinks: '+relative);continue;}
 if(entry.isDirectory()){inspect(file);continue;}
 files++;const text=fs.readFileSync(file,'utf8');if(patterns.some(pattern=>pattern.test(text)))problems.push('Potential private data in '+relative);
 if(/\.user\.js$/.test(file)&&/const builtin\s*=/.test(text))problems.push('Unexpected built-in course data in '+relative);
}}
inspect(root);
if(problems.length){for(const problem of problems)console.error(problem);process.exitCode=1;}else console.log('Package checks passed ('+files+' files; known secret/path patterns checked).');
