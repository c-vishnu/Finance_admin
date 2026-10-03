/* Cash & Banking - the read-only projection behind the Cash & Bank Book and the Bank Reconciliation
   report.

   The Cash & Bank Book is a transaction-level book, not a statement. It states the individual
   movements that touched one of the accounts the Chart of Accounts already classifies as cash or
   bank, in date order, with the running balance the ledger itself carries. The Cash Flow Statement
   classifies those same movements into operating, investing and financing activity; this report
   never does, so the two can never become each other.

   The Bank Reconciliation report is a control report over the banking module's own records: the
   book side is the posted bank ledger, the statement side is what the existing import stored, and
   the match is the existing `bankMatches` row the existing matching workflow wrote. Nothing here
   posts, edits, reverses, matches or adjusts anything: reconciling a statement line never moves a
   ledger balance, and this report never states a balance the ledger does not hold.

   Like every other Wayvida statement this projection only reads. It never calls the tax engines,
   never calls `journal()` or a posting command, and never writes a store. */
import {normalizeAccounts} from './account-master.js';
import {isMoneyAccount} from './simple-journal-transaction.js';
import {transactionType} from './daybook-service.js';
import {bookBalance,bookTransactions,reconciliationSummary} from './banking-service.js';
import {ALL,sortTransactions} from './transaction-register.js';
import {financialYearStart} from './profit-loss.js';

/* The financial year the page opens on is the same 1 April every other statement uses, re-exported
   here so each Cash & Banking page imports its own module only. The register's own 'All' word and
   ordering are reused too, so a filter and a sort mean the same thing here as on the Transaction
   Register. */
export {financialYearStart};
export {ALL};

/* The one missing-value mark the report family prints, and the lifecycle word every posted line
   carries. */
export const DASH='\u2014';
export const POSTED='Posted';

/* The reconciliation vocabulary the banking module already writes. 'Posted' is added for the money
   accounts a bank statement can never be checked against: a cash account is not reconciled. */
export const RECONCILIATION_STATUSES=['Reconciled','Unreconciled','Excluded'];
export const CASH_BANK_STATUSES=[...RECONCILIATION_STATUSES,POSTED];

const posted=journal=>!journal.status||journal.status==='Posted';
const signed=line=>(Number(line.debit)||0)-(Number(line.credit)||0);
const text=value=>String(value??'');
const byName=(left,right)=>String(left.accountName||left.bankName||'').localeCompare(String(right.accountName||right.bankName||''));
const byCodeOrder=(left,right)=>String(left.code).localeCompare(String(right.code),undefined,{numeric:true});
const unique=values=>[...new Set(values.filter(Boolean))].sort();
const sum=(rows,key)=>rows.reduce((total,row)=>total+Number(row[key]||0),0);

/* One day before a date, in the same YYYY-MM-DD the stores hold, so the opening balance can be read
   with the ledger's own rule at the instant before the period starts. */
