export const PERIOD_STORAGE='wayvida-period-control-v1';
export const PERIOD_SETTINGS_STORAGE='wayvida-period-settings-v1';
export const PERIOD_STATUSES=['Open','Closing Review','Pending Approval','Soft Locked','Hard Locked','Pending Unlock Approval','Temporary Unlock','Reclosed'];
export const PERIOD_MODULES=['Sales','Purchases','Banking','Expenses','Inventory','Assets','Payroll','Accounting','Tax'];
export const PERIOD_PERMISSIONS={'Business User':['view'],Accountant:['view','request-unlock'],'Business Owner':['view','lock','approve-unlock'],Admin:['view','request-unlock','lock','approve-unlock','configure']};
export const PERIOD_ROLE_OPTIONS=['Admin','Business Owner','Accountant'];
export const PERIOD_DISPLAY_STATUSES=['Open','Closing','Closed','Reopened'];
export const PERIOD_DISPLAY_STATUS={'Open':'Open','Closing Review':'Closing','Pending Approval':'Closing','Soft Locked':'Closed','Hard Locked':'Closed','Reclosed':'Closed','Temporary Unlock':'Reopened','Pending Unlock Approval':'Reopened'};
export const initialPeriods=[
 {id:'2026-04',companyId:'ABC01',year:'2026–27',name:'April 2026',start:'2026-04-01',end:'2026-04-30',status:'Locked',lockType:'Hard Lock',lockedBy:'Admin',lockedAt:'2026-05-01T09:30:00',reason:'Monthly closing completed'},
 {id:'2026-05',companyId:'ABC01',year:'2026–27',name:'May 2026',start:'2026-05-01',end:'2026-05-31',status:'Soft locked',lockType:'Soft Lock',lockedBy:'Admin',lockedAt:'2026-06-02T11:00:00',reason:'Management review in progress'},
 {id:'2026-06',companyId:'ABC01',year:'2026–27',name:'June 2026',start:'2026-06-01',end:'2026-06-30',status:'Open',lockType:'—',lockedBy:'—',lockedAt:'',reason:''},
 {id:'2026-07',companyId:'ABC01',year:'2026–27',name:'July 2026',start:'2026-07-01',end:'2026-07-31',status:'Open',lockType:'—',lockedBy:'—',lockedAt:'',reason:''},
 {id:'2026-08',companyId:'ABC01',year:'2026–27',name:'August 2026',start:'2026-08-01',end:'2026-08-31',status:'Closing',lockType:'—',lockedBy:'—',lockedAt:'',reason:'Reconciliation checks in progress'},
 {id:'2026-09',companyId:'ABC01',year:'2026–27',name:'September 2026',start:'2026-09-01',end:'2026-09-30',status:'Open',lockType:'—',lockedBy:'—',lockedAt:'',reason:''}
];
export const defaultPeriodSettings={backdated:false,approval:true,defaultType:'Soft Lock',unlock:true,defaultFrequency:'Month',reminderDays:5,autoRelock:true,defaultUnlockDuration:'1 Hour',maximumUnlockHours:24,mandatoryChecks:true,warningChecks:true,automaticPeriodCreation:true,autoLockPreviousMonth:false,autoLockAfterDays:5,closingDay:5,allowedRoles:['Admin','Business Owner','Accountant'],unlockPermission:'Approval required',lockingMode:'Manual',schedule:{frequency:'Month',effectiveFrom:'2026-04-01',lockAfterDays:5,lockAtTime:'00:05',notifyDaysBefore:3,timezone:'Asia/Kolkata (IST)',weekStart:'Monday',monthMode:'Calendar month',monthStartDay:1,monthEndDay:0,quarterMode:'Calendar quarters',yearMode:'Calendar year',anniversaryDate:'',fyStartMonth:'April',fyLabelFormat:'FY 2026–27'},approverRole:'Role that closed the period',maximumUnlockDuration:'24 Hours',unlockScope:'Whole period',dailyAutoApproval:false,createdBy:'',createdAt:'',updatedBy:'',updatedAt:'',defaultScope:{companyIds:['ABC01'],branchIds:[]},exemptModules:[]};
const PERIOD_ORGANISATIONS={ABC01:'ABC Technologies Pvt Ltd',NSR02:'Northstar Retail LLP',MTC03:'Malabar Trading Co.',BWS04:'Bluewave Services Pvt Ltd'};
const PERIOD_BRANCHES={'abc-kochi':'Kochi Branch','abc-bengaluru':'Bengaluru Branch','abc-trivandrum':'Trivandrum Branch','northstar-chennai':'Chennai Branch','northstar-coimbatore':'Coimbatore Branch','malabar-calicut':'Calicut Branch','malabar-kannur':'Kannur Branch','bluewave-mumbai':'Mumbai Branch','bluewave-pune':'Pune Branch'};
const auditBranchLabel=(unit,entry)=>{const named=(unit?.branchNames||[]).filter(Boolean);if(named.length)return named.join(', ');const ids=(unit?.branchIds?.length?unit.branchIds:entry?.scope?.branchIds)||[];return ids.length?ids.map(id=>PERIOD_BRANCHES[id]||id).join(', '):'All branches';};
const auditEntry=(entry,unit)=>({organisation:entry.organisation||unit?.organisationName||PERIOD_ORGANISATIONS[unit?.companyId||entry?.scope?.companyId]||'All organisations',branch:entry.branch||auditBranchLabel(unit,entry),beforeValue:entry.beforeValue??entry.previousStatus??null,afterValue:entry.afterValue??entry.newStatus??null,reason:entry.reason||entry.remarks||'',...entry});
export const emptyPeriodControl=()=>({version:1,periods:structuredClone(initialPeriods),requests:[],audit:[]});
const browserStorage=()=>typeof localStorage==='undefined'?null:localStorage;
export function readPeriodControl(store=browserStorage()){try{let state=JSON.parse(store?.getItem(PERIOD_STORAGE))||emptyPeriodControl(),settings=readPeriodSettings(store);if(!settings.automaticPeriodCreation)return state;let created=0;for(const organisation of [{companyId:'ABC01',organisationName:'ABC Technologies Pvt Ltd'},{companyId:'NSR02',organisationName:'Northstar Retail LLP'},{companyId:'MTC03',organisationName:'Malabar Trading Co.'},{companyId:'BWS04',organisationName:'Bluewave Services Pvt Ltd'}]){const generated=generateFinancialYearPeriods(state,{financialYearStart:'2026-04-01',financialYearEnd:'2027-03-31',...organisation});state=generated.state;created+=generated.created.length}if(created)store?.setItem(PERIOD_STORAGE,JSON.stringify(state));return state}catch{return emptyPeriodControl()}}
export function writePeriodControl(value,store=browserStorage()){store?.setItem(PERIOD_STORAGE,JSON.stringify(value));return value}
export function readPeriodSettings(store=browserStorage()){try{return normalisePeriodSettings(JSON.parse(store?.getItem(PERIOD_SETTINGS_STORAGE))||{})}catch{return normalisePeriodSettings({})}}
export function writePeriodSettings(value,store=browserStorage()){const next=normalisePeriodSettings(value);store?.setItem(PERIOD_SETTINGS_STORAGE,JSON.stringify(next));return next}
export function can(role,permission){return (PERIOD_PERMISSIONS[role]||[]).includes(permission)}
export const legacyStatus=value=>({'Closing':'Closing Review','Soft locked':'Soft Locked','Locked':'Hard Locked','Reopened':'Temporary Unlock'}[value]||value);
export function periodStatus(period){if(period.status==='Locked'&&period.lockType==='Soft Lock')return 'Soft Locked';return legacyStatus(period.status)}
export function findPeriod(periods,date,companyId){return periods.find(p=>p.companyId===companyId&&date>=p.start&&date<=p.end)}
const ownsScope=(p,{companyId,branchId,module})=>p.companyId===companyId&&(!module||(p.modules||PERIOD_MODULES).includes(module))&&(p.scopeType!=='Branches'||Boolean(branchId)&&(p.branchIds||[]).includes(branchId));
const overlaps=(a,b)=>a.start<=b.end&&b.start<=a.end;
const scopeOverlaps=(a,b)=>a.scopeType!=='Branches'||b.scopeType!=='Branches'||(a.branchIds||[]).some(id=>(b.branchIds||[]).includes(id));
const moduleOverlaps=(a,b)=>(a.modules||PERIOD_MODULES).some(name=>(b.modules||PERIOD_MODULES).includes(name));
const contextLabel=p=>[p.organisationName||p.companyId,p.scopeType==='Branches'?(p.branchNames||p.branchIds||[]).join(', '):'all branches',p.name].filter(Boolean).join(', ');
const iso=date=>date.toISOString().slice(0,10);
const monthEnd=(year,month)=>iso(new Date(year,month+1,0,12));
const unlockedFor=(period,date,now)=>{if(periodStatus(period)!=='Temporary Unlock')return false;if(period.unlockExpiresAt&&now>=period.unlockExpiresAt)return false;if(period.unlockStartDate&&(date<period.unlockStartDate||date>period.unlockEndDate))return false;return true};
export function unlockWindowFor(period,{unlockScope='Whole period',startDate,endDate}={}){
 if(!period)throw Error('Select a locked accounting period.');
 if(unlockScope!=='Selected date range')return {unlockScope:'Whole period',startDate:period.start,endDate:period.end};
 const start=String(startDate||''),end=String(endDate||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw Error('Choose both the unlock start date and the unlock end date.');
 if(start>end)throw Error('The unlock start date cannot be after the unlock end date.');
 if(start<period.start||end>period.end)throw Error('A selected date range must stay inside '+period.name+' ('+period.start+' to '+period.end+').');
 return {unlockScope:'Selected date range',startDate:start,endDate:end};
}
export function generateFinancialYearPeriods(state,{financialYearStart,financialYearEnd,companyId='ABC01',organisationName='Organisation',completed=false}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(financialYearStart||'')||!/^\d{4}-\d{2}-\d{2}$/.test(financialYearEnd||'')||financialYearStart>financialYearEnd)throw Error('Choose a valid financial year range.');
 const next=structuredClone(state),created=[],cursor=new Date(financialYearStart+'T12:00:00'),limit=new Date(financialYearEnd+'T12:00:00'),fyYear=cursor.getFullYear(),fy=`${fyYear}–${String(fyYear+1).slice(-2)}`;
 while(cursor<=limit){const year=cursor.getFullYear(),month=cursor.getMonth(),start=`${year}-${String(month+1).padStart(2,'0')}-01`,end=monthEnd(year,month),id=`${companyId}-${start.slice(0,7)}`;if(!next.periods.some(p=>p.companyId===companyId&&p.start===start&&p.end===(end>financialYearEnd?financialYearEnd:end))){const status=completed?'Hard Locked':'Open',period={id,companyId,organisationName,year:fy,name:cursor.toLocaleDateString('en-IN',{month:'long',year:'numeric'}),start,end:end>financialYearEnd?financialYearEnd:end,frequency:'Month',scopeType:'Organisation',branchIds:[],branchNames:[],modules:[...PERIOD_MODULES],financialYearId:`FY-${fyYear}`,status,lockType:completed?'Hard Lock':'—',lockedBy:completed?'System':'—',lockedAt:completed?new Date(financialYearEnd+'T23:59:59').toISOString():'',reason:completed?'Previous financial year completed.':'',approvalStatus:'Not required',lastAction:completed?'Automatically locked':'Automatically created',transactionImpactCount:0,version:1};next.periods.push(period);created.push(period)}cursor.setMonth(cursor.getMonth()+1)}
 return {state:next,created};
}
export function findMissingPeriods(state,{financialYearStart,financialYearEnd,companyId='ABC01'}={}){const shell={...state,periods:[]},expected=generateFinancialYearPeriods(shell,{financialYearStart,financialYearEnd,companyId}).created;return expected.filter(month=>!state.periods.some(p=>p.companyId===companyId&&p.frequency==='Month'&&p.start===month.start));}
export function resolveLockRange(frequency,date){
 if(frequency==='Financial Year')frequency='Year';
 const value=new Date(date+'T12:00:00');if(Number.isNaN(value.getTime()))throw Error('Choose a valid period.');let start=new Date(value),end=new Date(value);
 if(frequency==='Week'){const offset=(value.getDay()+6)%7;start.setDate(value.getDate()-offset);end=new Date(start);end.setDate(start.getDate()+6)}
 else if(frequency==='Month'){start=new Date(value.getFullYear(),value.getMonth(),1,12);end=new Date(value.getFullYear(),value.getMonth()+1,0,12)}
 else if(frequency==='Quarter'){const month=Math.floor(value.getMonth()/3)*3;start=new Date(value.getFullYear(),month,1,12);end=new Date(value.getFullYear(),month+3,0,12)}
 else if(frequency==='Year'){start=new Date(value.getFullYear(),3,1,12);if(value.getMonth()<3)start.setFullYear(value.getFullYear()-1);end=new Date(start.getFullYear()+1,2,31,12)}
 else if(frequency!=='Day')throw Error('Choose Day, Week, Month, Quarter, or Year.');
 const fiscalStart=start.getMonth()<3?start.getFullYear()-1:start.getFullYear(),fiscalQuarter=Math.floor(((start.getMonth()+9)%12)/3)+1;
 const name=frequency==='Day'?start.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):frequency==='Week'?`Week of ${start.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`:frequency==='Quarter'?`Q${fiscalQuarter} FY ${fiscalStart}–${String(fiscalStart+1).slice(-2)}`:frequency==='Year'?`FY ${start.getFullYear()}–${String(start.getFullYear()+1).slice(-2)}`:start.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
 return {start:iso(start),end:iso(end),name};
}
export function createLockWindow(state,{frequency,date,preview=false,companyId='ABC01',organisationName='ABC Technologies Pvt Ltd',scopeType='Organisation',branchIds=[],branchNames=[],availableBranchIds,financialYearId}){
 const modules=[...PERIOD_MODULES],range=resolveLockRange(frequency,date),scopeKey=scopeType==='Branches'?'-'+[...branchIds].sort().join('_'):'',id=`${companyId}-${frequency.toLowerCase()}-${range.start}${scopeKey}`;
 const duplicate=state.periods.find(p=>p.id===id);if(duplicate){if(['Soft Locked','Hard Locked','Reclosed','Temporary Unlock'].includes(periodStatus(duplicate)))throw Error(`${range.name} is already locked for the selected organisation and branches.`);return preview?duplicate:{state,period:duplicate}}
 if(scopeType==='Branches'&&!branchIds.length)throw Error('Select at least one branch.');if(new Set(branchIds).size!==branchIds.length)throw Error('Each branch can be selected only once.');if(availableBranchIds&&branchIds.some(id=>!availableBranchIds.includes(id)))throw Error('A selected branch does not belong to this organisation.');
 const fyYear=Number(String(financialYearId||'').match(/\d{4}/)?.[0]||range.start.slice(0,4)),fyStart=`${fyYear}-04-01`,fyEnd=`${fyYear+1}-03-31`;if(range.start<fyStart||range.end>fyEnd)throw Error('The selected period must be within the chosen financial year.');
 const period={id,companyId,organisationName,scopeType,branchIds:[...branchIds],branchNames:[...branchNames],modules:[...new Set(modules)],financialYearId:financialYearId||`FY-${fyYear}`,year:fyYear+'–'+String(fyYear+1).slice(-2),name:range.name,frequency,...range,status:'Open',lockType:'—',lockedBy:'—',lockedAt:'',reason:'',approvalStatus:'Not required',lastAction:'Created',transactionImpactCount:0,version:1};
 const conflict=state.periods.find(existing=>existing.companyId===companyId&&overlaps(existing,period)&&scopeOverlaps(existing,period)&&moduleOverlaps(existing,period)&&periodStatus(existing)!=='Open');
 if(conflict)throw Error(`A locked period already exists within this date range. Review ${contextLabel(conflict)} first.`);
 return preview?period:{state:{...state,periods:[period,...state.periods]},period};
}
export function validatePeriodAction({date,role='Business User',action='post',companyId='ABC01',branchId,module,state=readPeriodControl(),settings=readPeriodSettings(),approvalGranted=false,now=new Date().toISOString()}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return {allowed:false,code:'INVALID_DATE',message:'Choose a valid accounting date.'};
 const rank={Day:5,Week:4,Month:3,Quarter:2,Year:1},restriction={'Hard Locked':6,Reclosed:6,'Closing Review':5,'Pending Approval':5,'Soft Locked':4,'Temporary Unlock':2,Open:1};const matches=state.periods.filter(p=>ownsScope(p,{companyId,branchId,module})&&date>=p.start&&date<=p.end);const period=matches.sort((a,b)=>10*((restriction[periodStatus(b)]||0)-(restriction[periodStatus(a)]||0))+(rank[b.frequency||'Month']-rank[a.frequency||'Month']))[0];
 if(!period)return {allowed:false,code:'PERIOD_NOT_CONFIGURED',message:'No accounting period is configured for this transaction date.'};
 if(period.status==='Reopened'&&period.unlockExpiresAt&&now>=period.unlockExpiresAt)return {allowed:false,code:period.lockTypeBeforeUnlock==='Hard Lock'?'PERIOD_HARD_LOCKED':'PERIOD_APPROVAL_REQUIRED',message:`${period.name} has been automatically relocked. Request another temporary unlock to continue.`,period:{...period,status:period.lockTypeBeforeUnlock==='Hard Lock'?'Locked':'Soft locked'}};
 const status=periodStatus(period);
 if(status==='Open')return {allowed:true,period};
 if(status==='Temporary Unlock'&&(!period.unlockExpiresAt||now<period.unlockExpiresAt)){
  const windowOk=!period.unlockStartDate||(date>=period.unlockStartDate&&date<=period.unlockEndDate),windowLabel=period.unlockStartDate?` from ${period.unlockStartDate} to ${period.unlockEndDate}`:'';
  if(windowOk)return {allowed:true,period,requiresAudit:true,warning:`${period.name} is temporarily unlocked${windowLabel}. This ${action} will be recorded.`};
  return {allowed:false,code:'PERIOD_HARD_LOCKED',message:`Posting blocked. ${period.name} is only unlocked${windowLabel}, so ${date} stays locked. Request another unlock or ask an administrator for a written override.`,period};
 }
 if(['Closing Review','Pending Approval'].includes(status))return {allowed:false,code:'PERIOD_CLOSING',message:`${period.name} is under closing review. Complete the review before ${action}.`,period};
 if(status==='Pending Unlock Approval')return {allowed:false,code:'PERIOD_APPROVAL_REQUIRED',requiresApproval:true,message:`${period.name} is locked. Unlock approval is pending.`,period};
 if(status==='Soft Locked'&&can(role,'request-unlock')){
  if(!settings.approval||approvalGranted)return {allowed:true,warning:`${period.name} is soft locked. This override will be recorded in the audit trail.`,period,requiresAudit:true};
  return {allowed:false,code:'PERIOD_APPROVAL_REQUIRED',requiresApproval:true,message:`${period.name} is closed. Submit an unlock request for administrator approval.`,period};
 }
 return {allowed:false,code:'PERIOD_HARD_LOCKED',message:`Posting blocked. ${module||'Accounting'} is hard locked for ${contextLabel(period)}. Request an approved temporary unlock to continue.`,period};
}
export function validatePostingDate(date,role='Business User',options={}){return validatePeriodAction({date,role,action:'posting',...options})}
export function lockPeriod(state,{periodId,lockType,reason,user='Admin',action='Period locked',now=new Date().toISOString()}){
 if(!can(user,'lock'))throw Error('Only an administrator can lock accounting periods.');if(!['Soft Lock','Hard Lock'].includes(lockType))throw Error('Choose a valid lock type.');if(!reason?.trim())throw Error('A closing reason is required.');
 const period=state.periods.find(p=>p.id===periodId);if(!period)throw Error('Accounting period not found.');if(!['Open','Closing Review','Pending Approval'].includes(periodStatus(period)))throw Error(`A period in ${periodStatus(period)} status cannot be locked.`);
 const previousStatus=periodStatus(period),status=lockType==='Hard Lock'?'Hard Locked':'Soft Locked';return {...state,periods:state.periods.map(p=>p.id===periodId?{...p,status,lockType,lockedBy:user,lockedAt:now,statusChangedBy:user,statusChangedAt:now,reason:reason.trim(),approvalStatus:'Approved',lastAction:'Locked',version:(p.version||0)+1}:p),audit:[auditEntry({id:crypto.randomUUID(),periodId,period:period.name,action,type:lockType,user,date:now,remarks:reason.trim(),previousStatus,newStatus:status,scope:{companyId:period.companyId,branchIds:period.branchIds||[],modules:period.modules||[]}},period),...state.audit]};
}
export function requestPeriodUnlock(state,{periodId,reason,user='Accountant',duration='1 Hour',unlockScope='Whole period',startDate,endDate,affectedTransactionCount=0,transactionType='Accounting transaction',amount=0,approver='Admin',now=new Date().toISOString()}){
 if(!can(user,'request-unlock'))throw Error('Your role cannot request an unlock.');if(!reason?.trim())throw Error('An unlock reason is required.');const period=state.periods.find(p=>p.id===periodId);if(!period||!['Hard Locked','Soft Locked','Reclosed'].includes(periodStatus(period)))throw Error('Select a locked accounting period.');if(state.requests.some(r=>r.periodId===periodId&&r.status==='Pending approval'))throw Error('An unlock request is already pending for this period.');const window=unlockWindowFor(period,{unlockScope,startDate,endDate});
 const request={id:'ULR-'+String(state.requests.length+1).padStart(4,'0'),periodId,period:period.name,companyId:period.companyId,organisationName:period.organisationName,scopeType:period.scopeType,branchIds:[...(period.branchIds||[])],modules:[...(period.modules||[])],requestedBy:user,reason:reason.trim(),duration,requiredDuration:duration,unlockScope:window.unlockScope,unlockStartDate:window.startDate,unlockEndDate:window.endDate,transactionType,amount:Number(amount)||0,approver,affectedTransactionCount,status:'Pending approval',date:now,autoReclose:true};return {...state,requests:[request,...state.requests],periods:state.periods.map(p=>p.id===periodId?{...p,status:'Pending Unlock Approval',lockTypeBeforeUnlock:p.lockType,approvalStatus:'Pending approval',lastAction:'Unlock requested'}:p),audit:[auditEntry({id:crypto.randomUUID(),periodId,period:period.name,requestId:request.id,action:'Unlock requested',type:'Approval',user,date:now,remarks:reason.trim(),unlockScope:window.unlockScope,unlockStartDate:window.startDate,unlockEndDate:window.endDate,previousStatus:periodStatus(period),newStatus:'Pending Unlock Approval',scope:{companyId:period.companyId,branchIds:period.branchIds||[],modules:period.modules||[]}},period),...state.audit]};
}
export function decideUnlockRequest(state,{requestId,decision,user='Admin',remarks='',duration,maxHours,now=new Date().toISOString()}){
 if(!can(user,'approve-unlock'))throw Error('Only an administrator can decide unlock requests.');if(!['Approved','Rejected'].includes(decision))throw Error('Choose Approved or Rejected.');const request=state.requests.find(r=>r.id===requestId);if(!request||request.status!=='Pending approval')throw Error('Pending unlock request not found.');if(user===request.requestedBy)throw Error('You cannot approve your own unlock request. Another administrator must review it.');
 const chosen=duration||request.duration||'1 Hour',start=new Date(now),expires=new Date(start),manual=String(chosen).startsWith('Until manually');if(manual)expires.setTime(NaN);else if(chosen==='Today')expires.setHours(23,59,59,999);else{const hours=Math.min(Number(String(chosen).match(/(\d+)\s*Hour/)?.[1]||1),Number(maxHours)||24);expires.setHours(expires.getHours()+hours)}const expiresIso=Number.isNaN(expires.getTime())?null:expires.toISOString();
 const approvalId='ULA-'+crypto.randomUUID();return {...state,requests:state.requests.map(r=>r.id===requestId?{...r,status:decision,approvedBy:user,approvedAt:now,approvalId,remarks,duration:chosen,startAt:decision==='Approved'?now:null,expiresAt:decision==='Approved'?expiresIso:null,manual}:r),periods:state.periods.map(p=>p.id===request.periodId?(decision==='Approved'?{...p,status:'Temporary Unlock',lockType:p.lockTypeBeforeUnlock||p.lockType,unlockedBy:user,unlockedAt:now,unlockRequestId:requestId,unlockApprovalId:approvalId,unlockExpiresAt:expiresIso,unlockManual:manual,unlockScope:request.unlockScope||'Whole period',unlockStartDate:request.unlockStartDate||p.start,unlockEndDate:request.unlockEndDate||p.end,approvalStatus:'Approved',lastAction:'Temporarily unlocked',statusChangedBy:user,statusChangedAt:now,version:(p.version||0)+1}:{...p,status:p.lockTypeBeforeUnlock==='Hard Lock'?'Hard Locked':'Soft Locked',lockType:p.lockTypeBeforeUnlock||p.lockType,approvalStatus:'Rejected',lastAction:'Unlock rejected',version:(p.version||0)+1}):p),audit:[auditEntry({id:crypto.randomUUID(),periodId:request.periodId,period:request.period,requestId,approvalId,action:decision==='Approved'?'Temporary unlock approved':'Unlock rejected',type:'Approval',user,date:now,remarks:remarks||request.reason,previousStatus:'Pending Unlock Approval',newStatus:decision==='Approved'?'Temporary Unlock':'Locked',duration:chosen,expiresAt:decision==='Approved'?expiresIso:null,manual,unlockScope:request.unlockScope||'Whole period',unlockStartDate:request.unlockStartDate||request.startDate,unlockEndDate:request.unlockEndDate||request.endDate,scope:{companyId:request.companyId,branchIds:request.branchIds||[],modules:request.modules||[]}},request),...state.audit]};
}
export function relockExpiredPeriods(state,now=new Date().toISOString()){
 let changed=false;const expired=[];
 const periods=state.periods.map(p=>{if(periodStatus(p)!=='Temporary Unlock'||!p.unlockExpiresAt||p.unlockExpiresAt>now)return p;changed=true;expired.push(p);const lockType=p.lockTypeBeforeUnlock||'Soft Lock';return {...p,status:'Reclosed',lockType,unlockExpiresAt:null,unlockStartDate:'',unlockEndDate:'',unlockScope:'Whole period',lastAction:'Automatically reclosed',statusChangedBy:'System',statusChangedAt:now,approvalStatus:'Not required',version:(p.version||0)+1}});
 if(!changed)return state;
 const expiredIds=expired.map(p=>p.unlockRequestId).filter(Boolean);
 const requests=(state.requests||[]).map(r=>expiredIds.includes(r.id)?{...r,status:'Expired',expiredAt:now}:r);
 const scopeOf=p=>({companyId:p.companyId,branchIds:p.branchIds||[],modules:p.modules||[]});
 const audit=[...expired.flatMap(p=>[auditEntry({id:crypto.randomUUID(),periodId:p.id,period:p.name,requestId:p.unlockRequestId||'',action:'Unlock expired',type:'System',user:'System',date:now,remarks:'The approved temporary unlock window ended.',previousStatus:'Temporary Unlock',newStatus:'Reclosed',unlockScope:p.unlockScope||'Whole period',unlockStartDate:p.unlockStartDate||p.start,unlockEndDate:p.unlockEndDate||p.end,scope:scopeOf(p)},p),auditEntry({id:crypto.randomUUID(),periodId:p.id,period:p.name,requestId:p.unlockRequestId||'',action:'Period reclosed',type:'System',user:'System',date:now,remarks:'Temporary unlock expired.',previousStatus:'Temporary Unlock',newStatus:'Reclosed',scope:scopeOf(p)},p)]),...(state.audit||[])];
 return {...state,periods,requests,audit};
}

