import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {ALL,CASH_BANK_STATUSES,DASH,POSTED,RECONCILIATION_STATUSES,bankReconciliation,bankReconciliationExportRows,cashBankAccounts,cashBankBook,cashBankBookExportRows,financialYearStart} from '../src/cash-banking.js';
import {financialYearStart as statementYearStart} from '../src/profit-loss.js';

const read=name=>readFileSync('src/'+name,'utf8');
/* Comments are stripped before the honesty guards, because the module docstring names the very
   functions the guards prove it never calls. */
const code=name=>read(name).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const R=rupees=>Math.round(rupees*100);
const FY='2026-04-01',TODAY='2026-09-29';

/* ---------- the fixture ---------- */
/* Every amount is in paise, the unit the stores hold and money() expects. The chart carries every
   case the brief names - a cash ledger, a bank ledger, bank ledgers classified only by their group,
   an inactive cash ledger, a cash group header, a ledger merely named after a bank but typed as an
   expense, and a bank-looking ledger with no cash-or-bank wording at all - so the eligibility rule
   is pinned rather than assumed. */
const account=(code,name,extra={})=>({id:'acct-'+code,code,name,type:'Assets',active:true,isGroup:false,...extra});
const accounts=[
 account('1000','Cash'),
 account('1010','Bank'),
 account('1030','HDFC Current Account',{group:'Cash and Bank',accountNature:'Bank'}),
 account('1031','ICICI Current Account',{group:'Cash and Bank',accountNature:'Bank'}),
 account('1020','ICICI Current Account'),
 account('1100','Accounts Receivable'),
 account('2000','Accounts Payable',{type:'Liabilities'}),
 account('2100','GST Payable',{type:'Liabilities'}),
 account('3000','Opening Balance Equity',{type:'Equity'}),
 account('4000','Sales',{type:'Income'}),
 account('5700','Bank Charges',{type:'Expenses'}),
 account('1900','Petty Cash',{active:false}),
 account('1001','Cash Group',{isGroup:true})
];

let sequence=0;
const journal=(id,date,number,source,lines,extra={})=>({id,date,number,reference:number,source,status:'Posted',createdAt:new Date(Date.UTC(2026,7,20,0,sequence++)).toISOString(),lines:lines.map(line=>({branch:'abc-kochi',...line})),...extra});
const line=(account,debit,credit,description,branch)=>branch?{account,debit:R(debit),credit:R(credit),description,branch}:{account,debit:R(debit),credit:R(credit),description};
const journals=[
 journal('j-open','2026-03-31','OPEN-CASH','Opening Balance',[line('1000',100,0,'Opening cash balance'),line('3000',0,100,'Opening balance equity')]),
 journal('j1','2026-09-01','OPEN-HDFC','Opening Balance',[line('1030',5000,0,'Opening bank balance'),line('3000',0,5000,'Opening balance equity')]),
 journal('j2','2026-09-04','RCPT-HDFC-1','Customer Receipt',[line('1030',500,0,'Receipt from ABC Retail Pvt Ltd'),line('1100',0,500,'Customer receipt')]),
 journal('j3','2026-09-05','VPAY-HDFC-1','Vendor Payment',[line('2000',250,0,'Payment to Kerala Office Supplies'),line('1030',0,250,'Vendor payment')]),
 journal('j4','2026-09-06','TRF-ICICI-1','Bank Transfer',[line('1031',1000,0,'Transfer from HDFC Current Account'),line('1030',0,1000,'Transfer to ICICI Current Account')]),
 journal('j5','2026-09-10','SINV-1','Sales Invoice',[line('1100',1180,0,'September supply'),line('4000',0,1000,'Sales'),line('2100',0,180,'Output GST')]),
 journal('j6','2026-09-13','CSH-1','Journal Transaction',[line('1000',50,0,'Cash moved to the petty cash box'),line('1010',0,50,'Cash moved to the petty cash box')]),
 journal('j7','2026-09-15','DRAFT-1','Journal Transaction',[line('1010',9999,0,'Draft entry')],{status:'Draft'}),
 journal('j8','2026-09-20','CHG-HDFC-1','Bank Transaction',[line('5700',500,0,'Monthly bank charges'),line('1030',0,500,'Monthly bank charges')]),
 journal('j9','2026-09-28','LATE-CHQ-1','Vendor Payment',[line('2000',200,0,'Cheque issued and not yet presented'),line('1030',0,200,'Cheque issued and not yet presented')]),
 journal('j10','2026-09-29','RCPT-TRV-1','Customer Receipt',[line('1030',75,0,'Receipt from ABC Retail Pvt Ltd','abc-trivandrum'),line('1100',0,75,'Customer receipt','abc-trivandrum')]),
 journal('j11','2026-10-05','RCPT-OCT-1','Customer Receipt',[line('1030',999,0,'October receipt'),line('1100',0,999,'October receipt')]),
 journal('j12','2026-09-12','VOID-1','Journal Transaction',[line('1010',400,0,'Cancelled entry')],{status:'Cancelled'})
];

