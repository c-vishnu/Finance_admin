const DEMO_BUDGETS = [
  {id: 'b1', name: 'FY 2026�27 Operating Budget', financialYear: '2026-27', period: 'Yearly', startDate: '2026-04-01', endDate: '2027-03-31', type: 'Profit & Loss Budget', scope: {type: 'Entire Organisation', companyIds: ['abc', 'northstar'], branchIds: []}, amount: 4800000, actual: 2175400, variance: 2624600},
  {id: 'b2', name: 'FY 2026�27 Sales Budget', financialYear: '2026-27', period: 'Yearly', startDate: '2026-04-01', endDate: '2027-03-31', type: 'Profit & Loss Budget', scope: {type: 'Entire Organisation', companyIds: ['abc', 'northstar'], branchIds: []}, amount: 12000000, actual: 5480000, variance: 6520000},
  {id: 'b3', name: 'Q2 Marketing Budget', financialYear: '2026-27', period: 'Quarterly', startDate: '2026-07-01', endDate: '2026-09-30', type: 'Profit & Loss Budget', scope: {type: 'Entire Organisation', companyIds: ['abc', 'northstar'], branchIds: []}, amount: 600000, actual: 425000, variance: 175000},
  {id: 'b4', name: 'Q3 Operating Expenses', financialYear: '2026-27', period: 'Quarterly', startDate: '2026-10-01', endDate: '2026-12-31', type: 'Profit & Loss Budget', scope: {type: 'Entire Organisation', companyIds: ['abc', 'northstar'], branchIds: []}, amount: 1800000, actual: 0, variance: 1800000},
  {id: 'b5', name: 'Kochi Branch Budget', financialYear: '2026-27', period: 'Yearly', startDate: '2026-04-01', endDate: '2027-03-31', type: 'Profit & Loss Budget', scope: {type: 'Branch', companyIds: ['abc'], branchIds: ['abc-kochi']}, amount: 3000000, actual: 1480000, variance: 1520000},
  {id: 'b6', name: 'Bengaluru Branch Budget', financialYear: '2026-27', period: 'Yearly', startDate: '2026-04-01', endDate: '2027-03-31', type: 'Profit & Loss Budget', scope: {type: 'Branch', companyIds: ['abc'], branchIds: ['abc-bengaluru']}, amount: 1800000, actual: 695400, variance: 1104600}
];
export const BUDGET_STORAGE='wayvida-budgets-v4';
export const LEGACY_BUDGET_STORAGE='wayvida-budgets-v3';
export const ACCOUNTING_KEY='wayvida-accounting-v1';

export const FINANCIAL_YEARS=['FY 2026-27','FY 2027-28','FY 2028-29'];
export const MONTHS=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
export const QUARTERS=['Q1','Q2','Q3','Q4'];
export const HALF_YEARS=['H1','H2'];