export function evaluateClosingChecks({modules=PERIOD_MODULES,counts={}}={}){
 const warnings={Sales:[['draftInvoices','Draft invoices'],['pendingInvoiceApprovals','Pending invoice approvals'],['unpostedInvoices','Unposted invoices']],Purchases:[['draftBills','Draft purchase bills'],['pendingPurchaseApprovals','Pending purchase approvals']],Banking:[['unreconciledTransactions','Unreconciled bank transactions']],Accounting:[['draftJournals','Draft journals'],['pendingJournalApprovals','Pending journal approvals']],Inventory:[['pendingStockAdjustments','Pending stock adjustments']],Payroll:[['pendingPayroll','Pending payroll posting']],Tax:[['pendingTaxTransactions','Pending tax transactions']],Expenses:[['pendingExpenseApprovals','Pending expense approvals']],Assets:[['pendingDepreciation','Pending depreciation']]};
 const blockers={Accounting:[['unbalancedJournals','Unbalanced journal entries'],['missingLedgerPostings','Missing ledger postings'],['failedAccountingEntries','Failed accounting entries']],Sales:[['salesWithoutAccountingImpact','Posted invoices without accounting impact']],Purchases:[['purchasesWithoutAccountingImpact','Posted bills without accounting impact']]};
 const results=modules.flatMap(module=>[...(warnings[module]||[]).map(([key,label])=>({module,key,label,count:Number(counts[key]||0),severity:Number(counts[key]||0)>0?'Warning':'Completed'})),...(blockers[module]||[]).map(([key,label])=>({module,key,label,count:Number(counts[key]||0),severity:Number(counts[key]||0)>0?'Blocking':'Completed'}))]);
 if(modules.includes('Accounting'))for(const dependency of ['Sales','Purchases','Banking'])if(!modules.includes(dependency))results.push({module:'Accounting',key:`dependency-${dependency}`,label:`Accounting depends on ${dependency} completion`,count:0,severity:'Warning'});
 return {results,blocking:results.filter(x=>x.severity==='Blocking'),warnings:results.filter(x=>x.severity==='Warning'),completed:results.filter(x=>x.severity==='Completed'),canContinue:!results.some(x=>x.severity==='Blocking')};
}

