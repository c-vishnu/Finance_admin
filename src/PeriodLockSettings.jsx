import {useState} from 'react';
import {IconAlertTriangle,IconCalendar,IconCheck,IconInfoCircle,IconPlus,IconX} from '@tabler/icons-react';
import {demoOrganizations} from './HeaderOrgSelectors.jsx';
import {LOCK_FREQUENCIES,SCHEDULE_CHOICES,generatedSchedule,normalisePeriodSettings,policyChangeGuard,settingsWarnings,writePeriodSettings} from './period-locking.js';
import {NO_BRANCH,branchReference,getBranchesForOrganisation,normaliseScope,scopeVisibility} from './organisation-scope.js';
import './period-lock-settings.css';

const Switch=({label,note,checked,disabled=false,onChange})=><label className={"pls-switch"+(disabled?" pls-switch-off":"")}><span><b>{label}</b><small>{note}</small></span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><i aria-hidden="true"/></label>;
const day=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-';

export function ScopeSelector({organisations=demoOrganizations,companyIds=[],branchIds=[],onChange,note='Default scope'}){
 const visibility=scopeVisibility({organisations,companyIds,branchIds}),rows=visibility.rows;
 const apply=(nextCompanyIds,nextBranchIds)=>{const resolved=normaliseScope({organisations,companyIds:nextCompanyIds,branchIds:nextBranchIds});onChange({companyIds:resolved.companyIds,branchIds:resolved.branchIds})};
 const changeOrg=(row,nextCode)=>{const next=rows.map(item=>item.companyId===row.companyId?nextCode:item.companyId).filter((code,index,all)=>all.indexOf(code)===index);apply(next,branchIds)};
 const removeOrg=row=>apply(rows.map(item=>item.companyId).filter(code=>code!==row.companyId),branchIds);
 const addOrg=()=>{const used=rows.map(row=>row.companyId),candidate=(organisations.find(org=>!used.includes(org.code))||{}).code;if(candidate)apply([...used,candidate],branchIds)};
 const changeBranch=(row,nextBranchId)=>{const keep=branchIds.filter(id=>!getBranchesForOrganisation(row.companyId,organisations).some(branch=>branchReference(branch)===String(id)));apply(rows.map(item=>item.companyId),nextBranchId?[...keep,nextBranchId]:keep)};
 const branchCell=row=>{const branches=getBranchesForOrganisation(row.companyId,organisations);
  if(!branches.length)return <span className="pls-scope-fixed" key="branch">{NO_BRANCH}</span>;
  if(branches.length===1)return <span className="pls-scope-fixed" key="branch">{branches[0].name}</span>;
  const selected=branches.find(branch=>branchIds.includes(String(branch.id)))?.id||'';
  return <select key="branch" aria-label={'Branch for '+row.organisationName} value={selected} onChange={event=>changeBranch(row,event.target.value)}><option value="">All branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>};
 return <div className="pls-scope">
  <span className="pls-scope-strip">{visibility.strip}</span>
  {rows.length&&(visibility.showOrgColumn||visibility.showBranchColumn)?<div className="pls-scope-table">
   {visibility.showOrgColumn&&<div className="pls-scope-head"><span>Organisation</span>{visibility.showBranchColumn&&<span>Branch</span>}<span/></div>}
   {rows.map(row=><div className="pls-scope-row" key={row.companyId}>
    {visibility.showOrgColumn?<select aria-label="Organisation in scope" value={row.companyId} onChange={event=>changeOrg(row,event.target.value)}>{organisations.map(org=><option key={org.code} value={org.code}>{org.name}</option>)}</select>:<span className="pls-scope-fixed">{row.organisationName}</span>}
    {visibility.showBranchColumn?branchCell(row):null}
    {visibility.showOrgColumn?<button type="button" aria-label={'Remove '+row.organisationName} disabled={rows.length<2} onClick={()=>removeOrg(row)}><IconX size={15}/></button>:<span/>}
   </div>)}
  </div>:null}
  {!rows.length?<button type="button" className="pls-add" onClick={addOrg}><IconPlus size={15}/>Add organisation</button>:null}
  {visibility.showOrgColumn&&rows.length?<button type="button" className="pls-add" onClick={addOrg}><IconPlus size={15}/>Add organisation</button>:null}
  <p className="pls-help">{note}: {visibility.showOrgColumn?'Branch options always belong to the organisation in the same row.':visibility.showBranchColumn?'The organisation is fixed, so only the branch is chosen here.':'This single organisation owns one branch, so both are filled automatically.'}</p>
 </div>;
}

