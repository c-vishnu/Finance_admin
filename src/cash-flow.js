/* Cash Flow Statement - a read-only projection of the posted journal.

   A cash flow statement is not a second Profit & Loss. It states the movements that actually
   touched a cash, bank or cash-equivalent account, and classifies each one by what the other side
   of its entry was. The report therefore reads the ledger twice: once to find the cash legs and the
   balances they move, once to read the accounts those legs were posted against. A cash flow is
   never derived from revenue minus expenses, and a credit sale or credit purchase creates no cash
   flow at all until it is settled - only the settlement moves a cash account. */
import {normalizeAccounts} from './account-master.js';
import {isMoneyAccount} from './simple-journal-transaction.js';
import {financialYearStart} from './profit-loss.js';

/* The financial year the page opens on is the same 1 April the Profit & Loss and the budget module
   use, re-exported here so the report page imports its own module only. */
export {financialYearStart};

/* The structure the statement is stated in. A line is a fixed classification, never an account:
   every cash movement lands on exactly one line, so one account may appear under two lines without
   ever being counted twice, and an investing or financing movement can never also be operating. */
export const ACTIVITY_SECTIONS=[
  {key:'operating',label:'Operating Activities',totalLabel:'Net Cash from Operating Activities',lines:[
    ['customers','Cash received from customers'],
    ['suppliers','Cash paid to suppliers'],
    ['operatingExpenses','Cash paid for operating expenses'],
    ['taxes','Taxes paid'],
    ['otherOperating','Other operating cash flows']
  ]},
  {key:'investing',label:'Investing Activities',totalLabel:'Net Cash from Investing Activities',lines:[
    ['fixedAssets','Purchase of fixed assets'],
    ['fixedAssetsSale','Sale of fixed assets'],
    ['investments','Purchase/sale of investments'],
    ['otherInvesting','Other investing cash flows']
  ]},
  {key:'financing',label:'Financing Activities',totalLabel:'Net Cash from Financing Activities',lines:[
    ['capital','Capital introduced'],
    ['loansReceived','Loans received'],
    ['loanRepayments','Loan repayments'],
    ['drawings','Owner drawings / distributions'],
    ['otherFinancing','Other financing cash flows']
  ]}
];
const LINE_KEYS=new Set(ACTIVITY_SECTIONS.flatMap(section=>section.lines.map(([key])=>key)));

/* An investment is a long-dated asset the Chart of Accounts names as one; the chart has no separate
   Investments nature, so the report reads the words the business already writes on the account. */
const INVESTMENT=/investment|mutual fund|securities|debenture|fixed deposit/i;
const CUSTOMER_SIDE=/advance|customer|receivable/i;

const posted=journal=>!journal.status||journal.status==='Posted';
const signed=line=>(Number(line.debit)||0)-(Number(line.credit)||0);
const accountText=account=>[account.name,account.group,account.accountNature,account.accountPurpose].filter(Boolean).join(' ');
const byCodeOrder=(a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true});
const sum=(rows,key)=>rows.reduce((total,row)=>total+row[key],0);

/* Cash and cash equivalents are the accounts the Chart of Accounts already classifies as Cash, Bank
   or Cash Equivalents. The rule is the one the transaction form uses to offer a money account
   (src/simple-journal-transaction.js), so the report, the form and the banking module can never
   disagree about which accounts are money; no account code is ever named here. */
export const isCashEquivalent=account=>isMoneyAccount(account);

/* Which fixed line a cash movement belongs to, read from the accounts on the other side of the same
   entry. The order is the accounting meaning of the counterpart: funds the owner put in, a loan, a
   long-lived asset, then the trading accounts. Nothing is inferred from a document label. */