export function closingStatus(period){return PERIOD_DISPLAY_STATUS[periodStatus(period)]||'Open'}
export function lockRegisterRows(periods=[],{mode='Manual',today='',createdIds=[]}={}){const rows=Array.isArray(periods)?periods:[];if(mode==='Automatic')return rows.filter(period=>period.end<today&&closingStatus(period)==='Closed');if(mode==='Manual')return rows.filter(period=>createdIds.includes(period.id));return rows}
export function periodClosedBy(period){return period?.closedBy||period?.lockedBy||'—'}
export function periodClosedAt(period){return period?.closedAt||period?.lockedAt||''}
export function periodBranchLabel(period){if(!period)return '—';if(period.scopeType!=='Branches')return 'All branches';const names=period.branchNames?.length?period.branchNames:[...(period.branchIds||[])];return names.length?names.join(', '):'All branches'}
export function currentPeriodFor(periods=[],{companyId,date}={}){return periods.find(p=>p.companyId===companyId&&date>=p.start&&date<=p.end)||null}
export function closedPeriods(periods=[]){return periods.filter(p=>closingStatus(p)==='Closed')}
export function lastClosedPeriod(periods=[]){return closedPeriods(periods).sort((a,b)=>String(periodClosedAt(b)).localeCompare(String(periodClosedAt(a))))[0]||null}
export const CLOSING_CHECKLIST=[
 {key:'invoicesPosted',label:'All invoices posted',detail:'Draft, unapproved or unposted sales invoices must be posted or cancelled.',severity:'Blocking',counts:['draftInvoices','pendingInvoiceApprovals','unpostedInvoices']},
 {key:'billsApproved',label:'All bills approved',detail:'Draft or pending purchase bills must be approved and posted.',severity:'Blocking',counts:['draftBills','pendingPurchaseApprovals']},
 {key:'noDraftJournals',label:'No draft journal entries',detail:'Manual journal entries must be posted or deleted before closing.',severity:'Blocking',counts:['draftJournals','pendingJournalApprovals']},
 {key:'bankReconciled',label:'Bank reconciliation completed',detail:'Every bank reconciliation for the period should be completed.',severity:'Warning',counts:['pendingReconciliations','unreconciledTransactions']},
 {key:'taxAdjusted',label:'Tax adjustments completed',detail:'Draft tax adjustments must be posted before closing.',severity:'Warning',counts:['pendingTaxAdjustments']}
];
export function evaluateClosingReadiness({counts={}}={}){
 const checks=CLOSING_CHECKLIST.map(item=>{const count=item.counts.reduce((sum,key)=>sum+Number(counts[key]||0),0);return {...item,count,state:count>0?(item.severity==='Blocking'?'Failed':'Warning'):'Passed'}});
 const blocking=checks.filter(item=>item.state==='Failed'),warnings=checks.filter(item=>item.state==='Warning');
 return {checks,blocking,warnings,completed:checks.filter(item=>item.state==='Passed'),canClose:!blocking.length,requiresAcknowledgement:Boolean(warnings.length)};
}
export function closePeriod(state,{periodId,user='Admin',reason,counts={},acknowledgeWarnings=false,now=new Date().toISOString()}){
 const period=state.periods.find(p=>p.id===periodId);if(!period)throw Error('Accounting period not found.');
 const readiness=evaluateClosingReadiness({counts});
 if(readiness.blocking.length)throw Error(`Closing cannot continue. ${readiness.blocking.map(item=>`${item.label} (${item.count})`).join(', ')}.`);
 if(readiness.requiresAcknowledgement&&!acknowledgeWarnings)throw Error(`Confirm the outstanding warnings before closing: ${readiness.warnings.map(item=>item.label).join(', ')}.`);
 const closed=lockPeriod(state,{periodId,lockType:'Hard Lock',reason,user,action:'Period closed',now});
 return {...closed,periods:closed.periods.map(p=>p.id===periodId?{...p,closedBy:user,closedAt:now,closingChecklist:readiness.checks.map(item=>({key:item.key,label:item.label,state:item.state,count:item.count}))}:p)};
}
export function periodAuditTimeline(state,periodId,limit=25){return (state.audit||[]).filter(entry=>entry.periodId===periodId).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,limit)}

