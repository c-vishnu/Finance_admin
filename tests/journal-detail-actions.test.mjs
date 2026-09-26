import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const domain=readFileSync(new URL('../src/simple-journal-transaction.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/journal-detail-actions.css',import.meta.url),'utf8');

test('manual journal detail exposes only the actions the status and role allow',()=>{
  for(const label of ['Submit for approval','Resubmit','Approve','Reject','Reverse journal','Duplicate','Delete draft'])assert.ok(page.includes(label),label);
  assert.match(page,/actions=actionEntries\(journal,role,16\),canDo=name=>actions\.find\(entry=>entry\.action===name\)\|\|null/);
  assert.match(page,/\{canDo\('Approve'\)&&<button className="je-primary-action" onClick=\{\(\)=>onAction\(journal,'Approve'\)\}>Publish journal<\/button>\}/);
  assert.match(page,/\{canDo\('Reject'\)&&<button className="je-danger-action" onClick=\{\(\)=>setRejectOpen\(true\)\}>Reject<\/button>\}/);
  assert.match(page,/\{canDo\('Submit for Approval'\)&&<button className="je-primary-action" onClick=\{\(\)=>onAction\(journal,'Submit for Approval'\)\}>/,'a draft submits for approval from the primary button');
  assert.match(page,/\{canDo\('Approve'\)&&<button className="je-primary-action" onClick=\{\(\)=>onAction\(journal,'Approve'\)\}>Publish journal<\/button>\}/,'a pending journal publishes from the primary button');
  assert.match(css,/\.je-detail-actions\{/);
});

test('publishing is a lifecycle step the engine performs once',()=>{
  assert.match(page,/next==='Approve'\?'Approved'/);
  assert.match(page,/if\(next==='Approve'\)assertOpenPeriod\(j\.date\)/);
  assert.match(page,/postToLedger\(base,'Journal Transaction','journal-transaction:'\+base\.id\)/);
  assert.match(page,/publishedBy:'Admin',publishedAt:stamp,postedBy:'Admin',postedAt:stamp/);
});

test('rejecting needs a reason and records who rejected it and when',()=>{
  assert.match(page,/onAction\(journal,'Reject',\{reason:rejectReason\}\)/);
  assert.match(page,/if\(target==='Rejected'&&!String\(payload\.reason\|\|''\)\.trim\(\)\)\{setError\('Enter a reason for rejecting this transaction\.'\);return\}/);
  assert.match(page,/rejectedBy:'Admin',rejectedAt:stamp,rejectionReason:payload\.reason/);
  assert.match(page,/Reason for rejection/);
});

test('reversal is confirmed, linked and makes the original single-use',()=>{
  assert.match(page,/reversalRecord\(j,payload\.date,payload\.reason\)/);
  assert.match(domain,/export function reversalRecord\(record=\{\},date='',reason=''\)/);
  assert.match(domain,/reversalOf:record\.id/);
  assert.match(page,/if\(current!=='Approved'\|\|!j\.ledgerJournalId\|\|j\.reversalOf\|\|j\.reversalJournalId/);
  assert.match(page,/status:'Reversed',reversalJournalId:r\.id/);
  assert.match(page,/reversalReason:payload\.reason/);
  assert.match(page,/className="je-reverse-dialog"/);
  assert.match(page,/The original journal remains in the audit trail and cannot be reversed again/);
});

test('a published transaction cannot be edited or deleted from the register',()=>{
  assert.match(domain,/export const canEditStatus=value=>\['Draft','Rejected'\]\.includes\(normaliseStatus\(value\)\)/);
  assert.match(page,/const canEditJournal=journal=>canEditStatus\(journal\.status\)/);
  assert.match(page,/if\(!\['Draft','Rejected'\]\.includes\(current\)\)return;/);
});

test('approval is re-checked in the lifecycle, not trusted from the row menu',()=>{
  assert.match(domain,/export const POSTING_STATUS='Approved';/);
  assert.match(domain,/export const postsToLedger=value=>normaliseStatus\(value\)===POSTING_STATUS;/);
  assert.match(page,/const duty=JOURNAL_ACTION_DUTY\[next\];/);
  assert.match(page,/if\(!\(JOURNAL_ACTIONS\[current\]\|\|\[\]\)\.includes\(next\)\)/,'the status must still offer the step');
  assert.match(page,/if\(duty&&!journalAllowed\(role,duty\)\)/,'the acting role must hold the duty');
  assert.match(page,/if\(next==='Approve'&&postsToLedger\(current\)\)\{setError\('This journal is already approved and posted\. Nothing was published twice\.'\);return\}/,'a journal that is already posted is never published twice');
  assert.match(page,/\{if\(normaliseStatus\(journal\.status\)!=='Draft'\)return true;const publisher=journalAllowed\(role,'post'\);if\(action==='Approve'\)return publisher;if\(action==='Submit for Approval'\)return !publisher;return true\}/,'an approver publishes their own draft instead of queueing it');
  assert.match(page,/je-detail-docs"><h3>\{viewMode==='business'\?'Documents':'Supporting Documents'\}<\/h3><div className="je-supporting-documents">/,'the documents block opens with one heading, its content directly beneath');
  assert.match(page,/:!journal\.automatic&&<p className="je-docs-empty"><IconPaperclip size=\{14\}\/>No documents attached yet\. Attachments uploaded with this journal will appear here\.<\/p>/,'an empty attachment list is one quiet line, never a second heading');
  assert.ok(!page.includes('<h3>No supporting documents</h3>'),'the second heading is gone');
  assert.match(css,/\.je-docs-empty\{display:flex;align-items:center;gap:7px;margin:0;color:#667085;font-size:12px\}/,'and it renders at the standard body size');
  assert.match(css,/\.je-timeline-body\{flex:1;min-width:0;padding-top:7px/,'the event text lines up with its mark');
  assert.match(css,/\.je-timeline>li:not\(:last-child\)::before\{content:"";position:absolute;left:19\.5px/,'the rail runs through the centre of the marks');
});

test('an entry that already owns a posting is never posted twice',()=>{
  assert.match(page,/if\(next==='Approve'&&j\.ledgerJournalId\)\{setError\('This journal already owns a ledger posting\. Nothing was posted twice\.'\);return\}/);
  assert.match(page,/postToLedger\(base,'Journal Transaction','journal-transaction:'\+base\.id\)/,'the engine token stays the second guard');
});

test('the audit trail states who submitted, approved, rejected and posted, and when',()=>{
  assert.match(page,/const timeline=journalTimeline\(journal\)/,'the panel is built from the one timeline helper');
  assert.match(page,/<ol className="je-timeline">/,'and renders as a timeline');
  assert.match(page,/<div className="je-timeline-panel">\{\(\(\)=>\{const timeline=journalTimeline\(journal\)/,'the timeline keeps its own panel class, so the legacy je-audit paragraph rules cannot rotate the text');
  assert.ok(!page.includes('<div className="je-audit">{(()=>{const timeline'),'the timeline no longer sits in the old je-audit wrapper');
  assert.match(css,/\.je-timeline-body>p\{display:block;/,'the sentence is a block, never a flex row');
  assert.match(page,/<TimelineMark kind=\{entry\.kind\}\/>/,'each event carries its own mark');
  assert.match(page,/<p><b className="je-timeline-actor">\{entry\.actor\}<\/b> \{entry\.from&&entry\.to\?<>changed the status from <StatusBadge value=\{entry\.from}\/> to <StatusBadge value=\{entry\.to}\/><\/>:entry\.text\}<\/p>/,'the actor leads the sentence and a status change reads as two badges');
  assert.match(page,/<time dateTime=\{entry\.at\|\|undefined\}>\{entry\.when\}<\/time>/,'with how long ago underneath');
  assert.match(css,/\.je-timeline>li:not\(:last-child\)::before\{content:"";position:absolute;left:19\.5px/,'the rail connects the marks');
  assert.match(css,/\.je-timeline-mark\.is-approved\{background:#e6f7ee/,'and the tint states the outcome');
  assert.match(css,/\.je-timeline-mark\{position:relative;z-index:1;flex:0 0 40px;display:grid;place-items:center;width:40px;height:40px;border-radius:50%/,'the icon column is a fixed 40px circular badge');
  assert.match(css,/\.je-timeline>li\{position:relative;display:flex;gap:12px;padding-bottom:24px\}/,'events are 24px apart');
  assert.match(css,/\.je-timeline>li:not\(:last-child\)::before\{content:"";position:absolute;left:19\.5px;top:46px;bottom:6px;width:1px/,'a thin connector runs through the badge centres and stops before the next badge');
  assert.match(css,/\.je-timeline-actor\{color:#172033;font-weight:600;white-space:nowrap\}/,'a username is semibold and never wraps');
  assert.match(css,/\.je-timeline-body>p\.je-timeline-note\{margin-top:8px;padding:8px 10px;border:1px solid #eef1f6;border-radius:8px;background:#f8fafc/,'a reason sits in a subtle note box');
  assert.match(css,/\.je-timeline time\{display:block;margin-top:6px;color:#98a2b3;font-size:12px\}/,'the timestamp is small muted text under the sentence');
  assert.match(css,/\.je-detail-audit\{position:sticky;top:12px;padding:24px;border:1px solid #e1e6ed;border-radius:14px/,'the history card is 24px padded with a 14px radius');
  assert.match(css,/\.je-status-badge\.is-approved\{background:#e6f7ee;color:#157f4a\}/,'an approved badge is green');
  assert.match(css,/\.je-status-badge\.is-rejected\{background:#fdeaea;color:#b42318\}/,'a rejected badge is red');
  assert.match(css,/\.je-status-badge\.is-pending\{background:#eaf1ff;color:#2f6fed\}/,'a pending badge is blue');
  assert.match(css,/@media\(max-width:700px\)\{\.je-detail-audit\{padding:16px\}\}/,'the card relaxes its padding on a narrow screen');
});

test('a pending journal states every field the approver decides on',()=>{
  for(const label of ['Transaction Type','Transaction Name','Date','Pay From','Category','Amount','Organisation','Branch'])assert.ok(page.includes("['"+label+"'"),label+' is one of the fact rows');
  assert.ok(!page.includes("['Status',statusText("),'the status is not repeated in the field list, because the header carries it beside the journal id');
  assert.match(page,/journal\.simpleTransaction\?\[\['Transaction Type',display\.type,IconArrowsExchange\],\['Transaction Name',display\.name,IconFileText\]/);
  assert.match(page,/const display=journalRegisterDisplay\(journal,state\.accounts\)/,'the rows reuse the register projection instead of a second lookup');
  assert.match(page,/key=\{label\}><dt>\{Icon&&<Icon size=\{15\} stroke=\{1\.8\} aria-hidden="true"\/>\}\{label\}<\/dt><dd>\{value\|\|'—'\}<\/dd>/,'every row renders its label over its value');
});

test('the detail is one section with the audit log beside it and the impact folded away',()=>{
  assert.match(page,/className="je-detail-single"><div className="je-detail-main">/,'the record and the audit log share one section');
  assert.match(page,/<\/details><\/div><div className="je-detail-audit">/,'the audit log is the side column, and a div rather than an aside so the shell global aside rule cannot pin it');
  assert.match(page,/className="je-impact"><summary><span>View \{viewMode==='business'\?'Transaction Impact':'Accounting Impact'\}<\/span>/,'the accounting impact is an accordion');
  assert.match(page,/<\/summary><div className="je-impact-body"><table>/,'the double entry lives inside that accordion');
  assert.match(page,/className="je-detail-docs"><h3>\{viewMode==='business'\?'Documents':'Supporting Documents'\}<\/h3>/,'attachments sit under their own heading in the record column');
  assert.doesNotMatch(page,/\{tab==='Overview'/,'the four tabs are gone from the live detail');
  assert.match(css,/\.je-detail-single\{display:grid;grid-template-columns:minmax\(0,7fr\) minmax\(0,3fr\)/,'the record column takes 70% and the audit log 30%');
  assert.match(css,/\.je-detail-audit\{position:sticky/,'the audit column follows a long record');
  assert.match(css,/\.je-detail-facts>dl\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,'four fields to a line');
  assert.match(css,/@media\(max-width:1280px\)\{\.je-detail-facts>dl\{grid-template-columns:repeat\(3/,'three to a line on a smaller laptop');
  assert.match(css,/@media\(max-width:1050px\)\{\.je-detail-facts>dl\{grid-template-columns:repeat\(2/,'two to a line on a tablet');
  assert.match(css,/@media\(max-width:700px\)\{\.je-detail-facts>dl\{grid-template-columns:1fr\}\}/,'one to a line on a phone');
  assert.match(page,/\[\['Transaction Type',display\.type,IconArrowsExchange\],\['Transaction Name',display\.name,IconFileText\]/,'every field row carries its own icon');
  assert.match(page,/<dt>\{Icon&&<Icon size=\{15\} stroke=\{1\.8\} aria-hidden="true"\/>\}\{label\}<\/dt>/,'and the icon is rendered beside the label');
  assert.match(page,/je-detail-facts"><h3>\{viewMode==='business'\?'Summary':'Journal details'\}<\/h3>\{\(\(\)=>\{/,'the details card opens with its heading');
  assert.match(page,/\}\)\(\)\}<section className="je-detail-docs">/,'Supporting Documents sits inside the Journal details card');
  assert.match(page,/je-permission-note">\{?<IconLock/,'a pending journal tells an unauthorised role who can publish it');
  assert.match(css,/@media\(max-width:1050px\)\{\.je-detail-single\{grid-template-columns:1fr\}/,'and the two columns stack on a narrow screen');
});
