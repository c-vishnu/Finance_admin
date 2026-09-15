import test from 'node:test';
import assert from 'node:assert/strict';
import {ENFORCED_OPERATIONS,PERIOD_MODULES,assertOperationAllowed,lockPeriod,blockingLocksFor,cancelUnlockRequest,decideUnlockRequest,normalisePeriodSettings,recordPolicyChange,relockExpiredPeriods,requestPeriodUnlock,unlockWindowFor,validatePeriodAction} from '../src/period-locking.js';

const settings=normalisePeriodSettings({lockingMode:'Manual',approval:true,unlockScope:'Selected date range',maximumUnlockDuration:'24 Hours'});
const locked=overrides=>({id:'L1',companyId:'ABC01',organisationName:'ABC Technologies Pvt Ltd',year:'2026-27',name:'September 2026',start:'2026-09-01',end:'2026-09-30',frequency:'Month',scopeType:'Organisation',branchIds:[],modules:['Accounting'],status:'Hard Locked',lockType:'Hard Lock',lockedBy:'Admin',lockedAt:'2026-10-01T09:00:00',reason:'Monthly closing completed',...overrides});
const base=()=>({version:1,periods:[locked()],requests:[],audit:[]});
const pending=(extra={})=>requestPeriodUnlock(base(),{periodId:'L1',reason:'GST correction',user:'Accountant',duration:'8 Hours',unlockScope:'Selected date range',startDate:'2026-09-10',endDate:'2026-09-12',...extra});
const approved=()=>decideUnlockRequest(pending(),{requestId:'ULR-0001',decision:'Approved',user:'Admin',now:'2026-09-10T09:00:00.000Z'});
const check=(state,date,now='2026-09-10T09:30:00.000Z')=>validatePeriodAction({date,companyId:'ABC01',module:'Accounting',role:'Admin',state,settings,now});

test('an unlock request can never escape the locked period',()=>{
 assert.deepEqual(unlockWindowFor(locked(),{unlockScope:'Whole period'}),{unlockScope:'Whole period',startDate:'2026-09-01',endDate:'2026-09-30'});
 assert.throws(()=>unlockWindowFor(locked(),{unlockScope:'Selected date range',startDate:'2026-08-25',endDate:'2026-09-10'}),/must stay inside/);
 assert.throws(()=>unlockWindowFor(locked(),{unlockScope:'Selected date range',startDate:'2026-09-01',endDate:'2026-10-05'}),/must stay inside/);
 assert.throws(()=>unlockWindowFor(locked(),{unlockScope:'Selected date range',startDate:'2026-09-20',endDate:'2026-09-10'}),/cannot be after/);
 assert.throws(()=>unlockWindowFor(locked(),{unlockScope:'Selected date range'}),/Choose both/);
 assert.throws(()=>pending({startDate:'2026-08-25'}),/must stay inside/);
});

test('a whole period request records the full lock range',()=>{
 const state=pending({unlockScope:'Whole period'}),row=state.requests[0];
 assert.equal(row.unlockScope,'Whole period');
 assert.equal(row.unlockStartDate,'2026-09-01');
 assert.equal(row.unlockEndDate,'2026-09-30');
 assert.equal(state.audit[0].unlockScope,'Whole period');
});