/* Period locking policy: modes, schedule, scope visibility and enforcement.
   These helpers are additive: postToLedger-style callers keep the same
   validatePeriodAction contract, and no existing lock is ever rewritten
   just because a policy value changed. */
export const LOCKING_MODES=['Automatic','Manual','Off'];
export const LOCK_FREQUENCIES=['Day','Week','Month','Quarter','Year','Financial Year'];
export const SCHEDULE_CHOICES={weekStart:['Monday','Sunday'],monthMode:['Calendar month','Custom start and end day'],quarterMode:['Calendar quarters','Financial-year aligned'],yearMode:['Calendar year','Anniversary'],fyStartMonth:['April','January','July','October'],fyLabelFormat:['FY 2026–27','2026–27','2026/2027'],unlockScope:['Whole period','Selected date range'],approverRole:['Role that closed the period','Business Owner','Admin'],duration:['1 Hour','8 Hours','24 Hours','Until manually re-locked'],notifyDays:['0','1','3','5','7']};
const policyToday=()=>new Date().toISOString().slice(0,10);
export function normalisePeriodSettings(value={}){
 const source=value&&typeof value==='object'?value:{};
 const merged={...defaultPeriodSettings,...source};
 const lockingMode=LOCKING_MODES.includes(source.lockingMode)?source.lockingMode:(source.lockingMode===undefined&&source.autoLockPreviousMonth?'Automatic':'Manual');
 return {...merged,lockingMode,autoLockPreviousMonth:lockingMode==='Automatic',approval:merged.approval!==false,schedule:{...defaultPeriodSettings.schedule,...(source.schedule||{})},defaultScope:{...defaultPeriodSettings.defaultScope,...(source.defaultScope||{})},exemptModules:[...(merged.exemptModules||[])]};
}
export const lockingEnabled=settings=>normalisePeriodSettings(settings).lockingMode!=='Off';
export const unlockApprovalRequired=settings=>{const value=normalisePeriodSettings(settings);return value.lockingMode!=='Off'&&value.approval};
export function policyChip(settings){const value=normalisePeriodSettings(settings);if(value.lockingMode==='Off')return {text:'Locking off',mode:'Off'};if(value.lockingMode==='Manual')return {text:'Manual locking',mode:'Manual'};const frequency={Day:'Daily',Week:'Weekly',Month:'Monthly',Quarter:'Quarterly',Year:'Yearly','Financial Year':'Financial yearly'}[value.schedule.frequency]||'Monthly';return {text:`Auto-lock: ${frequency} · ${value.schedule.lockAfterDays}-day grace`,mode:'Automatic'};}
export function settingsWarnings(settings){
 const value=normalisePeriodSettings(settings),warnings=[];
 if(value.lockingMode==='Automatic'&&!value.approval)warnings.push({code:'LOCKED_FOREVER',requiresConfirmation:true,offer:null,message:'Automatic locking with unlock approval turned off locks every period permanently: nobody can request or approve temporary access again. Confirm this locked-forever policy before saving.'});
 if(value.lockingMode==='Automatic'&&value.schedule.frequency==='Day'&&value.approval&&!value.dailyAutoApproval)warnings.push({code:'DAILY_UNLOCK_VOLUME',requiresConfirmation:false,offer:'dailyAutoApproval',message:'A daily schedule with approval required can raise an unlock request every day. Enable auto-approval for daily locks, or lengthen the closing frequency.'});
 return warnings;
}
export {NO_BRANCH,ALL_BRANCHES,organisationScopeList,organisationReference,branchReference,organisationBranches,selectedOrganisations,findOrganisation,getBranchesForOrganisation,getBranchIdsForOrganisation,organisationContainsBranch,getScopeVisibility,scopeVisibility,normaliseScope,validateScope,assertValidScope,scopeLabel} from './organisation-scope.js';
export function nextLockCursor(range){return iso(new Date(new Date(range.end+'T12:00:00').getTime()+86400000));}
export function generatedSchedule(settings,{from,limit=12}={}){
 const value=normalisePeriodSettings(settings);
 if(value.lockingMode!=='Automatic')return [];
 const frequency=value.schedule.frequency,rows=[];
 let cursor=from||value.schedule.effectiveFrom||policyToday();
 for(let index=0;index<limit;index++){const range=resolveLockRange(frequency,cursor);rows.push({...range,frequency,lockAfterDays:value.schedule.lockAfterDays,lockAtTime:value.schedule.lockAtTime,notifyDaysBefore:value.schedule.notifyDaysBefore});cursor=nextLockCursor(range);}
 return rows;
}
export const ENFORCED_OPERATIONS={create:'create an entry',edit:'edit an entry',delete:'delete an entry',post:'post to the ledger','post-draft':'post a draft',backdate:'back-date a transaction',allocation:'allocate a payment',inventory:'post an inventory adjustment',depreciation:'run depreciation',accrual:'run an accrual',revaluation:'run a revaluation',import:'import a statement or bank feed'};
export const LOCK_ACTIVE_STATUSES=['Closing Review','Pending Approval','Soft Locked','Hard Locked','Pending Unlock Approval','Temporary Unlock','Reclosed'];
export function blockingLocksFor(periods=[],{date,companyId,branchId,module,now=new Date().toISOString()}={}){return periods.filter(period=>ownsScope(period,{companyId,branchId,module})&&date>=period.start&&date<=period.end&&LOCK_ACTIVE_STATUSES.includes(periodStatus(period))&&!unlockedFor(period,date,now)).sort((a,b)=>String(a.start).localeCompare(String(b.start))||String(a.end).localeCompare(String(b.end)));}
export function isOperationExempt({operation,module,settings}={}){const value=normalisePeriodSettings(settings);return (value.exemptModules||[]).some(name=>name===module||name===operation);}
export function assertOperationAllowed({operation='post',date,role='Business User',companyId='ABC01',branchId,module,state,settings,approvalGranted=false,now}={}){
 const value=normalisePeriodSettings(settings||readPeriodSettings()),control=state||readPeriodControl(),label=ENFORCED_OPERATIONS[operation]||operation;
 if(value.lockingMode==='Off')return {allowed:true,operation,operationLabel:label,lockingDisabled:true,locks:[]};
 if(isOperationExempt({operation,module,settings:value}))return {allowed:true,operation,operationLabel:label,exempt:true,locks:[]};
 if(!control||!Array.isArray(control.periods))return {allowed:false,operation,operationLabel:label,code:'PERIOD_NOT_CONFIGURED',locks:[],lock:null,remedy:'The lock state could not be read, so this '+label+' is blocked. Ask an administrator to confirm the period configuration before continuing.'};
 const result=validatePeriodAction({date,role,companyId,branchId,module,state:control,settings:value,approvalGranted,now,action:label});
 const locks=result.allowed?[]:blockingLocksFor(control.periods,{date,companyId,branchId,module,now}),lock=locks[0]||(result.period&&LOCK_ACTIVE_STATUSES.includes(periodStatus(result.period))?result.period:null);
 const remedy=result.allowed?'':`${lock?.name||'That period'} is locked for ${lock?contextLabel(lock):'this scope'}. ${value.approval?'Open Period Lock to request an unlock, or ask an administrator for a written override.':'Unlock approval is off, so only an administrator can apply a written override.'}`;
 return {...result,operation,operationLabel:label,locks,lock,remedy};
}
export function applyAdminOverride(state,{periodId,reason,user='Admin',operation='post',targetDate,now=new Date().toISOString()}={}){
 if(!can(user,'lock')&&!can(user,'configure'))throw Error('Only an administrator can override a locked period.');
 if(!reason||!reason.trim())throw Error('A written reason is required to override a locked period.');
 const period=(state?.periods||[]).find(item=>item.id===periodId);
 if(!period)throw Error('Locked period not found.');
 const entry=auditEntry({id:crypto.randomUUID(),periodId,period:period.name,action:'Lock override',type:'Override',user,date:now,remarks:reason.trim(),previousStatus:periodStatus(period),newStatus:periodStatus(period),operation,targetDate:targetDate||'',scope:{companyId:period.companyId,branchIds:period.branchIds||[],modules:period.modules||[]}},period);
 return {...state,overrides:[...(state.overrides||[]),{id:entry.id,periodId,period:period.name,user,date:now,operation,targetDate:targetDate||'',reason:reason.trim()}],audit:[entry,...(state.audit||[])]};
}
export function policyChangeGuard(previous,next){
 const before=normalisePeriodSettings(previous),after=normalisePeriodSettings(next),changed=[];
 if(before.lockingMode!==after.lockingMode)changed.push('locking mode');
 if(before.approval!==after.approval)changed.push('unlock approval');
 if(JSON.stringify(before.schedule)!==JSON.stringify(after.schedule))changed.push('automatic schedule');
 if(JSON.stringify(before.defaultScope)!==JSON.stringify(after.defaultScope))changed.push('default scope');
 if(String(before.maximumUnlockDuration||'')!==String(after.maximumUnlockDuration||''))changed.push('maximum unlock duration');
 if(String(before.unlockScope||'')!==String(after.unlockScope||''))changed.push('unlock scope');
 if(JSON.stringify(before.allowedRoles||[])!==JSON.stringify(after.allowedRoles||[]))changed.push('allowed roles');
 return {changed,appliesFrom:'next unclosed period',message:changed.length?`${changed.join(', ')} will apply from the next unclosed period. Existing locks keep their original scope, reason and history and are never reopened, rewritten or removed.`:'No policy change detected.'};
}
export const UNLOCK_APPROVER_ORDER=['Business Owner','Admin'];
export function unlockApproverFor(requestedBy,settings){
 const value=normalisePeriodSettings(settings),allowed=value.allowedRoles||PERIOD_ROLE_OPTIONS;
 return UNLOCK_APPROVER_ORDER.find(name=>name!==requestedBy&&allowed.includes(name)&&can(name,'approve-unlock'))||'';
}
export function submitUnlockRequest(state,payload={},settings){
 const value=normalisePeriodSettings(settings||readPeriodSettings()),next=requestPeriodUnlock(state,payload);
 if(!(value.lockingMode==='Automatic'&&value.dailyAutoApproval&&value.approval))return next;
 const request=next.requests[0],period=next.periods.find(item=>item.id===request.periodId);
 if(!period||period.frequency!=='Day')return next;
 const approver=unlockApproverFor(request.requestedBy,value);
 return approver?decideUnlockRequest(next,{requestId:request.id,decision:'Approved',user:approver,remarks:'Auto-approved under the daily lock policy.'}):next;
}

