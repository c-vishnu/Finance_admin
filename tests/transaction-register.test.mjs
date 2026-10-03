import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ALL,DEFAULT_SORT,SORT_OPTIONS,TRANSACTION_STATUSES,TRANSACTION_TYPES,collectTransactions,filterTransactions,registerOptions,sortTransactions,summarizeTransactions,transactionRegisterExportRows} from '../src/transaction-register.js';

const book={
  accounts:[],
  config:{},
  invoices:[{id:'i1',number:'INV-0001',date:'2026-09-05',customerName:'ABC Retail Pvt Ltd',posted:true,status:'Approved',reference:'SO-00001',journalId:'j-inv1',totals:{total:2478000},branch:'Kochi'}],
  payments:[],
  receipts:[{id:'r1',number:'RCP-0001',date:'2026-09-08',customerName:'ABC Retail Pvt Ltd',amount:100000,status:'Posted',reference:'UPI-99',branch:'Kochi'}],
  creditNotes:[{id:'cn1',number:'CN-0001',date:'2026-09-09',customerName:'ABC Retail Pvt Ltd',posted:true,status:'Approved',totals:{total:50000},journalId:'j-cn1',branch:'Kochi'}],
  purchaseBills:[{id:'b1',number:'BILL-0004',date:'2026-09-10',vendorName:'ABC Suppliers',posted:true,status:'Unpaid',total:1850000,vendorInvoice:'PO-004',journalId:'j-b1',branch:'Kochi'}],
  debitNotes:[{id:'dn1',number:'DN-0001',date:'2026-09-11',vendorName:'ABC Suppliers',posted:true,status:'Posted',total:20000,branch:'Kochi'}],
  vendorPayments:[{id:'vp1',number:'VPAY-00001',date:'2026-09-12',billId:'b1',amount:500000,status:'Posted',branch:'Kochi'}],
  journals:[
    {id:'j-inv1',date:'2026-09-05',number:'JE-1',source:'Sales Invoice',invoiceId:'i1',status:'Posted',lines:[{account:'1100',debit:2478000,credit:0,branch:'Kochi'},{account:'4000',debit:0,credit:2478000,branch:'Kochi'}]},
    {id:'j-manual',date:'2026-09-19',number:'JE-2',source:'Manual Journal',status:'Posted',lines:[{account:'1010',debit:6850000,credit:0,branch:'Kochi'},{account:'4000',debit:0,credit:6850000,branch:'Kochi'}]}
  ]
};
const operations={expenses:[
  {id:'e1',number:'EXP-00041',date:'2026-09-13',name:'Cloud hosting',payee:'Cloudstack Services',amount:118000,status:'Posted',branch:'Kochi'},
  {id:'e2',number:'EXP-00042',date:'2026-09-14',name:'Client visit',payee:'Metro Cabs',amount:245000,status:'Pending',branch:'Kochi'},
  {id:'e3',number:'EXP-00043',date:'2026-09-15',name:'Internet charges',payee:'FiberNet India',amount:177000,status:'Draft',branch:'Kochi'}
]};
const banking={
  bankAccounts:[{id:'bank-1',name:'HDFC',branch:'Kochi'}],
  bankTransactions:[
    {id:'bt1',date:'2026-09-16',reference:'NEFT-1',description:'Customer payment',credit:250000,status:'Matched',bankAccountId:'bank-1'},
    {id:'bt2',date:'2026-09-17',reference:'CHG-1',description:'Bank charge',debit:5000,status:'Unmatched',bankAccountId:'bank-1'},
    {id:'bt3',date:'2026-09-18',reference:'EX-1',description:'Duplicate line',debit:9000,status:'Excluded',bankAccountId:'bank-1'}
  ]
};
const manual=[{id:'m1',number:'JE-2026-000141',date:'2026-09-19',reference:'CSH-0928',status:'Approved',type:'Business Transaction',narration:'Counter sales collected today',ledgerJournalId:'j-manual',lines:[{id:'l1',account:'1010',debit:68500,credit:0},{id:'l2',account:'4000',debit:0,credit:68500}],simpleTransaction:{label:'Income',name:'Counter sales collected today',partyName:'',moneyAccount:'1010'}}];

