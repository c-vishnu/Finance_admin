/* Organisation and branch picker - the interactive half of the shared scope rule
   in src/organisation-scope.js, and the same control the Create Journal Entry
   journal lines use. Every decision comes from scopePickerState, so the visible
   selectors, the branch options and the clearing of an incompatible branch are
   identical wherever the control is used.

   `multiple` renders that same rule as checkbox lists instead of one-choice
   selects, for the screens where a scope may cover several organisations or
   several branches (Create Budget). The rows and the toggling come from
   scopePickerRows and toggleScopePicker, so this file stays presentation only. */
import {useEffect,useRef,useState} from 'react';
import {IconCheck,IconChevronDown} from '@tabler/icons-react';
import {ALL_BRANCHES,normaliseScope,scopePickerState} from './organisation-scope.js';
import {scopePickerRows,toggleScopePicker} from './organisation-scope.js';
import './organisation-branch-scope.css';

export function OrganisationBranchScope({organisations=[],companyIds=[],branchIds=[],onChange=()=>{},label='Locking for',strip='',showLine=true,showFields=true,readOnly=false,multiple=false}){
 const state=scopePickerState({organisations,companyIds,branchIds,label});
 const emit=(nextCode,nextBranchId)=>{const resolved=normaliseScope({organisations,companyIds:nextCode?[nextCode]:[],branchIds:nextBranchId?[nextBranchId]:[]});onChange({companyId:resolved.companyIds[0]||'',branchId:resolved.branchIds[0]||'',companyIds:resolved.companyIds,branchIds:resolved.branchIds,scopeType:resolved.scopeType})};
 const emitScope=(nextCompanyIds,nextBranchIds)=>{const resolved=normaliseScope({organisations,companyIds:nextCompanyIds,branchIds:nextBranchIds});onChange({companyId:resolved.companyIds[0]||'',branchId:resolved.branchIds[0]||'',companyIds:resolved.companyIds,branchIds:resolved.branchIds,scopeType:resolved.scopeType})};
 const fields=showFields&&(state.showOrganisation||state.showBranch);
 if(fields&&multiple&&!readOnly){
  const rows=scopePickerRows(state);
  const pick=row=>{const next=toggleScopePicker(state,row);emitScope(next.companyIds,next.branchIds)};
  return <div className="pc-scope-picker pc-scope-multi">
   {showLine&&<span className="pc-lock-scope">{strip||state.line}</span>}
   <div className="pc-fields">
    {state.showOrganisation&&<MultiScopeField title="Organisation" summary={state.organisationSummary} rows={rows.organisationRows} onPick={pick}/>}
    {state.showBranch&&rows.branchRows.length>1&&<MultiScopeField title="Branch" summary={state.branchSummary} rows={rows.branchRows} onPick={pick}/>}
   </div>
  </div>;
 }
 return <div className="pc-scope-picker">
  {showLine&&<span className="pc-lock-scope">{strip||state.line}</span>}
  {fields&&<div className="pc-fields">
   {state.showOrganisation&&<label className="pc-field">Organisation<select aria-label="Organisation" value={state.companyId} disabled={readOnly} onChange={event=>emit(event.target.value,'')}>{state.organisationOptions.map(option=><option key={option.id} value={option.code}>{option.name}</option>)}</select></label>}
   {state.showBranch&&<label className="pc-field">Branch<select aria-label="Branch" value={state.branchId} disabled={readOnly} onChange={event=>emit(state.companyId,event.target.value)}><option value="">{ALL_BRANCHES}</option>{state.branchOptions.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
  </div>}
 </div>;
}

/* One checkbox list of the multi-select variant. It closes on an outside press
   or Escape so the control needs no page-level wiring, and the open state is a
   class on the field rather than the details element, so both fields can be
   opened and compared without one closing the other. */
function MultiScopeField({title,summary,rows,onPick}){
 const [open,setOpen]=useState(false);
 const rootRef=useRef(null);
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false)};
  const escape=event=>{if(event.key==='Escape')setOpen(false)};
  document.addEventListener('pointerdown',away);
  document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',escape)};
 },[open]);
 return <div className={'pc-multi-field'+(open?' open':'')} ref={rootRef}>
  <span className="pc-multi-label">{title}</span>
  <button type="button" className="pc-multi-trigger" aria-label={title} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   <span className="pc-multi-value">{summary}</span>
   <IconChevronDown size={15}/>
  </button>
  {open&&<div className="pc-multi-panel" role="listbox" aria-label={title} aria-multiselectable="true">
   <div className="pc-multi-head"><span>{title}</span></div>
   {rows.map(row=><button key={row.key} type="button" role="option" aria-selected={row.checked} className={'pc-multi-option'+(row.checked?' checked':'')} onClick={()=>onPick(row)}><span className="pc-multi-box">{row.checked?<IconCheck size={13}/>:null}</span><span className="pc-multi-text"><b>{row.label}</b>{row.meta?<small>{row.meta}</small>:null}</span></button>)}
   {!rows.length&&<p className="pc-multi-empty">Nothing to choose here yet.</p>}
  </div>}
 </div>;
}

export default OrganisationBranchScope;
