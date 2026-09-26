import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const form=readFileSync(new URL('../src/SimpleTransactionForm.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/record-transaction.css',import.meta.url),'utf8');
const domain=readFileSync(new URL('../src/simple-journal-transaction.js',import.meta.url),'utf8');

test('the create action opens the plain-language transaction page with a working back control',()=>{
 assert.match(page,/if\(mode==='create'\)return <SimpleTransactionForm/);
 assert.match(page,/const openCreate=\(\)=>\{setForm\(null\);setError\(''\);setMode\('create'\)\}/);
 assert.match(form,/aria-label="Back to Journal Entries" onClick=\{onBack\}/);
 assert.match(form,/<h1>\{editing\?'Edit transaction':'Record Transaction'\}<\/h1>/);
});

test('the form asks what happened before it asks for the money detail',()=>{
 const order=['<Field label="Transaction type *"','<Field label="Transaction name *"','<Field label="Date *"','<Field label="Amount *"','<details className="rt-details">','<div className="rt-actions">'];
 const positions=order.map(piece=>form.indexOf(piece));
 assert.ok(positions.every(position=>position>=0),'every section is present');
 assert.ok(positions.every((position,index)=>index===0||position>positions[index-1]),'the sections stay in order');
});

test('the transaction type is a dropdown and reveals only its own fields',()=>{
 assert.match(form,/<select aria-label="Transaction type" value=\{type\}/);
 assert.match(form,/\{type==='expense'&&<>/);
 assert.match(form,/\{type==='income'&&<>/);
 assert.match(form,/\{type==='transfer'&&<>/);
 assert.match(form,/\{type==='customer_payment'&&<>/);
 assert.match(form,/\{type==='vendor_payment'&&<>/);
 for(const label of ['Pay From *','Deposit To *','From Account *','To Account *','Category *','Customer *','Vendor *','Invoice','Bill','Amount *'])assert.ok(form.includes('label="'+label+'"'),label);
 assert.match(form,/e\.g\. Bought office printer/);
 assert.match(form,/<Field label="Description"><input value=\{state\.description\}/,'Description is a single-line input');
 assert.match(form,/<Field label="Reference number"><input value=\{state\.reference\}/);
 assert.match(form,/<div className="rt-field"><span>Attachment<\/span><label className="rt-attach-button">/,'description, reference and attachment share one row');
 assert.match(form,/placeholder="Reference number"/);
});

test('the normal journey never shows a debit or a credit column or field',()=>{
 assert.ok(!form.includes('Debit'),'no Debit label');
 assert.ok(!form.includes('Credit'),'no Credit label');
 assert.ok(!form.includes('journal line'),'no journal-line vocabulary');
 assert.match(form,/<button type="button" className="rt-accounting-trigger" aria-expanded=\{showEntry\} aria-describedby="rt-accounting-tip"/);
 assert.match(form,/<span className="rt-accounting-tip" id="rt-accounting-tip" role="tooltip">/,'the entry is a tooltip, not a disclosure');
 assert.match(css,/\.rt-accounting-tip\{position:absolute;left:0;bottom:calc\(100% \+ 8px\)/,'the tooltip floats above its trigger');
});

test('a settlement shows the invoice or bill facts before it is saved',()=>{
 assert.match(form,/function DocumentFacts\(\{kind,row,balance\}\)/);
 assert.match(form,/<DocumentFacts kind="Invoice" row=\{selected\}/);
 assert.match(form,/<DocumentFacts kind="Bill" row=\{selected\}/);
 for(const label of ['number','date','total'])assert.ok(form.includes('{kind} '+label),label+' is stated');
 assert.match(form,/<dt>Current balance<\/dt>/);
});

test('organisation and branch reuse the working context instead of a second model',()=>{
 assert.match(form,/getAccessibleOrganizations\(\)/);
 assert.match(form,/getCurrentOrganizationContext\(\)/);
 assert.match(form,/const showOrganisation=organisations\.length>1,showBranch=branches\.length>1;/);
 assert.match(form,/const chooseOrganisation=id=>setState\(current=>\(\{\.\.\.current,organizationId:id,branchId:organisations\.find\(row=>row\.id===id\)\?\.branches\?\.\[0\]\?\.id\|\|''\}\)\)/);
 assert.match(form,/branches\.map\(row=><option key=\{row\.id\} value=\{row\.id\}>\{row\.name\}<\/option>\)/);
 assert.match(form,/<input value=\{branch\?\.name\|\|'Not selected'\} readOnly\/>/);
});

test('an attachment can be added and removed without leaving the form',()=>{
 assert.match(form,/const readAttachments=files=>Promise\.all/);
 assert.match(form,/<label className="rt-attach-button">/);
 assert.match(form,/aria-label=\{`Remove \$\{fileName\}`\}/);
 assert.match(css,/\.rt-selected-files/);
});

test('saving offers draft and submit and, for an approver, publish',()=>{
 assert.match(form,/onClick=\{\(\)=>commit\('Draft'\)\}>Save draft<\/button>/);
 assert.match(form,/onClick=\{\(\)=>commit\('Pending Approval'\)\}>Submit for approval<\/button>/);
 assert.match(form,/\{journalAllowed\(role,'post'\)&&<button type="button" className="primary" onClick=\{\(\)=>commit\('Approved'\)\}>Publish now<\/button>\}/);
 assert.match(page,/function saveSimple\(\{payload,target,document\}\)/);
});

test('one Simple / Advanced toggle switches between the two editors',()=>{
 assert.match(form,/export function ModeToggle\(\{mode='simple',onSimple,onAdvanced\}\)/);
 assert.match(form,/<div className="rt-mode-toggle" role="group" aria-label="Entry mode">/);
 assert.match(form,/aria-pressed=\{mode==='simple'\}/);
 assert.match(form,/aria-pressed=\{mode==='advanced'\}/);
 assert.match(form,/<ModeToggle mode="simple" onAdvanced=\{onAdvanced\}\/>/);
 assert.match(css,/\.rt-mode-toggle\{[^}]*margin-left:auto/);
 assert.match(css,/\.rt-mode-toggle button\.active\{/);
 assert.match(page,/import SimpleTransactionForm,\{ModeToggle\} from '\.\/SimpleTransactionForm\.jsx';/);
 assert.match(page,/<ModeToggle mode="advanced" onSimple=\{onSimple\}\/>/);
 assert.match(page,/if\(mode==='advanced'\)return <JournalForm/);
 assert.match(page,/onSimple=\{\(\)=>\{setForm\(null\);setError\(''\);setMode\('create'\)\}\}/);
});

test('a transaction type is chosen from the start and the fields run three to a line',()=>{
 assert.match(form,/transactionType:TRANSACTION_TYPES\[0\]\[0\],name:'',date:localToday\(\)/);
 assert.doesNotMatch(form,/<option value="">Select a transaction type<\/option>/,'the type is always chosen');
 assert.doesNotMatch(form,/rt-review/,'the Wayvida will record card is gone');
 assert.doesNotMatch(form,/rt-layout/,'the two-column page is gone');
 assert.match(form,/<form className="rt-shell" onSubmit=\{event=>\{event\.preventDefault\(\);commit\('Draft'\)\}\}>/);
 assert.match(form,/<div className="rt-form-card">/);
 assert.match(form,/<footer className="rt-footer">/);
 assert.ok(form.indexOf('<footer className="rt-footer">')<form.indexOf('<div className="rt-actions">'),'the actions sit in the static footer, not in a side card');
 assert.match(css,/\.rt-form-card\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'three fields to a line');
 assert.match(css,/\.rt-footer\{position:sticky;bottom:0/,'the actions pin to the viewport while the page scrolls');
 assert.match(css,/\.rt-actions\{[^}]*margin-left:auto/);
 assert.match(css,/@media\(max-width:1050px\)\{\.rt-form-card\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
 assert.match(css,/@media\(max-width:700px\)\{\.rt-form-card\{grid-template-columns:1fr\}/);
});

test('editing reopens the simple form for a simple record and the editor for an advanced one',()=>{
 assert.match(page,/const openEdit=record=>\{setForm\(record\);setDetail\(null\);setError\(''\);setMode\(record\.simpleTransaction\?'create':'advanced'\)\}/);
 assert.match(page,/onEdit=\{\(\)=>openEdit\(detail\)\}/);
});

test('every required journal field sits directly under one Journal details section',()=>{
 assert.match(form,/<div className="rt-section-head">\n     <h3>Journal details<\/h3>/,'the page leads with the section heading');
 assert.match(css,/\.rt-section-head\{grid-column:1\/-1;/,'the heading spans the whole field grid');
 for(const label of ['Transaction type *','Transaction name *','Date *','Amount *'])assert.ok(form.includes('label="'+label+'"'),label+' is visible without opening anything');
 assert.match(form,/label="Description"/,'only the optional extras stay behind Additional details');
});

test('the form asks for the organisation and branch before the transaction itself',()=>{
 const order=['label="Organisation *"','label="Branch *"','<Field label="Transaction type *"','<Field label="Transaction name *"','<Field label="Date *"','<Field label="Amount *"','<details className="rt-details">'];
 const positions=order.map(piece=>form.indexOf(piece));
 assert.ok(positions.every(position=>position>=0),'every field is present');
 assert.ok(positions.every((position,index)=>index===0||position>positions[index-1]),'Organisation, Branch, the transaction and the amount stay in that order');
 assert.ok(form.indexOf('label="Amount *"')>form.indexOf('label="Category *"'),'the dynamic accounting fields sit above the amount');
 assert.ok(form.indexOf('label="Category *"')>form.indexOf('<Field label="Date *"'),'and below the date');
});

test('the transaction type is stored as a stable value rather than its display text',()=>{
 assert.match(domain,/export const TRANSACTION_TYPES=\[\['expense','Expense'\],\['income','Income'\],\['transfer','Transfer'\],\['customer_payment','Customer Payment'\],\['vendor_payment','Vendor Payment'\]\];/);
 assert.match(form,/\{TRANSACTION_TYPES\.map\(\(\[value,label\]\)=><option key=\{value\} value=\{value\}>\{label\}<\/option>\)\}/);
 assert.match(form,/transactionType:TRANSACTION_TYPES\[0\]\[0\]/,'a blank form keeps the stable value');
});