export function cancelUnlockRequest(state,{requestId,user='Accountant',reason='',now=new Date().toISOString()}={}){
 const request=(state.requests||[]).find(r=>r.id===requestId);
 if(!request)throw Error('Unlock request not found.');
 if(request.status!=='Pending approval')throw Error('Only a pending unlock request can be cancelled.');
 if(user!==request.requestedBy&&!can(user,'approve-unlock'))throw Error('Only the requester or an approver can cancel this unlock request.');
 const period=state.periods.find(p=>p.id===request.periodId),restored=period?.lockTypeBeforeUnlock||period?.lockType||'Soft Lock',restoredStatus=restored==='Hard Lock'?'Hard Locked':'Soft Locked';
 const entry=auditEntry({id:crypto.randomUUID(),periodId:request.periodId,period:request.period,requestId,action:'Unlock cancelled',type:'Approval',user,date:now,remarks:reason.trim()||'Cancelled by '+user,previousStatus:'Pending Unlock Approval',newStatus:restored==='Hard Lock'?'Hard Locked':'Soft Locked',scope:{companyId:request.companyId,branchIds:request.branchIds||[],modules:request.modules||[]}},request);
 return {...state,requests:(state.requests||[]).map(r=>r.id===requestId?{...r,status:'Cancelled',cancelledBy:user,cancelledAt:now,decisionReason:reason.trim()}:r),periods:state.periods.map(p=>p.id===request.periodId?{...p,status:restoredStatus,lockType:restored,approvalStatus:'Cancelled',lastAction:'Unlock cancelled',statusChangedBy:user,statusChangedAt:now,version:(p.version||0)+1}:p),audit:[entry,...(state.audit||[])]};
}

