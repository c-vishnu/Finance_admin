import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/BudgetWorkspace.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/budget-workspace.css',import.meta.url),'utf8');

test('Budgets and Period Lock are one section of their own, out of Accounting',()=>{
  assert.match(navigation,/\{label:'Accounting',icon:IconBook,children:\[leaf\('Chart of Accounts'\),leaf\('Journal','Journal Entries'\)\]\}/,'Accounting holds the chart of accounts and the journal only');
  assert.match(navigation,/\{label:'Other',children:\[leaf\('Budgets'\),leaf\('Period Lock'\),leaf\('Inventory Adjustments'\)\]\}/,'Budgets, Period Lock and Inventory Adjustments are declared together in the Other group Settings carries');
  assert.ok(!navigation.includes("{label:'Budget',"),'the Budget sub-group is gone from the sidebar');
  assert.ok(!navigation.includes('Budget Reports')&&!navigation.includes('Budget Settings'),'the reports and settings destinations are gone from the sidebar');
  const accounting=navigation.indexOf("{label:'Accounting'");
  const other=navigation.indexOf("{label:'Other'");
  const budgets=navigation.indexOf("leaf('Budgets')");
  const closing=navigation.indexOf("leaf('Period Lock')");
  assert.ok(accounting>-1&&other>accounting,'the Other group is declared after Accounting, inside the Settings section that follows the reports');
  assert.ok(budgets>other&&budgets<closing,'Budgets sits above Period Lock inside Other');
  assert.equal((navigation.match(/leaf\('Budgets'\)/g)||[]).length,1,'Budgets is declared once');
  assert.ok(budgets>navigation.indexOf("{label:'Accounting'")+60,'Budgets is no longer inside the Accounting group');
});

test('the sidebar owns budget navigation and no budget screen renders a section tab row',()=>{
  assert.ok(!workspace.includes('BudgetTabs'),'the shared tab row component is gone');
  assert.ok(!workspace.includes('BUDGET_TABS'),'the tab label list is gone');
  assert.ok(!workspace.includes('budgetWorkspaceTabs'),'no budget screen renders a section nav');
  assert.ok(!workspace.includes('aria-label="Budget sections"'),'no budget screen renders the section nav label');
  assert.ok(!css.includes('budgetWorkspaceTabs'),'no tab row styling is left behind');
  assert.ok(!workspace.includes('onNavigate'),'no budget screen needs a navigation callback any more');
});

test('the register is the only budget destination and still owns the create and detail screens',()=>{
  assert.match(workspace,/export default function BudgetWorkspace\(\{page='Budgets',notify=\(\)=>\{\}\}\)\{/,'the workspace still defaults to the register');
  assert.ok(!workspace.includes('BudgetReports')&&!workspace.includes('BudgetSettings'),'the reports and settings screens are deleted from the workspace');
  assert.ok(!workspace.includes("if(page==='Budget Reports')")&&!workspace.includes("if(page==='Budget Settings')"),'the workspace no longer routes a reports or settings page name');
  assert.ok(!css.includes('budgetReportCard')&&!css.includes('budgetSettingsGrid')&&!css.includes('budgetReportFilters'),'their styling is deleted too');
  assert.ok(workspace.includes("return <BudgetList state={state} accounts={accounts} business={business}"),'every page name renders the register');
  assert.ok(workspace.includes("if(screen==='wizard')return <BudgetWizard")&&workspace.includes("if(screen==='detail'&&selected)"),'the register still owns the create and detail screens');
});