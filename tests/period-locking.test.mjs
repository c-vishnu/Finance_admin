import test from 'node:test';
import assert from 'node:assert/strict';
import {PERIOD_MODULES,can,closingStatus,closePeriod,closedPeriods,createLockWindow,currentPeriodFor,decideUnlockRequest,deleteUnlockRequest,emptyPeriodControl,evaluateClosingChecks,evaluateClosingReadiness,findMissingPeriods,generateFinancialYearPeriods,lastClosedPeriod,lockPeriod,lockRegisterRows,lockingEnabled,periodAuditTimeline,periodBranchLabel,periodClosedAt,periodClosedBy,periodStatus,readPeriodSettings,relockExpiredPeriods,requestPeriodUnlock,resolveLockRange,unlockApprovalRequired,unlockApproverFor,validatePeriodAction,writePeriodSettings} from '../src/period-locking.js';

test('open periods allow posting and hard locks block every role',()=>{
 const state=emptyPeriodControl();
 assert.equal(validatePeriodAction({date:'2026-06-15',state}).allowed,true);
 const blocked=validatePeriodAction({date:'2026-04-15',role:'Admin',state});
 assert.equal(blocked.allowed,false);
 assert.equal(blocked.code,'PERIOD_HARD_LOCKED');
});

test('soft locks require approval and approved override is auditable',()=>{
 const state=emptyPeriodControl();
 const pending=validatePeriodAction({date:'2026-05-15',role:'Accountant',state,settings:{approval:true}});
 assert.equal(pending.requiresApproval,true);
 const override=validatePeriodAction({date:'2026-05-15',role:'Accountant',state,settings:{approval:true},approvalGranted:true});
 assert.equal(override.allowed,true);
 assert.equal(override.requiresAudit,true);
});

test('lock and administrator-approved unlock preserve audit history',()=>{
 let state=emptyPeriodControl();
 state=lockPeriod(state,{periodId:'2026-06',lockType:'Hard Lock',reason:'Month end complete',now:'2026-07-01T09:00:00Z'});
 assert.equal(state.periods.find(p=>p.id==='2026-06').status,'Hard Locked');
 state=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Post approved correction',now:'2026-07-02T09:00:00Z'});
 const request=state.requests[0];
 state=decideUnlockRequest(state,{requestId:request.id,decision:'Approved',remarks:'Controller approved',now:'2026-07-02T10:00:00Z'});
 assert.equal(state.periods.find(p=>p.id==='2026-06').status,'Temporary Unlock');
 assert.equal(state.requests[0].status,'Approved');
 assert.deepEqual(state.audit.map(x=>x.action),['Temporary unlock approved','Unlock requested','Period locked']);
});

test('closing review and unconfigured dates fail closed',()=>{
 const state=emptyPeriodControl();
 assert.equal(validatePeriodAction({date:'2026-08-10',state}).code,'PERIOD_CLOSING');
 assert.equal(validatePeriodAction({date:'2027-04-10',state}).code,'PERIOD_NOT_CONFIGURED');
});

test('day, week and month locks resolve predictable calendar ranges',()=>{
 assert.deepEqual(resolveLockRange('Day','2026-09-05'),{start:'2026-09-05',end:'2026-09-05',name:'05 Sept 2026'});
 assert.deepEqual(resolveLockRange('Week','2026-09-05'),{start:'2026-08-31',end:'2026-09-06',name:'Week of 31 Aug 2026'});
 const month=resolveLockRange('Month','2026-09-05');assert.equal(month.start,'2026-09-01');assert.equal(month.end,'2026-09-30');
 const created=createLockWindow(emptyPeriodControl(),{frequency:'Day',date:'2026-09-05'});assert.equal(created.period.frequency,'Day');assert.equal(created.state.periods[0].id,created.period.id);
});

