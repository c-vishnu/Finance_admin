import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/JournalEntriesPro.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8');
const picker = readFileSync(new URL('../src/JournalAccountPicker.jsx', import.meta.url), 'utf8');
const form = source.slice(source.indexOf('function JournalForm('), source.indexOf('function JournalDetail('));

test('create journal entry page follows the compact task-oriented header', () => {
  assert.ok(form.length > 2000, 'create form located');
  assert.match(form, /Create Journal Entry/);
  assert.doesNotMatch(form, /Journal number is generated after saving/);
  assert.match(form, /je-header-hint/);
  assert.match(form, /Organisation \*/);
  assert.match(form, /Branch \*/);
  assert.doesNotMatch(form, /Default organisation and branch for new lines/);
  assert.match(form, /Reference number <span className="je-optional">Optional<\/span>/);
});

test('journal metadata no longer spends a card on the generated number', () => {
  assert.doesNotMatch(form, /je-journal-number/);
  assert.doesNotMatch(form, /Generated automatically/);
  assert.doesNotMatch(form, /je-notes-card/);
  assert.doesNotMatch(form, /Reason &amp; Attachments/);
});

test('organisation and branch sit between the account and debit columns on each line', () => {
  assert.match(form, /<div className=\{'je-line head'\+\(showOrganizationColumn\?'':' no-organization'\)\+\(showBranchColumn\?'':' no-branch'\)\}><span>Account \*<\/span>\{showOrganizationColumn&&<span>Organisation \*<\/span>\}\{showBranchColumn&&<span>Branch \*<\/span>\}<span className="je-head-amount">Debit \(₹\)<\/span><span className="je-head-amount">Credit \(₹\)<\/span><span>Description<\/span><span\/><\/div>/);
  const row = form.slice(form.indexOf("className={'je-line'+(showOrganizationColumn"), form.indexOf('<div className="je-cell je-cell-action">'));
  const order = ['data-label="Account"','data-label="Organisation"','data-label="Branch"',"data-label={'Debit (₹)'}","data-label={'Credit (₹)'}",'data-label="Description"'];
  let previous = -1;
  for (const marker of order) {
    const at = row.indexOf(marker);
    assert.ok(at > previous, marker + ' follows the previous column');
    previous = at;
  }
});

test('per-line organisation and branch keep the existing name-based contract', () => {
  assert.match(form, /const updateLineOrganization=\(id,name\)=>/);
  assert.match(form, /lines:form\.lines\.map\(line=>line\.id===id\?\{\.\.\.line,organization:name,branch:branchName\}:line\)/);
  assert.match(form, /const lineBranchOptions=line=>/);
  assert.match(form, /onChange=\{event=>update\(line\.id,'branch',event\.target\.value\)\}/);
  assert.match(source, /branch:line\.branch,costCentre:line\.costCentre,description:line\.description/);
});

