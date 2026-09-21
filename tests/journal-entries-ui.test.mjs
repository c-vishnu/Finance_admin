import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/JournalPreview.jsx',import.meta.url),'utf8');

test('journal register shows only manual journals without redundant origin controls',()=>{
 assert.match(source,/const list=manual\.filter\(j=>!j\.automatic\)/);
 assert.match(source,/Create manual journal/);
 assert.match(source,/Manage manual entries\. Daily transactions are recorded automatically\./);
 assert.match(source,/className="je-create-callout"/);
 assert.doesNotMatch(source,/All origins/);
 assert.doesNotMatch(source,/aria-label="Journal origin"/);
 assert.doesNotMatch(source,/const list=\[\.\.\.automatic/);
 assert.match(source,/Entry purpose/);
 assert.match(source,/purposeFilters/);
 assert.match(source,/className="je-filters"/);
 assert.match(source,/>Created by<select/);
 assert.match(source,/>From date<input type="date"/);
 assert.match(source,/>To date<input type="date"/);
 assert.match(source,/Fix a mistake/);
 assert.match(source,/Transfer Journal/);
 assert.doesNotMatch(source,/const TYPES=.*Reversal/);
 assert.doesNotMatch(source,/className="je-filter-panel"/);
 assert.doesNotMatch(source,/Automatic Journals/);
 const register=source.slice(source.indexOf('const JournalRegister='),source.indexOf('export default function JournalEntriesPro'));
 assert.doesNotMatch(register,/Recurring Journals/);
 assert.doesNotMatch(register,/Journal Templates/);
 assert.match(source,/className="je-edit-journal"/);
 assert.match(source,/j\.status==='Draft'/);
 assert.match(preview,/>Print<\/button>/);
 assert.match(preview,/>Download<\/button>/);
 assert.match(preview,/>Share<\/button>/);
 assert.match(preview,/>Customize<\/button>/);
 assert.match(source,/JournalPreview/);
 assert.match(source,/title="Preview journal"/);
 assert.match(source,/Supporting Documents/);
 assert.match(source,/Uploaded attachments/);
 assert.doesNotMatch(source,/\['Overview','Accounting Impact','Source Document'/);
});

/* The journal register rides the shared merged header row: the page heading and its toolbar are
   one sticky line, the search sits beside the Filters disclosure, and Status moved into the panel
   so the panel owns every filter. */
test('the journal register merges its heading and toolbar and owns every filter in the panel',()=>{
  const css=readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');
  const register=source.slice(source.indexOf('const JournalRegister='),source.indexOf('export default function JournalEntriesPro'));
  assert.match(register,/<div className="je-heading registerHead"><div className="registerHeadText"><h2>/,'the heading is the shared marker with the shared text block');
  assert.ok(register.indexOf('className="je-tools"')>register.indexOf('registerHead'),'the toolbar is merged into the heading row');
  assert.ok(register.indexOf('className="je-tools"')<register.indexOf('className="je-card'),'and it is no longer inside the register card');
  assert.ok(register.indexOf('className="je-create-callout"')>register.indexOf('className="je-tools"'),'the create action closes the row');
  assert.match(register,/<details className="je-filters"><summary aria-label="Open filters"><IconFilter size=\{17\}\/>Filters\{activeFilterCount>0&&<span>\{activeFilterCount\}<\/span>\}<\/summary><div><label>Status<select aria-label="Journal status"/,'the panel leads with Status, which left the toolbar');
  const toolbar=register.slice(register.indexOf('className="je-tools"'),register.indexOf('className="je-filters"'));
  assert.ok(toolbar.includes('<label><IconSearch'),'the search is the only control left in the toolbar');
  assert.ok(!toolbar.includes('<select'),'no select is left in the toolbar');
  assert.match(register,/const activeFilterCount=\[status!=='All statuses',journalType!=='All',creator!=='All creators',!!fromDate,!!toDate\]\.filter\(Boolean\)\.length;/,'the badge counts every filter the panel owns');
  assert.match(register,/setStatus\('All statuses'\);setJournalType\('All'\)/,'and Clear filters resets the status too');
  assert.ok(css.includes('.je-page .registerHead .je-tools{margin:0!important;padding:0!important;border:0!important;background:transparent!important;min-height:0!important;gap:10px!important;flex:0 1 auto!important;flex-wrap:nowrap!important}'),'the toolbar gives up its card chrome');
  assert.ok(css.includes('.je-page .registerHead .je-tools>label{width:auto!important;flex:0 1 260px!important;min-width:180px!important;max-width:280px!important;margin-left:auto!important}'),'and the search keeps the pair with the Filters disclosure');
  assert.ok(css.includes('.je-page .je-heading.registerHead{background:#fff!important;min-height:0!important;margin:0!important;padding:12px 16px!important;border:1px solid #e1e6ed!important;border-bottom:1px solid #e1e6ed!important;border-radius:10px 10px 0 0!important;box-shadow:none!important}'),'the heading is the opaque top of the register card');
  assert.ok(css.includes('@media(min-width:761px){\n .je-page .je-heading.registerHead{grid-template-columns:minmax(0,1fr) auto auto!important}'),'and takes a third column above the mobile fold, where src/journal-heading-fix.css already stacks it');
  assert.ok(register.includes('<div className="je-create-callout"><div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick={onCreate}>'),'the add action is the shared split button');
  assert.ok(register.includes('<details className="registerSplitMore"><summary aria-label="More journal actions"'),'whose caret opens the register actions');
  assert.ok(register.includes('onClick={exportRegister}'),'and the menu carries the register export');
  assert.ok(css.includes('.registerHead .registerSplit>.registerSplitMain{border-top-right-radius:0;border-bottom-right-radius:0}'),'the caret is welded to the primary button');
  assert.ok(css.includes('.registerHead .registerSplit>.registerSplitMore>summary{display:inline-grid;'),'and the caret keeps the Chart of Accounts geometry');
  assert.ok(css.includes('.je-page .je-card.unified{margin-top:0!important;border-top:0!important;border-radius:0 0 10px 10px!important}'),'and the table card completes the same card');
});

/* The split menu is the register's one overflow: Import opens the CSV dialog, Export writes the rows
   on screen, and both entries carry the same comfortable geometry. */
test('the register split menu opens the import dialog and offers both directions',()=>{
 const css=readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');
 const importCss=readFileSync(new URL('../src/journal-import.css',import.meta.url),'utf8');
 assert.ok(source.includes('<button type="button" onClick={menuRun(onImport)}><IconUpload size={16}/>Import</button><button type="button" onClick={exportRegister}><IconDownload size={16}/>Export</button>'),'the menu reads Import and Export');
 assert.ok(source.includes("const [importOpen,setImportOpen]=useState(false)")||source.includes(',[importOpen,setImportOpen]=useState(false)'),'the page owns one open flag for the dialog');
 assert.ok(source.includes('onImport={()=>setImportOpen(true)}'),'the register opens it from the menu');
 assert.ok(source.includes('{importOpen&&<JournalImportDialog accounts={accounts} onClose={()=>setImportOpen(false)} onImport={importJournals}/>}'),'and the dialog is rendered from that flag');
 assert.ok(source.includes('const importJournals=plans=>{'),'the page turns ready plans into journals');
 assert.ok(/const importJournals=plans=>\{[\s\S]{0,1600}status:'Draft'/.test(source),'as drafts only, so an import can never post');
 assert.ok(source.includes('{...emptyLine(),account:line.account'),'and every line keeps the shape a typed line has');
 assert.ok(source.includes("import './journal-import.css';"),'the dialog carries its own sheet');
 assert.ok(importCss.includes('.je-import-dialog .je-import-preview li.good{border-color:#cfe8da;background:#f5fbf8}')&&importCss.includes('.je-import-dialog .je-import-preview li.bad{border-color:#f3d2cf;background:#fff7f6}'),'which states ready and refused vouchers apart');
 assert.ok(importCss.includes('.je-page~.journals')&&importCss.includes('display:none!important'),'and hides the superseded legacy screen even with the dialog between them');
 assert.ok(css.includes('.registerHead .registerSplit>.registerSplitMore>div{position:absolute;right:0;top:calc(100% + 6px);z-index:80;display:flex;flex-direction:column;min-width:212px;padding:8px;border:1px solid #e1e6ed;border-radius:9px;background:#fff;box-shadow:0 12px 30px #1018281f}'),'the panel keeps a roomy padding');
 assert.ok(css.includes('.registerHead .registerSplit>.registerSplitMore>div>button{display:flex;flex:0 0 auto;width:100%;height:auto;min-height:40px;align-items:center;justify-content:flex-start;gap:11px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:#344054;font-size:13px;font-weight:600;text-align:left;white-space:nowrap}'),'and every entry is a centred 40px row rather than a cramped one');
});
