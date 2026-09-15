import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAccounts,changeAccount} from '../src/account-master.js';
import {postOpening} from '../src/account-settings.js';
import {initial,reports,journal,command} from '../src/invoice-engine.js';
const setup=()=>normalizeAccounts(initial(),{Assets:[['1000','Bank'],['1100','Accounts Receivable']],Liabilities:[['2100','GST Payable'],['2110','Output CGST'],['2200','TDS Payable']],Equity:[['3000','Capital']],Income:[['4100','Service Income']],Expenses:[['5900','Other Expenses']]});
test('settings persist, global GST mapping validates type and concurrency',()=>{
 const s=setup(),a=s.accounts.find(a=>a.code==='4100'),p={...a,taxMode:'validate',gstRate:'18',tds:{enabled:true,section:'Configured provision',rate:'10',account:'2200'},gstMappings:{...s.config,cgst:'2110'},mappingBaseline:{...s.config}};
 const out=changeAccount(s,'save',p);assert.equal(out.record.gstRate,'18');assert.equal(out.record.tds.account,'2200');assert.equal(out.state.config.cgst,'2110');assert.equal(s.config.cgst,'2100');
 assert.throws(()=>changeAccount(s,'save',{...p,gstMappings:{...s.config,cgst:'1000'}}),/liability/);
 const changed=setup();changed.config.cgst='2110';assert.throws(()=>changeAccount(changed,'save',p),/elsewhere/);
});
test('opening posts a balanced immutable journal once and blocks AR',()=>{
 const s=setup(),a=s.accounts[0],p={id:a.id,revision:a.revision,date:'2026-04-01',amount:'10000',side:'Debit',offset:'3000',reference:'Migration',token:'one'};
 const out=postOpening(s,p);assert.equal(out.state.journals.length,1);assert.equal(reports(out.state).assets,1000000);assert.equal(reports(out.state).debit,reports(out.state).credit);assert.equal(postOpening(out.state,p).state.journals.length,1);
 assert.throws(()=>postOpening(out.state,{...p,token:'two'}),/already/);assert.throws(()=>postOpening(s,{...p,offset:'1000'}),/equity/);assert.throws(()=>postOpening(s,{...p,id:s.accounts[1].id}),/subledger/);assert.equal(s.journals.length,0);
});
test('control accounts reject manual journals and permit opening source',()=>{
 const s=setup(),out=changeAccount(s,'save',{...s.accounts[0],controlAccount:true});const lines=[{account:'1000',debit:100,credit:0},{account:'3000',debit:0,credit:100}];
 assert.throws(()=>journal(out.state,{},'Manual Journal',lines,'2026-04-01','m'),/source transaction/);journal(out.state,{},'Opening Balance',lines,'2026-04-01','o');assert.throws(()=>changeAccount(out.state,'save',{...out.record,controlAccount:false}),/used control/);
});
test('configured account tax validation is enforced at invoice posting',()=>{
 let s=setup();s=changeAccount(s,'save',{...s.accounts.find(a=>a.code==='4100'),taxMode:'none'}).state;
 const saved=command(s,'save',{customerId:'c',customerName:'Customer',date:'2026-09-04',dueDate:'2026-09-04',place:'Kerala',lines:[{description:'Service',unit:'hour',qty:'1',rate:'100',income:'4100',tax:'18'}]});assert.throws(()=>command(saved.state,'post',{id:saved.result.id}),/zero GST/);assert.equal(saved.state.journals.length,0);
});
