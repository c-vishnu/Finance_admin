const fs = require('fs');

let content = fs.readFileSync('src/JournalEntriesPro.jsx', 'utf8');

// Replace the two columns with one
let targetCell = {showOrganizationColumn&&<div className="je-cell" data-label="Organisation">\\s*<select aria-label=\\{'Organisation for line '\\+\\(index\\+1\\)\\} value=\\{line\\.organization\\|\\|''\\} onChange=\\{event=>updateLineOrganization\\(line\\.id,event\\.target\\.value\\)\\}>\\{contextOrganizations\\.map\\(org=><option key=\\{org\\.id\\} value=\\{org\\.name\\}>\\{org\\.name\\}</option>\\)\\}\\s*</select></div>}\\s*{showBranchColumn&&<div className="je-cell" data-label="Branch">\\s*<select aria-label=\\{'Branch for line '\\+\\(index\\+1\\)\\} value=\\{line\\.branch\\|\\|''\\} onChange=\\{event=>update\\(line\\.id,'branch',event\\.target\\.value\\)\\}>\\{lineBranchOptions\\(line\\)\\.map\\(name=><option key=\\{name\\} value=\\{name\\}>\\{name\\}</option>\\)\\}\\s*</select></div>};
let regex = new RegExp(targetCell, 'g');

let replacement = "{(showOrganizationColumn || showBranchColumn) && <div className=\"je-cell\" data-label=\"Organisation & Branch\"><select aria-label={'Scope for line '+(index+1)} value={${line.organization}|} onChange={event=>{const [org, branch]=event.target.value.split('|'); updateLineOrganization(line.id, org); setTimeout(()=>update(line.id, 'branch', branch), 0);}}>{contextOrganizations.map(org=><optgroup key={org.id} label={org.name}>{branchNamesFor(org.name).map(b=><option key={b} value={${org.name}|}>{b}</option>)}</optgroup>)}</select></div>}";

content = content.replace(regex, replacement);

fs.writeFileSync('src/JournalEntriesPro.jsx', content, 'utf8');
