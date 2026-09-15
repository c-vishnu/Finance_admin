import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_PERIODS,actualForAccount,archiveBudget,budgetDateError,budgetDurationLabel,budgetMetrics,budgetToCSV,completeBudget,computeAlerts,computeForecast,computeSummary,computeVarianceRows,createBudget,createRevision,deleteBudget,duplicateBudget,emptyBudgetState,logBudgetActivity,parseBudgetCSV,periodCount,periodLabels,plannedTotal,restoreRevision,setBudgetStatus,submitBudget,totalOf,updateBudget,varianceDirection
} from '../src/budget-store.js';

const account={code:'4000',name:'Sales',type:'Income'};
const expense={code:'5400',name:'Marketing Expense',type:'Expenses'};
const base={...emptyBudgetState()};

test('a budget requires a name and mapped accounts',()=>{
  assert.throws(()=>createBudget(base,{name:'',accounts:[account]}),/budget name/i);
  assert.throws(()=>createBudget(base,{name:'FY plan',accounts:[]}),/at least one account/i);
});

test('a monthly budget retains mapped account allocations and lifecycle status',()=>{
  const created=createBudget(base,{name:'FY plan',financialYear:'FY 2026-27',period:'Monthly',type:'Profit & Loss Budget',accounts:[account],allocations:{'4000':{p1:1000,p2:1200}}});
  assert.equal(created.budgets[0].status,'Draft');
  assert.equal(created.budgets[0].allocations['4000'].p2,1200);
  assert.equal(totalOf(created.budgets[0].allocations['4000']),2200);
  const active=setBudgetStatus(created,created.budgets[0].id,'Active');
  assert.equal(active.budgets[0].status,'Active');
  assert.equal(active.budgets[0].activity[0].action,'Marked Active');
});

test('a budget safely records its optional template and scope metadata',()=>{
  const created=createBudget(base,{name:'Retail plan',financialYear:'FY 2026-27',period:'Quarterly',type:'Profit & Loss Budget',template:'Retail Business',scope:{type:'Branch',name:'Kochi Branch'},accounts:[account],allocations:{}});
  assert.equal(created.budgets[0].template,'Retail Business');
  assert.deepEqual(created.budgets[0].scope,{type:'Branch',name:'Kochi Branch'});
  assert.equal(periodCount('Quarterly'),4);
  assert.equal(periodCount('Half-Yearly'),2);
  assert.equal(periodCount('Yearly'),1);
  assert.deepEqual(periodLabels('Half-Yearly'),['H1','H2']);
  assert.equal(created.budgets[0].startDate,'2026-04-01','a quarterly plan records the year it covers');
  assert.equal(created.budgets[0].endDate,'2027-03-31');
  const dated=createBudget(base,{name:'Dated plan',accounts:[account],startDate:'2026-04-01',endDate:'2027-03-31',description:'Plan for the year.'});
  assert.equal(dated.budgets[0].startDate,'2026-04-01');
  assert.equal(dated.budgets[0].endDate,'2027-03-31');
  assert.equal(dated.budgets[0].description,'Plan for the year.');
});