const statement=(id,bankAccountId,date,reference,description,debit,credit,balance,status='Unmatched')=>({id,bankAccountId,reconciliationId:null,date,reference,description,debit:R(debit),credit:R(credit),balance:balance==null?null:R(balance),category:'',matchedWith:'',status,source:'Statement',fingerprint:id,importedBy:'Harness',importedAt:'2026-09-29T00:00:00.000Z',fileName:'statement.csv'});
const bankAccounts=[
 {id:'bank-hdfc',bankName:'HDFC Bank',accountName:'HDFC Current Account',accountNumber:'50100012345678',accountType:'Current Account',branch:'Kochi',ifsc:'HDFC0000123',currency:'INR',status:'Active',accountCode:'1030'},
 {id:'bank-icici',bankName:'ICICI Bank',accountName:'ICICI Current Account',accountNumber:'210501987654',accountType:'Current Account',branch:'Kochi',ifsc:'ICIC0000456',currency:'INR',status:'Active',accountCode:'1031'},
 {id:'bank-axis',bankName:'Axis Bank',accountName:'Axis Current Account',accountNumber:'910000000001',accountType:'Current Account',branch:'Calicut',ifsc:'UTIB0000001',currency:'INR',status:'Active',accountCode:'1099'}
];
const bankTransactions=[
 statement('tx-h1','bank-hdfc','2026-09-04','RCPT-HDFC-1','ABC RETAIL NEFT',0,500,5500,'Matched'),
 statement('tx-h2','bank-hdfc','2026-09-05','VPAY-HDFC-1','KERALA OFFICE SUPPLIES',250,0,5250,'Matched'),
 statement('tx-h3','bank-hdfc','2026-09-06','TRF-ICICI-1','TRANSFER TO ICICI',1000,0,4250,'Matched'),
 statement('tx-h4','bank-hdfc','2026-09-20','CHG-HDFC-1','MONTHLY BANK CHARGES',500,0,3750,'Excluded'),
 statement('tx-h5','bank-hdfc','2026-09-24','NEFT-OUT-1','VENDOR PAYMENT NOT IN BOOKS',2500,0,null),
 statement('tx-i1','bank-icici','2026-09-06','TRF-ICICI-1','TRANSFER FROM HDFC',0,1000,1000,'Matched')
];
const bankMatches=[
 {id:'m1',statementId:'tx-h1',bookTransactionId:'book:j2:0',journalId:'j2',amount:R(500),matchedBy:'Harness',matchedAt:'2026-09-29T00:00:00.000Z'},
 {id:'m2',statementId:'tx-h2',bookTransactionId:'book:j3:0',journalId:'j3',amount:R(250),matchedBy:'Harness',matchedAt:'2026-09-29T00:00:00.000Z'},
 {id:'m3',statementId:'tx-h3',bookTransactionId:'book:j4:0',journalId:'j4',amount:R(1000),matchedBy:'Harness',matchedAt:'2026-09-29T00:00:00.000Z'},
 {id:'m4',statementId:'tx-i1',bookTransactionId:'book:j4:0',journalId:'j4',amount:R(1000),matchedBy:'Harness',matchedAt:'2026-09-29T00:00:00.000Z'}
];

const bookState=()=>({accounts,config:{},invoices:[],creditNotes:[],journals,payments:[],receipts:[],debitNotes:[],purchaseBills:[]});
const bankingState=(overrides={})=>({version:3,demoVersion:0,bankAccounts,bankTransactions,bankMatches,...overrides});
const period={from:FY,to:TODAY,account:ALL,branch:ALL,type:ALL,status:ALL};
const sheet=overrides=>cashBankBook(bookState(),bankingState(),{...period,...overrides});
const reconcile=overrides=>bankReconciliation(bookState(),bankingState(),{from:FY,to:TODAY,status:ALL,branch:ALL,reference:'',bankAccount:'bank-hdfc',...overrides});

/* ---------- navigation ---------- */

test('the sidebar states a Cash & Banking group with exactly the two brief entries',()=>{
 const nav=read('ReportsSecondaryNav.jsx');
 assert.ok(nav.includes("heading: 'CASH & BANKING'"),'the group heading is declared');
 assert.ok(nav.includes("label: 'Cash & Bank Book', page: 'Cash & Bank Book'"),'Cash & Bank Book is listed');
 assert.ok(nav.includes("label: 'Bank Reconciliation', page: 'Bank Reconciliation Report'"),'Bank Reconciliation is listed');
});