const rows=()=>collectTransactions({book,operations,banking,manual});
const find=(list,predicate)=>list.find(predicate);

test('the register states one row per transaction and never the journal behind it',()=>{
 const all=rows();
 const invoices=all.filter(entry=>entry.type==='Sales Invoice');
 assert.equal(invoices.length,1);
 assert.equal(invoices[0].number,'INV-0001');
 assert.equal(invoices[0].party,'ABC Retail Pvt Ltd');
 assert.equal(invoices[0].reference,'SO-00001');
 assert.equal(invoices[0].amount,2478000);
 assert.equal(invoices[0].status,'Posted');
 assert.equal(all.filter(entry=>entry.type==='Journal').length,1);
 assert.equal(all.filter(entry=>entry.recordId==='j-inv1').length,0);
 assert.equal(all.filter(entry=>entry.recordId==='j-manual').length,0);
 assert.equal(new Set(all.map(entry=>entry.id)).size,all.length);
});

test('every transaction type the data model carries is collected once',()=>{
 const all=rows();
 assert.deepEqual([...new Set(all.map(entry=>entry.type))].sort(),[...TRANSACTION_TYPES].sort());
 assert.equal(all.length,13);
 for(const type of TRANSACTION_TYPES)assert.ok(all.some(entry=>entry.type===type),type);
});

test('each type is reduced to the lifecycle word its own module already applies',()=>{
 const all=rows();
 const status=type=>all.filter(entry=>entry.type===type).map(entry=>entry.status);
 assert.deepEqual(status('Sales Invoice'),['Posted']);
 assert.deepEqual(status('Purchase Bill'),['Posted']);
 assert.deepEqual(status('Supplier Payment'),['Posted']);
 assert.deepEqual(status('Expense').sort(),['Draft','Pending','Posted']);
 assert.deepEqual(status('Bank Transaction').sort(),['Cancelled','Pending','Posted']);
 for(const entry of all)assert.ok(TRANSACTION_STATUSES.includes(entry.status),entry.status);
});

test('the summary states the four cards and they add up to the total',()=>{
 const summary=summarizeTransactions(rows());
 assert.deepEqual(summary,{total:13,posted:9,draft:3,cancelled:1});
 assert.equal(summary.posted+summary.draft+summary.cancelled,summary.total);
});

test('date filters are inclusive on both ends',()=>{
 const all=rows();
 const from=filterTransactions(all,{from:'2026-09-08'});
 assert.ok(from.every(entry=>entry.date>='2026-09-08'));
 const to=filterTransactions(all,{to:'2026-09-08'});
 assert.ok(to.every(entry=>entry.date<='2026-09-08'));
 const both=filterTransactions(all,{from:'2026-09-08',to:'2026-09-08'});
 assert.deepEqual(both.map(entry=>entry.number),['RCP-0001']);
});

test('filters combine and nothing else is reset',()=>{
 const all=rows();
 const combined=filterTransactions(all,{from:'2026-09-01',to:'2026-09-30',type:'Sales Invoice',status:'Posted',branch:'Kochi'});
 assert.equal(combined.length,1);
 assert.equal(combined[0].number,'INV-0001');
 assert.equal(filterTransactions(all,{type:'Sales Invoice',status:'Draft'}).length,0);
 assert.equal(filterTransactions(all,{branch:'Bengaluru'}).length,0);
});

test('the customer and supplier filters narrow the same party column by kind',()=>{
 const all=rows();
 const customer=filterTransactions(all,{customer:'ABC Retail Pvt Ltd'});
 assert.ok(customer.length>0);
 assert.ok(customer.every(entry=>entry.partyKind==='customer'));
 const supplier=filterTransactions(all,{supplier:'ABC Suppliers'});
 assert.ok(supplier.length>0);
 assert.ok(supplier.every(entry=>entry.partyKind==='supplier'&&entry.party==='ABC Suppliers'));
 assert.equal(filterTransactions(all,{customer:'ABC Suppliers'}).length,0);
});

