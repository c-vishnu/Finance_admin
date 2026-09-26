import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {normalizeAccounts} from '../src/account-master.js';
import {initial,KEY} from '../src/invoice-engine.js';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite'))('esbuild');
const result=await build({entryPoints:['src/AccountWorkspace.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
const Workspace=module.exports.default;
const advancedBuild=await build({entryPoints:['src/AccountAdvancedSettings.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const advancedModule={exports:{}};new Function('require','module','exports',advancedBuild.outputFiles[0].text)(require,advancedModule,advancedModule.exports);
const seed={Assets:[['1000','Cash']],Income:[['4000','Sales']],Expenses:[['5000','Rent']],Liabilities:[['2000','Payables']],Equity:[['3000','Capital']]};
test('business and accountant views render the same operational account grid',()=>{
  const state=normalizeAccounts(initial(),seed);state.accounts.push({id:'custom',code:'5001',name:'Internet Expense',type:'Expenses',active:true,nature:'Debit'});
  let mode='Business';globalThis.localStorage={getItem:key=>key===KEY?JSON.stringify(state):key==='wayvida-coa-view'?JSON.stringify(mode):null};
  let html=renderToString(React.createElement(Workspace,{seed,notify(){},onNavigate(){}}));
  /* The account list is one accordion at a time, so a collapsed group does not render its
     accounts. The pushed account sits in Expenses, which opens only when it is chosen or when a
     search leaves it as the first group with matches: the grid therefore proves the group row is
     listed, and the open first group is what proves account rows render at all. */
  assert.match(html,/Add Category/);assert.doesNotMatch(html,/<th>Organisation &amp; Availability<\/th>/);assert.doesNotMatch(html,/Protected posting account/);assert.doesNotMatch(html,/₹5,00,000/);
  assert.match(html,/>1000</);assert.match(html,/Cash/,"the first group renders its accounts");
  for(const group of ['Assets','Liabilities','Equity','Income','Expenses'])assert.ok(html.includes(group),group+' is listed');
  assert.doesNotMatch(html,/aria-expanded="true"/,'no accordion section is open, because the grid is one flat table');
  assert.match(html,/<th>Account Type<\/th>/,'and the type the sections used to group by is a column');
  assert.match(html,/>5001</,'every account renders, because there is no collapsed section left to hide it');
  mode='Accounting';html=renderToString(React.createElement(Workspace,{seed,notify(){},onNavigate(){}}));assert.match(html,/Account Type.*Account Group/);
  assert.match(html,/>1000</);assert.match(html,/Cash/,"the accountant view opens the same first group");
  assert.doesNotMatch(html,/aria-expanded="true"/,'and the same flat table, with no section open');
  delete globalThis.localStorage;
});
test('advanced form renders actual tax, TDS, control and opening controls',()=>{
 const db=normalizeAccounts(initial(),seed),form={...db.accounts[0],gstMappings:{...db.config},tds:{enabled:true,section:'Configured provision',rate:'10',account:'2000'}};
 const html=renderToString(React.createElement(advancedModule.exports.default,{form,db,setForm(){},onOpening(){}})).replace(/<!--.*?-->/g,'');
 for(const label of ['GST validation','CGST payable account','Configured rate','Restrict ordinary manual','Equity offset account','Post opening balance'])assert.ok(html.includes(label),label);
 assert.ok(html.includes('<select'));assert.ok(html.includes('type="number"'));
});
test('chart of accounts filter toolbar renders every filter inside the Filters panel and excludes tax mapping',()=>{
  const state=normalizeAccounts(initial(),seed);
  globalThis.localStorage={getItem:key=>key===KEY?JSON.stringify(state):key==='wayvida-coa-view'?JSON.stringify('accounting'):null};
  const html=renderToString(React.createElement(Workspace,{seed,notify(){},onNavigate(){}}));
  assert.match(html,/class="am-type-filter"/);
  assert.match(html,/class="am-status-filter"/);
  assert.match(html,/Open filters/);
  assert.match(html,/>Filters<\/summary>/);
  assert.match(html,/All account types/);
  assert.match(html,/All statuses/);
  assert.doesNotMatch(html,/Tax mapping/);
  assert.doesNotMatch(html,/GST mapped/);
  assert.match(html,/Created by/i);
  assert.match(html,/Account group/i);
  assert.match(html,/Branch requirement/i);
  assert.match(html,/Balance range/i);
  delete globalThis.localStorage;
});
test('account details resolves multi-organisation scope and exposes all available branches',()=>{
  const state=normalizeAccounts(initial(),seed);
  state.accounts[0]={...state.accounts[0],organizationId:'abc',organizationIds:['abc','northstar'],scope:'Organisation Account'};
  globalThis.localStorage={getItem:key=>key===KEY?JSON.stringify(state):key==='wayvida-coa-view'?JSON.stringify('accounting'):key==='wayvida-demo-company'?'abc':key==='wayvida-demo-branch'?'abc-kochi':key==='wayvida-context-companies'?JSON.stringify(['abc','northstar']):null};
  globalThis.sessionStorage={getItem:key=>key==='wayvida-open-account'?'1000':null,removeItem(){}};
  const html=renderToString(React.createElement(Workspace,{seed,notify(){},onNavigate(){}}));
  assert.match(html,/Wayvida/);
  assert.match(html,/Viskool/);
  assert.match(html,/All branches \(5\)/);
  assert.match(html,/Kochi Branch/);
  assert.match(html,/Thrissur Branch/);
  assert.doesNotMatch(html,/Current organisation/);
  delete globalThis.localStorage;delete globalThis.sessionStorage;
});
test('legacy account scope follows the active multi-organisation header context for display',()=>{
  const state=normalizeAccounts(initial(),seed);
  globalThis.localStorage={getItem:key=>key===KEY?JSON.stringify(state):key==='wayvida-coa-view'?JSON.stringify('accounting'):key==='wayvida-demo-company'?'abc':key==='wayvida-demo-branch'?'abc-kochi':key==='wayvida-context-companies'?JSON.stringify(['abc','northstar']):null};
  globalThis.sessionStorage={getItem:key=>key==='wayvida-open-account'?'1000':null,removeItem(){}};
  const html=renderToString(React.createElement(Workspace,{seed,notify(){},onNavigate(){}}));
  assert.match(html,/All branches \(5\)/);
  assert.match(html,/Viskool/);
  delete globalThis.localStorage;delete globalThis.sessionStorage;
});
test('legacy account groups resolve to operational group names',()=>{
  const state=normalizeAccounts(initial(),seed);
  const group=code=>state.accounts.find(account=>account.code===code)?.group;
  assert.equal(group('1000'),'Cash and Bank');
  assert.equal(group('2000'),'Current Liabilities');
  assert.equal(group('3000'),'Equity');
  assert.equal(group('4000'),'Operating Income');
  assert.equal(group('5000'),'Operating Expenses');
});