export const BUDGET_STATUSES=['Draft','Pending Approval','Approved','Active','Completed','Archived'];
export const BUDGET_PERIODS=['Monthly','Quarterly','Half-Yearly','Yearly','Custom'];
export const BUDGET_TYPES=[
  {id:'Profit & Loss Budget',title:'Revenue & Expense Planning',description:'Plan income, expenses and expected profit.',accounts:['Income','Expenses']},
  {id:'Balance Sheet Budget',title:'Balance Sheet Planning',description:'Plan assets, liabilities and equity.',accounts:['Assets','Liabilities','Equity']},
  {id:'Cash Flow Budget',title:'Cash Flow Planning',description:'Plan cash inflows and outflows.',accounts:['Assets','Liabilities','Income','Expenses']},
  {id:'Complete Business Budget',title:'Complete Business Budget',description:'Plan every accounting category together.',accounts:['Income','Expenses','Assets','Liabilities','Equity']},
  {id:'Department Budget',title:'Department Planning',description:'Plan income and expenses for a department.',accounts:['Income','Expenses']},
  {id:'Project Budget',title:'Project Planning',description:'Plan income and expenses for a project.',accounts:['Income','Expenses']}
];
export const BUDGET_SCOPES=['Entire Organisation','Branch','Department','Cost Centre','Project','Custom Scope'];
export const BUDGET_TEMPLATES=[
  ['Custom Budget','Create from scratch','Choose your own accounts and allocations.',[]],
  ['Education Institute','Education Institute','Course fees, faculty, exams, marketing and campus costs.',['course','fee','student','faculty','exam','training','marketing','software','rent']],
  ['Coaching Institute','Coaching Institute','Course income, faculty cost, marketing and software.',['course','fee','training','faculty','salary','marketing','software','rent']],
  ['Retail Business','Retail Business','Product sales, inventory, staff and rent.',['sales','product','inventory','purchase','stock','salary','rent']],
  ['Service Business','Service Business','Service income, people, tools and operating costs.',['service','consult','salary','software','rent','marketing']],
  ['Startup','Startup','Product revenue, technology, marketing and operations.',['revenue','sales','software','technology','marketing','operations','salary']],
  ['Manufacturing','Manufacturing','Sales, materials, production and factory costs.',['sales','material','production','manufactur','inventory','labor']],
  ['IT Company','IT Company','Software services, cloud, developers and delivery costs.',['software','subscription','cloud','developer','salary','server','marketing']]
];
export const BUDGET_PERMISSIONS=['Budget View','Budget Create','Budget Edit','Budget Approve','Budget Export','Budget Archive'];

export const FLOW={
  'Draft':['Pending Approval','Active','Archived'],
  'Pending Approval':['Approved','Draft','Archived'],
  'Approved':['Active','Archived'],
  'Active':['Completed','Archived'],
  'Completed':['Archived'],
  'Archived':['Active','Draft']
};