export default function PeriodLockSettings({settings,onClose=()=>{},onSaved=()=>{},notify=()=>{},organisations=demoOrganizations}){
 const [value,setValue]=useState(()=>normalisePeriodSettings(settings)),[savedValue,setSavedValue]=useState(()=>normalisePeriodSettings(settings));
 const [confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(''),[discard,setDiscard]=useState(false);
 const warnings=settingsWarnings(value),schedule=value.lockingMode==='Automatic'?generatedSchedule(value,{limit:6}):[],dirty=JSON.stringify(value)!==JSON.stringify(savedValue),lockingForever=warnings.some(item=>item.requiresConfirmation);
 const patch=next=>setValue(current=>({...current,...next}));
 const patchSchedule=(key,next)=>setValue(current=>({...current,schedule:{...current.schedule,[key]:next}}));
 const save=()=>{if(lockingForever&&!confirmed){setError('Confirm the locked-forever policy before saving.');return}const guard=policyChangeGuard(savedValue,value),next=writePeriodSettings(value);setValue(next);setSavedValue(next);setConfirmed(false);setError('');setSaved(guard.message);onSaved();notify('Period locking settings saved')};
 const requestClose=()=>{if(dirty){setDiscard(true);return}onClose()};
 const automaticLocking=value.lockingMode==='Automatic',lockingOn=value.lockingMode!=='Off',scheduleField=!lockingOn||!automaticLocking;
 const autoNote=automaticLocking?'Periods are created and locked on a schedule.':lockingOn?'Manual locking: you create every lock yourself with Create Lock / Close.':'Locking is off, so this schedule stays parked until period locking is switched on in Accounting settings.';
 return <div className="pls pls-popup">
  <header className="pls-heading pls-heading-popup"><div><h1>Period Closing Settings</h1><p>Locking applies to every module in Wayvida Books, and changes apply from the next unclosed period.</p></div><button type="button" className="pls-close" onClick={requestClose} aria-label="Close period closing settings"><IconX size={17}/></button></header>
  {warnings.map(item=><div className={'pls-warning'+(item.requiresConfirmation?' severe':'')} key={item.code}><IconAlertTriangle size={17}/><div><b>{item.requiresConfirmation?'Locked-forever configuration':'Daily unlock request volume'}</b><p>{item.message}</p>{item.offer==='dailyAutoApproval'&&<button type="button" onClick={()=>patch({dailyAutoApproval:true})}>Enable auto-approval for daily locks</button>}{item.requiresConfirmation&&<label className="pls-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm this locked-forever policy</span></label>}</div></div>)}
  <div className="pls-grid">
   <section className="pls-card wide">
    <Switch label="Enable automatic locking" note={autoNote} checked={automaticLocking} disabled={!lockingOn} onChange={next=>patch({lockingMode:next?"Automatic":"Manual"})}/>
    <div className={'pls-fields'+(scheduleField?' pls-fields-off':'')}>
     <label className="pls-field">Frequency<select disabled={scheduleField} value={value.schedule.frequency} onChange={event=>patchSchedule('frequency',event.target.value)}>{LOCK_FREQUENCIES.map(name=><option key={name} value={name}>{name==='Financial Year'?'Financial Yearly':name}</option>)}</select><small>How often a period is locked.</small></label>
     <label className="pls-field">Effective from<input type="date" disabled={scheduleField} value={value.schedule.effectiveFrom} onChange={event=>patchSchedule('effectiveFrom',event.target.value)}/><small>The date the schedule starts.</small></label>
     <label className="pls-field">Lock after period end<input type="number" min="0" max="31" disabled={scheduleField} value={value.schedule.lockAfterDays} onChange={event=>patchSchedule('lockAfterDays',Number(event.target.value))}/><small>Days of grace after the period ends.</small></label>
     <label className="pls-field">Lock at<input type="time" disabled={scheduleField} value={value.schedule.lockAtTime} onChange={event=>patchSchedule('lockAtTime',event.target.value)}/><small>Time of day the scheduled lock runs.</small></label>
     <label className="pls-field">Notify before locking<select disabled={scheduleField} value={String(value.schedule.notifyDaysBefore)} onChange={event=>patchSchedule('notifyDaysBefore',Number(event.target.value))}>{SCHEDULE_CHOICES.notifyDays.map(name=><option key={name} value={name}>{name} day{name==='1'?'':'s'}</option>)}</select><small>Advance notice before a period locks.</small></label>
    </div>
    {!automaticLocking&&lockingOn&&<p className="pls-note"><IconInfoCircle size={15}/>Manual locking is active, so these schedule fields stay disabled until automatic locking is switched on.</p>}
    {!lockingOn&&<p className="pls-note"><IconInfoCircle size={15}/>Period locking is switched off in Accounting settings, so no lock runs anywhere and every lock control stays hidden. Turn period locking on there to configure this schedule.</p>}
    {automaticLocking&&<><div className="pls-subhead"><b>Generated schedule</b><span>{schedule.length} periods</span></div>{schedule.length?<div className="pls-schedule">{schedule.map(row=><div key={row.start}><IconCalendar size={15}/><b>{row.name}</b><small>{day(row.start)} to {day(row.end)}</small><span>{'Locks '+row.lockAfterDays+' day(s) after period end at '+row.lockAtTime}</span></div>)}</div>:<p className="pls-help">No periods generated. Check the effective date and frequency.</p>}</>}
    <div className="pls-rule" aria-hidden="true"/>
    <Switch label="Require approval to unlock" note={value.approval?"Unlock requests are reviewed by another approver.":"Request Unlock actions are removed completely and only an administrator override remains."} checked={value.approval} onChange={next=>patch({approval:next})}/>
    {!value.approval&&<p className="pls-note"><IconInfoCircle size={15}/>Approval is off, so no Request Unlock action is rendered anywhere. Only an administrator can apply a written override.</p>}
   </section>
  </div>
  <footer className="pls-footer">{error?<span className="pls-error"><IconAlertTriangle size={15}/>{error}</span>:saved&&!dirty?<span className="pls-saved"><IconCheck size={15}/>{saved}</span>:<span className="pls-dirty">{dirty?'Unsaved changes':''}</span>}<button onClick={requestClose}>Cancel</button><button className="primary" onClick={save}>Save changes</button></footer>
  {discard&&<div className="pls-guard" role="dialog" aria-modal="true" aria-label="Unsaved period locking changes"><section><h3>Discard unsaved changes?</h3><p>Your period closing policy changes have not been saved. Existing locks are never modified by leaving this panel.</p><div><button onClick={()=>setDiscard(false)}>Keep editing</button><button className="danger" onClick={()=>{setDiscard(false);onClose()}}>Discard and leave</button></div></section></div>}
 </div>;
}
