import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const docsDir=path.join(root,'docs');
const required=['README.md','PROJECT-OVERVIEW.md','TECHNICAL-ARCHITECTURE.md','ACCOUNTING-DOMAIN.md','MODULES.md','DATA-MODEL.md','UI-DESIGN-SYSTEM.md','DEVELOPER-GUIDE.md','TESTING-AND-QA.md','SECURITY-AND-CONTROLS.md','KNOWN-GAPS-AND-ROADMAP.md','GLOSSARY.md','AI-HANDOFF-PROMPT.md','WAYVIDA-BOOKS-HANDBOOK.md','project-manifest.json'];
const failures=[];

for(const name of required){try{await access(path.join(docsDir,name))}catch{failures.push(`Missing required document: docs/${name}`)}}

let manifest;
try{manifest=JSON.parse(await readFile(path.join(docsDir,'project-manifest.json'),'utf8'))}catch(error){failures.push(`Invalid project-manifest.json: ${error.message}`)}
if(manifest){
  for(const section of ['metadata','runtime','modules','navigation','persistence','accountingRules','tests','documentation','constraints','implementationStatus'])if(!(section in manifest))failures.push(`Manifest is missing section: ${section}`);
  if(!manifest.metadata?.lastVerified)failures.push('Manifest metadata.lastVerified is required');
}

for(const name of (await readdir(docsDir)).filter(file=>file.endsWith('.md'))){
  const content=await readFile(path.join(docsDir,name),'utf8');
  if(!content.includes('Last verified:'))failures.push(`docs/${name} is missing Last verified metadata`);
  for(const match of content.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)){
    const target=match[1];
    if(/^(https?:|mailto:)/.test(target))continue;
    try{await access(path.resolve(docsDir,target))}catch{failures.push(`Broken link in docs/${name}: ${target}`)}
  }
}

if(failures.length){
  console.error(`Knowledge documentation check failed (${failures.length} issue${failures.length===1?'':'s'}):`);
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exitCode=1;
}else console.log(`Knowledge documentation check passed: ${required.length} required files, valid manifest, metadata and local links.`);