test('branch scoped locks apply to every module in the selected context',()=>{
 let state={...emptyPeriodControl(),periods:[]};
 const created=createLockWindow(state,{frequency:'Month',date:'2026-09-05',companyId:'NSR02',scopeType:'Branches',branchIds:['northstar-chennai'],modules:['Sales']});
 state=lockPeriod(created.state,{periodId:created.period.id,lockType:'Hard Lock',reason:'Sales close'});
 assert.equal(validatePeriodAction({date:'2026-09-10',companyId:'NSR02',branchId:'northstar-chennai',module:'Sales',state}).code,'PERIOD_HARD_LOCKED');
 assert.equal(validatePeriodAction({date:'2026-09-10',companyId:'NSR02',branchId:'northstar-coimbatore',module:'Sales',state}).code,'PERIOD_NOT_CONFIGURED');
 assert.equal(validatePeriodAction({date:'2026-09-10',companyId:'NSR02',branchId:'northstar-chennai',module:'Banking',state}).code,'PERIOD_HARD_LOCKED');
 assert.deepEqual(created.period.modules,PERIOD_MODULES);
});

test('approved unlock is temporary and automatically relocks after expiry',()=>{
 let state=emptyPeriodControl();
 state=lockPeriod(state,{periodId:'2026-06',lockType:'Hard Lock',reason:'Close'});
 state=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Correction',duration:'1 Hour',now:'2026-07-02T09:00:00Z'});
 state=decideUnlockRequest(state,{requestId:state.requests[0].id,decision:'Approved',now:'2026-07-02T10:00:00Z'});
 assert.equal(state.periods.find(p=>p.id==='2026-06').status,'Temporary Unlock');
 state=relockExpiredPeriods(state,'2026-07-02T11:01:00Z');
 assert.equal(state.periods.find(p=>p.id==='2026-06').status,'Reclosed');
});

test('quarter and financial year ranges are supported',()=>{
 assert.deepEqual(resolveLockRange('Quarter','2026-09-05'),{start:'2026-07-01',end:'2026-09-30',name:'Q2 FY 2026–27'});
 assert.deepEqual(resolveLockRange('Year','2026-02-05'),{start:'2025-04-01',end:'2026-03-31',name:'FY 2025–26'});
});

test('operational pending work warns while accounting integrity failures block closing',()=>{
 const warningOnly=evaluateClosingChecks({modules:['Sales','Accounting'],counts:{draftInvoices:3,pendingJournalApprovals:1}});
 assert.equal(warningOnly.canContinue,true);
 assert.equal(warningOnly.warnings.reduce((n,x)=>n+x.count,0),4);
 const blocked=evaluateClosingChecks({modules:['Accounting'],counts:{unbalancedJournals:1}});
 assert.equal(blocked.canContinue,false);
 assert.equal(blocked.blocking[0].label,'Unbalanced journal entries');
 assert.ok(warningOnly.warnings.some(x=>x.label.includes('Purchases')));
 const clear=evaluateClosingChecks({modules:['Sales'],counts:{}});
 assert.equal(clear.canContinue,true);
});

test('branch ownership validation rejects branches outside the selected organisation',()=>{
 assert.throws(()=>createLockWindow({...emptyPeriodControl(),periods:[]},{frequency:'Month',date:'2026-09-05',companyId:'NSR02',scopeType:'Branches',branchIds:['abc-kochi'],availableBranchIds:['northstar-chennai'],modules:['Sales']}),/does not belong/);
});

test('active overlapping locks are rejected instead of silently contradicting each other',()=>{
 let state={...emptyPeriodControl(),periods:[]};
 const monthly=createLockWindow(state,{frequency:'Month',date:'2026-09-05',companyId:'NSR02',modules:['Accounting']});
 state=lockPeriod(monthly.state,{periodId:monthly.period.id,lockType:'Hard Lock',reason:'Month closed'});
 assert.throws(()=>createLockWindow(state,{frequency:'Day',date:'2026-09-05',companyId:'NSR02',modules:['Accounting']}),/locked period already exists/);
});