function priorDate(value){
  const date=new Date(value+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}

/* The accounts the Chart of Accounts already classifies as cash, bank or cash-equivalent. The rule
   is the transaction form's own (src/simple-journal-transaction.js), so a configured UPI, wallet or
   payment-gateway ledger is stated under its own account and is never folded into 'Cash'. No account
   code is ever named here. */
export function cashBankAccounts(state){
  const books=normalizeAccounts(state||{});
  return (books.accounts||[]).filter(item=>item.active&&!item.isGroup).filter(isMoneyAccount).sort(byCodeOrder);
}

/* The ledger balance rule, stated once. One account with no branch filter is read with the banking
   module's own `bookBalance`, which is that rule verbatim; a selected branch narrows the lines by
   the same branch test the Balance Sheet, the Trial Balance, the Profit & Loss, the Cash Flow
   Statement and the General Ledger apply, which `bookBalance` does not carry. */
function balanceThrough(state,codes,{through='9999-12-31',strict=false,branch=ALL}={}){
  const list=(codes||[]).map(String);
  if(branch===ALL&&list.length===1&&!strict)return bookBalance(state,list[0],through);
  const wanted=new Set(list);
  return (state.journals||[]).filter(row=>posted(row)&&(strict?text(row.date)<through:text(row.date)<=through))
    .flatMap(row=>(row.lines||[]).filter(line=>wanted.has(String(line.account))&&(branch===ALL||(line.branch||row.branch||row.branchId)===branch)))
    .reduce((total,line)=>total+signed(line),0);
}

/* The banking records a reconciliation status is read from, indexed once. `bankMatches` is the
   authoritative match - the row the existing matching workflow wrote - so a status is never guessed
   from a date or an amount anywhere in this module. */
function matchIndex(banking){
  const bankById=new Map((banking?.bankAccounts||[]).map(bank=>[bank.id,bank]));
  const statementById=new Map((banking?.bankTransactions||[]).map(row=>[row.id,row]));
  const byJournalAccount=new Map(),byBookId=new Map(),excludedRefs=new Map();
  for(const match of banking?.bankMatches||[]){
    if(match.voided)continue;
    const statement=statementById.get(match.statementId);
    if(!statement)continue;
    const bank=bankById.get(statement.bankAccountId);
    if(bank)byJournalAccount.set(text(match.journalId)+'|'+String(bank.accountCode),statement);
    byBookId.set(text(match.bookTransactionId),statement);
  }
  for(const statement of statementById.values()){
    if(statement.status!=='Excluded')continue;
    const bank=bankById.get(statement.bankAccountId);
    if(!bank)continue;
    const code=String(bank.accountCode),reference=text(statement.reference).trim().toLowerCase();
    if(!reference)continue;
    if(!excludedRefs.has(code))excludedRefs.set(code,new Set());
    excludedRefs.get(code).add(reference);
  }
  return {byJournalAccount,byBookId,excludedRefs};
}

/* A book line is Reconciled only when the banking module holds a match against it. It is Excluded
   when the statement line carrying the same reference on the same account was excluded, and
   Unreconciled when its account is one a statement is reconciled against but no match exists. A
   cash account has no statement, so it stays Posted. */
function reconciliationStatus(index,{journalId,accountCode,reference,reconcilable}){
  if(index.byJournalAccount.has(text(journalId)+'|'+String(accountCode)))return 'Reconciled';
  const excluded=index.excludedRefs.get(String(accountCode));
  if(excluded&&excluded.has(text(reference).trim().toLowerCase()))return 'Excluded';
  return reconcilable?'Unreconciled':POSTED;
}

/* Read-only projection for the Cash & Bank Book. Every eligible money account is offered, the rows
   are one per posted journal line, and the balances are the ledger's own.

   Date From, Date To, Account and Branch decide which movements are in the book at all, so they move
   the opening balance, the closing balance and every account total. Transaction Type, Reconciliation
   Status and Search narrow which of those movements are listed, so they move the receipts and
   payments of the rows shown and leave the account's ledger balance stated on the strip instead of
   silently unbalancing the report. */
export function cashBankBook(state,banking,filters={}){
  const books=normalizeAccounts(state||{});
  const from=text(filters.from),to=text(filters.to);
  const account=filters.account||ALL,branch=filters.branch||ALL,type=filters.type||ALL,status=filters.status||ALL;
  const query=text(filters.search||'').trim().toLowerCase();
  const chart=cashBankAccounts(books);
  const byCode=new Map(chart.map(item=>[String(item.code),item]));
  const known=new Map((books.accounts||[]).map(item=>[String(item.code),item]));
  const selected=chart.find(item=>String(item.code)===String(account))||null;
  const scope=selected?[selected]:chart;
  const scopeCodes=new Set(scope.map(item=>String(item.code)));
  const allCodes=new Set(chart.map(item=>String(item.code)));
  const reconcilable=new Set((banking?.bankAccounts||[]).map(bank=>String(bank.accountCode)));
  const index=matchIndex(banking);
  const accountName=code=>known.get(String(code))?.name||byCode.get(String(code))?.name||code;

  /* One pass over the posted journal builds the whole book. A journal whose other side is another of
     the business own money accounts is an internal transfer: it changes the mix of cash, never the
     amount of it, so it is marked rather than counted as income or expense. */
  const unordered=[];
  for(const journal of books.journals||[]){
    if(!posted(journal))continue;
    const legs=(journal.lines||[]).filter(line=>branch===ALL||(line.branch||journal.branch||journal.branchId)===branch);
    const cashLegs=legs.filter(line=>allCodes.has(String(line.account)));
    if(!cashLegs.length)continue;
    const internal=!legs.some(line=>!allCodes.has(String(line.account)));
    const source=text(journal.source),kind=transactionType(source),number=text(journal.number);
    const reference=text(journal.reference||journal.number);
    const counterparty=legs.filter(line=>!cashLegs.includes(line)).map(line=>accountName(line.account)).filter(Boolean).join(' ');
    for(const line of cashLegs){
      const code=String(line.account);
      if(!scopeCodes.has(code))continue;
      const entry=byCode.get(code)||{code,name:code,group:''};
      const debit=Number(line.debit)||0,credit=Number(line.credit)||0;
      const particulars=text(line.description||source||kind);
      const lineIndex=(journal.lines||[]).filter(item=>String(item.account)===code).indexOf(line);
      unordered.push({
        /* The banking module numbers a book line `book:<journalId>:<index>` inside one bank account.
           This book states every account at once, and a transfer between two of them puts a line on
           each, so the account code belongs in the key: no two lines of one journal can share it. */
        id:'cb:'+text(journal.id)+':'+code+':'+lineIndex,
        date:text(journal.date),
        accountCode:code,
        accountName:entry.name,
        accountGroup:entry.group||'',
        journalId:text(journal.id),
        journalNumber:number,
        number:number||reference,
        type:kind,
        reference,
        particulars,
        debit,
        credit,
        amount:Math.abs(debit-credit),
        balance:null,
        branch:text(line.branch||journal.branch||journal.branchId||''),
        internal,
        posted:true,
        status:reconciliationStatus(index,{journalId:journal.id,accountCode:code,reference,reconcilable:reconcilable.has(code)}),
        searchText:[number,journal.reference,kind,particulars,entry.name,code,counterparty].filter(Boolean).join(' ').toLowerCase()
      });
    }
  }
  /* The register's own ordering control, oldest first: a running balance only reads downwards. */
  const pool=sortTransactions(unordered,'oldest');
  const inRange=date=>!(from&&date<from)&&!(to&&date>to);
  const scoped=pool.filter(row=>inRange(row.date));

  /* The running balance is the ledger's, so it is assigned over every row in the period before the
     narrowing filters remove any, and only for a single account: a combined running balance across
     unrelated accounts would be meaningless, so the all-account view states account totals instead. */
  const opening=balanceThrough(books,scope.map(item=>String(item.code)),{through:from?priorDate(from):'',branch});
  if(selected){let running=opening;for(const row of scoped){running+=row.debit-row.credit;row.balance=running}}

  const rows=sortTransactions(scoped.filter(row=>{
    if(type!==ALL&&row.type!==type)return false;
    if(status!==ALL&&row.status!==status)return false;
    if(!query)return true;
    return row.searchText.includes(query);
  }),'oldest');

  const receipts=sum(rows,'debit'),payments=sum(rows,'credit'),closing=opening+receipts-payments;
  const ledgerClosing=balanceThrough(books,scope.map(item=>String(item.code)),{through:to||'9999-12-31',branch});
  const groups=scope.map(item=>{
    const code=String(item.code),own=rows.filter(row=>row.accountCode===code);
    const accountOpening=balanceThrough(books,[code],{through:from?priorDate(from):'',branch});
    const accountReceipts=sum(own,'debit'),accountPayments=sum(own,'credit');
    return {code,name:item.name,group:item.group||'',opening:accountOpening,receipts:accountReceipts,payments:accountPayments,closing:accountOpening+accountReceipts-accountPayments,rows:own.length};
  });
  const transferRows=rows.filter(row=>row.internal);
  const transferMovement=transferRows.reduce((total,row)=>total+row.debit-row.credit,0);

  /* Six assertions, each re-deriving a figure from the rows it claims to summarise rather than
     trusting the loop that produced it. A genuine difference is reported, never forced to zero. */
  const checks=[
    {key:'closingStated',label:'The closing balance is not the opening balance plus the movement',ok:closing===opening+receipts-payments},
    {key:'ledgerAgrees',label:'The rows listed do not add up to the account ledger balance',ok:ledgerClosing-closing===0},
    {key:'accountTotals',label:'The account balances do not add up to the closing balance',ok:sum(groups,'closing')===closing},
    {key:'oneRowPerLine',label:'A journal line is stated more than once',ok:new Set(rows.map(row=>row.id)).size===rows.length},
    {key:'transfersNotIncome',label:'An internal transfer moved the combined cash and bank position',ok:Boolean(selected)||transferMovement===0},
    {key:'postedOnly',label:'An unposted entry reached the book',ok:rows.every(row=>row.posted===true)}
  ];
  return {
    from,to,account,branch,type,status,search:query,
    accounts:chart,accountOptions:chart.map(item=>({code:String(item.code),name:item.name})),
    selected,scope,
    rows,scoped,pool,
    groups,
    opening,receipts,payments,closing,ledgerClosing,difference:ledgerClosing-closing,
    branchOptions:unique(pool.map(row=>row.branch)),
    typeOptions:unique(scoped.map(row=>row.type)),
    statusOptions:CASH_BANK_STATUSES,
    hasRows:scoped.length>0,periodActivity:scoped.length>0,
    internalRows:transferRows.length,internalTransfers:transferMovement,
    count:rows.length,
    checks,valid:checks.every(check=>check.ok)
  };
}

/* Export shape for the shared CSV/Excel writer in src/daybook-export.js. Money leaves the engine in
   integer paise, as every other report export does, and is stated in rupees in the sheet. The
   identity block states the account, the date range and every active filter, and - in the
   all-account view, where no single running balance exists - the account-level opening, movement and
   closing balances are stated before the transactions. */
export function cashBankBookExportRows(report,{organisation='',branch=ALL,generatedBy='Local user',generatedAt=''}={}){
  const applied=Object.entries({Account:report.selected?report.selected.code+' \u00b7 '+report.selected.name:ALL,'Transaction Type':report.type==='All'?'':report.type,'Reconciliation Status':report.status==='All'?'':report.status,Search:report.search||''}).filter(([,value])=>value&&value!==ALL).map(([key,value])=>key+': '+value);
  const rows=[
    ['Wayvida Books \u00b7 Cash & Bank Book','View cash, bank and payment-account transactions and balances.'],
    ['Organisation',organisation],
    ['Branch',branch===ALL?'All branches':branch],
    ['Account',report.selected?report.selected.code+' \u00b7 '+report.selected.name:'All cash and bank accounts'],
    ['Date range',(report.from||'Beginning')+' to '+(report.to||'Latest')],
    ['Applied filters',applied.length?applied.join(' \u00b7 '):'None'],
    ['Opening balance INR',report.opening/100],
    ['Total receipts INR',report.receipts/100],
    ['Total payments INR',report.payments/100],
    ['Closing balance INR',report.closing/100],
    ['Ledger closing balance INR',report.ledgerClosing/100],
    ['Difference INR',report.difference/100],
    ['Transactions',report.rows.length],
    ['Generated by',generatedBy],
    ['Generated at',generatedAt],
    []
  ];
  if(report.groups.length>1){
    rows.push(['Account balances'],['Account Code','Account','Opening INR','Receipts INR','Payments INR','Closing INR']);
    for(const group of report.groups)rows.push([group.code,group.name,group.opening/100,group.receipts/100,group.payments/100,group.closing/100]);
    rows.push([]);
  }
  rows.push(['Date','Account','Transaction Type','Reference','Particulars','Debit INR','Credit INR','Balance INR','Status']);
  for(const row of report.rows)rows.push([row.date,row.accountCode+' \u00b7 '+row.accountName,row.type,row.reference||DASH,row.particulars,row.debit/100,row.credit/100,row.balance==null?DASH:row.balance/100,row.status]);
  return rows;
}

/* Read-only projection for the Bank Reconciliation report. The bank account is required and is
   offered from the bank accounts the Banking module already holds - every one of them linked to an
   Assets cash-and-bank ledger - so no ordinary expense or revenue account is ever selectable.

   The summary is the banking module's own `reconciliationSummary`, so the book balance, the
   statement balance, the reconciled and unreconciled amounts and the difference are the figures the
   reconciliation workspace states for the same period. When no statement line falls in the period
   the statement balance is not available, and the report says so rather than inventing a figure. */
export function bankReconciliation(state,banking,filters={}){
  const books=normalizeAccounts(state||{});
  const from=text(filters.from),to=text(filters.to);
  const status=filters.status||ALL,branch=filters.branch||ALL;
  const reference=text(filters.reference||'').trim().toLowerCase();
  const query=text(filters.search||'').trim().toLowerCase();
  const accounts=[...(banking?.bankAccounts||[])].sort(byName);
  const branchOptions=unique(accounts.map(bank=>bank.branch));
  const selectable=branch===ALL?accounts:accounts.filter(bank=>bank.branch===branch);
  const wanted=text(filters.bankAccount||'');
  const bank=selectable.find(item=>text(item.id)===wanted)||selectable[0]||null;
  if(!bank)return {from,to,status,branch,branchOptions,accounts,selectable,bank:null,rows:[],bookRows:[],statementRows:[],summary:null,statementAvailable:false,bookBalance:0,bankBalance:0,reconciledAmount:0,unreconciledAmount:0,difference:0,hasData:false,count:0,checks:[],valid:true};

  const bookRows=bookTransactions(books,bank).map(row=>({...row,amount:Math.abs((Number(row.moneyIn)||0)-(Number(row.moneyOut)||0)),number:text(row.reference||row.journalId)}));
  const bookById=new Map(bookRows.map(row=>[row.id,row]));
  const statementRows=[...(banking.bankTransactions||[])].filter(row=>row.bankAccountId===bank.id).sort((left,right)=>text(left.date).localeCompare(text(right.date))).map(row=>({...row,amount:Math.abs((Number(row.credit)||0)-(Number(row.debit)||0)),number:text(row.reference)}));
  const statementById=new Map(statementRows.map(row=>[row.id,row]));
  const matchByStatement=new Map(),matchByBook=new Map();
  for(const match of banking.bankMatches||[]){
    if(match.voided)continue;
    if(statementById.has(match.statementId))matchByStatement.set(match.statementId,match);
    if(bookById.has(match.bookTransactionId))matchByBook.set(match.bookTransactionId,match);
  }
  /* An empty To date means 'latest', the way every other report states it, so the banking module's
     own summary is never handed an empty bound. */
  const upto=to||'9999-12-31';
  const summary=reconciliationSummary(banking,books,bank.id,{from,to:upto});

  const merged=[];
  for(const statement of statementRows){
    const match=matchByStatement.get(statement.id),book=match?bookById.get(match.bookTransactionId):null;
    const bookAmount=book?(Number(book.moneyIn)||0)-(Number(book.moneyOut)||0):null;
    const bankAmount=(Number(statement.credit)||0)-(Number(statement.debit)||0);
    merged.push({
      id:'recon:'+statement.id,
      date:text(statement.date),
      description:text(statement.description||statement.reference||'Bank statement line'),
      reference:text(statement.reference),
      bookAmount,bankAmount,difference:bookAmount==null?null:bookAmount-bankAmount,
      status:book?'Reconciled':statement.status==='Excluded'?'Excluded':'Unreconciled',
      statementId:statement.id,bookTransactionId:book?book.id:'',journalId:book?book.journalId:'',
      accountCode:String(bank.accountCode),type:'Bank Transaction',side:book?'both':'statement',
      reconciliationId:text(statement.reconciliationId),
      number:text(statement.reference||statement.id),amount:Math.abs(bankAmount),
      searchText:[statement.date,statement.description,statement.reference,bank.accountName,bank.bankName].filter(Boolean).join(' ').toLowerCase()
    });
  }
  for(const book of bookRows){
    if(matchByBook.has(book.id))continue;
    const bookAmount=(Number(book.moneyIn)||0)-(Number(book.moneyOut)||0);
    merged.push({
      id:'recon:'+book.id,
      date:text(book.date),
      description:text(book.description||book.reference||'Book transaction'),
      reference:text(book.reference),
      bookAmount,bankAmount:null,difference:null,
      status:'Unreconciled',
      statementId:'',bookTransactionId:book.id,journalId:book.journalId,
      accountCode:String(bank.accountCode),type:'Book transaction',side:'book',reconciliationId:'',
      number:text(book.reference||book.id),amount:Math.abs(bookAmount),
      searchText:[book.date,book.description,book.reference,bank.accountName,'book transaction'].filter(Boolean).join(' ').toLowerCase()
    });
  }
  const rows=sortTransactions(merged.filter(row=>{
    if(from&&row.date<from)return false;
    if(to&&row.date>to)return false;
    if(status!==ALL&&row.status!==status)return false;
    if(reference&&!row.reference.toLowerCase().includes(reference))return false;
    if(!query)return true;
    return row.searchText.includes(query);
  }),'oldest');

  /* The local names keep the banking module's own balance function visible, so the check below can
     re-derive the card from the ledger instead of restating it. */
  const ledgerBookBalance=summary.bookBalance,statementBalance=summary.bankBalance;
  const reconciledAmount=summary.reconciled,unreconciledAmount=summary.unreconciled,difference=summary.difference;
  const statementAvailable=summary.rows.length>0;
  const checks=[
    {key:'differenceStated',label:'The difference is not the statement balance less the book balance',ok:!statementAvailable||difference===statementBalance-ledgerBookBalance},
    {key:'balancesFromLedger',label:'The book balance is not the posted bank ledger balance',ok:ledgerBookBalance===bookBalance(books,bank.accountCode,upto)},
    {key:'matchedPairsAgree',label:'A reconciled row states two different amounts',ok:rows.every(row=>row.status!=='Reconciled'||row.bookAmount===row.bankAmount)},
    {key:'oneRowPerLine',label:'A transaction is stated more than once',ok:new Set(rows.map(row=>row.id)).size===rows.length},
    {key:'statementOnlyUnmatched',label:'A statement line is matched but has no book side',ok:rows.every(row=>row.side!=='statement'||row.bookAmount===null)},
    {key:'noBookRowTwice',label:'A book transaction is stated more than once',ok:rows.filter(row=>row.bookTransactionId).length===new Set(rows.filter(row=>row.bookTransactionId).map(row=>row.bookTransactionId)).size}
  ];
  return {
    from,to,status,branch,branchOptions,accounts,selectable,bank,
    rows,bookRows,statementRows,reference,poolSize:merged.length,
    summary,statementAvailable,
    bookBalance:ledgerBookBalance,bankBalance:statementBalance,reconciledAmount,unreconciledAmount,difference,
    matchedRows:rows.filter(row=>row.status==='Reconciled').length,
    unreconciledRows:rows.filter(row=>row.status==='Unreconciled').length,
    excludedRows:rows.filter(row=>row.status==='Excluded').length,
    hasData:bookRows.length>0||statementRows.length>0,
    count:rows.length,
    checks,valid:checks.every(check=>check.ok)
  };
}

/* Export shape for the Bank Reconciliation report: the identity block and the five summary figures
   the brief lists, then one line per transaction with the book amount, the bank amount and the
   difference. An amount that does not exist is printed as the report's own dash, never as a zero. */
export function bankReconciliationExportRows(report,{organisation='',branch=ALL,generatedBy='Local user',generatedAt=''}={}){
  const applied=Object.entries({'Reconciliation Status':report.status==='All'?'':report.status,Reference:report.reference||'',Search:report.search||''}).filter(([,value])=>value&&value!==ALL).map(([key,value])=>key+': '+value);
  const rows=[
    ['Wayvida Books \u00b7 Bank Reconciliation','Compare your bank records with your accounting records.'],
    ['Organisation',organisation],
    ['Branch',branch===ALL?'All branches':branch],
    ['Bank account',report.bank?report.bank.bankName+' \u00b7 '+report.bank.accountName:'None'],
    ['Statement period',(report.from||'Beginning')+' to '+(report.to||'Latest')],
    ['Applied filters',applied.length?applied.join(' \u00b7 '):'None'],
    ['Book balance INR',report.bookBalance/100],
    ['Bank statement balance',report.statementAvailable?report.bankBalance/100:'Not available'],
    ['Reconciled amount INR',report.reconciledAmount/100],
    ['Unreconciled amount INR',report.unreconciledAmount/100],
    ['Difference',report.statementAvailable?report.difference/100:'Not available'],
    ['Transactions',report.rows.length],
    ['Generated by',generatedBy],
    ['Generated at',generatedAt],
    [],
    ['Date','Description','Reference','Book Amount INR','Bank Amount INR','Difference INR','Status']
  ];
  for(const row of report.rows)rows.push([row.date,row.description,row.reference||DASH,row.bookAmount==null?DASH:row.bookAmount/100,row.bankAmount==null?DASH:row.bankAmount/100,row.difference==null?DASH:row.difference/100,row.status]);
  return rows;
}