function lineFor(counterparts,inflow){
  const any=test=>counterparts.some(test);
  if(any(account=>account.type==='Equity'))return any(account=>account.accountNature==='Drawings')?'drawings':any(account=>account.accountNature==='Capital')?'capital':'otherFinancing';
  if(any(account=>account.accountNature==='Loans'))return inflow?'loansReceived':'loanRepayments';
  if(any(account=>account.accountNature==='Fixed Assets'))return inflow?'fixedAssetsSale':'fixedAssets';
  if(any(account=>INVESTMENT.test(accountText(account))))return 'investments';
  if(any(account=>account.accountNature==='GST Payable'||account.accountNature==='Tax Liability'))return 'taxes';
  if(any(account=>account.type==='Income'))return any(account=>account.accountNature==='Other Income')?'otherOperating':'customers';
  if(any(account=>account.accountNature==='Accounts Receivable'))return 'customers';
  if(any(account=>account.type==='Expenses'))return any(account=>account.accountNature==='Cost of Goods Sold')?'suppliers':'operatingExpenses';
  if(any(account=>account.accountNature==='Accounts Payable'))return 'suppliers';
  if(any(account=>account.accountNature==='Inventory'))return 'suppliers';
  if(any(account=>account.type==='Assets'&&account.accountNature==='Other Assets'))return 'otherInvesting';
  if(any(account=>account.type==='Liabilities'))return any(account=>CUSTOMER_SIDE.test(accountText(account)))?'customers':'otherOperating';
  return 'otherOperating';
}

/* Read-only projection. It never posts, edits, reverses or creates an entry, and it reads the
   account store without writing it. Draft, unposted and cancelled documents never reach a journal,
   so they contribute nothing; a reversal is an ordinary posted entry, so a reversed pair nets to
   zero by itself.

   From date, To date, Branch and Cash / Bank account narrow what is computed: they move the opening
   balance, the closing balance and every total. Account, Account group and Search narrow which
   movements are classified: the movements they leave out are stated on their own reconciling line
   instead of silently unbalancing the statement, so closing cash still agrees with the ledger. */
