import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUDGET_STATEMENTS, budgetBalanceCheck, budgetPeriodTotals, budgetStatementRows, budgetTotalRows} from '../src/budget-statements.js';

const workspace = readFileSync(new URL('../src/BudgetWorkspace.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/budget-workspace.css', import.meta.url), 'utf8');

const accounts = [
  {code: '4000', name: 'Sales', type: 'Income', group: 'Direct Income'},
  {code: '4100', name: 'Discount', type: 'Income', group: 'Direct Income'},
  {code: '5000', name: 'Rent', type: 'Expenses', group: 'Operating Expenses'},
  {code: '1200', name: 'Machinery', type: 'Assets', group: 'Fixed Assets'},
  {code: '2000', name: 'Bank Loan', type: 'Liabilities', group: 'Long Term Liabilities'},
  {code: '3000', name: 'Owner Capital', type: 'Equity', group: 'Owner Funds'},
];
const allocations = {'4000': {p1: 5000}, '4100': {p1: 200}, '5000': {p1: 3000}, '1200': {p1: 1000}, '2000': {p1: 500}, '3000': {p1: 700}};
const shape = rows => rows.map(row => [row.kind, row.label || row.account?.name]);
const of = (statement, period = 'Monthly') => budgetStatementRows(statement, accounts, allocations, period);

test('the three standard statements are the entry points of the budget view', () => {
  assert.deepEqual(BUDGET_STATEMENTS, ['Profit and Loss', 'Balance Sheet', 'Cash Flow Statement'], 'the statements are named and ordered as the reference sheets print them');
  assert.ok(workspace.includes('export function BudgetStatementView({statement,budget,business}){'), 'the view exports one component that renders any of them');
  assert.ok(workspace.includes("import {BUDGET_STATEMENTS,budgetBalanceCheck,budgetStatementRows,budgetTotalRows} from './budget-statements.js';"), 'the workspace reads its figures, and its balance check, from the shared statement layer');
  assert.ok(!/const revenueByPeriod=/.test(workspace), 'the page no longer totals the grid for itself');
});

test('every statement is built from the planned amounts alone', () => {
  const totals = budgetPeriodTotals(accounts, allocations, 'Monthly');
  assert.equal(totals.count, 12, 'a monthly budget plans twelve periods');
  assert.equal(totals.revenueTotal, 5200, 'revenue is every planned income account');
  assert.equal(totals.expenseTotal, 3000, 'expense is every planned expense account');
  assert.equal(totals.profitTotal, 2200, 'profit is revenue less expense');
  assert.equal(totals.assetsTotal, 1000, 'assets are the planned asset accounts');
  assert.equal(totals.liabilitiesTotal, 500, 'liabilities are the planned liability accounts');
  assert.equal(totals.equityTotal, 700, 'equities are the planned equity accounts');
  assert.equal(totals.netWorthTotal, 3400, 'the planned result rolls into the liabilities and equities total');
  assert.equal(totals.mismatchTotal, -2400, 'the mismatch is what the planned sheet cannot balance');
  assert.equal(totals.marginTotal, 42, 'the margin follows the planned result');
  assert.equal(budgetPeriodTotals([], {}, 'Monthly').revenueTotal, 0, 'an empty budget totals zero instead of throwing');
});

test('the profit and loss groups revenue and expense and closes on the planned result', () => {
  assert.deepEqual(shape(of('Profit and Loss')), [
    ['section', 'Profit and Loss'],
    ['type', 'Revenue'], ['group', 'Direct Income'], ['account', 'Sales'], ['account', 'Discount'], ['groupTotal', 'Total for Direct Income'], ['typeTotal', 'Total Revenue'],
    ['type', 'Expenses'], ['group', 'Operating Expenses'], ['account', 'Rent'], ['groupTotal', 'Total for Operating Expenses'], ['typeTotal', 'Total Expenses'],
    ['grand', 'Net Profit / Loss'],
  ], 'each chart of accounts group totals under its accounting type, and the statement totals last');
  const grand = of('Profit and Loss').at(-1);
  assert.equal(grand.total, 2200, 'the statement closes on the planned result');
  assert.equal(grand.values.length, 12, 'every closing figure carries one cell per period');
});

test('the balance sheet shows what the plan leaves unbalanced', () => {
  const rows = of('Balance Sheet');
  assert.deepEqual(rows.filter(row => row.kind === 'type').map(row => row.label), ['Assets', 'Liabilities', 'Equity'], 'the sheet reads assets, liabilities then equity');
  const closing = rows.filter(row => row.kind === 'grand');
  assert.equal(closing[0].label, 'Total Liabilities & Equity', 'the profit rolls into liabilities and equity');
  assert.equal(closing[0].total, 3400, 'that total is liabilities plus equity plus the planned result');
  const check = rows.find(row => row.kind === 'check');
  assert.equal(check.label, 'Balance Difference', 'the sheet ends with the balance check');
  assert.equal(check.className, 'budgetStatementMismatch', 'the difference keeps its own treatment');
  assert.ok(check.note, 'the difference explains that it is reported and never posted');
  assert.ok(workspace.includes("if(row.kind==='check')"), 'the statement view renders the balance check row as its own kind');
});

