import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BANKING_PERMISSIONS,categorizationSuggestion,initialBanking,parseStatementCsv,saveBankingConfiguration,saveCategorizationRule,saveMatchingRule} from '../src/banking-service.js';

test('banking settings exposes the six required sections and scalable permissions',()=>{
 const page=readFileSync('src/BankingSettings.jsx','utf8');
 for(const label of ['Matching Rules','Categorization Rules','Bank Import Settings','Reconciliation Settings','Permissions','Bank Integration','View Bank Statement','Delete Imported Statement','Unmatch Transaction','View Audit History'])assert.ok(page.includes(label)||BANKING_PERMISSIONS.includes(label),label);
});

test('matching rules preserve priority, type, scope and disabled state',()=>{
 let banking=initialBanking();
 const result=saveMatchingRule(banking,{name:'Invoice and amount',priority:1,ruleType:'Auto Match',bankAccountId:'all',amountCondition:'Exact Match',dateToleranceDays:0,confidence:98,enabled:true});
 assert.equal(result.rule.ruleType,'Auto Match');
 assert.equal(result.rule.priority,1);
 const disabled=saveMatchingRule(result.banking,{...result.rule,enabled:false});
 assert.equal(disabled.rule.enabled,false);
});

test('categorization rules apply by bank, flow and description without posting',()=>{
 const banking=initialBanking(),saved=saveCategorizationRule(banking,{name:'AWS hosting',bankAccountId:'bank-1',transactionType:'Money Out',condition:'Contains',descriptionValue:'AWS INDIA',accountCode:'6100',taxTreatment:'Not applicable',enabled:true});
 assert.equal(categorizationSuggestion(saved.banking,{bankAccountId:'bank-1',description:'AWS INDIA CLOUD',debit:2500000,credit:0})?.accountCode,'6100');
 assert.equal(categorizationSuggestion(saved.banking,{bankAccountId:'bank-1',description:'AWS INDIA CLOUD',debit:0,credit:2500000}),null);
 assert.equal(saved.banking.bankTransactions.length,0);
});

test('import, reconciliation and permission settings are versioned and audited',()=>{
 const banking=initialBanking(),updated=saveBankingConfiguration(banking,'reconciliationSettings',{matchingToleranceDays:2,autoMatchThreshold:97,allowAutoCategorization:false,allowAdjustmentCreation:false});
 assert.equal(updated.reconciliationSettings.autoMatchThreshold,97);
 assert.equal(updated.audit.at(-1).action,'update banking reconciliationSettings');
});

test('saved HDFC-style column mapping projects CSV into canonical statement fields',()=>{
 const settings=initialBanking().importSettings,rows=parseStatementCsv('Transaction Date,Narration,Reference,Deposit,Withdrawal,Balance\n2026-09-07,AWS INDIA,UTR-7,0,25000,75000',settings);
 assert.deepEqual(rows[0],{date:'2026-09-07',description:'AWS INDIA',reference:'UTR-7',debit:'25000',credit:'0',balance:'75000'});
});
