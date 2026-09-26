import test from 'node:test';
import assert from 'node:assert/strict';
import {
 JOURNAL_ACTIONS,JOURNAL_ACTION_DUTY,JOURNAL_ROLES,SAMPLE_TRANSACTIONS,TRANSACTION_STATUSES,TRANSACTION_TYPES,
 buildSimpleJournal,counterpartyAccount,duplicateTransaction,financialYearLabel,getAccountingPreview,
 getSimplePostingLines,getValidationErrors,journalAllowed,moneyAccounts,nextJournalNumber,normaliseStatus,
 journalTimeline,postsToLedger,relativeTime,reversalRecord,sampleJournalRecords,transactionTypeLabel
} from '../src/simple-journal-transaction.js';

const accounts=[
 {code:'1000',name:'Cash',type:'Assets',accountNature:'Cash',active:true},
 {code:'1010',name:'Bank',type:'Assets',accountNature:'Bank',active:true},
 {code:'1100',name:'Accounts Receivable',type:'Assets',active:true},
 {code:'2000',name:'Accounts Payable',type:'Liabilities',active:true},
 {code:'4100',name:'Service Income',type:'Income',active:true},
 {code:'5000',name:'Purchase',type:'Expenses',active:true},
 {code:'5300',name:'Utilities',type:'Expenses',active:true},
 {code:'5600',name:'Professional Fees',type:'Expenses',active:true}
];
const customers=[{id:'cus-1',name:'ABC Retail Pvt Ltd',account:'1100'}];
const vendors=[{id:'ven-1',name:'Kerala Office Supplies',payableAccountId:'2000'}];
const documents=[{id:'inv-1',kind:'Invoice',number:'INV-00001',date:'2026-09-02',outstanding:59000}];
const ctx={accounts,customers,vendors,documents:[]};
const state=over=>({transactionType:'expense',name:'Office electricity bill',date:'2026-09-08',amount:'8500',moneyAccount:'1010',category:'5300',...over});

test('the simple vocabulary is the five business transactions, not accounting pairs',()=>{
 assert.deepEqual(TRANSACTION_TYPES.map(([,label])=>label),['Expense','Income','Transfer','Customer Payment','Vendor Payment']);
 assert.equal(transactionTypeLabel('expense'),'Expense');
 assert.equal(transactionTypeLabel('unknown'),'unknown');
 assert.deepEqual(TRANSACTION_STATUSES,['Draft','Pending Approval','Approved','Rejected','Reversed','Cancelled']);
});

test('the stored vocabulary of earlier rows still resolves to a lifecycle status',()=>{
 assert.equal(normaliseStatus('Pending Approval'),'Pending Approval');
 assert.equal(normaliseStatus('Approved'),'Approved');
 assert.equal(normaliseStatus('Posted'),'Approved');
 assert.equal(normaliseStatus('Reversed'),'Reversed');
 assert.equal(normaliseStatus(''),'Draft');
 assert.equal(normaliseStatus('Cancelled'),'Cancelled');
});

test('every status offers exactly the actions the spec lists',()=>{
 assert.deepEqual(JOURNAL_ACTIONS.Draft,['Edit','Preview','Duplicate','Submit for Approval','Approve','Delete'],'a draft can be published directly by an approver');
 assert.deepEqual(JOURNAL_ACTIONS.Pending,undefined,'Publish is no longer a status');
 assert.deepEqual(JOURNAL_ACTIONS['Pending Approval'],['Preview','Duplicate','Approve','Reject','Cancel journal']);
 assert.deepEqual(JOURNAL_ACTIONS.Approved,['Preview','Duplicate','Reverse']);
 assert.deepEqual(JOURNAL_ACTIONS.Rejected,['Edit','Preview','Duplicate','Resubmit','Delete']);
 assert.deepEqual(JOURNAL_ACTIONS.Reversed,['Preview','Duplicate']);
 for(const [action,duty] of Object.entries(JOURNAL_ACTION_DUTY))assert.ok(JOURNAL_ROLES.includes('Admin'),action+' names a duty '+duty);
});