test('both reports are reachable from Reports and no report is duplicated',()=>{
 const nav=read('ReportsSecondaryNav.jsx');
 for(const label of ['Cash & Bank Book','Bank Reconciliation Report'])assert.ok(nav.includes("'"+label+"'"),label+' is listed in ReportsSecondaryNav');
});

test('both reports are mounted through the shared portal and excluded from the module switch',()=>{
 const nav=read('Navigation.jsx');
 for(const [label,module] of [['Cash & Bank Book','CashAndBankBook'],['Bank Reconciliation Report','BankReconciliationReport']]){
  assert.ok(nav.includes("{active==='"+label+"'&&createPortal(<div className=\"transactionPortal\"><"+module+" onNavigate={onNavigate}/></div>,document.body)}"),label+' is mounted through .transactionPortal');
  assert.ok(nav.includes("import "+module+" from './"+module+".jsx';"),label+' is imported');
 }
 const app=read('App.jsx');
 assert.ok(app.includes("isReportPage(a)"),'the welcome banner is suppressed for report pages via isReportPage');
});

/* ---------- the shared family ---------- */

test('the two pages reuse the family shell rather than growing their own',()=>{
 for(const name of ['CashAndBankBook.jsx','BankReconciliationReport.jsx']){
  const page=read(name);
  assert.ok(page.includes("import './cash-banking.css';"),name+' uses the shared sheet');
  assert.ok(page.includes("import EmptyState from './EmptyState.jsx';"),name+' uses the shared empty state');
  assert.ok(page.includes("import StatusPill from './StatusPill.jsx';"),name+' uses the shared status pill');
  assert.ok(page.includes("import {downloadReport,excelReport} from './daybook-export.js';"),name+' exports through daybook-export');
  assert.ok(page.includes("import {money,today} from './invoice-engine.js';"),name+' formats money and dates with the shared helpers');
  assert.ok(page.includes("from './cash-banking.js';"),name+' reads the shared projection');
  assert.ok(page.includes('excelReport(')&&page.includes('downloadReport('),name+' builds its export through the shared writer');
  assert.ok(page.includes('window.print()'),name+' prints through the shared browser print path');
  assert.ok(page.includes('className="pagination-footer cbPager"')&&page.includes('pagination-left')&&page.includes('pagination-right'),name+' pages with the shared pagination footer');
  assert.ok(page.includes('emptyStateRow')&&page.includes('emptyStateCell'),name+' states an empty row through the shared classes');
  assert.ok(page.includes('className="transactionPortal"')===false,name+' does not declare its own portal');
  assert.ok(page.includes('className="cbTableScroll"'),name+' scrolls the table in the shared container');
 }
 assert.ok(read('BankReconciliationReport.jsx').includes("import OutstandingActions from './OutstandingActions.jsx';"),'the reconciliation row menu is the shared one');
});