test('a line cannot hold both a debit and a credit', () => {
  assert.match(form, /disabled=\{Boolean\(line\.credit\)\}/);
  assert.match(form, /disabled=\{Boolean\(line\.debit\)\}/);
  assert.match(form, /Total Debit/);
  assert.match(form, /Total Credit/);
  assert.match(styles, /\.je-create \.je-lines-footer \.je-balance \{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.je-create \.je-balance-totals \{[^}]*justify-content:\s*flex-end/s);
  assert.match(form, /Debit equals credit/);
  assert.match(form, /Difference: \{money\(difference\)\}/);
});

test('accounts are picked through a searchable picker with recents and favourites', () => {
  assert.match(form, /<JournalAccountPicker/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /aria-activedescendant/);
  assert.match(picker, /Recent accounts/);
  assert.match(picker, /Favourite accounts/);
  assert.match(picker, /Search account by name, code or type/);
  assert.match(picker, /ArrowDown/);
  assert.match(picker, /Escape/);
  assert.doesNotMatch(picker, /<select/);
});

test('the add-line button sits beside the template menu and optional details stay collapsed', () => {
  const actions=form.slice(form.indexOf('className="je-lines-actions"'),form.indexOf('<div className="je-lines">'));
  assert.match(actions, /Use Template/);
  assert.match(actions, /Add Journal Line/);
  assert.match(form, /je-lines-footer/);
  assert.match(form, /Remove \{emptyCount\} empty/);
  assert.match(form, /je-add-line/);
  assert.match(form, /<details className="je-details">/);
  assert.match(form, /Additional details/);
  assert.match(form, /je-details-body/);
  assert.match(form, /<label>Reason \*<input type="text" value=\{form\.narration\}/);
  assert.match(form, /const submit=targetStatus=>\{setError\(''\);onCommit\(targetStatus\)\};/);
  assert.equal((form.match(/onClick=\{\(\)=>submit\('/g) || []).length, 4);
});

test('productivity features are available without touching journal storage', () => {
  assert.match(form, /Use Template/);
  assert.match(form, /je-template-menu/);
  assert.match(form, /Save template/);
  assert.doesNotMatch(form, /Duplicate Journal/);
  assert.doesNotMatch(form, /Reverse Journal/);
  assert.match(form, /RECURRENCE_OPTIONS/);
  assert.match(source, /const STORE='wayvida-manual-journals-v2';/);
  assert.match(source, /import \{CREATE_JOURNAL_TYPES,RECURRENCE_OPTIONS,allTemplates,postingChecks,recordRecentAccount,resolveTemplate,saveCustomTemplate\} from '\.\/journal-templates\.js';/);
});

test('the inline lock hint appears only for genuinely locked periods', () => {
  assert.doesNotMatch(form, /je-lock-alert/);
  assert.doesNotMatch(form, /Posting is unavailable for this period\./);
  assert.match(form, /dateLocked=\['PERIOD_HARD_LOCKED','PERIOD_APPROVAL_REQUIRED','PERIOD_CLOSING'\]\.includes\(periodCheck\.code\)/);
  assert.match(form, /\{dateLocked\?<><IconLock size=\{12\}\/>\{periodName\(form\.date\)\} is locked · posting unavailable/);
  assert.match(form, /je-date-locked/);
  assert.match(form, /je-inline-action/);
  assert.match(form, /Request unlock/);
  assert.match(form, /Accounting period: <strong>\{periodName\(form\.date\)\}<\/strong>/);
  assert.doesNotMatch(form, /periodError/);
  assert.doesNotMatch(form, /Accounting period not configured/);
  assert.doesNotMatch(form, /je-period-warning/);
});

test('posting is gated on balanced totals, chosen accounts and an open period only', () => {
  assert.match(form, /const canPost=difference===0&&totals\.debit>0&&periodCheck\.allowed;/);
  assert.match(form, /disabled=\{!canPost\}/);
  assert.match(form, /\{viewMode==='business'\?'Post adjustment':'Post journal'\}/);
  assert.match(form, /onClick=\{\(\)=>submit\('Posted'\)\}/);
});

test('the create page no longer blocks posting behind approval', () => {
  assert.doesNotMatch(form, /Approve this \$\{viewMode==='business'\?'adjustment':'journal'\} before posting\./);
  assert.doesNotMatch(form, /je-post-hint/);
  assert.doesNotMatch(form, /je-more-actions/);
  assert.doesNotMatch(form, /Submit for approval/);
  assert.doesNotMatch(form, />Cancel<\/button>/);
});

test('the accounting guards behind the redesigned page are untouched', () => {
  assert.match(source, /import \{validatePostingDate\} from '\.\/period-locking\.js';/);
  assert.match(source, /function validate\(\)\{const t=totals\(form\);if\(!form\.date\|\|!form\.narration\.trim\(\)\)return 'Date and notes are required\.'/);
  assert.match(source, /A journal line cannot contain both debit and credit\./);
  assert.match(source, /Journal is not balanced\. Difference/);
  assert.doesNotMatch(source, /Only an approved journal can be posted\./);
  assert.match(source, /targetStatus==='Posted'\?\{ledgerJournalId:postToLedger\(base\)\.id\}/);
  assert.match(source, /const postToLedger=\(record,source='Manual Journal'/);
  assert.match(source, /line\.branch,costCentre:line\.costCentre,description:line\.description/);
});

test('the stylesheet reflows to a mobile card list and keeps the seven column table', () => {
  assert.match(styles, /\.je-create \.je-line \{\n  grid-template-columns: minmax\(210px, 1\.4fr\) 170px 150px 130px 130px minmax\(150px, 1fr\) 42px !important;/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.je-create \.je-line\.head \{ display: none !important; \}/);
  assert.match(styles, /content: attr\(data-label\) !important/);
  assert.match(styles, /\.je-account-pop \{/);
  assert.match(styles, /\.je-create \.je-lines \{ overflow-x: auto !important; overflow-y: visible !important; \}/);
  assert.match(styles, /\.je-create \.je-line \.je-cell input, \.je-create \.je-line \.je-cell select \{/);
});

test('the posting context card is removed now that every line owns its organisation and branch', () => {
  assert.doesNotMatch(form, /Posting To/);
  assert.doesNotMatch(form, /je-posting-card/);
  assert.doesNotMatch(form, /je-posting-copy/);
  assert.doesNotMatch(form, /je-posting-picker/);
  assert.doesNotMatch(form, /applyPostingContext/);
  assert.doesNotMatch(form, /draftCompany|draftBranch/);
  assert.match(form, /const contextOrganizations=getAccessibleOrganizations\(\);/);
  assert.doesNotMatch(styles, /\.je-posting-card/);
  assert.doesNotMatch(styles, /\.je-posting-picker/);
});

test('organisation and branch are edited per line through the existing working-context data', () => {
  assert.match(form, /const updateLineOrganization=\(id,name\)=>/);
  assert.match(form, /const lineBranchOptions=line=>/);
  assert.match(form, /aria-label=\{'Organisation for line '\+\(index\+1\)\}/);
  assert.match(form, /aria-label=\{'Branch for line '\+\(index\+1\)\}/);
  assert.doesNotMatch(form, /postingRef/);
  assert.doesNotMatch(source, /useRef/);
});

test('the balance status is the only posting indicator left in the lines card', () => {
  assert.match(form, /je-balance-status/);
  assert.match(form, /Total Debit/);
  assert.match(form, /Total Credit/);
  assert.match(form, /Debit equals credit/);
  assert.match(form, /Difference: \{money\(difference\)\}/);
  assert.doesNotMatch(form, /je-conditions/, 'the date, period and account chips were removed');
  assert.doesNotMatch(form, /Date is valid|Period is open|Accounts are active/, 'the three check names are gone from the page');
  assert.doesNotMatch(styles, /\.je-conditions/);
  assert.match(form, /const blocking=checks\.find\(check=>!check\.ok\);/);
  assert.doesNotMatch(form, /je-checks/);
  assert.doesNotMatch(styles, /\.je-checks/);
});

test('the header carries date, type, reference and a plain reason input', () => {
  assert.match(form, /<label className="je-date-field">Date \*<input type="date"/);
  assert.match(form, /<label>\{typeField\} \*<select/);
  assert.match(form, /<label>Reference number <span className="je-optional">Optional<\/span><input/);
  assert.match(form, /<label>Reason \*<input type="text"/);
  assert.doesNotMatch(form, /<textarea/, 'the reason is a plain input, not a description box');
  assert.doesNotMatch(form, /form\.notes/, 'no new key is added to the stored journal record');
});

test('attachments share the lines footer row while Add Journal Line sits beside Use Template', () => {
  const tools=form.slice(form.indexOf('className="je-lines-footer"'),form.indexOf('<div className="je-balance">'));
  const actions=form.slice(form.indexOf('className="je-lines-actions"'),form.indexOf('<div className="je-lines">'));
  assert.match(actions, /Use Template/);
  assert.match(actions, /Add Journal Line/);
  assert.doesNotMatch(tools, /Add Journal Line/, 'the add-line button no longer sits in the tools row');
  assert.match(tools, /je-attach-button/);
  assert.match(tools, /Attach files/);
  assert.match(form, /\{form\.audit&&form\.audit\.some\(entry=>entry\.reason\)&&<details className="je-details">/);
  assert.match(form, /Approval comments/);
  assert.match(form, /je-approval-comments/);
  assert.doesNotMatch(form, /je-attachments-copy/, 'the attachments showcase is gone');
  assert.doesNotMatch(form, /je-upload-button/);
  assert.match(styles, /\.je-create \.je-approval-comments li \{/);
  assert.match(styles, /\.je-create \.je-lines-footer \.je-attachments \{/);
  assert.match(styles, /\.je-create \.je-attach-button \{/);
});

test('the organisation and branch columns appear only when the working context needs them', () => {
  assert.match(form, /const showOrganizationColumn=lineScope\.showOrgColumn;/);
  assert.match(form, /const showBranchColumn=lineScope\.showBranchColumn;/);
  assert.match(form, /\{showOrganizationColumn&&<div className="je-cell" data-label="Organisation">/);
  assert.match(form, /\{showBranchColumn&&<div className="je-cell" data-label="Branch">/);
  assert.match(form, /\{showOrganizationColumn&&<span>Organisation \*<\/span>\}/);
  assert.match(form, /\{showBranchColumn&&<span>Branch \*<\/span>\}/);
  assert.match(form, /className=\{'je-line'\+\(showOrganizationColumn\?'':' no-organization'\)\+\(showBranchColumn\?'':' no-branch'\)\}/);
  assert.match(styles, /\.je-create \.je-line\.no-organization \{ grid-template-columns: minmax\(210px, 1\.4fr\) 150px 130px 130px minmax\(150px, 1fr\) 42px !important;/);
  assert.match(styles, /\.je-create \.je-line\.no-branch \{ grid-template-columns: minmax\(210px, 1\.4fr\) 170px 130px 130px minmax\(150px, 1fr\) 42px !important;/);
  assert.match(styles, /\.je-create \.je-line\.no-organization\.no-branch \{ grid-template-columns: minmax\(210px, 1\.4fr\) 130px 130px minmax\(150px, 1fr\) 42px !important;/);
  assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 1180px\)/);
  assert.match(styles, /\.je-create \.je-line\.head > \.je-head-amount \{ text-align: right !important; \}/);
  assert.match(styles, /\.je-create \.je-line > \.je-cell-amount input \{/);
  assert.doesNotMatch(styles, /nth-child\(4\) input/, 'the amount columns are addressed by class, not by position');
});

test('line organisation and branch stay aligned with the working context', () => {
  assert.match(form, /const branchNamesFor=organization=>getBranchesForOrganisation\(organization,contextOrganizations\)\.map\(branch=>branch\.name\);/);
  assert.match(form, /const lineScope=getScopeVisibility\(\{organisations:contextOrganizations,label:'Journal lines'\}\);/,'the line columns come from the shared organisation/branch scope module');
  assert.match(form, /const lineBranchOptions=line=>branchNamesFor\(line\.organization\);/);
  assert.match(form, /useEffect\(\(\)=>\{const aligned=form\.lines\.map\(alignLine\);/);
  assert.match(form, /branch:showBranchColumn&&branchNames\.includes\(line\.branch\)\?line\.branch:branchNames\[0\]/);
  assert.match(form, /organization=showOrganizationColumn&&getBranchesForOrganisation\(line\.organization,contextOrganizations\)\.length\?line\.organization:fallbackOrganization/);
  assert.match(form, /Posting to <b>\{contextOrganizations\[0\]\?\.name\|\|'—'\}<\/b>/);
  assert.doesNotMatch(form, /\[line\.branch,\.\.\.list\]/, 'the branch dropdown can no longer surface another organisation branch');
});
test('the sticky footer now holds only the save action and Post journal', () => {
  const footer = form.slice(form.indexOf('<footer>'), form.indexOf('<\/footer>'));
  assert.doesNotMatch(footer, /Cancel<\/button>/, 'the cancel action is gone');
  assert.doesNotMatch(footer, /je-post-hint/, 'the footer hint is gone');
  assert.doesNotMatch(footer, /je-more-actions/, 'the more-actions menu is gone');
  assert.ok(footer.indexOf('Post journal') > footer.indexOf('Save draft'), 'the primary action closes the bar');
  assert.match(styles, /\.je-create > footer \{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(styles, /je-post-hint/);
  assert.doesNotMatch(styles, /je-more-actions/);
});

test('the attach control and the posting totals share one footer row', () => {
  const footer=form.slice(form.indexOf('<div className="je-lines-footer">'),form.indexOf('{error&&<div className="je-error">'));
  const attach=footer.indexOf('je-attachments');
  const balance=footer.indexOf('je-balance');
  assert.ok(attach > -1, 'the attach control sits in the footer row');
  assert.ok(balance > attach, 'the posting totals sit in the same row after the attach control');
  const totals=footer.indexOf('je-balance-totals');
  const status=footer.indexOf('je-balance-status');
  assert.ok(status > totals, 'the balance status follows the totals inside the same block');
  assert.ok(footer.indexOf('je-clear-empty') > attach, 'the cleanup action stays in the same row');
  assert.doesNotMatch(form, /je-lines-tools/, 'the tools row no longer stacks above the balance block');
  const attachBlock=form.slice(form.indexOf('<div className="je-attachments">'),form.indexOf('je-selected-files'));
  assert.ok(attachBlock.indexOf('je-attach-button') < attachBlock.indexOf('je-attach-note'), 'the attach button leads its file-type hint');
  assert.match(styles, /\.je-create \.je-lines-footer \{[^}]*justify-content:\s*flex-end/s);
  assert.match(styles, /\.je-create \.je-lines-footer \.je-attachments \{[^}]*margin-right:\s*auto/s);
  assert.match(styles, /\.je-create \.je-add-line \{[^}]*border:\s*1px solid/s);
});