test('the financial year and the budget period decide the dates a plan covers',()=>{
  assert.ok(BUDGET_PERIODS.includes('Custom'),'a custom period is one of the period choices');
  const yearly=createBudget(base,{name:'Yearly plan',financialYear:'FY 2026-27',period:'Yearly',accounts:[account]});
  assert.equal(yearly.budgets[0].startDate,'2026-04-01');
  assert.equal(yearly.budgets[0].endDate,'2027-03-31');
  const nextYear=createBudget(base,{name:'Next year',financialYear:'FY 2027-28',period:'Quarterly',accounts:[account]});
  assert.equal(nextYear.budgets[0].startDate,'2027-04-01','a standard period follows its own financial year, not the first one');
  assert.equal(nextYear.budgets[0].endDate,'2028-03-31');
  const custom=createBudget(base,{name:'Campaign',financialYear:'FY 2026-27',period:'Custom',startDate:'2026-06-01',endDate:'2026-11-30',accounts:[account]});
  assert.equal(custom.budgets[0].startDate,'2026-06-01','only a custom period keeps the dates it was given');
  assert.equal(custom.budgets[0].endDate,'2026-11-30');
  assert.equal(periodCount('Custom'),1,'a custom period is planned in one column');
  assert.deepEqual(periodLabels('Custom'),['Custom Period']);
  assert.deepEqual(periodLabels('Yearly','FY 2026-27'),['FY 2026-27'],'a yearly plan prints the year, never a second Total column');
  assert.deepEqual(periodLabels('Half-Yearly','FY 2026-27'),['H1','H2'],'the half-yearly headers are unchanged');
  assert.equal(budgetDurationLabel('FY 2026-27','Monthly'),'12 months · Monthly');
  assert.equal(budgetDurationLabel('FY 2026-27','Quarterly'),'4 quarters · Quarterly');
  assert.equal(budgetDurationLabel('FY 2026-27','Half-Yearly'),'2 half-years · Half-Yearly');
  assert.equal(budgetDurationLabel('FY 2026-27','Yearly'),'1 year · Yearly');
  assert.equal(budgetDurationLabel('FY 2026-27','Custom','2026-06-01','2026-11-30'),'6 months · Custom');
  assert.equal(budgetDurationLabel('FY 2026-27','Custom','',''),'Set the period dates','an incomplete custom range says so rather than inventing a length');
  const id=custom.budgets[0].id;
  const renamed=updateBudget(custom,id,{name:'Renamed campaign'});
  assert.equal(renamed.budgets[0].startDate,'2026-06-01','an edit that leaves the period alone keeps the stored dates');
  const moved=updateBudget(custom,id,{period:'Monthly'});
  assert.equal(moved.budgets[0].startDate,'2026-04-01','leaving custom returns the plan to the financial year range');
  assert.equal(moved.budgets[0].endDate,'2027-03-31');
});

test('only a custom period can hold an invalid range',()=>{
  assert.equal(budgetDateError('FY 2026-27','Custom','2026-06-01','2026-11-30'),'');
  assert.equal(budgetDateError('FY 2026-27','Monthly','',''),'','a derived range is never invalid');
  assert.match(budgetDateError('FY 2026-27','Custom','',''),/both a start date and an end date/i);
  assert.match(budgetDateError('FY 2026-27','Custom','2026-11-30','2026-06-01'),/cannot be after the end date/i);
  assert.match(budgetDateError('FY 2026-27','Custom','2026-06-01','2027-06-30'),/must fall within FY 2026-27/i);
  assert.match(budgetDateError('FY 2026-27','Custom','2025-04-01','2026-06-30'),/must fall within FY 2026-27/i);
  assert.equal(plannedTotal({p1:10,p2:20,p3:30},2),30,'a row total reads only the periods the budget is planned in');
  assert.equal(plannedTotal({p1:10,p2:20,p3:30}),60,'without a count it still reads every column');
});

test('approval workflow enforces allowed transitions',()=>{
  let state=createBudget(base,{name:'Approval plan',accounts:[account]});
  const id=state.budgets[0].id;
  state=submitBudget(state,id);
  assert.equal(state.budgets[0].status,'Pending Approval');
  state=setBudgetStatus(state,id,'Approved');
  assert.equal(state.budgets[0].status,'Approved');
  assert.throws(()=>setBudgetStatus(state,id,'Draft'),/cannot move/i);
});

