import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOperationAllowed,applyAdminOverride,blockingLocksFor,createLockWindow,decideUnlockRequest,emptyPeriodControl,generatedSchedule,lockPeriod,lockingEnabled,normalisePeriodSettings,normaliseScope,policyChangeGuard,policyChip,readPeriodSettings,relockExpiredPeriods,requestPeriodUnlock,scopeVisibility,settingsWarnings,submitUnlockRequest,unlockApprovalRequired,writePeriodSettings} from '../src/period-locking.js';

const organisations=[
 {id:'a1',code:'ONE',name:'One Branch Co',branches:[{id:'one-main',name:'Main Branch'}]},
 {id:'a2',code:'TWO',name:'Two Branch Co',branches:[{id:'two-n',name:'North Branch'},{id:'two-s',name:'South Branch'}]},
 {id:'a3',code:'NIL',name:'No Branch Co',branches:[]},
];
const fakeStore=()=>({data:{},getItem(key){return this.data[key]??null},setItem(key,value){this.data[key]=value}});

test('one organisation with one branch hides both columns and shows the context strip',()=>{
 const view=scopeVisibility({organisations,companyIds:['ONE'],branchIds:[]});
 assert.equal(view.orgCount,1);
 assert.equal(view.showOrgColumn,false);
 assert.equal(view.showBranchColumn,false);
 assert.equal(view.branchRequired,false);
 assert.ok(view.strip.startsWith('Locking for: One Branch Co'));
 assert.ok(view.strip.includes('Main Branch'));
 assert.equal(view.rows[0].singleBranch,true);
 assert.equal(view.rows[0].branchName,'Main Branch');
});

test('one organisation with multiple branches hides organisation and shows branch only',()=>{
 const view=scopeVisibility({organisations,companyIds:['TWO'],branchIds:[]});
 assert.equal(view.showOrgColumn,false);
 assert.equal(view.showBranchColumn,true);
 assert.equal(view.anySelectedOrgHasMultipleBranches,true);
 assert.equal(view.branchRequired,true);
 assert.deepEqual(view.rows[0].branchOptions,['North Branch','South Branch']);
 assert.equal(view.rows[0].allBranches,true);
 assert.ok(view.strip.startsWith('Locking for: Two Branch Co'));
});

test('multiple organisations show both columns and branch stays inside its organisation',()=>{
 const view=scopeVisibility({organisations,companyIds:['ONE','TWO'],branchIds:['two-n']});
 assert.equal(view.orgCount,2);
 assert.equal(view.showOrgColumn,true);
 assert.equal(view.showBranchColumn,true);
 assert.equal(view.rows.length,2);
 assert.deepEqual(view.rows[0].branchOptions,['Main Branch']);
 assert.deepEqual(view.rows[1].branchOptions,['North Branch','South Branch']);
 assert.equal(view.rows[1].branchId,'two-n');
 assert.equal(view.rows[1].allBranches,false);
});

test('an organisation with no branches is the lock unit and shows a dash',()=>{
 const view=scopeVisibility({organisations,companyIds:['NIL'],branchIds:[]});
 assert.equal(view.rows[0].noBranches,true);
 assert.ok(['-','\u2014'].includes(view.rows[0].branchName),view.rows[0].branchName);
 assert.equal(view.showBranchColumn,false);
 assert.ok(view.strip.includes('All branches'));
});

test('changing the organisation re-resolves or clears the branch selection',()=>{
 const switched=normaliseScope({organisations,companyIds:['TWO'],branchIds:['one-main']});
 assert.deepEqual(switched.branchIds,[]);
 const autoFilled=normaliseScope({organisations,companyIds:['ONE'],branchIds:[]});
 assert.deepEqual(autoFilled.branchIds,['one-main']);
 assert.deepEqual(autoFilled.organisations[0].branchNames,['Main Branch']);
 const kept=normaliseScope({organisations,companyIds:['ONE','TWO'],branchIds:['two-s']});
 assert.deepEqual(kept.branchIds,['one-main','two-s']);
});

test('a locked date is rejected with the blocking lock and how to request an unlock',()=>{
 const state=emptyPeriodControl();
 const result=assertOperationAllowed({operation:'post',date:'2026-04-15',role:'Admin',companyId:'ABC01',state,settings:{lockingMode:'Manual',approval:true}});
 assert.equal(result.allowed,false);
 assert.ok(result.lock&&result.lock.name);
 assert.ok(result.locks.length>0);
 assert.ok(result.remedy.includes(result.lock.name));
 assert.ok(result.remedy.includes('request an unlock'));
 assert.equal(result.operationLabel,'post to the ledger');
});