test('only an approver may publish, reject or reverse',()=>{
 assert.equal(journalAllowed('Accountant','post'),false);
 assert.equal(journalAllowed('Accountant','approve'),false);
 assert.equal(journalAllowed('Accountant','reverse'),false);
 assert.equal(journalAllowed('Accountant','delete'),true);
 assert.equal(journalAllowed('Accountant','submit'),true);
 assert.equal(journalAllowed('Finance Manager','post'),true);
 assert.equal(journalAllowed('Finance Manager','approve'),true);
 assert.equal(journalAllowed('Finance Manager','reverse'),true);
 assert.equal(journalAllowed('Admin','post'),true);
 assert.equal(journalAllowed('Unknown role','post'),false);
});

test('a cash, bank or wallet account is the only money side offered',()=>{
 assert.deepEqual(moneyAccounts(accounts).map(account=>account.code),['1000','1010']);
});

test('validation asks only for what the chosen transaction needs',()=>{
 assert.deepEqual(getValidationErrors(state(),ctx),{});
 assert.equal(getValidationErrors(state({name:''}),ctx).name,'Enter a transaction name');
 assert.equal(getValidationErrors(state({amount:'0'}),ctx).amount,'Enter an amount greater than zero');
 assert.equal(getValidationErrors(state({amount:'10.005'}),ctx).amount,'Enter a valid amount with at most two decimals');
 assert.equal(getValidationErrors(state({moneyAccount:''}),ctx).moneyAccount,'Select where the money was paid from');
 assert.equal(getValidationErrors(state({category:''}),ctx).category,'Choose a category');
 assert.equal(getValidationErrors(state({transactionType:'income',moneyAccount:''}),ctx).moneyAccount,'Select where the money was received');
 assert.equal(getValidationErrors(state({transactionType:'income',category:''}),ctx).category,'Choose a category');
 assert.deepEqual(getValidationErrors(state({transactionType:'transfer',toAccount:'1010'}),ctx).toAccount,'Choose a different account to move the money into');
 assert.equal(getValidationErrors(state({transactionType:'transfer',moneyAccount:'',toAccount:''}),ctx).moneyAccount,'Select the account the money moved from');
 assert.equal(getValidationErrors(state({transactionType:'customer_payment',partyId:'',category:undefined}),ctx).partyId,'Choose the customer');
 assert.equal(getValidationErrors(state({transactionType:'vendor_payment',partyId:'',category:undefined}),ctx).partyId,'Choose the vendor');
 assert.equal(getValidationErrors(state({moneyAccount:'9999'}),ctx).moneyAccount,'Choose an account from your Chart of Accounts');
});

test('a settlement cannot exceed the open document balance, and its party needs a ledger account',()=>{
 const payment={transactionType:'customer_payment',name:'Customer payment',date:'2026-09-04',amount:'590',moneyAccount:'1010',partyId:'cus-1',documentId:'inv-1'};
 const withDocuments={...ctx,documents};
 assert.deepEqual(getValidationErrors(payment,withDocuments),{});
 assert.match(getValidationErrors({...payment,amount:'600'},withDocuments).amount,/exceeds the open invoice balance/);
 assert.equal(getValidationErrors({...payment,partyId:'missing'},withDocuments).partyId,'Choose the customer');
 assert.equal(getValidationErrors({...payment,partyId:'cus-2'},withDocuments).partyId,'Choose the customer');
 assert.equal(getValidationErrors({...payment,transactionType:'vendor_payment'},withDocuments).partyId,'Choose the vendor');
});