test('duplicate locked periods and financial-year boundary violations are rejected clearly',()=>{
 let state={...emptyPeriodControl(),periods:[]};
 const created=createLockWindow(state,{frequency:'Month',date:'2026-09-05',companyId:'NSR02',financialYearId:'FY-2026'});
 state=lockPeriod(created.state,{periodId:created.period.id,lockType:'Hard Lock',reason:'Closed'});
 assert.throws(()=>createLockWindow(state,{frequency:'Month',date:'2026-09-05',companyId:'NSR02',financialYearId:'FY-2026'}),/already locked for the selected organisation and branches/);
 assert.throws(()=>createLockWindow({...emptyPeriodControl(),periods:[]},{frequency:'Month',date:'2027-04-01',companyId:'NSR02',financialYearId:'FY-2026'}),/within the chosen financial year/);
});

test('the most restrictive overlapping lock wins and missing branch context cannot match a branch lock',()=>{
 const base={...emptyPeriodControl(),periods:[]};
 const soft={id:'soft-day',companyId:'NSR02',name:'05 Sept 2026',start:'2026-09-05',end:'2026-09-05',frequency:'Day',scopeType:'Organisation',modules:['Accounting'],status:'Soft Locked',lockType:'Soft Lock'};
 const hard={id:'hard-month',companyId:'NSR02',name:'September 2026',start:'2026-09-01',end:'2026-09-30',frequency:'Month',scopeType:'Organisation',modules:['Accounting'],status:'Hard Locked',lockType:'Hard Lock'};
 assert.equal(validatePeriodAction({date:'2026-09-05',companyId:'NSR02',branchId:'northstar-chennai',module:'Accounting',role:'Accountant',state:{...base,periods:[soft,hard]}}).code,'PERIOD_HARD_LOCKED');
 const branch={...hard,id:'branch-only',scopeType:'Branches',branchIds:['northstar-chennai']};
 assert.equal(validatePeriodAction({date:'2026-09-05',companyId:'NSR02',module:'Accounting',state:{...base,periods:[branch]}}).code,'PERIOD_NOT_CONFIGURED');
});

test('unlock approval enforces segregation of duties and records full scope',()=>{
 let state=emptyPeriodControl();
 state=lockPeriod(state,{periodId:'2026-06',lockType:'Hard Lock',reason:'Close'});
 state=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Correction',user:'Admin'});
 assert.throws(()=>decideUnlockRequest(state,{requestId:state.requests[0].id,decision:'Approved',user:'Admin'}),/own unlock request/);
 assert.equal(state.requests[0].companyId,'ABC01');
 assert.ok(Array.isArray(state.requests[0].modules));
});