test('an approved date range unlock only releases its own window',()=>{
 const state=approved(),period=state.periods[0];
 assert.equal(period.status,'Temporary Unlock');
 assert.equal(period.unlockStartDate,'2026-09-10');
 assert.equal(period.unlockEndDate,'2026-09-12');
 assert.equal(check(state,'2026-09-11').allowed,true);
 assert.equal(check(state,'2026-09-20').allowed,false);
 assert.equal(check(state,'2026-09-20').code,'PERIOD_HARD_LOCKED');
 assert.match(check(state,'2026-09-20').message,/only unlocked from 2026-09-10 to 2026-09-12/);
 assert.equal(blockingLocksFor(state.periods,{date:'2026-09-11',companyId:'ABC01',module:'Accounting',now:'2026-09-10T09:30:00.000Z'}).length,0);
 assert.equal(blockingLocksFor(state.periods,{date:'2026-09-20',companyId:'ABC01',module:'Accounting',now:'2026-09-10T09:30:00.000Z'}).length,1);
});
test('another active lock keeps a date locked after an overlapping unlock',()=>{
 const state=approved();
 const overlap=locked({id:'L2',name:'Mid September 2026',start:'2026-09-15',end:'2026-09-20'});
 const periods=[...state.periods,overlap],now='2026-09-10T09:30:00.000Z';
 assert.equal(blockingLocksFor(periods,{date:'2026-09-11',companyId:'ABC01',module:'Accounting',now}).length,0,'the unlocked window is free');
 assert.equal(blockingLocksFor(periods,{date:'2026-09-18',companyId:'ABC01',module:'Accounting',now}).length,2,'both locks still own the overlap');
 assert.equal(validatePeriodAction({date:'2026-09-18',companyId:'ABC01',module:'Accounting',role:'Admin',state:{...state,periods},settings,now}).allowed,false);
});

test('a pending unlock request can be cancelled and the previous lock returns',()=>{
 const state=pending(),cancelled=cancelUnlockRequest(state,{requestId:'ULR-0001',user:'Accountant',reason:'Duplicate request',now:'2026-09-10T08:00:00.000Z'});
 assert.equal(cancelled.requests[0].status,'Cancelled');
 assert.equal(cancelled.requests[0].cancelledBy,'Accountant');
 assert.equal(cancelled.periods[0].status,'Hard Locked');
 assert.equal(cancelled.audit[0].action,'Unlock cancelled');
 assert.equal(cancelled.audit[0].previousStatus,'Pending Unlock Approval');
 assert.equal(cancelled.audit[0].newStatus,'Hard Locked');
 assert.throws(()=>cancelUnlockRequest(state,{requestId:'ULR-0001',user:'Business User'}),/requester or an approver/);
 assert.throws(()=>cancelUnlockRequest(cancelled,{requestId:'ULR-0001',user:'Accountant'}),/pending unlock request/);
});

test('expiry re-locks the period, clears the window and stamps request and audit trail',()=>{
 const state=approved(),reclosed=relockExpiredPeriods(state,'2026-09-10T17:30:00.000Z'),period=reclosed.periods[0];
 assert.equal(reclosed.requests[0].status,'Expired');
 assert.equal(reclosed.requests[0].expiredAt,'2026-09-10T17:30:00.000Z');
 assert.equal(reclosed.requests[0].reason,'GST correction','the request history is preserved');
 assert.equal(period.status,'Reclosed');
 assert.equal(period.unlockExpiresAt,null);
 assert.equal(period.unlockStartDate,'');
 assert.equal(period.unlockEndDate,'');
 const actions=reclosed.audit.map(entry=>entry.action);
 assert.equal(actions[0],'Unlock expired');
 assert.equal(actions[1],'Period reclosed');
 assert.equal(reclosed.audit[0].user,'System');
 assert.equal(reclosed.audit[0].requestId,'ULR-0001');
});

test('a policy change is audited with before and after values',()=>{
 const before=normalisePeriodSettings({lockingMode:'Manual',approval:true}),after=normalisePeriodSettings({lockingMode:'Automatic',approval:false,schedule:{frequency:'Quarter'}});
 const state=recordPolicyChange(base(),{previous:before,next:after,user:'Admin',now:'2026-09-14T10:00:00.000Z'}),entry=state.audit[0];
 assert.equal(entry.action,'Policy changed');
 assert.equal(entry.entityType,'PeriodLockPolicy');
 assert.equal(entry.beforeValue.lockingMode,'Manual');
 assert.equal(entry.afterValue.lockingMode,'Automatic');
 assert.equal(entry.afterValue.schedule.frequency,'Quarter');
 assert.match(entry.reason,/next unclosed period/);
 assert.equal(state.policy.updatedBy,'Admin');
 assert.equal(state.policy.updatedAt,'2026-09-14T10:00:00.000Z');
 const untouched=base();
 assert.equal(recordPolicyChange(untouched,{previous:before,next:before,user:'Admin'}),untouched,'no change writes nothing');
});