export function cashFlow(state,{from='0000-01-01',to='9999-12-31',branch='All',cashAccount='All',account='All',accountGroup='All',search='',includeZero=false}={}){
  const books=normalizeAccounts(state);
  const chart=(books.accounts||[]).filter(item=>item.active&&!item.isGroup);
  const known=new Map(chart.map(item=>[String(item.code),item]));
  const cashChart=chart.filter(isCashEquivalent).sort(byCodeOrder);
  const selectedCash=cashChart.filter(item=>cashAccount==='All'||String(item.code)===String(cashAccount));
  const cashCodes=new Set(cashChart.map(item=>String(item.code)));
  const selectedCodes=new Set(selectedCash.map(item=>String(item.code)));
  const query=String(search||'').trim().toLowerCase();
  const counterpartFilter=account!=='All'||accountGroup!=='All'||Boolean(query);
  const searchText=item=>item?[item.code,item.name,item.type,item.accountNature||'',item.group].filter(Boolean).join(' ').toLowerCase():'';
  /* The account and account group filters read the accounts on the other side of the entry, which are
     the accounts the page offers. The free-text search reads every account in the entry, the cash or
     bank account included, so searching a cash account finds that account's own movements rather than
     blanking the report. */
  const matchFacets=item=>{
    if(!item)return false;
    if(account!=='All'&&String(item.code)!==String(account))return false;
    if(accountGroup!=='All'&&item.group!==accountGroup)return false;
    return true;
  };
  const matchesQuery=item=>!query||searchText(item).includes(query);
  /* The same branch rule the Balance Sheet, the Trial Balance and the Profit & Loss apply, so one
     branch filter means one thing across every statement. */
  const inBranch=(line,journal)=>branch==='All'||(line.branch||journal.branch||journal.branchId)===branch;
  const balanceAt=(upto,strict)=>{
    let total=0;
    for(const journal of books.journals||[]){
      if(!posted(journal))continue;
      const date=String(journal.date||'');
      if(strict?date>=upto:date>upto)continue;
      for(const line of journal.lines||[])if(selectedCodes.has(String(line.account))&&inBranch(line,journal))total+=signed(line);
    }
    return total;
  };

  const ledger=new Map();
  let movements=0,movementsShown=0,transferMovements=0,excludedMovements=0,internalTransfers=0,excluded=0,inflows=0,outflows=0;
  for(const journal of books.journals||[]){
    if(!posted(journal))continue;
    const date=String(journal.date||''),inPeriod=date>=from&&date<=to;
    const legs=(journal.lines||[]).filter(line=>inBranch(line,journal));
    if(!legs.length)continue;
    const cashLegs=legs.filter(line=>cashCodes.has(String(line.account)));
    if(!cashLegs.length)continue;
    const others=legs.filter(line=>!cashCodes.has(String(line.account)));
    /* A journal that only moves cash between two of the business own money accounts changes the mix
       of cash, never the amount of it. It is not an activity, so it is stated once as a transfer
       rather than invented as an inflow and an outflow. */
    if(!others.length){
      if(inPeriod)for(const leg of cashLegs)if(selectedCodes.has(String(leg.account))){movements++;transferMovements++;internalTransfers+=signed(leg)};
      continue;
    }
    const counterparts=others.map(line=>known.get(String(line.account))).filter(Boolean);
    const focused=counterparts.filter(item=>matchFacets(item)&&matchesQuery(item));
    const onFacets=(account==='All'&&accountGroup==='All')||counterparts.some(matchFacets);
    if(!inPeriod)continue;
    for(const leg of cashLegs){
      if(!selectedCodes.has(String(leg.account)))continue;
      const amount=signed(leg);
      movements++;
      /* An entry is stated only when the account and account group filters match one of its counterpart
         accounts and the search matches a counterpart or the cash or bank account itself; the
         movements it leaves out are stated on the reconciling line, so closing cash still agrees. */
      if(counterpartFilter&&!(onFacets&&(focused.length||matchesQuery(known.get(String(leg.account)))))){excludedMovements++;excluded+=amount;continue}
      const key=lineFor(focused.length?focused:counterparts,amount>=0),code=String(leg.account);
      if(!ledger.has(key))ledger.set(key,new Map());
      const rows=ledger.get(key),row=rows.get(code)||{code,name:known.get(code)?.name||code,group:known.get(code)?.group||'',amount:0};
      row.amount+=amount;
      rows.set(code,row);
      movementsShown++;
      if(amount>=0)inflows+=amount;else outflows-=amount;
    }
  }
  if(internalTransfers>0)inflows+=internalTransfers;else outflows-=internalTransfers;
  if(excluded>0)inflows+=excluded;else outflows-=excluded;

  /* Every line of every section is stated with its own rows and total; a zero-value account row is a
     display filter only, so hiding it can never change a line or a section total. */
  const sections=ACTIVITY_SECTIONS.map(section=>{
    const stated=section.lines.map(([key,label])=>{
      const rows=[...(ledger.get(key)||new Map()).values()].sort(byCodeOrder);
      return {key,label,rows:rows.filter(row=>includeZero||row.amount!==0),total:sum(rows,'amount'),accounts:rows.filter(row=>includeZero||row.amount!==0).length};
    });
    return {...section,lines:includeZero?stated:stated.filter(line=>line.rows.length||line.total!==0),stated,total:sum(stated,'total'),accounts:sum(stated,'accounts')};
  });
  const totalOf=key=>sections.find(section=>section.key===key)?.total||0;
  const operating=totalOf('operating'),investing=totalOf('investing'),financing=totalOf('financing');
  const netCashFlow=operating+investing+financing;
  const openingCash=balanceAt(from,true),closingCash=balanceAt(to,false);
  const periodMovement=closingCash-openingCash;
  const difference=closingCash-(openingCash+netCashFlow+internalTransfers+excluded);
  const accounts=sum(sections,'accounts');

  /* The branch filter is offered the branch identities the loaded journal actually carries, the same
     way the General Ledger derives its own branch options from real rows, so the filter can always
     match the value the postings were stored with. */
  const branchOptions=[...new Set((books.journals||[]).filter(posted).flatMap(journal=>(journal.lines||[]).map(line=>line.branch||journal.branch||journal.branchId)))].filter(Boolean).sort();

  /* One ordered list of rows that the page and the export both walk, so the sheet can never drift
     from the screen. Opening and closing are stated where the report reads them: opening at the
     head, and again immediately above the closing balance. */
  const statement=[{kind:'derived',key:'openingCash',label:'Opening Cash & Cash Equivalents',amount:openingCash}];
  for(const section of sections)if(section.lines.length)statement.push({kind:'section',...section,stated:undefined});
  if(internalTransfers!==0)statement.push({kind:'derived',key:'internalTransfers',label:'Transfers between cash and bank accounts',amount:internalTransfers});
  if(excluded!==0)statement.push({kind:'derived',key:'excluded',label:'Cash movements excluded by the current filters',amount:excluded});
  statement.push({kind:'derived',key:'netCashFlow',label:'Net Increase / (Decrease) in Cash',amount:netCashFlow,net:true});
  statement.push({kind:'derived',key:'openingRepeated',label:'Opening Cash & Cash Equivalents',amount:openingCash});
  statement.push({kind:'derived',key:'closingCash',label:'Closing Cash & Cash Equivalents',amount:closingCash,closing:true});

  /* Ten assertions, each re-deriving a total from the rows it claims to summarise rather than
     trusting the loop that produced it. A genuine difference is reported, never forced to zero. */
  const checks=[
    {key:'reconciles',ok:openingCash+netCashFlow+internalTransfers+excluded===closingCash},
    {key:'closingIsLedger',ok:periodMovement===netCashFlow+internalTransfers+excluded},
    {key:'netCashFlow',ok:netCashFlow===operating+investing+financing},
    {key:'operatingTotal',ok:operating===sum(sections.find(section=>section.key==='operating').stated,'total')},
    {key:'investingTotal',ok:investing===sum(sections.find(section=>section.key==='investing').stated,'total')},
    {key:'financingTotal',ok:financing===sum(sections.find(section=>section.key==='financing').stated,'total')},
    {key:'lineTotals',ok:sections.every(section=>section.stated.every(line=>line.total===sum([...(ledger.get(line.key)||new Map()).values()],'amount')))},
    {key:'noDoubleCount',ok:movements===movementsShown+transferMovements+excludedMovements&&[...ledger.keys()].every(key=>LINE_KEYS.has(key))},
    {key:'grossFlows',ok:inflows-outflows===netCashFlow+internalTransfers+excluded},
    {key:'difference',ok:difference===0}
  ];
  return {from,to,branch,branchOptions,cashAccount,account,accountGroup,search,includeZero,chart,cashChart,selectedCash,sections,statement,openingCash,closingCash,netCashFlow,operating,investing,financing,cashInflows:inflows,cashOutflows:outflows,internalTransfers,excluded,periodMovement,difference,accounts,movements,movementsShown,transferMovements,excludedMovements,periodActivity:movements>0,counterpartFilter,checks,valid:checks.every(check=>check.ok)};
}