test('a financial year automatically creates twelve open monthly periods without duplicates',()=>{const empty={...emptyPeriodControl(),periods:[]},generated=generateFinancialYearPeriods(empty,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'ABC01'});assert.equal(generated.created.length,12);assert.equal(generated.state.periods.every(p=>p.status==='Open'),true);assert.equal(generateFinancialYearPeriods(generated.state,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'ABC01'}).created.length,0)});
test('completed prior financial years are generated hard locked and missing months are detectable',()=>{const generated=generateFinancialYearPeriods({...emptyPeriodControl(),periods:[]},{financialYearStart:'2025-04-01',financialYearEnd:'2026-03-31',companyId:'ABC01',completed:true});assert.equal(generated.state.periods.every(p=>p.status==='Hard Locked'),true);const incomplete={...generated.state,periods:generated.state.periods.slice(1)};assert.equal(findMissingPeriods(incomplete,{financialYearStart:'2025-04-01',financialYearEnd:'2026-03-31',companyId:'ABC01'})[0].name,'April 2025')});
test('unlock requests expose a pending period status and retain approval context',()=>{let state=emptyPeriodControl();state=requestPeriodUnlock(state,{periodId:'2026-04',reason:'Correct approved invoice',transactionType:'Sales Invoice',amount:12500,approver:'Finance Manager'});assert.equal(periodStatus(state.periods.find(p=>p.id==='2026-04')),'Pending Unlock Approval');assert.equal(state.requests[0].transactionType,'Sales Invoice');assert.equal(state.requests[0].amount,12500);assert.equal(validatePeriodAction({date:'2026-04-15',state}).code,'PERIOD_APPROVAL_REQUIRED')});
test('create missing periods fills only the selected organisation and clears its missing list',()=>{const base={...emptyPeriodControl(),periods:[]},abc=generateFinancialYearPeriods(base,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'ABC01'}).state;assert.equal(findMissingPeriods(abc,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'NSR02'}).length,12);const viskool=generateFinancialYearPeriods(abc,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'NSR02',organisationName:'Viskool'});assert.equal(viskool.created.length,12);assert.equal(findMissingPeriods(viskool.state,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',companyId:'NSR02'}).length,0);assert.equal(viskool.state.periods.filter(p=>p.companyId==='ABC01').length,12)});

test('closing status maps engine states to the four professional statuses',()=>{
 assert.equal(closingStatus({status:'Open'}),'Open');
 assert.equal(closingStatus({status:'Closing'}),'Closing');
 assert.equal(closingStatus({status:'Locked',lockType:'Soft Lock'}),'Closed');
 assert.equal(closingStatus({status:'Locked'}),'Closed');
 assert.equal(closingStatus({status:'Reopened'}),'Reopened');
});

test('closing readiness separates blocking work from reviewable warnings',()=>{
 const blocked=evaluateClosingReadiness({counts:{draftInvoices:2,pendingReconciliations:1}});
 assert.equal(blocked.canClose,false);
 assert.equal(blocked.blocking[0].label,'All invoices posted');
 assert.equal(blocked.warnings[0].label,'Bank reconciliation completed');
 const warningsOnly=evaluateClosingReadiness({counts:{pendingTaxAdjustments:1}});
 assert.equal(warningsOnly.canClose,true);
 assert.equal(warningsOnly.requiresAcknowledgement,true);
 const clean=evaluateClosingReadiness({counts:{}});
 assert.equal(clean.canClose,true);
 assert.equal(clean.requiresAcknowledgement,false);
 assert.equal(clean.checks.length,5);
});

test('closePeriod blocks unposted work and records the closing user, date and audit event',()=>{
 let state=emptyPeriodControl();
 assert.throws(()=>closePeriod(state,{periodId:'2026-06',reason:'Month end',counts:{draftJournals:1},now:'2026-07-01T09:00:00Z'}),/Closing cannot continue/);
 assert.throws(()=>closePeriod(state,{periodId:'2026-06',reason:'Month end',counts:{},user:'Accountant',now:'2026-07-01T09:00:00Z'}),/administrator/);
 state=closePeriod(state,{periodId:'2026-06',reason:'Month end complete',counts:{},user:'Business Owner',now:'2026-07-01T09:00:00Z'});
 const period=state.periods.find(p=>p.id==='2026-06');
 assert.equal(period.status,'Hard Locked');
 assert.equal(period.closedBy,'Business Owner');
 assert.equal(period.closedAt,'2026-07-01T09:00:00Z');
 assert.equal(closingStatus(period),'Closed');
 assert.equal(period.closingChecklist.length,5);
 assert.equal(state.audit[0].action,'Period closed');
 assert.equal(state.audit[0].user,'Business Owner');
 assert.equal(validatePeriodAction({date:'2026-06-20',role:'Admin',state}).allowed,false);
});

test('closing requires warnings to be acknowledged when work is outstanding',()=>{
 const state=emptyPeriodControl();
 assert.throws(()=>closePeriod(state,{periodId:'2026-06',reason:'Month end',counts:{unreconciledTransactions:3},now:'2026-07-01T09:00:00Z'}),/warnings|Confirm the outstanding warnings/i);
 const closed=closePeriod(state,{periodId:'2026-06',reason:'Month end',counts:{unreconciledTransactions:3},acknowledgeWarnings:true,now:'2026-07-01T09:00:00Z'});
 assert.equal(closed.periods.find(p=>p.id==='2026-06').status,'Hard Locked');
});

test('business owner may close and approve but not raise unlock requests',()=>{
 assert.equal(can('Business Owner','lock'),true);
 assert.equal(can('Business Owner','approve-unlock'),true);
 assert.equal(can('Business Owner','request-unlock'),false);
 assert.equal(can('Accountant','request-unlock'),true);
 assert.equal(can('Accountant','lock'),false);
});

test('period helpers describe scope, closing metadata and timelines',()=>{
 let state=emptyPeriodControl();
 state=closePeriod(state,{periodId:'2026-06',reason:'Month end',counts:{},user:'Admin',now:'2026-07-01T09:00:00Z'});
 const period=state.periods.find(p=>p.id==='2026-06');
 assert.equal(periodBranchLabel(period),'All branches');
 assert.equal(periodClosedBy(period),'Admin');
 assert.equal(periodClosedAt(period),'2026-07-01T09:00:00Z');
 assert.equal(lastClosedPeriod(state.periods).id,'2026-06');
 assert.equal(currentPeriodFor(state.periods,{companyId:'ABC01',date:'2026-09-05'}).name,'September 2026');
 assert.equal(closedPeriods(state.periods).length,3);
 assert.deepEqual(periodAuditTimeline(state,'2026-06').map(entry=>entry.action),['Period closed']);
});
test('the lock register shows only past locks automatically and only locks created here manually',()=>{
 const rows=[{id:'2026-04',name:'April 2026',end:'2026-04-30',status:'Locked',lockType:'Hard Lock'},{id:'2026-05',name:'May 2026',end:'2026-05-31',status:'Locked',lockType:'Soft Lock'},{id:'2026-09',name:'September 2026',end:'2026-09-30',status:'Open',lockType:'\u2014'}];
 assert.deepEqual(lockRegisterRows(rows,{mode:'Automatic',today:'2026-09-05'}).map(row=>row.id),['2026-04','2026-05'],'automatic mode keeps the locks whose period already ended');
 assert.deepEqual(lockRegisterRows(rows,{mode:'Automatic',today:'2026-09-05',createdIds:['2026-09']}).map(row=>row.id),['2026-04','2026-05'],'a future lock created here still stays out of the automatic register');
 assert.deepEqual(lockRegisterRows(rows,{mode:'Manual',today:'2026-09-05'}).map(row=>row.id),[],'manual mode lists nothing until a lock is created here');
 assert.deepEqual(lockRegisterRows(rows,{mode:'Manual',today:'2026-09-05',createdIds:['2026-09']}).map(row=>row.id),['2026-09'],'manual mode lists only the lock created here');
 assert.deepEqual(lockRegisterRows(rows,{mode:'Off',today:'2026-09-05'}).map(row=>row.id),['2026-04','2026-05','2026-09'],'locking off hides nothing');
 assert.deepEqual(lockRegisterRows(undefined,{mode:'Manual'}),[],'a missing period list is handled');
});
test('the period locking switch is one stored mode shared by every module',()=>{
 const store=new Map();
 const fake={getItem:key=>(store.has(key)?store.get(key):null),setItem:(key,value)=>store.set(key,String(value))};
 writePeriodSettings({lockingMode:'Automatic'},fake);
 assert.equal(readPeriodSettings(fake).lockingMode,'Automatic');
 assert.equal(readPeriodSettings(fake).autoLockPreviousMonth,true,'the legacy mirror follows the switch');
 assert.equal(lockingEnabled(readPeriodSettings(fake)),true);
 writePeriodSettings({lockingMode:'Off'},fake);
 assert.equal(lockingEnabled(readPeriodSettings(fake)),false,'switching locking off disables it for every module');
 assert.equal(unlockApprovalRequired(readPeriodSettings(fake)),false,'the unlock approval flow disappears with locking off');
 writePeriodSettings({...readPeriodSettings(fake),lockingMode:'Manual'},fake);
 assert.equal(readPeriodSettings(fake).lockingMode,'Manual','disabling automatic locking is manual locking');
 assert.equal(readPeriodSettings(fake).autoLockPreviousMonth,false);
 assert.equal(lockingEnabled(readPeriodSettings(fake)),true,'manual locking still blocks postings inside a locked period');
});
test('a request raised by the acting role is decided by the next authorised approver',()=>{
 const state=emptyPeriodControl(),settings=readPeriodSettings();
 const raised=requestPeriodUnlock(state,{periodId:'2026-04',reason:'Correct April bank charges',user:'Admin'});
 const request=raised.requests[0];
 assert.equal(request.requestedBy,'Admin');
 assert.equal(request.status,'Pending approval');
 assert.equal(unlockApproverFor('Admin',settings),'Business Owner','the requester is never their own approver');
 assert.equal(unlockApproverFor('Business Owner',settings),'Admin');
 assert.equal(unlockApproverFor('Accountant',settings),'Business Owner');
 assert.equal(unlockApproverFor('Admin',{...settings,allowedRoles:['Admin']}),'','a policy with no other allowed approver returns nobody');
 assert.throws(()=>decideUnlockRequest(raised,{requestId:request.id,decision:'Approved',user:'Admin'}),/your own unlock request/);
 const decided=decideUnlockRequest(raised,{requestId:request.id,decision:'Approved',user:unlockApproverFor(request.requestedBy,settings)});
 assert.equal(decided.requests[0].status,'Approved');
 assert.equal(decided.requests[0].approvedBy,'Business Owner');
 assert.equal(closingStatus(decided.periods.find(period=>period.id==='2026-04')),'Reopened');
});

test('deleting a request releases a pending period, keeps the audit trail and refuses other roles',()=>{
 let state=emptyPeriodControl();
 state=lockPeriod(state,{periodId:'2026-06',lockType:'Hard Lock',reason:'Close'});
 const raised=requestPeriodUnlock(state,{periodId:'2026-06',reason:'Correction',user:'Admin'});
 const request=raised.requests[0];
 assert.equal(periodStatus(raised.periods.find(p=>p.id==='2026-06')),'Pending Unlock Approval');
 assert.throws(()=>deleteUnlockRequest(raised,{requestId:request.id,user:'Accountant'}),/requester or an approver/);
 const deleted=deleteUnlockRequest(raised,{requestId:request.id,user:'Admin'});
 assert.equal(deleted.requests.length,0,'the request record leaves the register');
 assert.equal(periodStatus(deleted.periods.find(p=>p.id==='2026-06')),'Hard Locked','a pending period is released before its row disappears');
 assert.equal(deleted.audit[0].action,'Unlock request deleted');
 assert.ok(deleted.audit.some(entry=>entry.action==='Unlock cancelled'),'the release itself is still audited');
 assert.throws(()=>deleteUnlockRequest(deleted,{requestId:request.id,user:'Admin'}),/not found/);
 const decided=decideUnlockRequest(raised,{requestId:request.id,decision:'Approved',user:'Business Owner'});
 const cleared=deleteUnlockRequest(decided,{requestId:request.id,user:'Business Owner'});
 assert.equal(cleared.requests.length,0,'a decided request can be cleared from the register too');
 assert.equal(closingStatus(cleared.periods.find(p=>p.id==='2026-06')),'Reopened','deleting a decided request never rewrites its outcome');
});