test('enforcement fails closed for every operation when locking cannot be resolved',()=>{
 for(const operation of Object.keys(ENFORCED_OPERATIONS)){
  const blocked=assertOperationAllowed({operation,date:'2026-09-11',companyId:'ABC01',module:'Sales',role:'Accountant',state:{version:1,periods:[locked({modules:[...PERIOD_MODULES]})],requests:[],audit:[]},settings});
  assert.equal(blocked.allowed,false,operation+' was allowed inside a locked period');
  assert.ok(blocked.lock&&blocked.remedy,operation+' must explain the block');
 }
 const unconfigured=assertOperationAllowed({operation:'post',date:'2026-09-11',companyId:'ABC01',module:'Accounting',role:'Admin',state:{version:1,periods:[],requests:[],audit:[]},settings});
 assert.equal(unconfigured.allowed,false);
 assert.equal(unconfigured.code,'PERIOD_NOT_CONFIGURED');
 const unreadable=assertOperationAllowed({operation:'post',date:'2026-09-11',companyId:'ABC01',module:'Accounting',role:'Admin',settings,state:{version:1}});
 assert.equal(unreadable.allowed,false,'an unreadable lock state must never allow a posting');
 assert.equal(unreadable.code,'PERIOD_NOT_CONFIGURED');
 assert.match(unreadable.remedy,/could not be read/);
});

test('every audit event carries the records fields the specification requires',()=>{
 let state=base();
 const open={version:1,periods:[locked({status:'Open',lockType:'—',lockedBy:'—',lockedAt:'',reason:''})],requests:[],audit:[]};
 const lockedState=lockPeriod(open,{periodId:'L1',lockType:'Hard Lock',reason:'Monthly closing completed',user:'Admin',now:'2026-10-01T09:00:00.000Z'});
 const requested=requestPeriodUnlock(lockedState,{periodId:'L1',reason:'GST correction',user:'Accountant',duration:'8 Hours',unlockScope:'Selected date range',startDate:'2026-09-10',endDate:'2026-09-12',now:'2026-10-02T09:00:00.000Z'});
 const approvedState=decideUnlockRequest(requested,{requestId:'ULR-0001',decision:'Approved',user:'Admin',remarks:'Controller approved',now:'2026-09-10T09:00:00.000Z'});
 const cancelled=cancelUnlockRequest(requested,{requestId:'ULR-0001',user:'Accountant',reason:'Duplicate request',now:'2026-10-02T09:30:00.000Z'});
 const expired=relockExpiredPeriods(approvedState,'2026-09-10T17:30:00.000Z');
 const policy=recordPolicyChange(base(),{previous:normalisePeriodSettings({lockingMode:'Manual'}),next:normalisePeriodSettings({lockingMode:'Automatic'}),user:'Admin',now:'2026-10-03T09:00:00.000Z'});
 const events=[...lockedState.audit,...requested.audit,...approvedState.audit,...cancelled.audit,...expired.audit,...policy.audit];
 assert.ok(events.length>=8,'all six locking flows wrote an audit record');
 const required=['user','date','action','organisation','branch','beforeValue','afterValue','reason'];
 for(const entry of events){
  const missing=required.filter(key=>!(key in entry));
  assert.deepEqual(missing,[],entry.action+' is missing '+(missing.join(', ')||'nothing'));
  assert.ok(entry.organisation.length>0,entry.action+' names an organisation');
  assert.ok(entry.branch.length>0,entry.action+' names a branch scope');
 }
 assert.equal(policy.audit[0].organisation,'All organisations','a global policy change is not attributed to one organisation');
});