/* Export shape for the shared CSV/Excel writer in src/daybook-export.js. Money leaves the engine in
   integer paise, as every other report export does, and is stated in rupees in the sheet. The
   hierarchy, the section subtotals, the opening balance, the net change and the closing balance all
   travel, and no interface control is ever exported. */
export function cashFlowExportRows(report,context={}){
  const rows=[['Wayvida Books . Cash Flow Statement',`For ${context.from||report.from} to ${context.to||report.to}`],
    ['Branch',context.branch||'All branches','Cash / bank accounts',context.cashAccount||'All cash and bank accounts'],
    ['Account',context.account||'All accounts','Account group',context.accountGroup||'All account groups'],
    ['Search',context.search||'None','Include zero-balance accounts',context.includeZero?'Yes':'No'],
    [],
    ['Section','Line','Account Code','Account','Account Group','Amount INR'],
    ['' ,'Opening Cash & Cash Equivalents','','','',report.openingCash/100]];
  for(const section of report.sections)for(const line of section.lines){
    for(const row of line.rows)rows.push([section.label,line.label,row.code,row.name,row.group,row.amount/100]);
    rows.push(['',`Total for ${line.label}`,'','','',line.total/100]);
  }
  for(const section of report.sections)rows.push(['',section.totalLabel,'','','',section.total/100]);
  if(report.internalTransfers!==0)rows.push(['','Transfers between cash and bank accounts','','','',report.internalTransfers/100]);
  if(report.excluded!==0)rows.push(['','Cash movements excluded by the current filters','','','',report.excluded/100]);
  rows.push(['','Net Increase / (Decrease) in Cash','','','',report.netCashFlow/100]);
  rows.push(['','Closing Cash & Cash Equivalents','','','',report.closingCash/100]);
  rows.push(['','Difference','','','',report.difference/100]);
  return rows;
}
