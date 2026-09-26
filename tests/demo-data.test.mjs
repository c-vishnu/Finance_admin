import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapDemoData,DEMO_MARKER,DEMO_VERSION} from '../src/demo-data.js';
import {KEY,reports} from '../src/invoice-engine.js';
import {MANUAL_JOURNAL_KEY,TRANSACTION_STATUSES,TRANSACTION_TYPES} from '../src/simple-journal-transaction.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values}};

test('demo bootstrap fills every implemented data area with linked records',()=>{
 const storage=memory(),result=bootstrapDemoData(storage),accounting=JSON.parse(storage.getItem(KEY));
 assert.equal(result.loaded,true);assert.ok(accounting.invoices.length>=2);assert.ok(accounting.receipts.length>=1);assert.ok(accounting.purchaseBills.length>=1);assert.ok(accounting.journals.length>=5);assert.equal(reports(accounting).debit,reports(accounting).credit);
 for(const key of ['wayvida-customers','finance-erp-items','wayvida-vendors-v1','wayvida-sales-orders','wayvida-purchase-orders-v1','wayvida-purchase-bills-v1','wayvida-goods-receipts-v1','wayvida-vendor-payments-v1','wayvida-debit-notes-v1','wayvida-banking-v1','wayvida-operations-v1',MANUAL_JOURNAL_KEY])assert.ok(JSON.parse(storage.getItem(key)),key);
});

test('the journal register arrives with a transaction for every status and every type',()=>{
 const storage=memory();bootstrapDemoData(storage);
 const rows=JSON.parse(storage.getItem(MANUAL_JOURNAL_KEY));
 assert.ok(rows.length>=5,'the register is seeded, not empty');
 for(const row of rows){
  assert.match(row.number,/^(JE|REV-JE)-2026-\d{6}$/);
  assert.equal(row.lines.reduce((total,line)=>total+Number(line.debit||0),0),row.lines.reduce((total,line)=>total+Number(line.credit||0),0),row.number+' is balanced');
  assert.ok(TRANSACTION_STATUSES.includes(row.status),row.status);
  assert.ok(TRANSACTION_TYPES.some(([value])=>value===row.simpleTransaction.transactionType),row.number+' names a transaction type');
 }
 const statuses=new Set(rows.map(row=>row.status));
 for(const status of TRANSACTION_STATUSES)assert.ok(statuses.has(status),status+' is represented');
});

test('only a published demo transaction owns a posting, and a reversal keeps its original',()=>{
 const storage=memory();bootstrapDemoData(storage);
 const rows=JSON.parse(storage.getItem(MANUAL_JOURNAL_KEY)),accounting=JSON.parse(storage.getItem(KEY));
 const posted=new Set(accounting.journals.map(journal=>journal.id));
 for(const row of rows){
  if(['Draft','Pending Approval','Rejected','Cancelled'].includes(row.status))assert.ok(!row.ledgerJournalId,row.number+' stays out of the ledger until it is approved');
  else assert.ok(posted.has(row.ledgerJournalId),row.number+' has its posting');
 }
 const reversed=rows.find(row=>row.status==='Reversed'),reversal=rows.find(row=>row.reversalOf===reversed.id);
 assert.ok(reversed&&reversal,'the reversed transaction keeps its reversal record');
 assert.ok(posted.has(reversal.ledgerJournalId));
});

test('the demo settles one customer invoice and one vendor bill through their own engines',()=>{
 const storage=memory();bootstrapDemoData(storage);
 const accounting=JSON.parse(storage.getItem(KEY)),bills=JSON.parse(storage.getItem('wayvida-purchase-bills-v1'));
 assert.ok((accounting.payments||[]).length>=1,'a customer payment exists');
 assert.ok((accounting.vendorPayments||[]).length>=2,'a vendor payment exists');
 const paid=bills.filter(bill=>bill.paidAmount>0);
 assert.ok(paid.length>=1,'the vendor payment moved the bill balance');
 assert.ok(paid.every(bill=>bill.paidAmount<=bill.total),'no bill is overpaid');
});

test('demo bootstrap is idempotent and preserves existing module data',()=>{
 const storage=memory();storage.setItem('wayvida-customers',JSON.stringify([{id:'user-record'}]));bootstrapDemoData(storage);const before=storage.getItem(KEY);assert.equal(bootstrapDemoData(storage).loaded,false);assert.equal(storage.getItem(KEY),before);assert.deepEqual(JSON.parse(storage.getItem('wayvida-customers')),[{id:'user-record'}]);assert.equal(storage.getItem(DEMO_MARKER),String(DEMO_VERSION));
});

/* A stored ledger set that has lost its bank account used to abort the demo
   before the marker was written, so the browser reported "Wayvida Books could
   not start." on that load and on every load after it. */
test('a stored ledger set without the bank account still finishes the demo bootstrap',()=>{
 const storage=memory();bootstrapDemoData(storage);
 const accounting=JSON.parse(storage.getItem(KEY));
 accounting.journals=accounting.journals.filter(journal=>!String(journal.token||'').startsWith('sample-'));
 accounting.accounts=accounting.accounts.filter(account=>account.code!=='1010');
 storage.setItem(KEY,JSON.stringify(accounting));storage.setItem(DEMO_MARKER,'0');
 assert.equal(bootstrapDemoData(storage).loaded,true,'the demo completes instead of throwing before it writes its marker');
 assert.equal(storage.getItem(DEMO_MARKER),String(DEMO_VERSION),'the marker is written, so the next load does not repeat the failure');
 const rescued=JSON.parse(storage.getItem(KEY)).accounts.find(account=>account.code==='1010');
 assert.deepEqual([rescued.active,rescued.isGroup,rescued.type],[true,false,'Assets'],'and the system bank ledger is restored for the postings that need it');
});

/* The same class of failure as the missing bank ledger, one ledger along: a
   stored Accounts Payable that the reader deactivated or turned into a heading
   made the demo post against a ledger the engine refuses, so the browser
   reported "Wayvida Books could not start." before it could write its marker. */
test('a stored ledger set whose Accounts Payable cannot post still finishes the demo bootstrap',()=>{
 const storage=memory();bootstrapDemoData(storage);
 const accounting=JSON.parse(storage.getItem(KEY));
 accounting.accounts=accounting.accounts.map(account=>account.code==='2000'?{...account,active:false,isGroup:true}:account);
 accounting.journals=accounting.journals.filter(journal=>!String(journal.token||'').startsWith('demo-banking:'));
 storage.setItem(KEY,JSON.stringify(accounting));
 storage.values.delete('wayvida-banking-v1');
 storage.setItem(DEMO_MARKER,'0');
 assert.equal(bootstrapDemoData(storage).loaded,true,'the demo completes instead of throwing before it writes its marker');
 assert.equal(storage.getItem(DEMO_MARKER),String(DEMO_VERSION),'the marker is written, so the next load does not repeat the failure');
 const rescued=JSON.parse(storage.getItem(KEY)).accounts.find(account=>account.code==='2000');
 assert.deepEqual([rescued.active,rescued.isGroup,rescued.type,rescued.nature],[true,false,'Liabilities','Credit'],'and the payable control ledger is restored for the postings that need it');
});