test('blocking locks are ordered so the reported lock is deterministic',()=>{
 const state=emptyPeriodControl();
 const synthetic=[...state.periods,{id:'custom-year',companyId:'ABC01',scopeType:'Organisation',modules:['Accounting'],frequency:'Year',name:'FY 2026-27',start:'2026-04-01',end:'2027-03-31',status:'Soft Locked'},{id:'custom-month',companyId:'ABC01',scopeType:'Organisation',modules:['Accounting'],frequency:'Month',name:'June 2026',start:'2026-06-01',end:'2026-06-30',status:'Soft Locked'}];
 const locks=blockingLocksFor(synthetic,{date:'2026-06-15',companyId:'ABC01',module:'Accounting'});
 assert.deepEqual(locks.map(lock=>lock.id),['custom-year','custom-month']);
 assert.equal(blockingLocksFor(synthetic,{date:'2026-06-15',companyId:'NSR02',module:'Accounting'}).length,0);
});

test('locking off short-circuits enforcement and every lock helper reports it',()=>{
 const state=emptyPeriodControl();
 const result=assertOperationAllowed({operation:'post',date:'2026-04-15',state,settings:{lockingMode:'Off'}});
 assert.equal(result.allowed,true);
 assert.equal(result.lockingDisabled,true);
 assert.equal(lockingEnabled({lockingMode:'Off'}),false);
 assert.equal(lockingEnabled({lockingMode:'Manual'}),true);
 assert.equal(policyChip({lockingMode:'Off'}).text,'Locking off');
 assert.equal(policyChip({lockingMode:'Manual'}).text,'Manual locking');
 assert.ok(policyChip({lockingMode:'Automatic',schedule:{frequency:'Month',lockAfterDays:5}}).text.includes('Auto-lock: Monthly'));
});

test('admin override needs a written reason, a permitted role and writes audit',()=>{
 const state=emptyPeriodControl();
 assert.throws(()=>applyAdminOverride(state,{periodId:'2026-04',user:'Admin',reason:'   '}),/written reason/);
 assert.throws(()=>applyAdminOverride(state,{periodId:'2026-04',user:'Business User',reason:'Approved correction'}),/administrator/);
 const next=applyAdminOverride(state,{periodId:'2026-04',operation:'post',targetDate:'2026-04-18',user:'Admin',reason:'Controller approved a supplier correction',now:'2026-07-05T09:00:00Z'});
 assert.equal(next.overrides.length,1);
 assert.equal(next.overrides[0].reason,'Controller approved a supplier correction');
 assert.equal(next.audit[0].action,'Lock override');
 assert.equal(next.audit[0].previousStatus,'Hard Locked');
 assert.equal(next.audit[0].newStatus,'Hard Locked');
});

test('unlock approval decides the unlock flow and hides it when disabled',()=>{
 assert.equal(unlockApprovalRequired({lockingMode:'Manual',approval:false}),false);
 assert.equal(unlockApprovalRequired({lockingMode:'Manual',approval:true}),true);
 assert.equal(unlockApprovalRequired({lockingMode:'Off',approval:true}),false);
});

test('an approved unlock expires, re-locks automatically and audits both events',()=>{
 let state=lockPeriod(emptyPeriodControl(),{periodId:'2026-06',lockType:'Hard Lock',reason:'Month end complete',now:'2026-07-01T09:00:00Z'});
 state=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Approved correction',now:'2026-07-02T09:00:00Z'});
 state=decideUnlockRequest(state,{requestId:state.requests[0].id,decision:'Approved',user:'Admin',remarks:'Controller approved',duration:'1 Hour',now:'2026-07-02T10:00:00Z'});
 assert.equal(state.periods.find(period=>period.id==='2026-06').unlockExpiresAt,'2026-07-02T11:00:00.000Z');
 const reclosed=relockExpiredPeriods(state,'2026-07-02T11:30:00.000Z');
 assert.equal(reclosed.periods.find(period=>period.id==='2026-06').status,'Reclosed');
 assert.equal(reclosed.requests[0].status,'Expired','the unlock request is stamped as expired');
 assert.deepEqual(reclosed.audit.slice(0,2).map(entry=>entry.action),['Unlock expired','Period reclosed'],'expiry writes both audit events');
 assert.equal(reclosed.audit[0].user,'System');
 assert.equal(reclosed.audit[1].user,'System');
 assert.equal(reclosed.audit[0].requestId,reclosed.requests[0].id,'the audit trail keeps the related request id');
 assert.equal(reclosed.audit[1].organisation,'Wayvida Learning');
});

