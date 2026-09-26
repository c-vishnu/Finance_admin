import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {journalRecordAmount} from '../src/journal-register-display.js';

const source=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/journal-entries.css',import.meta.url),'utf8');
const simple=readFileSync(new URL('../src/SimpleTransactionForm.jsx',import.meta.url),'utf8');

test('journal register presents the nine transaction columns and no debit or credit column',()=>{
 assert.match(source,/\['Journal ID & Date','Transaction details','Account','Transaction Type','Amount','Status','Organisation','Branch','Actions'\]/);
 assert.match(source,/<td className="je-details-cell">\{display\.name\}<small>\{j\.reference\|\|'No reference'\}<\/small><\/td>/,'the name and its reference share one stacked cell');
 assert.match(source,/<td className="je-id-cell"><button type="button" className="je-link" onClick=\{\(\)=>onDetail\(j\)\}>\{j\.number\}<\/button><small>\{fmtDate\(j\.date\)\}<\/small><\/td>/,'the journal id and its date share one stacked cell');
 assert.match(source,/<th>Account<\/th><th>Debit<\/th><th>Credit<\/th>/,'the double entry stays in its own detail view');
 assert.match(source,/colSpan=\{9\}/,'the empty state spans the nine columns');
 assert.match(source,/<td>\{fmtDate\(j\.date\)\}<\/td>/);
 assert.match(source,/<td>\{display\.account\}<\/td>/);
 assert.match(source,/<td>\{display\.type\}<\/td>/);
 assert.match(source,/<td><b>\{money\(journalRecordAmount\(j\)\)\}<\/b><\/td>/);
 assert.match(source,/<td><Status value=\{statusText\(display\.status,viewMode==='business'\)\}\/><\/td>/);
});

test('the amount in the table is the user-facing transaction amount',()=>{
 assert.equal(journalRecordAmount({amount:850000,lines:[{debit:8500,credit:''}]}),850000);
 assert.equal(journalRecordAmount({lines:[{debit:8500,credit:''},{debit:'',credit:8500}]}),850000);
 assert.equal(journalRecordAmount({lines:[{debit:'',credit:25000}]}),2500000);
 assert.equal(journalRecordAmount({}),0);
});

test('journal register respects the selected global scope',()=>{
 assert.match(source,/selectedPairs=new Set\(getAccessibleOrganizations\(\)/);
 assert.match(source,/const scopeKey=value=>String\(value\?\?''\)\.trim\(\)\.toLowerCase\(\)\.replace\(\/\\s\+branches\?\$\/,''/,'the branch label spelling is tolerated');
 assert.match(source,/selectedPairs\.has\(scopePair\(line\.organization,line\.branch\)\)/);
 assert.match(source,/const inScope=j=>\{const lines=j\.lines\|\|\[\];if\(!lines\.length\)return true;/);
});

test('the register searches id, name and reference and filters the six useful dimensions',()=>{
 assert.match(source,/placeholder="Search journal ID, transaction name or reference…"/);
 assert.match(source,/\[j\.number,j\.reference,display\.name,display\.type,display\.account,display\.party,display\.category\]\.join\(' '\)\.toLowerCase\(\)\.includes\(searchText\)/);
 assert.match(source,/const typeOptions=\['All types'/);
 assert.match(source,/const accountOptions=\[\['All accounts','All accounts'\]/);
 assert.match(source,/const organisationOptions=\['All organisations'/);
 assert.match(source,/const branchOptions=\['All branches'/);
 assert.match(source,/<label>Status<select aria-label="Transaction status"/);
 assert.match(source,/status==='All statuses'\|\|display\.status===status/);
 assert.match(source,/<label>Date range<select aria-label="Filter by date range"/);
});

test('the list shows ten transactions to a view with a pagination footer',()=>{
 assert.match(source,/const PAGE_SIZE=10;/,'the register holds ten rows to a view');
 assert.match(source,/const \[page,setPage\]=useState\(1\);/);
 assert.match(source,/const pageCount=Math\.max\(1,Math\.ceil\(filtered\.length\/PAGE_SIZE\)\);/);
 assert.match(source,/const visible=filtered\.slice\(\(current-1\)\*PAGE_SIZE,current\*PAGE_SIZE\);/);
 assert.match(source,/tbody>\{visible\.map\(j=>\{const display=journalRegisterDisplay/);
 assert.match(source,/Showing \{\(current-1\)\*PAGE_SIZE\+1\}&ndash;\{Math\.min\(current\*PAGE_SIZE,filtered\.length\)\} of \{filtered\.length\}/);
 assert.match(source,/aria-label="Previous page" disabled=\{current<=1\}/);
 assert.match(source,/aria-label="Next page" disabled=\{current>=pageCount\}/);
 assert.match(source,/useEffect\(\(\)=>\{setPage\(1\)\},\[query,status,typeFilter,accountFilter,orgFilter,branchFilter,fromDate,toDate\]\)/,'the filters return to the first page');
 assert.match(source,/const rows=\[\['Journal ID & Date'/,'the export still writes every filtered row');
});

test('the list keeps a left and right gutter inside its card',()=>{
 assert.match(source,/<td className="je-id-cell">/);
 assert.match(css,/\.je-page \.je-card \.je-table-wrap th:first-child,\.je-page \.je-card \.je-table-wrap td:first-child\{padding-left:24px!important\}/,'the first cell carries the register 24px inset');
 assert.match(css,/\.je-page \.je-card \.je-table-wrap th:last-child,\.je-page \.je-card \.je-table-wrap td:last-child\{min-width:84px!important;width:84px!important;padding-right:24px!important\}/,'the last cell keeps room for the row menu');
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?padding-left:12px!important/,'the gutter narrows on small screens');
});

test('row actions follow the status and the acting role',()=>{
 assert.match(source,/const role=reviewRole\(viewMode\)/);
 assert.match(source,/const reviewRole=viewMode=>viewMode==='business'\?'Admin':'Accountant'/);
 assert.match(source,/JOURNAL_ACTIONS\[normaliseStatus\(journal\.status\)\]\|\|\['Preview'\]/);
 assert.match(source,/\.filter\(action=>\{const duty=JOURNAL_ACTION_DUTY\[action\];return !duty\|\|journalAllowed\(role,duty\)\}\)/);
 assert.match(source,/entries=actionEntries\(j,role,16\)/);
});

test('journal register retains filters, actions, import and export',()=>{
 assert.match(source,/matchDateRange/);
 assert.match(source,/onImport/);
 assert.match(source,/Export/);
 assert.match(source,/More actions for/);
 assert.match(simple,/<h1>\{editing\?'Edit transaction':'Record Transaction'\}<\/h1>/);
});