test('search reaches the document number, reference, party and description',()=>{
 const all=rows();
 assert.deepEqual(filterTransactions(all,{search:'BILL-0004'}).map(entry=>entry.number),['BILL-0004']);
 assert.deepEqual(filterTransactions(all,{search:'UPI-99'}).map(entry=>entry.number),['RCP-0001']);
 assert.deepEqual(filterTransactions(all,{search:'metro cabs'}).map(entry=>entry.number),['EXP-00042']);
 assert.equal(filterTransactions(all,{search:'nothing here at all'}).length,0);
 assert.equal(filterTransactions(all,{search:''}).length,all.length);
});

test('filter options are derived from the rows, so no option is offered with no transaction',()=>{
 const all=rows(),options=registerOptions(all);
 assert.deepEqual(options.types,[...TRANSACTION_TYPES].sort());
 assert.deepEqual(options.branches,['Kochi']);
 assert.deepEqual(options.customers,['ABC Retail Pvt Ltd']);
 assert.deepEqual(options.suppliers,['ABC Suppliers','Cloudstack Services','FiberNet India','Metro Cabs']);
});

test('the export states the scope, the applied filters and the filtered rows only',()=>{
 const all=rows(),visible=filterTransactions(all,{from:'2026-09-10',to:'2026-09-18'});
 const sheet=transactionRegisterExportRows(visible,{organisation:'Wayvida Learning',branch:'Kochi',from:'2026-09-10',to:'2026-09-18',filters:{'Transaction type':'All',Status:'Posted'},generatedBy:'Local user',generatedAt:'2026-09-29T00:00:00.000Z'});
 const flat=sheet.map(row=>row.join(' ')).join('\n');
 assert.ok(flat.includes('Transaction Register'));
 assert.ok(flat.includes('Wayvida Learning'));
 assert.ok(flat.includes('2026-09-10 to 2026-09-18'));
 assert.ok(flat.includes('Status: Posted'));
 assert.ok(!flat.includes('Transaction type: All'),'an unfiltered control is not listed as an applied filter');
 const headerIndex=sheet.findIndex(row=>row[0]==='Date');
 assert.deepEqual(sheet[headerIndex],['Date','Transaction Type','Document No.','Party / Description','Reference','Amount INR','Status']);
 assert.equal(sheet.length-headerIndex-1,visible.length);
 assert.equal(visible.length,all.filter(entry=>entry.date>='2026-09-10'&&entry.date<='2026-09-18').length);
});

test('reports navigation exposes one central transaction register',()=>{
 const nav=readFileSync('src/Navigation.jsx','utf8');
 assert.match(nav,/leaf\('Transaction Register'\)/);
 assert.match(nav,/TransactionRegister onNavigate/);
});

test('the page keeps the module boundary the report is defined by',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 for(const label of ['Transaction Register','Find and review your business transactions in one place.','Search transactions...','Document No. & Date','Transaction Type','Party / Description','Reference','Amount','Status','Actions','Export Excel','Export PDF','No transactions found.','No transactions match your filters.','Unable to load transactions.','Retry','Clear filters'])assert.ok(page.includes(label),label);
 for(const banned of ['Debit','Credit','Accounting impact','Related documents and audit history','trOverlay'])assert.ok(!page.includes(banned),banned);
});

