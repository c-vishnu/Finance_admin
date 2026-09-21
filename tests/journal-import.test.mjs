import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPORT_HEADERS, journalImportAmount, journalImportDate, journalImportTemplate, parseJournalCSV, planJournalImport} from '../src/journal-import.js';

const accounts=[{code:'1100',name:'Accounts Receivable'},{code:'4100',name:'Subscription Income'}];
const csv=(...lines)=>['Voucher,Date,Type,Account,Debit,Credit,Description,Narration',...lines].join('\n');

test('the journal CSV reader keeps quoted cells and rejects a file it cannot read',()=>{
  const rows=parseJournalCSV(csv('JV-1,2026-09-05,General Journal,1100,10.00,,"Deposit, first call",Note'));
  assert.equal(rows.length,1);
  assert.equal(rows[0].description,'Deposit, first call');
  assert.equal(rows[0].line,2,'the first data row is line 2, so a message can name the spreadsheet row');
  assert.equal(journalImportAmount('n/a'),0,'a cell with no digits reads as empty, not as a broken amount');
  assert.throws(()=>parseJournalCSV('Voucher,Date,Account\nJV-1,2026-09-05,"1100'),/unclosed quote/);
  assert.throws(()=>parseJournalCSV('Name,Amount\nA,1'),/needs Voucher, Date and Account columns/);
  assert.throws(()=>parseJournalCSV('Voucher,Date,Account\n'),/No journal lines found/);
});

test('dates and amounts are normalised into the shapes the journal store already uses',()=>{
  assert.equal(journalImportDate('2026-09-05'),'2026-09-05');
  assert.equal(journalImportDate('05/09/2026'),'2026-09-05','a day-first export is reordered, not rejected');
  assert.equal(journalImportDate('5.9.2026'),'2026-09-05');
  assert.equal(journalImportDate('September'),'');
  assert.equal(journalImportAmount('1,250.00'),125000,'amounts are read in rupees and held in paise');
  assert.equal(journalImportAmount(''),0);
  assert.ok(Number.isNaN(journalImportAmount('1.2.3')),'a cell that cannot be a number is reported rather than rounded');
});

test('one voucher becomes one balanced draft plan and every problem is named',()=>{
  const plans=planJournalImport(parseJournalCSV(csv(
    'JV-1,2026-09-05,General Journal,1100,1250.00,,Invoice raised,September renewal',
    'JV-1,2026-09-05,General Journal,4100,,1250.00,Subscription billed,',
    'JV-2,2026-09-06,General Journal,1100,500.00,,Deposit,',
    'JV-2,2026-09-06,General Journal,4100,,400.00,Cash received,',
  )),{accounts,types:['General Journal','Adjustment Journal'],floor:'2026-04-01'});
  assert.equal(plans.length,2,'rows are grouped by voucher');
  const [ready,broken]=plans;
  assert.equal(ready.voucher,'JV-1');
  assert.equal(ready.problem,'');
  assert.equal(ready.debit,125000);
  assert.equal(ready.credit,125000);
  assert.equal(ready.narration,'September renewal');
  assert.deepEqual(ready.lines.map(l=>l.account),['1100','4100']);
  assert.equal(ready.lines[0].debit,'1250.00');
  assert.equal(broken.problem,'Debit and credit must match: 500.00 Dr against 400.00 Cr.');
});

test('an account is resolved by code, by name or by the leading code of one cell',()=>{
  const plans=planJournalImport(parseJournalCSV(csv(
    'JV-1,2026-09-05,General Journal,1100,10.00,,By code,',
    'JV-1,2026-09-05,General Journal,Subscription Income,,10.00,By name,',
  )),{accounts,types:['General Journal']});
  assert.equal(plans[0].problem,'');
  assert.deepEqual(plans[0].lines.map(l=>l.accountName),['Accounts Receivable','Subscription Income']);
  const leading=planJournalImport(parseJournalCSV(csv(
    'JV-1,2026-09-05,General Journal,1100 Accounts Receivable,10.00,,Pasted label,',
    'JV-1,2026-09-05,General Journal,4100 Subscription Income,,10.00,Pasted label,',
  )),{accounts,types:['General Journal']});
  assert.equal(leading[0].problem,'');
  assert.deepEqual(leading[0].lines.map(l=>l.account),['1100','4100']);
});

test('a closed period, an unknown account and a one-sided line are all refused before anything is saved',()=>{
  const plans=planJournalImport(parseJournalCSV(csv(
    'JV-1,2026-01-05,General Journal,9999,10.00,,Old and unknown,',
    'JV-1,2026-01-05,General Journal,4100,,10.00,Old and unknown,',
  )),{accounts,types:['General Journal'],floor:'2026-04-01'});
  assert.match(plans[0].problem,/falls in a closed accounting period/);
  assert.match(plans[0].problem,/is not in the chart of accounts/);
  const both=planJournalImport(parseJournalCSV(csv('JV-1,2026-09-05,General Journal,1100,5.00,5.00,Both sides,','JV-1,2026-09-05,General Journal,4100,,10.00,',)),{accounts,types:['General Journal']});
  assert.match(both[0].problem,/enter either a debit or a credit, not both/);
  const single=planJournalImport(parseJournalCSV(csv('JV-1,2026-09-05,General Journal,1100,10.00,,Only one line,')),{accounts,types:['General Journal']});
  assert.match(single[0].problem,/needs at least two lines/);
});

test('the template is the header row plus the worked example the dialog offers',()=>{
  const template=journalImportTemplate();
  assert.deepEqual(template[0],IMPORT_HEADERS);
  assert.equal(template.length,3);
  assert.equal(template[1][0],template[2][0],'the example shows one balanced voucher across two rows');
});