test('actuals, variance, forecast and alerts derive from posted journals',()=>{
  let state=createBudget(base,{name:'Variance plan',financialYear:'FY 2026-27',accounts:[account,expense],allocations:{'4000':{p1:1000},'5400':{p1:500}}});
  const budget=state.budgets[0];
  const journals=[{status:'Posted',date:'2026-04-15',lines:[{account:'4000',debit:0,credit:800},{account:'5400',debit:450,credit:0}]}];
  assert.equal(actualForAccount(account,'FY 2026-27',journals),8);
  assert.equal(actualForAccount(expense,'FY 2026-27',journals),4.5);
  const rows=computeVarianceRows(budget,journals);
  const incomeRow=rows.find(row=>row.account.code==='4000');
  assert.equal(incomeRow.variance,-992,'variance is actual less budget');
  assert.equal(incomeRow.percent,-99.2,'the variance percentage is the difference over the budget');
  assert.equal(incomeRow.achievement,0.8,'achievement is actual over budget and is a different figure from the variance');
  assert.equal(incomeRow.direction,'unfavourable','earning less than planned is unfavourable');
  const expenseRow=rows.find(row=>row.account.code==='5400');
  assert.equal(expenseRow.variance,-495.5);
  assert.equal(expenseRow.direction,'favourable','spending less than planned is favourable, so the same negative variance reads the other way');
  const summary=computeSummary(budget);
  assert.equal(summary.income,1000);
  assert.equal(summary.expense,500);
  assert.equal(summary.expectedProfit,500);
  assert.ok(computeForecast(budget,journals).projectedYearEnd>0);
  assert.ok(computeAlerts(budget,journals,{alertsEnabled:true,expenseAlertPercent:80,incomeAlertPercent:80}).length>=0);
});

test('budget metrics exclude deleted budgets',()=>{
  let state=createBudget(base,{name:'Active plan',status:'Active',accounts:[account],allocations:{'4000':{p1:1000}}});
  state=createBudget(state,{name:'Archived plan',status:'Archived',accounts:[account],allocations:{'4000':{p1:400}}});
  assert.equal(budgetMetrics(state.budgets).total,2);
  state=deleteBudget(state,state.budgets[1].id);
  assert.equal(budgetMetrics(state.budgets).total,1);
});

test('duplicate, archive, revision and CSV round-trip are available',()=>{
  let state=createBudget(base,{name:'Export plan',accounts:[account,expense],allocations:{'4000':{p1:100},'5400':{p1:50}}});
  const id=state.budgets[0].id;
  state=duplicateBudget(state,id);
  assert.equal(state.budgets.length,2);
  assert.match(state.budgets[0].name,/Copy/);
  state=createRevision(state,id,'Approved baseline');
  assert.equal(state.budgets.find(item=>item.id===id).revisions.length,2);
  state=restoreRevision(state,id,state.budgets.find(item=>item.id===id).revisions[0].id);
  const budget=state.budgets.find(item=>item.id===id);
  const csv=budgetToCSV(budget);
  assert.match(csv,/Account Code/);
  const parsed=parseBudgetCSV(csv,[account,expense]);
  assert.equal(parsed.accounts.length,2);
  assert.equal(parsed.allocations['4000'].p1,100);
  state=archiveBudget(state,id);
  assert.equal(state.budgets.find(item=>item.id===id).status,'Archived');
  const logged=logBudgetActivity(state,id,'Exported');
  assert.equal(logged.budgets.find(item=>item.id===id).activity[0].action,'Exported','an event the workspace raises reaches the activity history');
  assert.equal(logBudgetActivity(state,'missing-id','Exported'),state,'an unknown budget is left untouched');
});

test('one variance reads as favourable or unfavourable depending on the account',()=>{
  assert.equal(varianceDirection('Income',500),'favourable');
  assert.equal(varianceDirection('Income',-500),'unfavourable');
  assert.equal(varianceDirection('Expenses',500),'unfavourable');
  assert.equal(varianceDirection('Expenses',-500),'favourable');
  assert.equal(varianceDirection('Assets',500),'neutral');
  assert.equal(varianceDirection('Income',0),'neutral');
});