test('every transaction type opens the document that already owns it',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 const module_=readFileSync('src/transaction-register.js','utf8');
 assert.match(page,/sessionStorage\.setItem\(entry\.handshake/);
 assert.match(page,/onNavigate\(entry\.page\)/);
 for(const [type,target] of Object.entries({
  'Sales Invoice':['Invoices','wayvida-open-invoice'],
  'Credit Note':['Credit Notes','wayvida-open-credit'],
  'Customer Receipt':['Payments Received','wayvida-open-receipt'],
  'Purchase Bill':['Purchase Bills','wayvida-open-bill'],
  'Debit Note':['Debit Notes','wayvida-open-debit-note'],
  'Expense':['Expense Claims','wayvida-open-expense'],
  'Journal':['Journal Entries','wayvida-open-journal'],
  'Bank Transaction':['Bank Transactions','wayvida-open-bank']
 })){
  assert.ok(module_.includes(`'${type}':{page:'${target[0]}',handshake:'${target[1]}'}`),type);
 }
 assert.ok(module_.includes("'Supplier Payment':{page:'Payments Made'}"));
 assert.equal(find(rows(),entry=>entry.type==='Bank Transaction').handoffId,'bank-1');
 assert.equal(find(rows(),entry=>entry.type==='Sales Invoice').handoffId,'i1');
 for(const entry of rows())assert.ok(entry.handoffId,entry.type);
});

test('the page is a read-only projection and never writes a record',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 for(const banned of ['writeAccounts','localStorage.setItem','sessionStorage.removeItem','command(','receiptCommand','postPurchaseBill','createExpense'])assert.ok(!page.includes(banned),banned);
 assert.equal(page.match(/sessionStorage\.setItem\(/g).length,1);
});

test('duplicate posted-book panel is absent from the rendered banking experience',()=>{
 const css=readFileSync('src/transaction-register.css','utf8');
 assert.match(css,/\.bankBookRegister\{display:none!important\}/);
});

test('the register portal stays inside the dashboard shell and never scrolls the page sideways',()=>{
 const css=readFileSync('src/transaction-register.css','utf8');
 for(const token of ['.transactionPortal{position:fixed','inset:59px 0 0 250px','background:#f5f7fb'])assert.ok(css.includes(token),token);
 assert.ok(css.includes('.trTableScroll{overflow-x:auto'));
 assert.ok(css.includes('.transactionPortal:has(.trPage){position:static!important'));
 assert.ok(css.includes('.trRegisterCard .trRefCol{display:none}'));
 assert.ok(css.includes('.trRegisterCard .trPartyCol{display:none}'));
});

test('the sort control reorders the rows in hand and defaults to newest first',()=>{
 const all=rows();
 assert.equal(DEFAULT_SORT,'newest');
 assert.deepEqual(SORT_OPTIONS.map(option=>option.value),['newest','oldest','amount-desc','amount-asc','number']);
 const dates=list=>list.map(entry=>entry.date);
 assert.deepEqual(dates(sortTransactions(all)),dates(sortTransactions(all,'newest')));
 assert.ok(dates(sortTransactions(all)).every((value,index,list)=>index===0||list[index-1]>=value));
 assert.ok(dates(sortTransactions(all,'oldest')).every((value,index,list)=>index===0||list[index-1]<=value));
 const highest=sortTransactions(all,'amount-desc').map(entry=>entry.amount);
 assert.ok(highest.every((value,index)=>index===0||highest[index-1]>=value));
 const lowest=sortTransactions(all,'amount-asc').map(entry=>entry.amount);
 assert.ok(lowest.every((value,index)=>index===0||lowest[index-1]<=value));
 const numbers=sortTransactions(all,'number').map(entry=>entry.number);
 assert.ok(numbers.every((value,index)=>index===0||numbers[index-1].localeCompare(value)<=0));
 const before=all.map(entry=>entry.id);
 assert.equal(sortTransactions(all,'amount-asc').length,all.length);
 assert.deepEqual(all.map(entry=>entry.id),before);
 const tied=[{id:'b',number:'DOC-2',date:'2026-09-05',amount:100},{id:'a',number:'DOC-1',date:'2026-09-05',amount:100}];
 assert.deepEqual(sortTransactions(tied,'newest').map(entry=>entry.number),['DOC-1','DOC-2']);
 assert.deepEqual(sortTransactions(tied,'oldest').map(entry=>entry.number),['DOC-1','DOC-2']);
 assert.deepEqual(sortTransactions(tied,'amount-desc').map(entry=>entry.number),['DOC-1','DOC-2']);
 assert.deepEqual(tied.map(entry=>entry.number),['DOC-2','DOC-1'],'the input list is never reordered in place');
});

