import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCOUNT_TEMPLATES,templateRows,nameSuggestion} from '../src/account-templates.js';
import {importAccounts,normalizeAccounts} from '../src/account-master.js';
import {initial} from '../src/invoice-engine.js';
test('all business templates create only missing accounts without journals',()=>{
 for(const name of Object.keys(ACCOUNT_TEMPLATES)){
  const s=normalizeAccounts(initial(),{Income:[['4000','Product Sales']]});
  const rows=templateRows(name,s.accounts);assert.ok(!rows.some(r=>r.name==='Product Sales'));
  const next=importAccounts(s,rows);assert.equal(next.journals.length,0);assert.equal(s.accounts.length,1);
  assert.equal(templateRows(name,next.accounts).length,0);
 }
});
test('suggestions are explicit, type-aware and never assign tax rules',()=>{
 assert.equal(nameSuggestion(' Internet ','Expenses'),'Internet Expense');
 assert.equal(nameSuggestion('Office Rent','Expenses'),'Office Rent Expense');
 assert.equal(nameSuggestion('Internet','Income'),'');
 assert.equal(templateRows('Startup',[]).some(r=>'taxMode' in r),false);
});
