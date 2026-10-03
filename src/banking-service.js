import {journal,minor} from './invoice-engine.js';
import {validatePostingDate} from './period-locking.js';

export const BANKING_KEY='wayvida-banking-v1';
export const BANKING_DEMO_VERSION=3;
export const BANKING_PERMISSIONS=['View Reconciliation','Create Reconciliation','Import Statement','View Bank Statement','Delete Imported Statement','Match Transactions','Unmatch Transaction','Create Adjustment','Complete Reconciliation','Unlock Reconciliation','Export Report','View Audit History'];
export const initialBanking=()=>({version:3,demoVersion:0,bankAccounts:[],bankTransactions:[],bankMatches:[],bankTransfers:[],reconciliations:[],matchingRules:[{id:'default-amount-date',name:'Amount and date within 3 days',priority:1,ruleType:'Suggest Match',bankAccountId:'all',amountCondition:'Exact Match',dateToleranceDays:3,referenceCondition:'',referenceValue:'',descriptionCondition:'',descriptionValue:'',confidence:85,requireReference:false,enabled:true}],categorizationRules:[],importSettings:{fileType:'CSV',dateFormat:'YYYY-MM-DD',currencyFormat:'INR',decimalSeparator:'.',duplicateDetection:true,columnMapping:{date:'Transaction Date',description:'Narration',reference:'Reference',credit:'Deposit',debit:'Withdrawal',balance:'Balance'}},reconciliationSettings:{matchingToleranceDays:3,autoMatchThreshold:95,allowAutoCategorization:false,allowAdjustmentCreation:true},permissions:BANKING_PERMISSIONS.map(name=>({name,enabled:true})),integrations:[],audit:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const today=()=>new Date().toLocaleDateString('en-CA');
const requireActive=(banking,bankId)=>{const account=banking.bankAccounts.find(row=>row.id===bankId);if(!account)throw Error('Bank account not found.');if(account.status!=='Active')throw Error('Inactive bank accounts cannot receive new transactions.');return account};
export function readBanking(){try{const value=JSON.parse(localStorage.getItem(BANKING_KEY)||'null');if(!value?.bankAccounts)return initialBanking();const defaults=initialBanking();return {...defaults,...value,version:3,bankTransfers:value.bankTransfers||[],matchingRules:value.matchingRules?.length?value.matchingRules:defaults.matchingRules,importSettings:{...defaults.importSettings,...value.importSettings,columnMapping:{...defaults.importSettings.columnMapping,...value.importSettings?.columnMapping}},reconciliationSettings:{...defaults.reconciliationSettings,...value.reconciliationSettings},permissions:value.permissions?.length?value.permissions:defaults.permissions}}catch{return initialBanking()}}
export function saveBanking(value){localStorage.setItem(BANKING_KEY,JSON.stringify(value));return value}
export function bookBalance(accounting,accountCode,through='9999-12-31'){return (accounting.journals||[]).filter(row=>row.status==='Posted'&&row.date<=through).flatMap(row=>row.lines||[]).filter(line=>line.account===accountCode).reduce((sum,line)=>sum+Number(line.debit||0)-Number(line.credit||0),0)}
export function saveBankAccount(banking,accounting,input){
  const next=clone(banking),state=clone(accounting),existing=next.bankAccounts.find(row=>row.id===input.id);
  if(!input.bankName?.trim()||!input.accountName?.trim()||!input.accountType)throw Error('Bank name, account name, and account type are required.');
  let accountCode=input.accountCode?.trim();
  if(accountCode){
    let ledger=state.accounts.find(row=>row.code===accountCode);
    if(!ledger){
      ledger={id:`bank-ledger:${accountCode}`,code:accountCode,name:input.accountName.trim(),type:'Assets',nature:'Debit',group:'Cash and Bank',parent:'',active:true,isGroup:false,system:false,controlAccount:false,revision:1};
      state.accounts.push(ledger);
    }else{
      if(ledger.type!=='Assets'||ledger.isGroup)throw Error('Select an active posting Assets account.');
      if(!ledger.active)throw Error('The linked ledger account is inactive.');
    }
  }else{
    let code=1010;
    while(state.accounts.some(row=>row.code===String(code)))code++;
    accountCode=String(code);
    state.accounts.push({id:`bank-ledger:${accountCode}`,code:accountCode,name:input.accountName.trim(),type:'Assets',nature:'Debit',group:'Cash and Bank',parent:'',active:true,isGroup:false,system:false,controlAccount:false,revision:1});
  }
  if(next.bankAccounts.some(row=>row.id!==input.id&&row.accountCode===accountCode))throw Error('This ledger is already linked to another bank account.');
  const stamp=now();
  const openingBalanceCents=input.openingBalance?minor(input.openingBalance):0;
  const openingDate=input.openingBalanceDate||today();
  const record={
    ...input,
    id:input.id||id('bank'),
    bankName:input.bankName.trim(),
    accountName:input.accountName.trim(),
    accountNumber:input.accountNumber?.trim()||'',
    accountType:input.accountType||'Current Account',
    branch:input.branch?.trim()||input.branchName?.trim()||'Kochi Branch',
    organisation:input.organisation?.trim()||input.organizationName?.trim()||'ABC Technologies Pvt Ltd',
    ifsc:input.ifsc?.trim()||'',
    accountCode,
    currency:input.currency||'INR',
    openingBalance:openingBalanceCents,
    openingBalanceDate:openingDate,
    status:input.status||'Active',
    createdAt:existing?.createdAt||stamp,
    updatedAt:stamp
  };
  if(openingBalanceCents>0){
    ensureAccount(state,'3000','Opening Balance Equity','Equity','Credit');
    const token=`open-bank:${record.id}`;
    const existingJournalIndex=(state.journals||[]).findIndex(j=>j.id===token||(j.source==='Opening Balance'&&j.lines?.some(l=>l.account===accountCode)));
    if(existingJournalIndex>=0){
      state.journals[existingJournalIndex]={
        ...state.journals[existingJournalIndex],
        date:openingDate,
        lines:[
          {account:accountCode,debit:openingBalanceCents,credit:0,description:`Opening balance for ${record.accountName}`},
          {account:'3000',debit:0,credit:openingBalanceCents,description:'Opening balance equity'}
        ]
      };
    }else{
      journal(state,{id:id('open-bank'),number:`OPEN-${accountCode}`},'Opening Balance',[
        {account:accountCode,debit:openingBalanceCents,credit:0,description:`Opening balance for ${record.accountName}`},
        {account:'3000',debit:0,credit:openingBalanceCents,description:'Opening balance equity'}
      ],openingDate,token);
    }
  }
  next.bankAccounts=existing?next.bankAccounts.map(row=>row.id===record.id?record:row):[record,...next.bankAccounts];
  const ledger=state.accounts.find(row=>row.code===accountCode);
  if(ledger)Object.assign(ledger,{name:record.accountName,active:record.status==='Active'});
  next.audit.push({id:id('audit'),action:existing?'edit bank account':'create bank account',bankAccountId:record.id,by:'Admin',at:stamp});
  return {banking:next,accounting:state,record};
}
export function bookTransactions(accounting,bank){let balance=0;return (accounting.journals||[]).filter(row=>row.status==='Posted').sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)).flatMap(entry=>(entry.lines||[]).filter(line=>line.account===bank.accountCode).map((line,index)=>({id:`book:${entry.id}:${index}`,bankAccountId:bank.id,date:entry.date,description:line.description||entry.source,reference:entry.reference||entry.number,moneyIn:Number(line.debit||0),moneyOut:Number(line.credit||0),balance:balance+=Number(line.debit||0)-Number(line.credit||0),status:'Book transaction',source:'Book',journalId:entry.id})))}
export function importStatement(banking,bankId,rows,{fileName='Statement',actor='Admin',reconciliationId=null}={}){const next=clone(banking);requireActive(next,bankId);const reconciliation=reconciliationId?next.reconciliations.find(row=>row.id===reconciliationId):null;if(reconciliation&&['Completed','Locked'].includes(reconciliation.status))throw Error('Unlock this reconciliation before importing another statement.');let imported=0;for(const raw of rows){const date=String(raw.date||'').trim(),reference=String(raw.reference||raw.transactionReference||'').trim(),debit=minor(raw.debit||0),credit=minor(raw.credit||0),fingerprint=[bankId,date,reference,debit,credit].join('|');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Statement dates must use YYYY-MM-DD.');if(reconciliation&&(date<reconciliation.periodFrom||date>reconciliation.periodTo))throw Error('Statement rows must fall inside the reconciliation period.');if(debit<0||credit<0||(!debit&&!credit)||debit&&credit)throw Error('Each statement row needs either debit or credit.');if(next.bankTransactions.some(row=>row.fingerprint===fingerprint))continue;next.bankTransactions.push({id:id('banktx'),bankAccountId:bankId,reconciliationId,date,reference,description:String(raw.description||''),debit,credit,balance:raw.balance===''||raw.balance==null?null:minor(raw.balance),category:'',matchedWith:'',status:'Unmatched',source:'Statement',fingerprint,importedBy:actor,importedAt:now(),fileName});imported++}if(reconciliation){reconciliation.status='In Progress';reconciliation.importedBy=actor;reconciliation.importedAt=now();reconciliation.fileName=fileName;}next.audit.push({id:id('audit'),action:'import bank statement',bankAccountId:bankId,reconciliationId,fileName,rows:imported,by:actor,at:now()});return {banking:next,imported}}
export function parseStatementCsv(text,settings=null){const lines=String(text).trim().split(/\r?\n/).filter(Boolean),cells=line=>{const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'&&line[i+1]==='"'){value+='"';i++}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){out.push(value.trim());value=''}else value+=char}out.push(value.trim());return out};if(lines.length<2)return[];const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,''),headers=cells(lines[0]).map(normalize),mapping=settings?.columnMapping||{},physical={date:mapping.date||'Date',description:mapping.description||'Description',reference:mapping.reference||'Transaction Reference',debit:mapping.debit||'Debit',credit:mapping.credit||'Credit',balance:mapping.balance||'Balance'},indexes=Object.fromEntries(Object.entries(physical).map(([key,value])=>[key,headers.indexOf(normalize(value))]));if(['date','description','debit','credit'].some(key=>indexes[key]<0))throw Error('Statement columns do not match the saved Bank Import Settings.');return lines.slice(1).map(line=>{const values=cells(line),row={};for(const [key,index] of Object.entries(indexes))row[key]=index<0?'':values[index]||'';return row})}
export function matchStatement(banking,statementId,bookTransaction,{actor='Admin'}={}){const next=clone(banking),statement=next.bankTransactions.find(row=>row.id===statementId);if(!statement||statement.status==='Excluded')throw Error('Available statement transaction not found.');if(next.bankMatches.some(row=>row.statementId===statementId&&!row.voided))throw Error('This statement transaction is already matched.');const statementAmount=statement.credit||statement.debit,bookAmount=bookTransaction.moneyIn||bookTransaction.moneyOut;if(statementAmount!==bookAmount)throw Error('Transaction amounts must be equal to match.');if((statement.credit>0)!==(bookTransaction.moneyIn>0))throw Error('Money In can only match a bank debit in the ledger, and Money Out can only match a bank credit.');const match={id:id('match'),statementId,bookTransactionId:bookTransaction.id,journalId:bookTransaction.journalId,amount:statementAmount,matchedBy:actor,matchedAt:now()};next.bankMatches.push(match);statement.status='Matched';statement.matchedWith=bookTransaction.reference||bookTransaction.journalId;next.audit.push({id:id('audit'),action:'match bank transaction',bankAccountId:statement.bankAccountId,statementId,journalId:bookTransaction.journalId,by:actor,at:match.matchedAt});return {banking:next,match}}
export function excludeStatement(banking,statementId,{actor='Admin'}={}){const next=clone(banking),row=next.bankTransactions.find(item=>item.id===statementId);if(!row||row.status==='Matched')throw Error('Matched transactions must be unmatched before exclusion.');row.status='Excluded';row.excludedBy=actor;row.excludedAt=now();next.audit.push({id:id('audit'),action:'exclude bank transaction',statementId,bankAccountId:row.bankAccountId,by:actor,at:row.excludedAt});return next}
const checkPeriodLock=(date,actor='Admin',options={})=>{
  try{
    if(typeof localStorage==='undefined')return {allowed:true};
    return validatePostingDate(date,actor,options);
  }catch{
    return {allowed:true};
  }
};
const ensureAccount=(state,code,name,type,nature)=>{let account=state.accounts.find(row=>row.code===code);if(!account){account={id:`system:${code}`,code,name,type,nature,group:type==='Income'?'Other Income':'Operating Expenses',active:true,isGroup:false,system:true,controlAccount:false,revision:1};state.accounts.push(account)}if(!account.active||account.isGroup)throw Error(`Configure an active posting ${type} account for ${code}.`);return code};
export function createStatementEntry(banking,accounting,statementId,kind,{actor='Admin',notes=''}={}){const next=clone(banking),state=clone(accounting),row=next.bankTransactions.find(item=>item.id===statementId);if(!row||row.status!=='Unmatched')throw Error('Only unmatched statement transactions can create accounting.');const bank=requireActive(next,row.bankAccountId),lock=checkPeriodLock(row.date,actor,{});if(!lock.allowed)throw Error(lock.message);const token=`bank-statement:${row.id}`;let counter,label,source='Bank Transaction';if(['Bank charge','Expense'].includes(kind)){counter=ensureAccount(state,'6100','Bank Charges','Expenses','Debit');label=kind==='Expense'?'Bank expense':'Bank charge'}else if(['Interest income','Categorize income'].includes(kind)){counter=ensureAccount(state,'4200','Interest Income','Income','Credit');label='Bank interest'}else if(kind==='Customer receipt'){counter=ensureAccount(state,'1100','Accounts Receivable','Assets','Debit');label='Customer receipt';source='Customer Receipt'}else throw Error('Choose a supported transaction type.');const amount=row.credit||row.debit,bankDebit=row.credit>0;if(kind==='Customer receipt'&&!bankDebit)throw Error('A customer receipt must be a Money In transaction.');const lines=bankDebit?[{account:bank.accountCode,debit:amount,credit:0,description:label},{account:counter,debit:0,credit:amount,description:label}]:[{account:counter,debit:amount,credit:0,description:label},{account:bank.accountCode,debit:0,credit:amount,description:label}],entry=journal(state,{id:row.id,number:row.reference||row.id},source,lines,row.date,token);const book={id:`book:${entry.id}:${bankDebit?0:1}`,journalId:entry.id,moneyIn:bankDebit?amount:0,moneyOut:bankDebit?0:amount};const matched=matchStatement(next,row.id,book,{actor});const matchedRow=matched.banking.bankTransactions.find(item=>item.id===row.id);if(matchedRow){if(['Expense','Customer receipt','Categorize income'].includes(kind))matchedRow.status='Categorized';matchedRow.category=kind;matchedRow.matchedWith=entry.number}matched.banking.audit.push({id:id('audit'),action:'create accounting from bank transaction',statementId:row.id,journalId:entry.id,kind,notes,by:actor,at:now()});return {banking:matched.banking,accounting:state,journal:entry}}
export function transferMoney(banking,accounting,input,{actor='Admin'}={}){
  const next=clone(banking),state=clone(accounting);
  const from=requireActive(next,input.fromAccountId),to=requireActive(next,input.toAccountId);
  if(from.id===to.id)throw Error('Source and destination accounts must be different.');
  const amount=minor(input.amount);
  if(amount<=0)throw Error('Transfer amount must be greater than zero.');
  const lock=checkPeriodLock(input.date,actor,{});
  if(!lock.allowed)throw Error(lock.message);
  const ref=input.reference?.trim()||`TRF-${Date.now().toString().slice(-6)}`;
  const token=`bank-transfer:${ref}:${input.date}:${from.id}:${to.id}:${amount}`;
  const entry=journal(state,{id:id('transfer'),number:ref},'Bank Transfer',[
    {account:to.accountCode,debit:amount,credit:0,description:`Transfer from ${from.accountName}`},
    {account:from.accountCode,debit:0,credit:amount,description:`Transfer to ${to.accountName}`}
  ],input.date,token);
  const transferRecord={
    id:id('trf'),
    journalId:entry.id,
    number:ref,
    date:input.date,
    fromAccountId:from.id,
    toAccountId:to.id,
    fromAccountName:from.accountName,
    toAccountName:to.accountName,
    amount,
    reference:input.reference||'',
    notes:input.notes||'',
    status:'Posted',
    createdAt:now(),
    createdBy:actor
  };
  if(!next.bankTransfers)next.bankTransfers=[];
  next.bankTransfers.unshift(transferRecord);
  next.audit.push({id:id('audit'),action:'bank transfer',fromAccountId:from.id,toAccountId:to.id,journalId:entry.id,amount,notes:input.notes||'',by:actor,at:now()});
  return {banking:next,accounting:state,journal:entry,transfer:transferRecord};
}
export function recordManualTransaction(banking,accounting,input,{actor='Admin'}={}){
  const next=clone(banking),state=clone(accounting);
  const bank=requireActive(next,input.bankAccountId);
  if(!input.date)throw Error('Transaction date is required.');
  if(!input.description?.trim())throw Error('Description is required.');
  if(!input.counterAccount)throw Error('Counter account is required.');
  const amount=minor(input.amount);
  if(amount<=0)throw Error('Amount must be greater than zero.');
  let counter=state.accounts.find(row=>row.code===input.counterAccount);
  if(!counter){
    const type=input.type||'Deposit';
    const isMoneyIn=['Deposit','Interest','Money In'].includes(type);
    counter={
      id:`system:${input.counterAccount}`,
      code:input.counterAccount,
      name:type==='Bank Charge'?'Bank Charges':type==='Interest'?'Interest Income':'Adjustment Account',
      type:isMoneyIn?'Income':'Expenses',
      nature:isMoneyIn?'Credit':'Debit',
      group:'Operating Expenses',
      active:true,
      isGroup:false,
      system:false,
      controlAccount:false,
      revision:1
    };
    state.accounts.push(counter);
  }
  if(!counter.active||counter.isGroup)throw Error('Counter account must be an active posting account.');
  const lock=checkPeriodLock(input.date,actor,{});
  if(!lock.allowed)throw Error(lock.message);
  const type=input.type||'Deposit';
  const isMoneyIn=['Deposit','Interest','Money In'].includes(type);
  const source=type==='Bank Charge'?'Bank Charge':type==='Interest'?'Bank Interest':'Manual Bank Transaction';
  const desc=input.description.trim();
  const token=`manual-banktx:${id('tx')}`;
  const lines=isMoneyIn?[
    {account:bank.accountCode,debit:amount,credit:0,description:desc},
    {account:counter.code,debit:0,credit:amount,description:desc}
  ]:[
    {account:counter.code,debit:amount,credit:0,description:desc},
    {account:bank.accountCode,debit:0,credit:amount,description:desc}
  ];
  const ref=input.reference?.trim()||`TX-${Date.now().toString().slice(-6)}`;
  const entry=journal(state,{id:id('manual-tx'),number:ref},source,lines,input.date,token);
  next.audit.push({id:id('audit'),action:'record manual bank transaction',bankAccountId:bank.id,journalId:entry.id,type,amount,by:actor,at:now()});
  return {banking:next,accounting:state,journal:entry};
}
export function allBankTransfers(banking,accounting){
  const recorded=banking.bankTransfers||[];
  const fromJournals=(accounting.journals||[])
    .filter(j=>j.status==='Posted'&&j.source==='Bank Transfer')
    .map(j=>{
      const debitLine=j.lines?.find(l=>Number(l.debit||0)>0);
      const creditLine=j.lines?.find(l=>Number(l.credit||0)>0);
      const toBank=banking.bankAccounts.find(b=>b.accountCode===debitLine?.account);
      const fromBank=banking.bankAccounts.find(b=>b.accountCode===creditLine?.account);
      return {
        id:`trf-j:${j.id}`,
        journalId:j.id,
        number:j.number||'Bank Transfer',
        date:j.date,
        fromAccountId:fromBank?.id||'',
        toAccountId:toBank?.id||'',
        fromAccountName:fromBank?.accountName||creditLine?.description||'Bank Account',
        toAccountName:toBank?.accountName||debitLine?.description||'Bank Account',
        amount:Number(debitLine?.debit||0),
        reference:j.reference||j.number||'',
        notes:debitLine?.description||'',
        status:'Posted',
        createdAt:j.createdAt||j.date,
        createdBy:'Admin'
      };
    });
  const seen=new Set();
  const all=[];
  for(const item of [...recorded,...fromJournals]){
    const key=item.journalId||item.number||item.id;
    if(!seen.has(key)){
      seen.add(key);
      all.push(item);
    }
  }
  return all.sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function allBankTransactions(accounting,banking,{bankAccountId='all',query='',type='All',status='All',from='',to=''}={}){
  const bankAccounts=banking.bankAccounts||[];
  const bankMap=new Map(bankAccounts.map(b=>[b.accountCode,b]));
  const matchedJournalIds=new Set((banking.bankMatches||[]).filter(m=>!m.voided).map(m=>m.journalId));
  const targetCodes=bankAccountId&&bankAccountId!=='all'
    ?bankAccounts.filter(b=>b.id===bankAccountId).map(b=>b.accountCode)
    :bankAccounts.map(b=>b.accountCode);
  const targetSet=new Set(targetCodes);
  const postedJournals=(accounting.journals||[])
    .filter(j=>j.status==='Posted')
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const accountBalances={};
  targetCodes.forEach(code=>{accountBalances[code]=0;});
  const txList=[];
  for(const j of postedJournals){
    const lines=j.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(targetSet.has(line.account)){
        const bank=bankMap.get(line.account);
        const debit=Number(line.debit||0);
        const credit=Number(line.credit||0);
        accountBalances[line.account]=(accountBalances[line.account]||0)+debit-credit;
        const otherLine=lines.find((l,idx)=>idx!==i);
        const counterAccount=otherLine?(accounting.accounts||[]).find(a=>a.code===otherLine.account):null;
        const isReconciled=matchedJournalIds.has(j.id)||(banking.reconciliations||[]).some(r=>r.status==='Locked'&&r.bankAccountId===bank?.id&&j.date>=r.periodFrom&&j.date<=r.periodTo);
        let txType='Other';
        if(j.source==='Customer Receipt'||(debit>0&&otherLine?.account==='1100')){
          txType='Payment Received';
        }else if(j.source==='Vendor Payment'||(credit>0&&otherLine?.account==='2000')){
          txType='Payment Made';
        }else if(j.source==='Bank Transfer'){
          txType='Bank Transfer';
        }else if(j.source==='Bank Charge'||otherLine?.account==='6100'){
          txType='Bank Charge';
        }else if(j.source==='Bank Interest'||otherLine?.account==='4200'){
          txType='Bank Interest';
        }else if(j.source==='Opening Balance'){
          txType='Opening Balance';
        }else if(debit>0){
          txType='Deposit';
        }else if(credit>0){
          txType='Withdrawal';
        }
        txList.push({
          id:`book:${j.id}:${i}`,
          journalId:j.id,
          number:j.number||'',
          date:j.date,
          bankAccountId:bank?.id||'',
          accountName:bank?.accountName||'Bank Account',
          bankName:bank?.bankName||'',
          accountCode:line.account,
          description:line.description||j.source||'Bank Transaction',
          reference:j.reference||j.number||'',
          source:j.source||'Journal',
          sourceDocument:j.number,
          type:txType,
          moneyIn:debit,
          moneyOut:credit,
          balance:accountBalances[line.account],
          counterAccountCode:otherLine?.account||'',
          counterAccountName:counterAccount?.name||otherLine?.description||'',
          status:isReconciled?'Reconciled':'Posted',
          rawJournal:j
        });
      }
    }
  }
  let result=txList.slice().reverse();
  if(query){
    const q=query.toLowerCase();
    result=result.filter(r=>
      r.description.toLowerCase().includes(q)||
      r.reference.toLowerCase().includes(q)||
      r.accountName.toLowerCase().includes(q)||
      r.counterAccountName.toLowerCase().includes(q)||
      r.number.toLowerCase().includes(q)
    );
  }
  if(type&&type!=='All'){
    result=result.filter(r=>r.type===type);
  }
  if(status&&status!=='All'){
    result=result.filter(r=>r.status===status);
  }
  if(from){
    result=result.filter(r=>r.date>=from);
  }
  if(to){
    result=result.filter(r=>r.date<=to);
  }
  return result;
}
export function reconciliationSummary(banking,accounting,bankId,{from='',to='9999-12-31'}={}){const bank=banking.bankAccounts.find(row=>row.id===bankId);if(!bank)return {bookBalance:0,bankBalance:0,difference:0,reconciled:0,unreconciled:0,rows:[]};const rows=banking.bankTransactions.filter(row=>row.bankAccountId===bankId&&(!from||row.date>=from)&&row.date<=to&&row.status!=='Excluded'),last=[...rows].filter(row=>row.balance!=null).sort((a,b)=>a.date.localeCompare(b.date)).at(-1),book=bookBalance(accounting,bank.accountCode,to),statement=last?.balance??rows.reduce((sum,row)=>sum+row.credit-row.debit,0),reconciled=rows.filter(row=>row.status==='Matched').reduce((sum,row)=>sum+(row.credit||row.debit),0),unreconciled=rows.filter(row=>row.status==='Unmatched').reduce((sum,row)=>sum+(row.credit||row.debit),0);return {bookBalance:book,bankBalance:statement,difference:statement-book,reconciled,unreconciled,rows}}

const priorDate=value=>{const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10)};
export function createReconciliation(banking,accounting,input,{actor='Admin'}={}){
 const next=clone(banking),bank=requireActive(next,input.bankAccountId);if(!/^\d{4}-\d{2}-\d{2}$/.test(input.periodFrom||'')||!/^\d{4}-\d{2}-\d{2}$/.test(input.periodTo||'')||input.periodTo<input.periodFrom)throw Error('Choose a valid reconciliation period.');
 if(next.reconciliations.some(row=>row.bankAccountId===bank.id&&!['Cancelled'].includes(row.status)&&row.periodFrom<=input.periodTo&&row.periodTo>=input.periodFrom))throw Error('This bank account already has an overlapping reconciliation period.');
 const stamp=now(),record={id:id('recon'),bankAccountId:bank.id,financialYear:input.financialYear||'',periodFrom:input.periodFrom,periodTo:input.periodTo,openingBalance:bookBalance(accounting,bank.accountCode,priorDate(input.periodFrom)),statementOpeningBalance:null,statementClosingBalance:null,status:'Draft',createdBy:actor,createdAt:stamp,updatedAt:stamp};next.reconciliations.unshift(record);next.audit.push({id:id('audit'),action:'create reconciliation',reconciliationId:record.id,bankAccountId:bank.id,by:actor,at:stamp});return {banking:next,reconciliation:record};
}
export function reconciliationDetails(banking,accounting,reconciliationId){const record=banking.reconciliations.find(row=>row.id===reconciliationId);if(!record)throw Error('Reconciliation not found.');const all=banking.bankTransactions.filter(row=>row.bankAccountId===record.bankAccountId&&row.date>=record.periodFrom&&row.date<=record.periodTo&&row.status!=='Excluded'),owned=all.filter(row=>!row.reconciliationId||row.reconciliationId===record.id),last=[...owned].filter(row=>row.balance!=null).sort((a,b)=>a.date.localeCompare(b.date)).at(-1),bank=banking.bankAccounts.find(row=>row.id===record.bankAccountId),opening=record.statementOpeningBalance??record.openingBalance,statement=record.statementClosingBalance??last?.balance??opening+owned.reduce((sum,row)=>sum+row.credit-row.debit,0),book=bookBalance(accounting,bank.accountCode,record.periodTo),matched=owned.filter(row=>['Matched','Categorized'].includes(row.status)).reduce((sum,row)=>sum+(row.credit||row.debit),0),unmatched=owned.filter(row=>['Unmatched','Partially Matched'].includes(row.status)).reduce((sum,row)=>sum+(row.credit||row.debit),0);return {...record,bank,rows:owned,bookBalance:book,statementBalance:statement,matchedAmount:matched,unmatchedAmount:unmatched,difference:statement-book};}
export function suggestMatches(banking,accounting,reconciliationId){const details=reconciliationDetails(banking,accounting,reconciliationId),books=bookTransactions(accounting,details.bank).filter(row=>row.date>=details.periodFrom&&row.date<=details.periodTo),used=new Set((banking.bankMatches||[]).filter(row=>!row.voided).map(row=>row.bookTransactionId)),rules=(banking.matchingRules||[]).filter(row=>row.enabled&&(row.bankAccountId==='all'||!row.bankAccountId||row.bankAccountId===details.bank.id)).sort((a,b)=>Number(a.priority||99)-Number(b.priority||99));return details.rows.filter(row=>row.status==='Unmatched').map(row=>{const amount=row.credit||row.debit,candidates=books.filter(book=>!used.has(book.id)&&(book.moneyIn||book.moneyOut)===amount).map(book=>{const days=Math.abs((Date.parse(book.date)-Date.parse(row.date))/86400000),referenceMatch=Boolean(row.reference&&book.reference&&row.reference.toLowerCase()===book.reference.toLowerCase()),descriptionMatch=Boolean(row.description&&book.description&&book.description.toLowerCase().includes(row.description.toLowerCase().split(' ')[0])),score=(referenceMatch?60:0)+(days===0?30:Math.max(0,20-days*5))+(descriptionMatch?10:0),rule=rules.find(item=>days<=Number(item.dateToleranceDays??banking.reconciliationSettings?.matchingToleranceDays??3)&&(!item.requireReference||referenceMatch));return {...book,score,dateDifference:days,ruleId:rule?.id,ruleName:rule?.name,matchAction:score>=Number(banking.reconciliationSettings?.autoMatchThreshold??95)&&rule?.ruleType==='Auto Match'?'Auto Match':'Suggest Match'}}).filter(book=>book.ruleId).sort((a,b)=>b.score-a.score);return {statement:row,candidates}})}
export function autoMatchReconciliation(banking,accounting,reconciliationId,{actor='Admin'}={}){let next=clone(banking),matched=0;for(const suggestion of suggestMatches(next,accounting,reconciliationId)){if(suggestion.candidates[0]&&(!suggestion.candidates[1]||suggestion.candidates[0].score>suggestion.candidates[1].score)){next=matchStatement(next,suggestion.statement.id,suggestion.candidates[0],{actor}).banking;matched++}}const record=next.reconciliations.find(row=>row.id===reconciliationId);if(record){record.status='In Progress';record.updatedAt=now()}next.audit.push({id:id('audit'),action:'auto match reconciliation',reconciliationId,rows:matched,by:actor,at:now()});return {banking:next,matched};}
export function completeReconciliation(banking,accounting,reconciliationId,{actor='Admin',allowDifference=false}={}){const next=clone(banking),details=reconciliationDetails(next,accounting,reconciliationId),record=next.reconciliations.find(row=>row.id===reconciliationId);if(['Completed','Locked'].includes(record.status))return {banking:next,reconciliation:record};if(details.unmatchedAmount>0)throw Error('Resolve or exclude all unmatched statement transactions before completion.');if(details.difference!==0&&!allowDifference)throw Error('The reconciliation difference must be zero before completion.');const stamp=now();Object.assign(record,{status:'Locked',statementClosingBalance:details.statementBalance,bookBalance:details.bookBalance,difference:details.difference,matchedAmount:details.matchedAmount,unmatchedAmount:details.unmatchedAmount,completedBy:actor,completedAt:stamp,lockedAt:stamp,updatedAt:stamp});next.audit.push({id:id('audit'),action:'complete reconciliation',reconciliationId,bankAccountId:record.bankAccountId,by:actor,at:stamp});return {banking:next,reconciliation:record};}
export function unlockReconciliation(banking,reconciliationId,{actor='Admin',canUnlock=false,reason=''}={}){if(!canUnlock)throw Error('Unlock Reconciliation permission is required.');if(!reason.trim())throw Error('Enter an unlock reason.');const next=clone(banking),record=next.reconciliations.find(row=>row.id===reconciliationId);if(!record||!['Completed','Locked'].includes(record.status))throw Error('Only a completed reconciliation can be unlocked.');const stamp=now();Object.assign(record,{status:'In Progress',unlockedBy:actor,unlockedAt:stamp,unlockReason:reason.trim(),updatedAt:stamp});next.audit.push({id:id('audit'),action:'unlock reconciliation',reconciliationId,bankAccountId:record.bankAccountId,reason:reason.trim(),by:actor,at:stamp});return {banking:next,reconciliation:record};}
export function saveMatchingRule(banking,input,{actor='Admin'}={}){if(!input.name?.trim())throw Error('Rule name is required.');const tolerance=Number(input.dateToleranceDays);if(!Number.isInteger(tolerance)||tolerance<0||tolerance>30)throw Error('Date tolerance must be between 0 and 30 days.');const next=clone(banking),existing=(next.matchingRules||[]).find(row=>row.id===input.id),record={...input,id:input.id||id('rule'),name:input.name.trim(),dateToleranceDays:tolerance,enabled:input.enabled!==false,updatedAt:now(),updatedBy:actor};next.matchingRules=existing?next.matchingRules.map(row=>row.id===record.id?record:row):[...(next.matchingRules||[]),record];next.audit.push({id:id('audit'),action:existing?'edit bank matching rule':'create bank matching rule',ruleId:record.id,by:actor,at:record.updatedAt});return {banking:next,rule:record};}
export function saveCategorizationRule(banking,input,{actor='Admin'}={}){if(!input.name?.trim()||!input.descriptionValue?.trim()||!input.accountCode)throw Error('Rule name, description value, and category account are required.');const next=clone(banking),existing=(next.categorizationRules||[]).find(row=>row.id===input.id),stamp=now(),record={...input,id:input.id||id('category-rule'),name:input.name.trim(),descriptionValue:input.descriptionValue.trim(),bankAccountId:input.bankAccountId||'all',transactionType:input.transactionType||'Money Out',condition:input.condition||'Contains',enabled:input.enabled!==false,updatedAt:stamp,updatedBy:actor};next.categorizationRules=existing?next.categorizationRules.map(row=>row.id===record.id?record:row):[...(next.categorizationRules||[]),record];next.audit.push({id:id('audit'),action:existing?'edit bank categorization rule':'create bank categorization rule',ruleId:record.id,by:actor,at:stamp});return {banking:next,rule:record};}
export function categorizationSuggestion(banking,transaction){const text=String(transaction.description||'').toLowerCase();return (banking.categorizationRules||[]).filter(rule=>rule.enabled&&(rule.bankAccountId==='all'||rule.bankAccountId===transaction.bankAccountId)&&(rule.transactionType==='Money In'?transaction.credit>0:transaction.debit>0)).find(rule=>{const value=rule.descriptionValue.toLowerCase();return rule.condition==='Equals'?text===value:rule.condition==='Starts With'?text.startsWith(value):text.includes(value)})||null;}
export function saveBankingConfiguration(banking,section,value,{actor='Admin'}={}){if(!['importSettings','reconciliationSettings','permissions'].includes(section))throw Error('Unsupported banking setting.');const next=clone(banking),stamp=now();next[section]=clone(value);next.audit.push({id:id('audit'),action:`update banking ${section}`,by:actor,at:stamp});return next;}

export function createBankingDemo(banking,accounting){
 if(Number(banking.demoVersion||0)>=BANKING_DEMO_VERSION)return {banking:clone(banking),accounting:clone(accounting),created:false};
 let bankState=clone(banking),state=clone(accounting);const ensure=(code,name,type,nature,group)=>{if(!state.accounts.some(row=>row.code===code))state.accounts.push({id:`demo:${code}`,code,name,type,nature,group,active:true,isGroup:false,system:false,controlAccount:['1100','2000'].includes(code),revision:1})};
 const reserved=new Set(bankState.bankAccounts.map(row=>row.accountCode).concat(state.accounts.map(row=>row.code)));
 const demoCode=(id,preferred)=>{const existing=bankState.bankAccounts.find(row=>row.id===id);if(existing)return existing.accountCode;if(!reserved.has(preferred)){reserved.add(preferred);return preferred}let code=1030;while(reserved.has(String(code)))code++;reserved.add(String(code));return String(code)},hdfcCode=demoCode('demo-bank-hdfc','1010'),iciciCode=demoCode('demo-bank-icici','1020'),sbiCode=demoCode('demo-bank-sbi','1030');
 ensure(hdfcCode,'HDFC Current Account','Assets','Debit','Cash and Bank');ensure(iciciCode,'ICICI Current Account','Assets','Debit','Cash and Bank');ensure(sbiCode,'SBI Current Account','Assets','Debit','Cash and Bank');ensure('1100','Accounts Receivable','Assets','Debit','Current Assets');ensure('2000','Accounts Payable','Liabilities','Credit','Current Liabilities');ensure('3000','Opening Balance Equity','Equity','Credit','Equity');
 const stamp=now(),hdfc=bankState.bankAccounts.find(row=>row.id==='demo-bank-hdfc')||{id:'demo-bank-hdfc',demo:true,bankName:'HDFC Bank',accountName:'HDFC Current Account',accountNumber:'50100012345678',accountType:'Current Account',branch:'Kochi Branch',organisation:'ABC Technologies Pvt Ltd',ifsc:'HDFC0000123',currency:'INR',status:'Active',accountCode:hdfcCode,createdAt:stamp,updatedAt:stamp},icici=bankState.bankAccounts.find(row=>row.id==='demo-bank-icici')||{id:'demo-bank-icici',demo:true,bankName:'ICICI Bank',accountName:'ICICI Current Account',accountNumber:'210501987654',accountType:'Current Account',branch:'Kochi Branch',organisation:'ABC Technologies Pvt Ltd',ifsc:'ICIC0000456',currency:'INR',status:'Active',accountCode:iciciCode,createdAt:stamp,updatedAt:stamp};if(!bankState.bankAccounts.some(row=>row.id===hdfc.id))bankState.bankAccounts.push(hdfc);if(!bankState.bankAccounts.some(row=>row.id===icici.id))bankState.bankAccounts.push(icici);
 const sbi=bankState.bankAccounts.find(row=>row.id==='demo-bank-sbi')||{id:'demo-bank-sbi',demo:true,bankName:'State Bank of India',accountName:'SBI Current Account',accountNumber:'38102001122',accountType:'Current Account',branch:'Trivandrum Branch',organisation:'ABC Technologies Pvt Ltd',ifsc:'SBIN0000456',currency:'INR',status:'Active',accountCode:sbiCode,createdAt:stamp,updatedAt:stamp};if(!bankState.bankAccounts.some(row=>row.id===sbi.id))bankState.bankAccounts.push(sbi);
 const post=(date,number,source,lines,token)=>journal(state,{id:token,number},source,lines,date,`demo-banking:${token}`);
 post('2026-09-01','OPEN-HDFC','Opening Balance',[{account:hdfcCode,debit:50000000,credit:0,description:'Opening bank balance'},{account:'3000',debit:0,credit:50000000,description:'Opening balance equity'}],'open-hdfc');
 post('2026-09-01','OPEN-ICICI','Opening Balance',[{account:iciciCode,debit:20000000,credit:0,description:'Opening bank balance'},{account:'3000',debit:0,credit:20000000,description:'Opening balance equity'}],'open-icici');
 post('2026-09-01','OPEN-SBI','Opening Balance',[{account:sbiCode,debit:15000000,credit:0,description:'Opening bank balance'},{account:'3000',debit:0,credit:15000000,description:'Opening balance equity'}],'open-sbi');
 post('2026-09-04','RCPT-DEMO-001','Customer Receipt',[{account:hdfcCode,debit:5000000,credit:0,description:'Receipt from ABC Retail Pvt Ltd'},{account:'1100',debit:0,credit:5000000,description:'Customer receipt'}],'receipt');
 post('2026-09-05','VPAY-DEMO-001','Vendor Payment',[{account:'2000',debit:2500000,credit:0,description:'Payment to Kerala Office Supplies'},{account:hdfcCode,debit:0,credit:2500000,description:'Vendor payment'}],'vendor-payment');
 post('2026-09-06','TRF-DEMO-001','Bank Transfer',[{account:iciciCode,debit:10000000,credit:0,description:'Transfer from HDFC Current Account'},{account:hdfcCode,debit:0,credit:10000000,description:'Transfer to ICICI Current Account'}],'transfer');
 let imported=importStatement(bankState,hdfc.id,[{date:'2026-09-04',reference:'RCPT-DEMO-001',description:'ABC RETAIL NEFT',debit:'',credit:'50000',balance:'550000'},{date:'2026-09-05',reference:'VPAY-DEMO-001',description:'KERALA OFFICE SUPPLIES',debit:'25000',credit:'',balance:'525000'},{date:'2026-09-06',reference:'TRF-DEMO-001',description:'TRANSFER TO ICICI',debit:'100000',credit:'',balance:'425000'},{date:'2026-09-07',reference:'CHG-SEP',description:'Monthly bank charges',debit:'500',credit:'',balance:'424500'},{date:'2026-09-07',reference:'INT-SEP',description:'Savings interest',debit:'',credit:'2000',balance:'426500'},{date:'2026-09-08',reference:'UPI-902',description:'OFFICE SUPPLIES UPI',debit:'4200',credit:'',balance:'422300'},{date:'2026-09-08',reference:'SAL-903',description:'SALARY TRANSFER SEPTEMBER',debit:'185000',credit:'',balance:'237300'},{date:'2026-09-09',reference:'GST-904',description:'GST PAYMENT CHALLAN',debit:'62000',credit:'',balance:'175300'},{date:'2026-09-09',reference:'INT-905',description:'FD INTEREST CREDIT',debit:'',credit:'3500',balance:'178800'}],{fileName:'HDFC-demo-statement.csv',actor:'Demo Admin'});bankState=imported.banking;imported=importStatement(bankState,icici.id,[{date:'2026-09-06',reference:'TRF-DEMO-001',description:'TRANSFER FROM HDFC',debit:'',credit:'100000',balance:'300000'},{date:'2026-09-07',reference:'CHG-ICICI-01',description:'ICICI ACCOUNT MAINTENANCE',debit:'1180',credit:'',balance:'298820'},{date:'2026-09-08',reference:'NEFT-OUT-02',description:'VENDOR PAYMENT VERTEX',debit:'64000',credit:'',balance:'234820'}],{fileName:'ICICI-demo-statement.csv',actor:'Demo Admin'});bankState=imported.banking;imported=importStatement(bankState,sbi.id,[{date:'2026-09-05',reference:'SBI-OPEN',description:'ACCOUNT OPENING CREDIT',debit:'',credit:'150000',balance:'150000'},{date:'2026-09-08',reference:'SBI-CHQ-01',description:'CHEQUE CLEARANCE',debit:'18500',credit:'',balance:'131500'}],{fileName:'SBI-demo-statement.csv',actor:'Demo Admin'});bankState=imported.banking;for(const bank of [hdfc,icici]){const books=bookTransactions(state,bank);for(const row of bankState.bankTransactions.filter(row=>row.bankAccountId===bank.id&&['RCPT-DEMO-001','VPAY-DEMO-001','TRF-DEMO-001'].includes(row.reference)&&row.status==='Unmatched')){const amount=row.credit||row.debit,candidate=books.find(book=>book.date===row.date&&(book.moneyIn||book.moneyOut)===amount);if(candidate)bankState=matchStatement(bankState,row.id,candidate,{actor:'Demo Admin'}).banking}}
 if(!bankState.reconciliations.some(row=>row.id==='demo-recon-hdfc-aug-2026'))bankState.reconciliations.push({id:'demo-recon-hdfc-aug-2026',bankAccountId:hdfc.id,periodFrom:'2026-08-01',periodTo:'2026-08-31',statementClosingDate:'2026-08-31',statementBalance:50000000,bookBalance:50000000,difference:0,status:'Reconciled',reconciledBy:'Demo Admin',reconciledAt:'2026-09-01T09:30:00.000Z'});
 if(!bankState.reconciliations.some(row=>row.id==='demo-recon-icici-aug-2026'))bankState.reconciliations.push({id:'demo-recon-icici-aug-2026',bankAccountId:icici.id,periodFrom:'2026-08-01',periodTo:'2026-08-31',statementClosingDate:'2026-08-31',statementBalance:20000000,bookBalance:20000000,difference:0,status:'Reconciled',reconciledBy:'Demo Admin',reconciledAt:'2026-09-01T09:35:00.000Z'});
 bankState.demoVersion=BANKING_DEMO_VERSION;bankState.audit.push({id:id('audit'),action:'load banking test data',by:'Demo Admin',at:now()});return {banking:bankState,accounting:state,created:true};
}