/* Delete removes the request record from the register. A pending request is released first through
   cancelUnlockRequest, so the period always leaves the pending-approval state before its row disappears. */
export function deleteUnlockRequest(state,{requestId,user='Accountant',now=new Date().toISOString()}={}){
 const request=(state.requests||[]).find(r=>r.id===requestId);
 if(!request)throw Error('Unlock request not found.');
 if(user!==request.requestedBy&&!can(user,'approve-unlock'))throw Error('Only the requester or an approver can delete this unlock request.');
 const released=request.status==='Pending approval'?cancelUnlockRequest(state,{requestId,user,reason:'Deleted by '+user,now}):state;
 const entry=auditEntry({id:crypto.randomUUID(),periodId:request.periodId,period:request.period,requestId,action:'Unlock request deleted',type:'Approval',user,date:now,remarks:'Removed from the register by '+user,previousStatus:request.status,newStatus:'Deleted'},request);
 return {...released,requests:(released.requests||[]).filter(r=>r.id!==requestId),audit:[entry,...(released.audit||[])]};
}

export function recordPolicyChange(state,{previous,next,user='Admin',now=new Date().toISOString()}={}){
 const before=normalisePeriodSettings(previous),after=normalisePeriodSettings(next),guard=policyChangeGuard(before,after);
 if(!guard.changed.length)return state;
 const entry=auditEntry({id:crypto.randomUUID(),action:'Policy changed',type:'Policy',user,date:now,entityType:'PeriodLockPolicy',entityId:'policy',beforeValue:{lockingMode:before.lockingMode,approval:before.approval,schedule:before.schedule,defaultScope:before.defaultScope,unlockScope:before.unlockScope,maximumUnlockDuration:before.maximumUnlockDuration},afterValue:{lockingMode:after.lockingMode,approval:after.approval,schedule:after.schedule,defaultScope:after.defaultScope,unlockScope:after.unlockScope,maximumUnlockDuration:after.maximumUnlockDuration},previousStatus:before.lockingMode,newStatus:after.lockingMode,reason:guard.message,remarks:guard.message,changed:guard.changed,appliesFrom:guard.appliesFrom});
 return {...state,policy:{...(state.policy||{}),...after,updatedAt:now,updatedBy:user},audit:[entry,...(state.audit||[])]};
}