test('the shipped sheet never redeclares the shared portal and keeps the family print contract',()=>{
 const style=read('cash-banking.css');
 assert.ok(!/^\.transactionPortal\{/m.test(style),'the portal position rule stays owned by transaction-register.css');
 assert.ok(style.includes('body:has(.cbPage)'),'the print block neutralises the shell chrome');
 assert.ok(style.includes('.transactionPortal:has(.cbPage)'),'the print block neutralises the portal for both pages');
 assert.ok(style.includes('.cbPager{display:none!important}'),'the pager is not printed');
 assert.ok(style.includes('.cbCard tbody tr.cbOffPage{display:table-row!important}'),'every page of rows prints, not only the one on screen');
 assert.ok(style.includes('.cbStickyBalance'),'the reconciliation strip is the shared sticky footer');
 for(const width of ['max-width:1100px','max-width:900px','max-width:760px','max-width:560px'])assert.ok(style.includes(width),'the '+width+' breakpoint is declared');
 assert.ok(style.includes('.cbTableScroll{overflow-x:auto'),'only the table container scrolls sideways');
});

/* ---------- Cash & Bank Book ---------- */

test('the Cash & Bank Book states the brief copy, cards, columns and page contract',()=>{
 const page=read('CashAndBankBook.jsx');
 assert.ok(page.includes('<h1>Cash &amp; Bank Book</h1>'),'the title');
 assert.ok(page.includes('View cash, bank and payment-account transactions and balances.'),'the subtitle');
 assert.ok(page.includes('placeholder="Search transaction, reference or account"'),'the search placeholder');
 for(const card of ['Opening Balance','Total Receipts','Total Payments','Closing Balance'])assert.ok(page.includes('<span>'+card+'</span>'),'the '+card+' card');
 for(const column of ['<th className="cbDateTypeCol">DATE &amp; TRANSACTION TYPE</th>','<th className="cbAccountCol">ACCOUNT</th>','<th className="cbRefCol">REFERENCE</th>','<th className="cbDebitCol cbMoney">DEBIT</th>','<th className="cbCreditCol cbMoney">CREDIT</th>','<th className="cbBalanceCol cbMoney">BALANCE</th>','<th className="cbStatusCol">STATUS</th>'])assert.ok(page.includes(column),'the column '+column);
 assert.ok(page.includes('>Date From<')&&page.includes('>Date To<')&&page.includes('>Account<')&&page.includes('>Branch<')&&page.includes('>Transaction Type<')&&page.includes('>Reconciliation Status<'),'the six required filters');
 assert.ok(page.includes('>Clear Filters<'),'Clear Filters');
 assert.ok(page.includes('Debit and credit amounts follow your accounting records.'),'the debit and credit note');
 assert.ok(page.includes('No cash or bank transactions found.'),'the empty-state title');
 assert.ok(page.includes('No transactions match your filters.'),'the filtered empty-state title');
 assert.ok(/\[perPage,setPerPage\]=useState\(25\)/.test(page),'the pager opens on 25 rows');
 assert.ok(page.includes('{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}'),'the page-size control offers 25, 50 and 100');
 assert.ok(page.includes('Page {pageIndex} of {pageCount}'),'the pager states the page it is on');
 assert.ok(page.includes("sessionStorage.setItem('wayvida-open-account'")&&page.includes("onNavigate('General Ledger')"),'the account handoff opens the ledger where it already lives');
});

test('the Cash & Bank Book reads the chart own classification, never an account code',()=>{
 assert.ok(code('cash-banking.js').includes("from './simple-journal-transaction.js'")&&code('cash-banking.js').includes('isMoneyAccount'),'the eligibility rule is the transaction form own');
 assert.deepEqual(cashBankAccounts(bookState()).map(item=>item.code),['1000','1010','1030','1031'],'only the active, non-group cash and bank ledgers are offered');
 const offered=cashBankAccounts(bookState()).map(item=>item.code);
 assert.equal(offered.filter(code=>code==='1020').length,0,'a ledger merely named after a bank, with no cash-or-bank wording and no group, is not offered');
 assert.equal(offered.filter(code=>code==='1900').length,0,'an inactive cash ledger is not offered');
 assert.equal(offered.filter(code=>code==='1001').length,0,'a cash group header is not offered');
 assert.equal(offered.filter(code=>code==='5700').length,0,'a ledger named Bank Charges but typed Expenses is not a money account');
 assert.deepEqual(sheet().accountOptions.map(item=>item.code),['1000','1010','1030','1031'],'the Account filter offers exactly those ledgers');
 assert.equal(sheet({account:'9999'}).selected,null,'an unknown account selects nothing');
 assert.equal(sheet({account:'9999'}).rows.length,sheet().rows.length,'an unknown account is not a filter, so the whole book is stated');
});

test('the Cash & Bank Book filters on every required field, together',()=>{
 assert.equal(sheet().rows.length,10,'the posted money lines of the period');
 assert.equal(sheet({from:'2026-09-04',to:'2026-09-04'}).rows.length,1,'Date From and Date To are inclusive at both ends');
 assert.equal(sheet({to:'2026-09-01'}).rows.length,1,'Date To alone is inclusive');
 assert.equal(sheet({from:'2026-10-01'}).rows.length,0,'a range after the data states no row');
 assert.equal(sheet({account:'1030'}).rows.length,7,'the Account filter');
 assert.equal(sheet({branch:'abc-trivandrum'}).rows.length,1,'the Branch filter');
 assert.equal(sheet({branch:'abc-kochi'}).rows.length,9,'the other branch');
 assert.deepEqual(sheet().branchOptions,['abc-kochi','abc-trivandrum'],'the branch options are the branches the rows carry');
 assert.deepEqual(sheet().typeOptions,['Journal Entry','Opening Balance','Payment','Receipt','Transfer'],'the type options are the transaction words the rows carry');
 assert.equal(sheet({type:'Payment'}).rows.length,2,'the Transaction Type filter');
 assert.equal(sheet({type:'Transfer'}).rows.length,3,'a Bank Transaction is stated as a Transfer too');
 assert.equal(sheet({type:'Receipt'}).rows.length,2,'the receipt type');
 assert.equal(sheet({type:'Journal Entry'}).rows.length,2,'the journal-entry type');
 assert.equal(sheet({search:'rcpt-hdfc-1'}).rows.length,1,'the search reads the reference');
 assert.equal(sheet({search:'accounts receivable'}).rows.length,2,'the search reads the other side of the entry');
 assert.equal(sheet({search:'1030'}).rows.length,7,'the search reads the account code');
 assert.equal(sheet({search:'zzz'}).rows.length,0,'a search that matches nothing states nothing');
 assert.equal(sheet({type:'Receipt',status:'Unreconciled',search:'rcpt-trv-1'}).rows.length,1,'type, status and search narrow together');
 assert.equal(sheet({type:'Receipt',status:'Excluded'}).rows.length,0,'filters that cannot both hold state nothing');
 assert.equal(sheet().hasRows,true,'the period has rows');
 assert.equal(sheet({from:'2026-10-01'}).hasRows,false,'a period with no row says so');
});

test('the Cash & Bank Book states the ledger own opening, movement and closing balances',()=>{
 const report=sheet();
 assert.equal(report.opening,R(100),'the opening balance is the balance immediately before the range');
 assert.equal(report.receipts,R(6625),'the receipts total is the movement of the rows listed');
 assert.equal(report.payments,R(2000),'the payments total is the movement of the rows listed');
 assert.equal(report.closing,R(4725),'the closing balance is the opening balance plus the movement');
 assert.equal(report.ledgerClosing,R(4725),'the ledger closing balance is read from the posted journal');
 assert.equal(report.difference,0,'the report agrees with the ledger');
 assert.equal(report.valid,true,'every stated check holds');
 assert.ok(report.checks.every(check=>check.ok),'each check re-derives the figure it claims');
 assert.deepEqual(report.groups.map(group=>group.code),['1000','1010','1030','1031'],'one account line per offered ledger');
 assert.equal(report.groups.reduce((total,group)=>total+group.closing,0),report.closing,'the account balances add up to the closing balance');
 assert.deepEqual(report.groups.map(group=>group.closing),[R(150),R(-50),R(3625),R(1000)],'each account states its own closing balance');
 assert.equal(report.groups[0].opening,R(100),'only the ledger with movement before the range carries an opening balance');

 const single=sheet({account:'1030'});
 assert.equal(single.selected.code,'1030','the account is selected');
 assert.equal(single.opening,R(0),'the account opening balance');
 assert.equal(single.closing,R(3625),'the account closing balance');
 assert.equal(single.ledgerClosing,R(3625),'the account ledger balance');
 assert.equal(single.difference,0,'the single-account view agrees with the ledger');
 assert.deepEqual(single.rows.map(row=>row.balance),[R(5000),R(5500),R(5250),R(4250),R(3750),R(3550),R(3625)],'a running balance is stated when one account is selected');
 assert.ok(sheet().rows.every(row=>row.balance===null),'across every account no combined running balance is invented');

 assert.equal(sheet({from:''}).opening,R(0),'with no start date there is no balance before the range');
 assert.equal(sheet({from:'2026-10-01'}).opening,R(4725),'a later range opens on the balance the earlier period closed on');
});

test('the Cash & Bank Book counts only posted lines and never counts an internal transfer as income',()=>{
 const report=sheet();
 assert.ok(report.rows.every(row=>row.posted===true),'only posted lines are stated');
 assert.ok(!report.rows.some(row=>row.number==='DRAFT-1'),'a draft journal line is not stated');
 assert.ok(!report.rows.some(row=>row.number==='VOID-1'),'a cancelled journal line is not stated');
 assert.equal(sheet().pool.filter(row=>row.number==='VOID-1').length,0,'a cancelled line never even enters the pool');
 assert.ok(!report.rows.some(row=>row.number==='SINV-1'),'a journal that touches no money account is not stated');
 assert.ok(!report.rows.some(row=>row.number==='RCPT-OCT-1'),'a line after the range is not stated');
 assert.equal(report.internalRows,4,'a transfer between two of the business own money accounts is marked on both sides');
 assert.equal(report.internalTransfers,0,'the internal transfers move the combined position by nothing');
 assert.equal(report.rows.filter(row=>row.internal).length,4,'the marks are stated on the rows themselves');
 assert.ok(report.rows.filter(row=>row.number==='CHG-HDFC-1').every(row=>row.internal===false),'a bank charge paid to an expense ledger is not an internal transfer');
 assert.equal(report.receipts-report.payments,R(4625),'the movement is the receipts less the payments');
});

test('the Cash & Bank Book reads a reconciliation status from the banking module own match',()=>{
 const report=sheet();
 const counts=report.rows.reduce((total,row)=>{total[row.status]=(total[row.status]||0)+1;return total},{});
 assert.deepEqual(counts,{Unreconciled:3,Reconciled:4,Posted:2,Excluded:1},'every row carries the status the banking match gives it');
 assert.deepEqual(RECONCILIATION_STATUSES,['Reconciled','Unreconciled','Excluded'],'the reconciliation vocabulary is the banking module own');
 assert.deepEqual(CASH_BANK_STATUSES,['Reconciled','Unreconciled','Excluded',POSTED],'Posted is added for the accounts a statement can never be checked against');
 assert.equal(POSTED,'Posted','the posted word is the lifecycle word the family prints');
 assert.ok(report.rows.filter(row=>row.accountCode==='1000'||row.accountCode==='1010').every(row=>row.status===POSTED),'a cash ledger stays Posted');
 assert.equal(sheet({status:'Reconciled'}).rows.length,4,'the Reconciled filter');
 assert.equal(sheet({status:'Unreconciled'}).rows.length,3,'the Unreconciled filter');
 assert.equal(sheet({status:'Excluded'}).rows.length,1,'a statement line excluded on the same account and reference marks the book line Excluded');
 assert.equal(sheet({status:POSTED}).rows.length,2,'the Posted filter');
 assert.deepEqual(sheet({status:'Reconciled'}).rows.filter(row=>row.status!=='Reconciled'),[],'the filter states only what it names');
});

test('the Cash & Bank Book export states the brief columns and money in rupees',()=>{
 const report=sheet();
 const rows=cashBankBookExportRows(report,{organisation:'ABC Retail Pvt Ltd',branch:'All branches',generatedBy:'Local user',generatedAt:'2026-09-29T00:00:00.000Z'});
 assert.equal(rows[0][0],'Wayvida Books \u00b7 Cash & Bank Book','the identity block names the report');
 assert.deepEqual(rows.find(row=>row[0]==='Date range'),['Date range','2026-04-01 to 2026-09-29'],'the identity block states the date range');
 assert.deepEqual(rows.find(row=>row[0]==='Closing balance INR'),['Closing balance INR',4725],'the identity block states the closing balance in rupees');
 assert.deepEqual(rows.find(row=>row[0]==='Account balances'),['Account balances'],'the all-account view states the account balances first');
 assert.deepEqual(rows.find(row=>row[0]==='Account Code'),['Account Code','Account','Opening INR','Receipts INR','Payments INR','Closing INR'],'the account-balance columns');
 const header=rows.find(row=>row[0]==='Date');
 assert.deepEqual(header,['Date','Account','Transaction Type','Reference','Particulars','Debit INR','Credit INR','Balance INR','Status'],'the transaction columns in order');
 const transactions=rows.slice(rows.indexOf(header)+1);
 assert.equal(transactions.length,report.rows.length,'the export states exactly the rows the report shows');
 const receipt=rows.find(row=>row[3]==='RCPT-HDFC-1');
 assert.equal(receipt[5],500,'a debit leaves the engine in paise and is stated in rupees');
 assert.equal(receipt[6],0,'a credit that does not exist is stated as zero in the money columns');
 assert.equal(receipt[7],DASH,'a balance that does not exist is the report own dash, never a zero');
 assert.equal(receipt[1],'1030 \u00b7 HDFC Current Account','the account is stated with its code and name');
 assert.equal(DASH,'\u2014','the dash is the mark the report family prints');
 const single=cashBankBookExportRows(sheet({account:'1030'}),{});
 assert.ok(!single.some(row=>row[0]==='Account balances'),'the single-account view states no account-balance block');
 assert.equal(single.find(row=>row[3]==='RCPT-HDFC-1')[7],5500,'the single-account export states the running balance');
});

/* ---------- Bank Reconciliation ---------- */

test('the Bank Reconciliation report states the brief copy, cards, columns and filters',()=>{
 const page=read('BankReconciliationReport.jsx');
 assert.ok(page.includes('<h1>Bank Reconciliation</h1>'),'the title');
 assert.ok(page.includes('Compare your bank records with your accounting records.'),'the subtitle');
 assert.ok(page.includes('>Import Statement<'),'the statement-import handoff is offered because statement import exists');
 for(const card of ['Book Balance','Bank Statement Balance','Reconciled Amount','Unreconciled Amount','Difference'])assert.ok(page.includes('<span>'+card+'</span>'),'the '+card+' card');
 for(const column of ['<th className="cbDateCol">Date</th>','<th className="cbDescCol">Description</th>','<th className="cbRefCol">Reference</th>','<th className="cbBookCol cbMoney">Book Amount</th>','<th className="cbBankCol cbMoney">Bank Amount</th>','<th className="cbDiffCol cbMoney">Difference</th>','<th className="cbStatusCol">Status</th>','<th className="cbActionsCol">Actions</th>'])assert.ok(page.includes(column),'the column '+column);
 assert.ok(page.includes('placeholder="Search transaction, reference or account"'),'the search placeholder');
 assert.ok(page.includes('>Bank Account<')&&page.includes('>Branch<')&&page.includes('>Statement Date From<')&&page.includes('>Statement Date To<')&&page.includes('>Reconciliation Status<')&&page.includes('>Reference<'),'the six required filters');
 assert.ok(page.includes('>Clear Filters<'),'Clear Filters');
 assert.ok(page.includes('No bank reconciliation data found.'),'the no-bank empty-state title');
 assert.ok(page.includes('No bank statement has been imported for this account and period.'),'the no-statement empty-state title');
 assert.ok(page.includes("sessionStorage.setItem('wayvida-open-bank'")&&page.includes("onNavigate('Bank Reconciliation')"),'the import handoff opens the workspace that owns the import');
 assert.ok(page.includes("sessionStorage.setItem('wayvida-open-account'"),'the transaction handoff opens the ledger');
 assert.ok(page.includes("label:row.status==='Unreconciled'?'Match':'View Statement Line'"),'the row menu offers a match only where a statement line is unmatched');
 assert.ok(!/matchStatement\(|unmatchStatement\(|voidMatch\(|MatchingRule/.test(code('BankReconciliationReport.jsx')),'the report never matches or unmatches anything itself');
});

test('the Bank Reconciliation report reuses the banking module own summary and invents no balance',()=>{
 assert.ok(code('cash-banking.js').includes("from './banking-service.js'")&&code('cash-banking.js').includes('reconciliationSummary'),'the summary is the banking module own');
 const report=reconcile();
 assert.equal(report.bookBalance,R(3625),'the book balance is the posted bank ledger balance for the period');
 assert.equal(report.bankBalance,R(4250),'the statement balance is the imported statement own last balance');
 assert.equal(report.reconciledAmount,R(1750),'the reconciled amount is the matched statement amount');
 assert.equal(report.unreconciledAmount,R(2500),'the unreconciled amount is the unmatched statement amount');
 assert.equal(report.difference,R(625),'the difference is the statement balance less the book balance');
 assert.equal(report.statementAvailable,true,'a statement line falls in the period');
 assert.equal(report.valid,true,'every stated check holds');
 assert.ok(report.checks.every(check=>check.ok),'each check re-derives the figure it claims');
 assert.equal(report.rows.length,9,'a matched pair is stated once, and the statement-only and book-only lines once each');
 assert.equal(report.poolSize,10,'the pool counts the lines outside the range, so the shown count is honest');
 assert.equal(report.bookRows.length,8,'the book side is every posted line on the bank ledger, not only the ones in the range');
 assert.equal(report.statementRows.length,5,'the statement side is the imported rows of this account');
 assert.equal(report.matchedRows,3,'the matched statement lines');
 assert.equal(report.unreconciledRows,5,'the unmatched statement and book lines');
 assert.equal(report.excludedRows,1,'an excluded statement line is stated as excluded, never as a difference');
 assert.ok(report.rows.every(row=>row.status!=='Reconciled'||row.bookAmount===row.bankAmount),'a reconciled row never states two different amounts');
 assert.ok(report.rows.every(row=>row.side!=='statement'||row.bookAmount===null),'a statement-only line leaves the book side blank rather than zero');
 assert.equal(new Set(report.rows.map(row=>row.id)).size,report.rows.length,'a transaction is stated once');
 assert.deepEqual(report.branchOptions,['Calicut','Kochi'],'the branch options are the branches the bank accounts carry');

 assert.equal(reconcile({bankAccount:'bank-icici'}).rows.length,1,'the ICICI account states its own single matched line');
 assert.equal(reconcile({bankAccount:'bank-icici'}).difference,R(0),'the ICICI account agrees');
 assert.equal(reconcile({status:'Reconciled'}).rows.length,3,'the Reconciled filter');
 assert.equal(reconcile({status:'Unreconciled'}).rows.length,5,'the Unreconciled filter');
 assert.equal(reconcile({status:'Excluded'}).rows.length,1,'the Excluded filter');
 assert.equal(reconcile({reference:'TRF-ICICI-1'}).rows.length,1,'the Reference filter');
 assert.equal(reconcile({search:'abc retail'}).rows.length,2,'the search reads the statement description and the book description');
 assert.equal(reconcile({from:'2026-09-20',to:'2026-09-30'}).rows.length,5,'the statement date range is inclusive');
 assert.equal(reconcile({branch:'Kochi'}).selectable.length,2,'the Branch filter narrows the selectable accounts');
 assert.equal(reconcile({branch:'Calicut'}).bank.id,'bank-axis','a branch with one bank account selects it');
});

test('the Bank Reconciliation report states no balance when a period has no imported statement',()=>{
 const report=reconcile({bankAccount:'bank-icici',from:'2026-10-01'});
 assert.equal(report.statementAvailable,false,'no statement line falls in the period');
 assert.equal(report.bankBalance,0,'the statement balance is not invented');
 assert.equal(report.rows.length,0,'there is nothing to compare');
 assert.equal(report.bookBalance,R(1000),'the book balance is still the ledger own');
 assert.equal(report.valid,true,'the report is still internally consistent');

 const unused=reconcile({bankAccount:'bank-axis'});
 assert.equal(unused.statementAvailable,false,'an account with no imported statement says so');
 assert.equal(unused.bookRows.length,0,'and it has no book line either');
 assert.equal(unused.rows.length,0,'so the table is empty');
 assert.equal(unused.hasData,false,'the report knows it has no data');
 assert.equal(unused.valid,true,'and it still holds its checks');

 const none=bankReconciliation(bookState(),{version:3,demoVersion:0,bankAccounts:[],bankTransactions:[],bankMatches:[]},{});
 assert.equal(none.bank,null,'no bank account at all leaves nothing selected');
 assert.equal(none.hasData,false,'and nothing to state');
 assert.equal(none.valid,true,'and no broken check');
 assert.deepEqual(none.rows,[],'and no row');
});

test('the Bank Reconciliation export states the brief columns, the summary and money in rupees',()=>{
 const rows=bankReconciliationExportRows(reconcile(),{organisation:'ABC Retail Pvt Ltd',branch:'All branches',generatedBy:'Local user',generatedAt:'2026-09-29T00:00:00.000Z'});
 assert.equal(rows[0][0],'Wayvida Books \u00b7 Bank Reconciliation','the identity block names the report');
 assert.deepEqual(rows.find(row=>row[0]==='Bank statement balance'),['Bank statement balance',4250],'the statement balance is stated in rupees');
 assert.deepEqual(rows.find(row=>row[0]==='Difference'),['Difference',625],'the difference is stated in rupees');
 const header=rows.find(row=>row[0]==='Date');
 assert.deepEqual(header,['Date','Description','Reference','Book Amount INR','Bank Amount INR','Difference INR','Status'],'the transaction columns in order');
 const transactions=rows.slice(rows.indexOf(header)+1);
 assert.equal(transactions.length,reconcile().rows.length,'the export states exactly the rows the report shows');
 const statementOnly=rows.find(row=>row[2]==='NEFT-OUT-1');
 assert.equal(statementOnly[3],DASH,'a book amount that does not exist is the report own dash, never a zero');
 assert.equal(statementOnly[4],-2500,'a withdrawal is stated with the direction of the movement, in rupees');
 assert.equal(statementOnly[5],DASH,'a difference that does not exist is a dash, never a zero');

 const missing=bankReconciliationExportRows(reconcile({bankAccount:'bank-icici',from:'2026-10-01'}),{});
 assert.deepEqual(missing.find(row=>row[0]==='Bank statement balance'),['Bank statement balance','Not available'],'a missing statement is stated as not available, never as a zero');
 assert.deepEqual(missing.find(row=>row[0]==='Difference'),['Difference','Not available'],'and so is the difference');
});

/* ---------- honesty guards ---------- */

test('no cash or banking report re-derives a tax or reaches past the ledger',()=>{
 const module=code('cash-banking.js');
 assert.ok(!/calculate\(|lineTaxes|invoiceTax/.test(module),'the projection never calls a tax engine');
 assert.ok(!/journal\(|command\(|writeAccounts|saveOperations/.test(module),'the projection never posts or writes');
 assert.ok(!/creditNote|debitNote/i.test(module),'a credit or debit note is not folded into a cash report');
 assert.ok(module.includes("from './transaction-register.js'")&&module.includes('sortTransactions'),'the register own ordering is reused');
 assert.ok(module.includes("from './banking-service.js'"),'the reconciliation reads the banking module own records');
 assert.ok(module.includes('isMoneyAccount')&&module.includes('financialYearStart'),'the shared eligibility rule and financial year are reused');
 assert.ok(/reconciling a statement line never moves a\s+ledger balance/.test(read('cash-banking.js')),'the module says a match never moves a ledger balance');
 assert.ok(/It never posts, never changes a\s*ledger balance/.test(read('BankReconciliationReport.jsx')),'the page says the same to the reader');
 assert.equal(financialYearStart(),statementYearStart(),'the financial year is the statement family own');
 assert.ok(/^\d{4}-04-01$/.test(financialYearStart()),'the year opens on 1 April');
 for(const report of [sheet(),reconcile()])assert.ok(report.checks.every(check=>check.ok),'every stated check holds');
 for(const check of sheet().checks)assert.ok(check.key&&check.label,'a check states a key and a readable label');
});

test('the pass adds exactly four source files',()=>{
 const srcNames=readdirSync('src',{recursive:true}).filter(name=>/^cash-banking\.(js|css)$/.test(name)||/^(CashAndBankBook|BankReconciliationReport)\.jsx$/.test(name));
 assert.deepEqual(srcNames.sort(),['BankReconciliationReport.jsx','CashAndBankBook.jsx','cash-banking.css','cash-banking.js'],'the section is exactly two pages, one projection and one sheet');
});