test('the register pages the rows instead of printing the whole book at once',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 const css=readFileSync('src/transaction-register.css','utf8');
 assert.match(page,/useState\(25\)/);
 assert.match(page,/\[25,50,100\]\.map/);
 assert.ok(page.includes('Showing {firstRow}&ndash;{lastRow} of {ordered.length} transactions'));
 assert.ok(page.includes('{size} per page'));
 assert.ok(page.includes('Page {pageIndex} of {pageCount}'));
 assert.ok(page.includes('aria-label="Previous page"'));
 assert.ok(page.includes('aria-label="Next page"'));
 assert.equal(page.match(/setSearch\(''\)/g).length,1);
 assert.match(page,/filterTransactions\(rows,\{\.\.\.filters,search:deferredSearch\}\)/);
 assert.match(page,/useEffect\(\(\)=>\{setPage\(1\)\},\[deferredSearch,filters,sort,perPage\]\)/);
 assert.ok(css.includes('.trRegisterCard tbody tr.trOffPage{display:none}'));
 assert.ok(css.includes('.trRegisterCard tbody tr.trOffPage{display:table-row!important}'));
 assert.ok(css.includes('.trPager{display:none!important}'));
 assert.ok(!page.includes('<tfoot'));
});

test('the register states every date and amount through the one shared format',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 const journal=readFileSync('src/JournalEntriesPro.jsx','utf8');
 const formatter="toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})";
 assert.ok(page.includes(formatter),'the report uses the same date format as the other registers');
 assert.ok(journal.includes(formatter));
 assert.ok(page.includes('dateText(entry.date)'));
 assert.ok(page.includes('money(entry.amount)'));
 assert.ok(!page.includes('{entry.date||DASH}'),'the raw ISO date is never printed to the operator');
});

test('the row keeps its hierarchy and never wraps a long name or reference',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 const css=readFileSync('src/transaction-register.css','utf8');
 assert.ok(page.includes('className="trPartyCol" title={entry.party||entry.description||undefined}'));
 assert.ok(page.includes('className="trRefCol" title={entry.reference||undefined}'));
 assert.ok(page.includes('className="trLink" title='));
 assert.ok(page.includes("aria-label=\"Sort transactions\""));
 /* The 3-dot action dropdown menu provides View and Preview options. */
 assert.ok(page.includes('<IconDots size={18}/>'));
 assert.ok(page.includes('<span>Preview</span>'));
 assert.ok(css.includes('.trActionsMenu'));
 assert.ok(!css.includes('table-layout:auto;min-width:640px'));
 assert.ok(css.includes('.trRegisterCard th,.trRegisterCard td{padding:13px 16px'));
 assert.ok(css.includes('overflow:hidden;text-overflow:ellipsis;white-space:nowrap'));
 assert.ok(!css.includes('overflow-wrap:anywhere'));
 assert.ok(css.includes('.trRegisterCard td.trAmountCol{font-weight:700'));
});

test('both empty states keep their own words and their way out',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 assert.ok(page.includes("title={rows.length?'No transactions match your filters.':'No transactions found.'}"));
 assert.ok(page.includes("description={rows.length?'Try a wider date range, or clear the filters to see every transaction in this scope.':"));
 assert.ok(page.includes("actionLabel={rows.length||search||activeFilters?'Clear filters':undefined}"));
 assert.ok(page.includes("onAction={rows.length||search||activeFilters?clear:undefined}"));
 assert.match(page,/const clear=\(\)=>\{setFilters\(blankFilters\(\)\);setSearch\(''\);setSort\(DEFAULT_SORT\);setPage\(1\)\}/);
});
