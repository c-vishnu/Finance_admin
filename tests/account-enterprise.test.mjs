import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACCOUNT_PURPOSES,accountPurposeDefaults,changeAccount,normalizeAccounts} from '../src/account-master.js';
import {initial,journal} from '../src/invoice-engine.js';

const base=()=>normalizeAccounts({...initial(),accounts:[
  {id:'cash',code:'1000',name:'Cash',type:'Assets',nature:'Debit',active:true,system:true},
  {id:'capital',code:'3000',name:'Capital',type:'Equity',nature:'Credit',active:true,system:true}
]});

test('legacy accounts gain additive enterprise classification without changing codes',()=>{
  const state=base(),cash=state.accounts[0];
  assert.equal(cash.code,'1000');
  assert.equal(cash.scope,'Organisation Account');
  assert.equal(cash.accountNature,'Cash');
  assert.equal(cash.accountCategory,'System Account');
});

test('account organisation scope preserves every selected organisation while retaining a primary compatibility id',()=>{
  const result=changeAccount(base(),'save',{name:'Shared cash',type:'Assets',accountNature:'Cash',organizationIds:['abc','northstar','malabar','bluewave']});
  assert.equal(result.record.organizationId,'abc');
  assert.deepEqual(result.record.organizationIds,['abc','northstar','malabar','bluewave']);
  const legacy=normalizeAccounts({...initial(),accounts:[{id:'legacy',code:'1000',name:'Legacy cash',type:'Assets',organizationId:'abc'}]}).accounts[0];
  assert.deepEqual(legacy.organizationIds,['abc']);
});

test('branch-specific accounts require an owner and reject another branch posting',()=>{
  assert.throws(()=>changeAccount(base(),'save',{name:'HDFC',type:'Assets',accountNature:'Bank',scope:'Branch Specific Account'}),/applicable branch/);
  const made=changeAccount(base(),'save',{name:'HDFC Chennai',type:'Assets',accountNature:'Bank',scope:'Branch Specific Account',branchId:'Trivandrum Branch'}).state;
  assert.throws(()=>journal(made,{number:'T-1',branch:'Kochi Branch'},'Bank Transfer',[{account:'1000',debit:100,credit:0},{account:'1001',debit:0,credit:100}], '2026-09-08','wrong-branch'),/restricted to applicable branches/);
});

test('enterprise account metadata validates category, mapping and multiple branches',()=>{
  const first=changeAccount(base(),'save',{name:'Branch Bank',type:'Assets',accountNature:'Bank',reportingCategory:'Bank',scope:'Branch Specific Account',applicableBranches:['Trivandrum Branch','Kochi Branch'],allowDirectTransactions:true,moduleMappings:['Banking · Bank Ledger'],currency:'USD',taxApplicable:false}).state;
  const bank=first.accounts.find(a=>a.name==='Branch Bank');
  assert.deepEqual(bank.applicableBranches,['Trivandrum Branch','Kochi Branch']);
  assert.equal(bank.currency,'USD');
  assert.doesNotThrow(()=>journal(first,{number:'T-2',branch:'Kochi Branch'},'Bank Transfer',[{account:'1000',debit:100,credit:0},{account:bank.code,debit:0,credit:100}],'2026-09-08','allowed-branch'));
  assert.throws(()=>changeAccount(first,'save',{name:'Bad category',type:'Assets',accountNature:'Bank',reportingCategory:'Salary'}),/category/);
  assert.throws(()=>changeAccount(first,'save',{name:'Unmapped',type:'Income',accountNature:'Sales Income',reportingCategory:'Sales Revenue',allowDirectTransactions:true,moduleMappings:[],mappingRequired:true}),/Accounting Mapping/);
});

test('manual posting control is enforced while source posting remains available',()=>{
  const made=changeAccount(base(),'save',{name:'Clearing',type:'Assets',accountNature:'Current Assets',allowManualPosting:false}).state;
  assert.throws(()=>journal(made,{number:'M-1'},'Manual Journal',[{account:'1000',debit:100,credit:0},{account:'1001',debit:0,credit:100}],'2026-09-08','manual'),/does not allow manual/);
  assert.doesNotThrow(()=>journal(made,{number:'S-1'},'Receipt',[{account:'1000',debit:100,credit:0},{account:'1001',debit:0,credit:100}],'2026-09-08','source'));
});

test('COA UI exposes requested master fields, columns, detail tabs and actions',()=>{
  const jsx=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
  const form=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');
  for(const value of ['Basic Account Information','Account type *','Search account types','Account status','Organisation & Availability','Available for *','Select branches *'])assert.ok(form.includes(value),value);
  for(const value of ['organisations.map(item=>item.name).join', 'currencyMismatch', 'Select at least one branch for this account.', 'am-branch-grid'])assert.ok(form.includes(value),value);
  assert.ok(!form.includes('Additional settings'),'new accounts should not expose additional settings');
  assert.ok(!form.includes('Account purpose *'),'purpose is selected inside the combined account type picker');
  assert.doesNotMatch(form,/Accounting Preview|Accounting classification|Automatic usage|Advanced Accounting Settings|Automatic transaction mapping|Manage detailed mappings/);
  assert.doesNotMatch(form,/Usage & Automation|Where will you use this account|Report category \*/);
  assert.doesNotMatch(form,/Audit information/);
  for(const value of ['t.accountName','t.accountCode','t.accountType','t.accountGroup','t.status','Audit Trail','t.viewLedger','Duplicate Account','View Transactions'])assert.ok(jsx.includes(value),value);
  assert.ok(!jsx.includes('<th>Organisation &amp; Availability</th>'),'working context should not be duplicated in the grid');
  assert.ok(!jsx.includes('Opening balance</th>'),'opening balance should not appear in the Chart of Accounts grid');
  assert.ok(!jsx.includes('Account nature</th>'),'account nature should be labelled Account Group in the grid');
  assert.doesNotMatch(jsx,/tab==='Accounting Impact'/);
});

test('account purpose safely derives posting and reporting behaviour',()=>{
  assert.ok(ACCOUNT_PURPOSES.Assets['Bank Account']);
  const bank=accountPurposeDefaults('Assets','Bank Account');
  assert.equal(bank.accountNature,'Bank');
  assert.equal(bank.nature,'Debit');
  assert.equal(bank.report,'Balance Sheet');
  assert.deepEqual(bank.modules,['Banking · Bank Ledger','Payments','Receipts']);
  const rent=accountPurposeDefaults('Expenses','Rent Expense');
  assert.equal(rent.taxTreatment,'Input GST');
  assert.equal(rent.report,'Profit & Loss');
  assert.throws(()=>accountPurposeDefaults('Assets','Sales Income'),/Invalid accounting combination/);
});

test('new account status is saved from additional settings',()=>{
  const result=changeAccount(base(),'save',{name:'Dormant cash',type:'Assets',accountPurpose:'Cash',active:false});
  assert.equal(result.record.active,false);
  assert.equal(result.record.allowDirectTransactions,true);
});

test('create account keeps the shared shell header and avoids duplicate account headings',()=>{
  const form=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');
  assert.match(form,/Create account/);
  assert.match(form,/Add the account details\. Wayvida Books applies the accounting rules automatically\./);
  assert.doesNotMatch(form,/What do you want to track\?|Choose the closest business activity/);
  assert.doesNotMatch(form,/Custom Account/);
  assert.doesNotMatch(form,/title="Account information"/);
  assert.match(css,/\.app>main \.am-create-header\{position:static/);
  assert.match(css,/input\[type=checkbox\]:not\(\[role=switch\]\)/);
});