test('the generated posting is a balanced double entry for every transaction type',()=>{
 const cases=[
  [{transactionType:'expense'},[['5300',8500,''],['1010','',8500]]],
  [{transactionType:'income',category:'4100'},[['1010',8500,''],['4100','',8500]]],
  [{transactionType:'transfer',moneyAccount:'1000',toAccount:'1010'},[['1010',8500,''],['1000','',8500]]],
  [{transactionType:'customer_payment',partyId:'cus-1',category:undefined},[['1010',8500,''],['1100','',8500]]],
  [{transactionType:'vendor_payment',partyId:'ven-1',category:undefined},[['2000',8500,''],['1010','',8500]]]
 ];
 for(const [over,expected] of cases){
  const value=state(over);
  assert.deepEqual(getSimplePostingLines(value,ctx).map(line=>[line.account,line.debit,line.credit]),expected,value.transactionType);
  const built=buildSimpleJournal({state:value,ctx,organization:'Wayvida Learning',branch:'Kochi'});
  assert.equal(built.linked,false);
  assert.equal(built.lines.length,2);
  assert.equal(built.lines.reduce((total,line)=>total+Number(line.debit||0),0),built.lines.reduce((total,line)=>total+Number(line.credit||0),0));
  assert.equal(built.lines[0].organization,'Wayvida Learning');
  assert.equal(built.lines[0].branch,'Kochi');
 }
});

test('a payment against an invoice or bill is left to that document engine',()=>{
 const payment={transactionType:'customer_payment',name:'Customer payment',date:'2026-09-04',amount:'590',moneyAccount:'1010',partyId:'cus-1',documentId:'inv-1'};
 const built=buildSimpleJournal({state:payment,ctx:{...ctx,documents},organization:'Wayvida Learning',branch:'Kochi'});
 assert.equal(built.linked,true);
 assert.deepEqual(built.lines,[]);
});

test('an unbalanced or impossible pair is refused before anything is posted',()=>{
 const same={transactionType:'transfer',name:'Move',date:'2026-09-08',amount:'100',moneyAccount:'1010',toAccount:'1010'};
 assert.throws(()=>buildSimpleJournal({state:same,ctx,organization:'',branch:''}),/Choose different accounts/);
 assert.throws(()=>buildSimpleJournal({state:{...same,moneyAccount:'',toAccount:''},ctx,organization:'',branch:''}),/Unable to post this transaction/);
});

test('the plain-language summary names the money movement, never a debit or credit',()=>{
 const expense=getAccountingPreview(state(),ctx);
 assert.equal(expense.debit,'Utilities');
 assert.equal(expense.credit,'Bank');
 assert.equal(expense.amount,8500);
});

test('a journal id states the financial year and a six digit sequence',()=>{
 assert.equal(financialYearLabel('2026-09-08'),2026);
 assert.equal(financialYearLabel('2026-02-01'),2025);
 assert.equal(nextJournalNumber([],'2026-09-08'),'JE-2026-000001');
 assert.equal(nextJournalNumber([{number:'JE-2026-000124'},{number:'JV-2026-99'}],'2026-09-08'),'JE-2026-000125');
 assert.equal(nextJournalNumber([{number:'JE-2025-000009'}],'2026-09-08'),'JE-2026-000001');
});

test('a duplicate is a fresh draft with none of the original history',()=>{
 const original={...state(),simpleTransaction:{name:'Software subscription',amount:'4999'},id:'journal-1',number:'JE-2026-000124',status:'Approved',createdBy:'Admin',publishedBy:'Admin',publishedAt:'2026-09-20T09:00:00.000Z',ledgerJournalId:'ledger-1',reversalOf:null,audit:[{id:'a'}],lines:[{account:'5300',debit:8500,credit:''}]};
 const copy=duplicateTransaction(original);
 assert.notEqual(copy.id,'journal-1');
 assert.equal(copy.number,'');
 assert.equal(copy.status,'Draft');
 assert.equal(copy.publishedBy,undefined);
 assert.equal(copy.ledgerJournalId,undefined);
 assert.deepEqual(copy.audit,[]);
 assert.notEqual(copy.lines[0].id,original.lines[0].id);
 assert.equal(copy.lines[0].account,'5300');
 assert.equal(copy.simpleTransaction.name,original.simpleTransaction.name);
});

test('the reversal record is the equal and opposite entry linked to its original',()=>{
 const original={...state(),id:'journal-1',number:'JE-2026-000126',status:'Reversed',lines:[{id:'l1',account:'5600',debit:4999,credit:''},{id:'l2',account:'1010',debit:'',credit:4999}]};
 const reversal=reversalRecord(original,'2026-09-05','Charged twice');
 assert.equal(reversal.number,'REV-JE-2026-000126');
 assert.equal(reversal.reversalOf,'journal-1');
 assert.equal(reversal.reversalReason,'Charged twice');
 assert.equal(reversal.status,'Approved');
 assert.deepEqual(reversal.lines.map(line=>[line.account,line.debit,line.credit]),[['5600','',4999],['1010',4999,'']]);
});