const clone=value=>JSON.parse(JSON.stringify(value));
const makeId=()=>globalThis.crypto?.randomUUID?.()||`budget-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();

export const emptyBudgetState=()=>({
  version:4,
  budgets:[],
  settings:{
    fiscalYear:FINANCIAL_YEARS[0],
    expenseAlertPercent:80,
    incomeAlertPercent:80,
    alertsEnabled:true,
    defaultStatus:'Draft',
    permissions:Object.fromEntries(BUDGET_PERMISSIONS.map(name=>[name,true]))
  }
});

export function periodCount(period){
  return period==='Monthly'?12:period==='Quarterly'?4:period==='Half-Yearly'?2:1;
}

/* The column headers the allocation grid, the step totals and the statement
   views all share. Monthly reads Apr to Mar, Quarterly Q1 to Q4, Half-Yearly H1
   and H2, Yearly the financial year itself, and a Custom plan the single range
   its author described - never a second "Total" column beside the Total column. */
export function periodLabels(period,financialYear){
  if(period==='Monthly')return MONTHS;
  if(period==='Quarterly')return QUARTERS;
  if(period==='Half-Yearly')return HALF_YEARS;
  if(period==='Custom')return ['Custom Period'];
  return [financialYear?String(financialYear):'Yearly'];
}

export function totalOf(row={}){
  return Object.entries(row||{}).filter(([key])=>key.startsWith('p')).reduce((sum,[,value])=>sum+Number(value||0),0);
}

/* The same row total read over only the periods the budget is planned in, so
   changing the budget period can never leave an invisible column counted inside
   a visible total. A zero count means "every column", the totalOf reading. */
export function plannedTotal(row={},count=0){
  if(!count)return totalOf(row);
  return Array.from({length:count},(_,index)=>Number(row?.[`p${index+1}`]||0)).reduce((sum,value)=>sum+value,0);
}

export function financialYearRange(financialYear){
  const match=String(financialYear||'').match(/(\d{4})/);
  const start=Number(match?.[1]||new Date().getFullYear());
  return {start,end:start+1,from:`${start}-04-01`,to:`${start+1}-03-31`};
}

/* The dates a plan covers. A standard period always follows the financial year
   it is planned in - the year runs 01 Apr to 31 Mar - so its range is derived
   from that year and is never typed in. Only a Custom period carries dates the
   planner chose, and only there can the range be empty or incomplete. */
export function budgetDateRange(financialYear,period,startDate='',endDate=''){
  const {from,to}=financialYearRange(financialYear);
  if(period==='Custom')return {from:startDate||'',to:endDate||''};
  return {from,to};
}

const PERIOD_UNITS={Monthly:['months',12],Quarterly:['quarters',4],'Half-Yearly':['half-years',2],Yearly:['year',1]};

function monthSpan(from,to){
  const start=new Date(`${from}T00:00:00`),end=new Date(`${to}T00:00:00`);
  if(!from||!to||Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return 0;
  return (end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+1;
}

/* The compact second line of the duration summary: "12 months · Monthly",
   "4 quarters · Quarterly", "6 months · Custom". Read from the period, so the
   wording can never disagree with the columns the allocation grid shows. */
export function budgetDurationLabel(financialYear,period,startDate='',endDate=''){
  const {from,to}=budgetDateRange(financialYear,period,startDate,endDate);
  const [noun,count]=PERIOD_UNITS[period]||['months',monthSpan(from,to)];
  if(!count)return 'Set the period dates';
  return `${count} ${count===1?(noun.replace(/s$/,'')||noun):noun} · ${period}`;
}

/* Custom is the only period whose dates are typed, so it is the only one that
   can be wrong: a missing end, an inverted range, or a range that reaches
   outside the financial year the budget is planned in. */
export function budgetDateError(financialYear,period,startDate,endDate){
  if(period!=='Custom')return '';
  if(!startDate||!endDate)return 'Choose both a start date and an end date for a custom period.';
  if(startDate>endDate)return 'The start date cannot be after the end date.';
  const {from,to}=financialYearRange(financialYear);
  if(startDate<from||endDate>to)return `Custom budget dates must fall within ${financialYear}.`;
  return '';
}

/* One place that resolves the year, the period and the range the two imply, so
   a created budget and an updated budget can never store dates that disagree
   with the period they are planned in. */
function budgetTiming(input={},current={}){
  const financialYear=input.financialYear||current.financialYear||FINANCIAL_YEARS[0];
  const period=input.period||current.period||'Monthly';
  const range=budgetDateRange(financialYear,period,input.startDate??current.startDate,input.endDate??current.endDate);
  return {financialYear,period,startDate:range.from,endDate:range.to};
}

export function readAccountingState(store=globalThis.localStorage){
  try{
    const raw=store?.getItem?.(ACCOUNTING_KEY);
    const state=raw?JSON.parse(raw):null;
    return state&&Array.isArray(state.journals)?state:{journals:[]};
  }catch{return {journals:[]}}
}

function movementForLine(accountType,line){
  const debit=Number(line?.debit||0),credit=Number(line?.credit||0);
  if(accountType==='Income'||accountType==='Liabilities'||accountType==='Equity')return credit;
  return debit;
}

export function actualForAccount(account,financialYear,journals=readAccountingState().journals){
  try{
    const {from,to}=financialYearRange(financialYear);
    return journals.filter(journal=>journal?.status==='Posted'&&journal.date>=from&&journal.date<=to).reduce((sum,journal)=>sum+(journal.lines||[]).filter(line=>line.account===account.code).reduce((amount,line)=>amount+movementForLine(account.type,line),0),0)/100;
  }catch{return 0}
}

export function computeSummary(budget){
  const mapped=budget?.allocations||{};
  const result={income:0,expense:0,assets:0,liabilities:0,equity:0,total:0};
  for(const account of budget?.accounts||[]){
    const amount=totalOf(mapped[account.code]);
    result.total+=amount;
    if(account.type==='Income')result.income+=amount;
    else if(account.type==='Expenses')result.expense+=amount;
    else if(account.type==='Assets')result.assets+=amount;
    else if(account.type==='Liabilities')result.liabilities+=amount;
    else if(account.type==='Equity')result.equity+=amount;
  }
  result.expectedProfit=result.income-result.expense;
  result.profitMargin=result.income?Math.round(result.expectedProfit/result.income*100):0;
  return result;
}

/* Variance is read the way an accountant reads it: actual less budget, so a
   positive variance means more money moved than was planned. The percentage is
   that difference over the budget, and it is deliberately NOT the same figure
   as achievement (actual over budget) - the two are reported side by side and
   never labelled as each other.

   Whether the variance is good news depends on the account. Earning more than
   planned is favourable; spending more than planned is not, so the same
   positive variance is favourable on an income account and unfavourable on an
   expense one. Balance sheet accounts carry no target, so they stay neutral. */
export function varianceDirection(type,variance){
  if(!variance)return 'neutral';
  if(type==='Income')return variance>0?'favourable':'unfavourable';
  if(type==='Expenses')return variance<0?'favourable':'unfavourable';
  return 'neutral';
}

export function computeVarianceRows(budget,journals=readAccountingState().journals){
  return (budget?.accounts||[]).map(account=>{
    const planned=totalOf(budget.allocations?.[account.code]);
    const actual=actualForAccount(account,budget.financialYear,journals);
    const variance=actual-planned;
    const percent=planned?Math.round(variance/planned*1000)/10:0;
    const achievement=planned?Math.round(actual/planned*1000)/10:0;
    return {account,budget:planned,actual,variance,percent,achievement,direction:varianceDirection(account.type,variance)};
  });
}

export function computeForecast(budgetDoc,journals=readAccountingState().journals){
  const rows=computeVarianceRows(budgetDoc,journals);
  const totalBudget=rows.reduce((sum,row)=>sum+row.budget,0);
  const actual=rows.reduce((sum,row)=>sum+row.actual,0);
  const count=periodCount(budgetDoc?.period||'Monthly');
  const remaining=Math.max(0,count-Math.min(count,Math.ceil((new Date().getMonth()-3+12)%12+1)));
  return {budget:totalBudget,actual,remaining,projectedYearEnd:actual+(count?totalBudget/count:0)*remaining};
}

export function computeAlerts(budget,journals=readAccountingState().journals,settings=emptyBudgetState().settings){
  if(!settings?.alertsEnabled)return [];
  return computeVarianceRows(budget,journals).map(row=>{
    const percent=row.budget?Math.round(row.actual/row.budget*100):0;
    if(row.account.type==='Expenses'&&percent>=settings.expenseAlertPercent)return {level:'warning',message:`${row.account.name} has reached ${percent}% of its budget`};
    if(row.account.type==='Income'&&percent<settings.incomeAlertPercent)return {level:'info',message:`${row.account.name} is below ${settings.incomeAlertPercent}% of its target`};
    return null;
  }).filter(Boolean);
}

export function budgetMetrics(budgets){
  const visible=(budgets||[]).filter(budget=>!budget.deleted);
  return visible.reduce((metrics,budget)=>{
    const summary=computeSummary(budget);
    metrics.total++;
    if(budget.status==='Active')metrics.active++;
    metrics.income+=summary.income;
    metrics.expense+=summary.expense;
    metrics.totalAmount+=summary.total;
    metrics.expectedProfit+=summary.expectedProfit;
    return metrics;
  },{total:0,active:0,income:0,expense:0,totalAmount:0,expectedProfit:0});
}

function migrateLegacyBudget(legacy){
  const accounts=legacy.accounts||[];
  const allocations=Array.isArray(legacy.allocations)?Object.fromEntries(legacy.allocations.map(row=>[row.account.code,row])):(legacy.allocations||{});
  return {
    id:legacy.id||makeId(),
    name:legacy.name||'Migrated budget',
    financialYear:legacy.financialYear||FINANCIAL_YEARS[0],
    period:legacy.period||'Monthly',
    type:legacy.type||'Profit & Loss Budget',
    status:legacy.status||'Draft',
    scope:legacy.scope||{type:'Entire Organisation',name:'All branches'},
    template:legacy.template||'Custom Budget',
    description:legacy.description||'',
    createdBy:legacy.createdBy||'Admin',
    createdAt:legacy.createdAt||now(),
    updatedAt:legacy.updatedAt||legacy.createdAt||now(),
    accounts,
    allocations,
    activity:legacy.activity||[],
    revisions:legacy.revisions||[],
    deleted:!!legacy.deleted
  };
}

export function readBudgets(store=globalThis.localStorage){
  try{
    const stored=store?.getItem?.(BUDGET_STORAGE);
    const parsed=stored?JSON.parse(stored):null;
    if(parsed?.version===4&&Array.isArray(parsed.budgets))return parsed;
    const legacyRaw=store?.getItem?.(LEGACY_BUDGET_STORAGE);
    const legacy=legacyRaw?JSON.parse(legacyRaw):null;
    if(legacy&&Array.isArray(legacy.budgets)){
      return {...emptyBudgetState(),budgets:legacy.budgets.map(migrateLegacyBudget)};
    }
    return {...emptyBudgetState(), budgets: DEMO_BUDGETS};
  }catch{return emptyBudgetState()}
}

export function writeBudgets(value,store=globalThis.localStorage){
  store?.setItem?.(BUDGET_STORAGE,JSON.stringify(value));
  if(typeof window!=='undefined')window.dispatchEvent(new Event('wayvida-budgets-updated'));
  return value;
}

function validateInput(input){
  if(!input?.name?.trim())throw Error('Enter a budget name.');
  if(!input?.accounts?.length)throw Error('Select at least one account.');
}

export function createBudget(state,input){
  validateInput(input);
  const next=clone(state||emptyBudgetState());
  const created=now();
  const count=periodCount(input.period);
  const allocations=Object.fromEntries(input.accounts.map(account=>[account.code,Object.fromEntries(Array.from({length:count},(_,index)=>[`p${index+1}`,Number(input.allocations?.[account.code]?.[`p${index+1}`]||0)]))]));
  const revisions=[{id:makeId(),label:'Initial budget',createdAt:created,allocations:clone(allocations)}];
  const timing=budgetTiming(input);
  const budget={
    id:makeId(),name:input.name.trim(),financialYear:timing.financialYear,period:timing.period,
    type:input.type||'Profit & Loss Budget',status:input.status||'Draft',startDate:timing.startDate,endDate:timing.endDate,
    scope:input.scope||{type:'Entire Organisation',name:'All branches'},template:input.template||'Custom Budget',description:input.description||'',
    createdBy:input.createdBy||'Admin',createdAt:created,updatedAt:created,accounts:input.accounts,allocations,
    activity:[{action:'Created',by:input.createdBy||'Admin',at:created}],revisions,deleted:false
  };
  next.budgets.unshift(budget);
  return next;
}

export function updateBudget(state,id,patch){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)throw Error('Budget was not found.');
  const allocations=patch.allocations?clone(patch.allocations):budget.allocations;
  Object.assign(budget,clone(patch),budgetTiming(patch,budget),{updatedAt:now(),allocations});
  if(patch.allocations)budget.activity.unshift({action:'Modified allocation',by:'Admin',at:now()});
  else budget.activity.unshift({action:'Edited',by:'Admin',at:now()});
  return next;
}

/* One place that writes an activity entry, so an event the workspace can see
   (an export, a restore) reaches the Activity History the same way the engine's
   own events do. */
export function logBudgetActivity(state,id,action){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)return state;
  budget.activity.unshift({action,by:'Admin',at:now()});
  return next;
}

export function setBudgetStatus(state,id,status){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)throw Error('Budget was not found.');
  const allowed=FLOW[budget.status]||[];
  if(!allowed.includes(status))throw Error(`Budget cannot move from ${budget.status} to ${status}.`);
  budget.status=status;
  budget.updatedAt=now();
  budget.activity.unshift({action:`Marked ${status}`,by:'Admin',at:now()});
  return next;
}

export function submitBudget(state,id){return setBudgetStatus(state,id,'Pending Approval')}
export function approveBudget(state,id){return setBudgetStatus(state,id,'Approved')}
export function activateBudget(state,id){return setBudgetStatus(state,id,'Active')}
export function completeBudget(state,id){return setBudgetStatus(state,id,'Completed')}
export function archiveBudget(state,id){return setBudgetStatus(state,id,'Archived')}

export function duplicateBudget(state,id){
  const next=clone(state),source=next.budgets.find(item=>item.id===id);
  if(!source)throw Error('Budget was not found.');
  const createdAt=now();
  const copy={...clone(source),id:makeId(),name:`${source.name} (Copy)`,status:'Draft',createdAt,updatedAt:createdAt,createdBy:'Admin',activity:[{action:'Created from duplicate',by:'Admin',at:createdAt}],revisions:[{id:makeId(),label:'Initial budget',createdAt,allocations:clone(source.allocations)}],deleted:false};
  next.budgets.unshift(copy);
  return next;
}

export function deleteBudget(state,id){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)throw Error('Budget was not found.');
  budget.deleted=true;budget.status='Archived';budget.archivedAt=now();budget.updatedAt=now();
  budget.activity.unshift({action:'Deleted (archived)',by:'Admin',at:now()});
  return next;
}

export function createRevision(state,id,label){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)throw Error('Budget was not found.');
  const revision={id:makeId(),label:label?.trim()||`Revision ${budget.revisions.length+1}`,createdAt:now(),allocations:clone(budget.allocations)};
  budget.revisions.unshift(revision);
  budget.activity.unshift({action:'Created revision',by:'Admin',at:now()});
  return next;
}

export function restoreRevision(state,id,revisionId){
  const next=clone(state),budget=next.budgets.find(item=>item.id===id);
  if(!budget)throw Error('Budget was not found.');
  const revision=budget.revisions.find(item=>item.id===revisionId);
  if(!revision)throw Error('Revision was not found.');
  budget.allocations=clone(revision.allocations);
  budget.updatedAt=now();
  budget.activity.unshift({action:`Restored ${revision.label}`,by:'Admin',at:now()});
  return next;
}

export function budgetToCSV(budget){
  const labels=periodLabels(budget.period,budget.financialYear);
  const rows=budget.accounts.map(account=>{
    const row=budget.allocations?.[account.code]||{};
    return [account.code,account.name,account.type,...labels.map((_,index)=>row[`p${index+1}`]||0),plannedTotal(row,labels.length)].join(',');
  });
  return [['Account Code','Account Name','Account Type',...labels,'Total'].join(','),...rows].join('\r\n');
}

/* The register export: one row per budget carrying the four columns the grid shows plus the two it
   filters on, so a filtered register exports exactly what the reader is looking at. Values are
   quoted the way src/daybook-export.js quotes them, so a name with a comma or a quote survives. */
export function budgetListCSV(budgets=[]){
  const quote=value=>'"'+String(value==null?'':value).replaceAll('"','""')+'"';
  return [['Budget Name','Financial Year','Budget Period','Type','Scope','Status'],...budgets.map(budget=>[budget.name,budget.financialYear,budget.period,budget.type,budget.scope?.type||'',budget.status])].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function parseBudgetCSV(text,availableAccounts=[]){
  const lines=String(text||'').split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw Error('CSV needs a header and at least one data row.');
  const header=lines[0].split(',').map(value=>value.replace(/^\uFEFF/,'').trim().toLowerCase());
  const count=header.filter(value=>/^(apr|may|jun|jul|aug|sep|oct|nov|dec|jan|feb|mar|q[1-4]|total)$/i.test(value)).length;
  if(!count)throw Error('CSV needs month, quarter or Total columns.');
  const allocations={};const accounts=[];
  lines.slice(1).forEach((line,index)=>{
    const cells=line.split(',');
    const code=(cells[0]||'').trim(),name=(cells[1]||'').trim();
    const account=availableAccounts.find(item=>item.code===code)||availableAccounts.find(item=>item.name.toLowerCase()===name.toLowerCase());
    if(!account)throw Error(`Row ${index+2}: account "${name||code}" was not found in the Chart of Accounts.`);
    accounts.push(account);
    const start=3;
    const values=header.slice(start,start+count).map((key,offset)=>Number(cells[start+offset]||0)||0);
    allocations[account.code]=Object.fromEntries(values.map((value,offset)=>[`p${offset+1}`,value]));
  });
  if(!accounts.length)throw Error('No valid budget rows found in the CSV.');
  return {accounts,allocations};
}

export function settingsFor(state){
  return state?.settings||emptyBudgetState().settings;
}