test('unlocking until manually re-locked never auto expires',()=>{
 let state=lockPeriod(emptyPeriodControl(),{periodId:'2026-06',lockType:'Hard Lock',reason:'Month end complete',now:'2026-07-01T09:00:00Z'});
 state=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Approved correction',now:'2026-07-02T09:00:00Z'});
 state=decideUnlockRequest(state,{requestId:state.requests[0].id,decision:'Approved',user:'Admin',remarks:'Standing access',duration:'Until manually re-locked',now:'2026-07-02T10:00:00Z'});
 const period=state.periods.find(row=>row.id==='2026-06');
 assert.equal(period.unlockExpiresAt,null);
 assert.equal(period.unlockManual,true);
 assert.equal(relockExpiredPeriods(state,'2030-01-01T00:00:00.000Z'),state);
});

test('a daily automatic schedule can auto approve unlock requests',()=>{
 const created=createLockWindow(emptyPeriodControl(),{frequency:'Day',date:'2026-06-15',companyId:'ABC01',financialYearId:'FY-2026'});
 const state=lockPeriod(created.state,{periodId:created.period.id,lockType:'Soft Lock',reason:'Daily close',now:'2026-06-16T09:00:00Z'});
 const next=submitUnlockRequest(state,{periodId:created.period.id,reason:'Same day correction',user:'Accountant',now:'2026-06-16T10:00:00Z'},{lockingMode:'Automatic',approval:true,dailyAutoApproval:true,schedule:{frequency:'Day'}});
 assert.equal(next.requests[0].status,'Approved');
 assert.equal(next.requests[0].remarks,'Auto-approved under the daily lock policy.');
});

test('policy changes apply from the next unclosed period and never rewrite locks',()=>{
 const store=fakeStore();
 writePeriodSettings({lockingMode:'Automatic',approval:true,schedule:{frequency:'Month',lockAfterDays:5}},store);
 const before=readPeriodSettings(store);
 const state=lockPeriod(emptyPeriodControl(),{periodId:'2026-06',lockType:'Hard Lock',reason:'Month end complete',now:'2026-07-01T09:00:00Z'});
 const snapshot=JSON.stringify(state.periods);
 writePeriodSettings({...before,schedule:{...before.schedule,frequency:'Quarter'}},store);
 const after=readPeriodSettings(store);
 assert.equal(after.schedule.frequency,'Quarter');
 assert.equal(JSON.stringify(state.periods),snapshot);
 assert.equal(state.periods.find(period=>period.id==='2026-06').status,'Hard Locked');
 const guard=policyChangeGuard(before,after);
 assert.deepEqual(guard.changed,['automatic schedule']);
 assert.equal(guard.appliesFrom,'next unclosed period');
 assert.ok(guard.message.includes('never reopened'));
});

test('settings keep the legacy automatic mirror and warn about unsafe policies',()=>{
 const derived=normalisePeriodSettings({autoLockPreviousMonth:true});
 assert.equal(derived.lockingMode,'Automatic');
 assert.equal(normalisePeriodSettings({lockingMode:'Manual'}).autoLockPreviousMonth,false);
 assert.equal(normalisePeriodSettings({}).defaultScope.companyIds.includes('ABC01'),true);
 const locked=settingsWarnings({lockingMode:'Automatic',approval:false});
 assert.deepEqual(locked.map(item=>item.code),['LOCKED_FOREVER']);
 assert.equal(locked[0].requiresConfirmation,true);
 const daily=settingsWarnings({lockingMode:'Automatic',approval:true,dailyAutoApproval:false,schedule:{frequency:'Day'}});
 assert.equal(daily[0].offer,'dailyAutoApproval');
 assert.equal(daily[0].requiresConfirmation,false);
});

test('the generated schedule is read-only and only exists in automatic mode',()=>{
 assert.deepEqual(generatedSchedule({lockingMode:'Manual'}),[]);
 const rows=generatedSchedule({lockingMode:'Automatic',schedule:{frequency:'Month',effectiveFrom:'2026-04-01',lockAfterDays:5,lockAtTime:'00:05',notifyDaysBefore:3}},{limit:3});
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(row=>row.start),['2026-04-01','2026-05-01','2026-06-01']);
 assert.equal(rows[0].lockAfterDays,5);
 assert.equal(rows[0].lockAtTime,'00:05');
});