test('the demo content covers every status and every transaction type',()=>{
 assert.deepEqual([...new Set(SAMPLE_TRANSACTIONS.map(row=>row.status))].sort(),[...TRANSACTION_STATUSES].sort());
 assert.deepEqual([...new Set(SAMPLE_TRANSACTIONS.map(row=>row.transactionType))].sort(),TRANSACTION_TYPES.map(([value])=>value).sort());
 const records=sampleJournalRecords({accounts});
 assert.equal(records.length,6);
 for(const record of records){
  assert.match(record.number,/^JE-2026-\d{6}$/);
  assert.ok(record.lines.length>=2);
  assert.equal(record.lines.reduce((total,line)=>total+Number(line.debit||0),0),record.lines.reduce((total,line)=>total+Number(line.credit||0),0));
  assert.ok(record.simpleTransaction.name);
 }
 assert.deepEqual(records.map(record=>record.status),['Approved','Pending Approval','Draft','Rejected','Reversed','Cancelled']);
});

test('a customer or vendor payment resolves the party ledger account from the party',()=>{
 assert.equal(counterpartyAccount({transactionType:'customer_payment',partyId:'cus-1'},ctx),'1100');
 assert.equal(counterpartyAccount({transactionType:'vendor_payment',partyId:'ven-1'},ctx),'2000');
 assert.equal(counterpartyAccount({transactionType:'customer_payment',partyId:'unknown'},ctx),'1100');
});

test('the audit timeline describes each event with a relative time',()=>{
 const now=new Date('2026-09-25T09:00:00.000Z');
 const stamped={createdBy:'Admin',createdAt:'2026-09-20T09:00:00.000Z',submittedBy:'Arun',submittedAt:'2026-09-21T09:00:00.000Z',publishedBy:'Priya',publishedAt:'2026-09-25T08:30:00.000Z',postedBy:'Priya',postedAt:'2026-09-25T08:30:00.000Z'};
 const rows=journalTimeline(stamped,now);
 assert.deepEqual(rows.map(row=>row.kind),['approved','posted','submitted','created'],'newest first');
 assert.equal(rows[0].text,'approved this journal');
 assert.equal(rows[0].when,'30m ago');
 assert.equal(rows[3].when,'5d ago');
 const audited=journalTimeline({audit:[{id:'a',user:'Priya',at:'2026-09-25T08:30:00.000Z',action:'Approved',oldValue:'Pending Approval',newValue:'Approved',reason:'Checked against the bank'}]},now);
 assert.equal(audited[0].kind,'approved');
 assert.equal(audited[0].actor,'Priya');
 assert.equal(audited[0].text,'changed the status from Pending Approval to Approved');
 assert.equal(audited[0].note,'Checked against the bank');
 assert.equal(journalTimeline({audit:[{id:'b',user:'Arun',at:'2026-09-24T08:30:00.000Z',action:'Created',oldValue:'',newValue:'Draft'}]},now)[0].when,'Yesterday');
 assert.equal(relativeTime('',now),'');
 assert.equal(relativeTime(undefined,now),'');
});

test('only the approved status owns a ledger posting',()=>{
 for(const status of ['Draft','Pending Approval','Rejected','Reversed','Cancelled'])assert.equal(postsToLedger(status),false,status+' is an operational record and must never reach the ledger');
 assert.equal(postsToLedger('Approved'),true,'the approved status is the one posting status');
 assert.equal(postsToLedger('Pending'),false,'the earlier pending spelling still resolves to Pending Approval');
 assert.equal(postsToLedger('Published'),true,'the earlier published spelling maps onto the approved status');
 assert.equal(postsToLedger('Posted'),true,'the legacy posted wording maps onto the approved status');
 assert.equal(postsToLedger(undefined),false,'a record with no status is not a posting');
});