test('the balance check reads assets against liabilities plus equity', () => {
  const check = budgetBalanceCheck(accounts, allocations, 'Monthly');
  assert.equal(check.assets, 1000, 'the check totals the planned assets');
  assert.equal(check.liabilities, 500, 'the check totals the planned liabilities');
  assert.equal(check.equity, 700, 'the check totals the planned equity');
  assert.equal(check.profit, 2200, 'the planned result is carried into the check so it can never be dropped');
  assert.equal(check.liabilitiesAndEquity, 3400, 'liabilities, equity and the planned result are one side of the check');
  assert.equal(check.difference, -2400, 'the difference is assets less liabilities and equity');
  assert.equal(check.balanced, false, 'a plan whose sides disagree reads as unbalanced');
  assert.equal(budgetBalanceCheck(accounts, {'1200': {p1: 1000}, '3000': {p1: 1000}}, 'Monthly').balanced, true, 'a plan whose sides agree reads as balanced');
  assert.equal(budgetBalanceCheck([], {}, 'Monthly').difference, 0, 'an empty plan checks as balanced instead of throwing');
  assert.ok(workspace.includes('const balance=budgetBalanceCheck(form.accounts,form.allocations,form.period,form.financialYear);'), 'the allocation step runs the same check the statements use');
});

test('the cash flow reads each amount as the cash it moves', () => {
  const rows = of('Cash Flow Statement');
  assert.deepEqual(rows.filter(row => row.kind === 'type').map(row => row.label), ['Operating activities', 'Investing activities', 'Financing activities'], 'the statement reads by activity');
  const expense = rows.find(row => row.account?.type === 'Expenses');
  assert.equal(expense.values[0], -3000, 'an expense leaves the bank, so it is signed negative');
  const asset = rows.find(row => row.account?.type === 'Assets');
  assert.equal(asset.values[0], -1000, 'buying an asset leaves the bank too');
  const net = rows.at(-1);
  assert.equal(net.label, 'Net Cash Flow', 'the statement closes on the net cash flow');
  assert.equal(net.total, 2400, 'every activity adds into the net change');
});

test('a statement is safe when the scope, the period or the accounts are missing', () => {
  assert.deepEqual(budgetStatementRows('Nothing', accounts, allocations, 'Monthly'), [], 'an unknown statement renders nothing rather than a broken table');
  assert.equal(budgetStatementRows('Balance Sheet', [], {}, 'Monthly').length, 9, 'an empty budget still prints every total line');
  assert.equal(budgetStatementRows('Profit and Loss', accounts, allocations, 'Quarterly').at(-1).values.length, 4, 'the statement follows the budget period');
  assert.ok(budgetStatementRows('Profit and Loss', accounts, {}, 'Monthly').every(row => !row.values || row.values.every(value => value === 0)), 'an unplanned budget reads zero everywhere');
});

test('the allocation step and the statement view share one derivation', () => {
  const totals = budgetTotalRows(accounts, allocations, 'Monthly');
  assert.deepEqual(totals.map(row => row.label), ['Total Revenue', 'Total Expenses', 'Net Profit / Loss', 'Profit Margin', 'Total Assets', 'Total Liabilities', 'Total Equity', 'Total Liabilities & Equity'], 'the allocation step closes with the eight standard total lines, and no balancing adjustment');
  assert.equal(totals[2].total, of('Profit and Loss').at(-1).total, 'both screens agree because both read the same layer');
  assert.ok(workspace.includes('const totalsRows=budgetTotalRows(form.accounts,form.allocations,form.period,form.financialYear);'), 'the allocation step builds its totals through the shared layer');
});

test('the detail page offers the statements first and keeps every other view reachable', () => {
  assert.ok(workspace.includes("['Profit and Loss','Profit & Loss'],") && workspace.includes("['Balance Sheet','Balance Sheet'],") && workspace.includes("['Cash Flow Statement','Cash Flow'],"), 'the three statements keep their tab names');
  assert.ok(workspace.includes("const BUDGET_DETAIL_DEFAULT='Overview';"), 'the detail opens on the overview');
  assert.ok(workspace.includes('{BUDGET_STATEMENTS.includes(tab)&&<BudgetStatementView statement={tab} budget={budget} business={business}/>}'), 'the body renders the selected statement');
  assert.ok(workspace.includes("<nav className=\"budgetAccountTabs\">{BUDGET_DETAIL_TABS.map(([key,label])=>"), 'one flat tab row drives the whole detail screen');
  assert.ok(!workspace.includes('AllocationTable'), 'the flat allocation tab is superseded by the statements');
});

test('the statement table keeps the register density and never prints text below 12px', () => {
  for (const token of ['.budgetStatementSection>th', '.budgetStatementType>th', '.budgetStatementGroup>th', '.budgetStatementTotal>*', '.budgetStatementTotal.budgetStatementMismatch>*', '.budgetStatementNegative', '.budgetStatementRow td:first-child']) {
    assert.ok(css.includes(token), token + ' is styled with the statement');
  }
  const block = css.slice(css.indexOf('.budgetStatement>.budgetAllocationGrid'));
  const sizes = [...block.matchAll(/font-size:(\d+)px/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 0 && Math.min(...sizes) >= 12, 'no statement text drops below 12px');
  assert.ok(block.includes('text-align:right'), 'the planned amounts are right aligned like every other register');
  assert.ok(block.includes('white-space:nowrap'), 'a period column never wraps its figure');
});
