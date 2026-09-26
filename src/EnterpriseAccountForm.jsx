import {useEffect,useState} from 'react';
import {IconBuildingStore,IconCheck,IconChevronDown,IconX} from '@tabler/icons-react';
import {ACCOUNT_PURPOSES,ACCOUNT_SCOPES,CATEGORY,accountPurposeDefaults,nextCode} from './account-master.js';
import AccountGroupPicker from './AccountGroupPicker.jsx';
import {demoOrganizations} from './demo-organisations.js';
import {NO_BRANCH,findOrganisation,getScopeVisibility,getBranchesForOrganisation,normaliseScope,organisationBranches,selectedOrganisations,validateScope} from './organisation-scope.js';
import './account-type-picker.css';
import './account-type-picker-polish.css';
import './account-create-drawer.css';

const GROUP_OPTIONS=[
  {type:'Assets',label:'Assets',options:[
    {purpose:'Cash',label:'Cash Accounts'},
    {purpose:'Bank Account',label:'Bank Accounts'},
    {purpose:'Fixed Asset',label:'Fixed Assets'},
    {purpose:'Customer Receivable',label:'Current Assets'}
  ]},
  {type:'Liabilities',label:'Liabilities',options:[
    {purpose:'Loan',label:'Loans'},
    {purpose:'Supplier Payable',label:'Payables'}
  ]},
  {type:'Income',label:'Income',options:[
    {purpose:'Sales Income',label:'Sales Income'},
    {purpose:'Other Income',label:'Other Income'}
  ]},
  {type:'Expenses',label:'Expenses',options:[
    {purpose:'Salary Expense',label:'Salary Expense'},
    {purpose:'Rent Expense',label:'Rent Expense'},
    {purpose:'Marketing Expense',label:'Marketing Expense'}
  ]},
  {type:'Equity',label:'Equity',options:[
    {purpose:'Capital',label:'Capital'}
  ]}
];

const selectedOrganisationIds=()=>{
  try{
    const ids=JSON.parse(localStorage.getItem('wayvida-context-companies'));
    return Array.isArray(ids)&&ids.length?ids:[localStorage.getItem('wayvida-demo-company')||'abc'];
  }catch{
    return ['abc'];
  }
};

const selectedBranchId=()=>{
  try{return localStorage.getItem('wayvida-demo-branch')||''}catch{return ''}
};

const inferPurpose=form=>Object.entries(ACCOUNT_PURPOSES[form.type]||{}).find(([,rule])=>rule.nature===form.accountNature&&rule.category===form.reportingCategory)?.[0]||Object.keys(ACCOUNT_PURPOSES[form.type]||{})[0];

const purposeLabel=(type,purpose)=>GROUP_OPTIONS.find(group=>group.type===type)?.options.find(option=>option.purpose===purpose)?.label||purpose;

export default function EnterpriseAccountForm({form,setForm,db,error,setError,locked,duplicate,onSave}){
  const type=form.type||'Assets';
  const purpose=form.accountPurpose&&ACCOUNT_PURPOSES[type]?.[form.accountPurpose]?form.accountPurpose:inferPurpose(form);
  const rule=accountPurposeDefaults(type,purpose);
  const primaryOrganisationId=selectedOrganisationIds()[0]||'abc';
  const primaryOrganisation=findOrganisation(primaryOrganisationId,demoOrganizations)||demoOrganizations[0];
  const primaryBranchId=selectedBranchId();
  const [availabilityOn,setAvailabilityOn]=useState(()=>Boolean(form.multiAvailability??form.scope===ACCOUNT_SCOPES[1]));
  const rawSelectedOrgIds=availabilityOn?(form.organizationIds?.length?form.organizationIds:[primaryOrganisationId]):[primaryOrganisationId];
  const selectedOrgIds=rawSelectedOrgIds.some(id=>demoOrganizations.some(item=>item.id===id))?rawSelectedOrgIds:[primaryOrganisationId];
  const scopeOrganisations=selectedOrganisations(selectedOrgIds,demoOrganizations);
  const chosenOrganisations=scopeOrganisations.length?scopeOrganisations:[primaryOrganisation];
  const workingBranches=getBranchesForOrganisation(primaryOrganisation.id,demoOrganizations);
  const primaryBranch=workingBranches.find(item=>item.id===primaryBranchId)||workingBranches[0]||null;
  const scope=getScopeVisibility({organisations:chosenOrganisations,organisationIds:chosenOrganisations.map(item=>item.id),label:'Availability for'});
  const availableBranches=organisationBranches(chosenOrganisations);
  const selectedBranchValues=form.applicableBranches||[];
  const selectedBranchIds=availableBranches.filter(branch=>selectedBranchValues.includes(branch.id)||selectedBranchValues.includes(branch.name)).map(branch=>branch.id);
  const autoBranchIds=chosenOrganisations.filter(organisation=>organisation.branches.length===1).map(organisation=>organisation.branches[0].id);
  const effectiveBranchIds=[...new Set([...selectedBranchIds,...autoBranchIds])];
  const currencies=[...new Set(chosenOrganisations.map(item=>item.currency||'INR'))];
  const currencyMismatch=currencies.length>1;
  const set=(key,value)=>setForm({...form,[key]:value});

  const close=()=>{setForm(null);setError('')};

  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=event=>{if(event.key==='Escape')close()};
    window.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)};
  },[]);

  const applyGroup=(nextType,nextPurpose)=>{
    const next=accountPurposeDefaults(nextType,nextPurpose);
    setForm({
      ...form,
      type:nextType,
      accountPurpose:nextPurpose,
      nature:next.nature,
      accountNature:next.accountNature,
      reportingCategory:next.category,
      group:next.group,
      moduleMappings:[...next.modules],
      reconciliationRequired:next.reconciliationRequired,
      allowManualPosting:next.allowManualPosting,
      allowDirectTransactions:true,
      controlAccount:!!next.controlAccount,
      taxApplicable:next.taxApplicable,
      taxTreatment:next.taxTreatment,
      taxMode:next.taxMode,
      defaultTaxRate:next.defaultTaxRate,
      parent:'',
      makeSubAccount:false
    });
  };

  const toggleAvailability=next=>{
    setAvailabilityOn(next);
    if(next){
      const organisationIds=form.organizationIds?.length?form.organizationIds:[primaryOrganisationId];
      const branches=form.applicableBranches?.length?form.applicableBranches:autoBranchIds;
      setForm({...form,multiAvailability:true,scope:ACCOUNT_SCOPES[1],organizationIds:organisationIds,organizationId:organisationIds[0],applicableBranches:branches,branchId:branches[0]||''});
    }else{
      setForm({...form,multiAvailability:false,scope:ACCOUNT_SCOPES[0],organizationIds:[primaryOrganisationId],organizationId:primaryOrganisationId,applicableBranches:[],branchId:''});
    }
  };

  const updateOrganisations=organisationIds=>{
    const nextIds=organisationIds.length?organisationIds:[primaryOrganisationId];
    const nextOrganisations=selectedOrganisations(nextIds,demoOrganizations),allowed=organisationBranches(nextOrganisations.length?nextOrganisations:[primaryOrganisation]);
    const kept=(form.applicableBranches||[]).filter(value=>allowed.some(branch=>branch.id===value||branch.name===value));
    const picked=nextOrganisations.filter(organisation=>organisation.branches.length===1).map(organisation=>organisation.branches[0].id).filter(id=>!kept.includes(id));
    const nextBranches=[...kept,...picked];
    setForm({...form,organizationIds:nextIds,organizationId:nextIds[0],applicableBranches:nextBranches,branchId:nextBranches[0]||''});
  };

  const updateBranches=branchIds=>{const resolved=normaliseScope({organisations:chosenOrganisations,companyIds:chosenOrganisations.map(item=>item.code),branchIds});setForm({...form,applicableBranches:resolved.branchIds,branchId:resolved.branchIds[0]||''});};

  const submit=event=>{
    event.preventDefault();
    if(currencyMismatch){setError('Selected organisations must use the same base currency.');return}
    if(availabilityOn){const result=validateScope({organisations:chosenOrganisations,organisationIds:chosenOrganisations.map(item=>item.id),branchIds:effectiveBranchIds});if(!result.ok){setError(result.code==='BRANCH_REQUIRED'?'Select at least one branch for this account.':result.message);return}}
    if(!String(form.name||'').trim()){setError('Enter an account name.');return}
    onSave();
  };

  const groupOptions=GROUP_OPTIONS.map(group=>({...group,options:[...group.options]}));
  const currentGroup=groupOptions.find(group=>group.type===type);
  if(currentGroup){
    if(!currentGroup.options.some(option=>option.purpose===purpose)){
      currentGroup.options.push({purpose,label:purpose});
    }
  }else{
    groupOptions.push({type,label:type,options:[{purpose,label:purpose}]});
  }

  return (
    <div className="am-create-drawer-layer">
      <button type="button" className="am-create-drawer-backdrop" aria-label="Close create account" onClick={close}/>
      <aside className="am-create-drawer" role="dialog" aria-modal="true" aria-label="Create Account">
        <div className="am-create-drawer-header">
          <div>
            <h2>{form.id?'Edit Account':'Create Account'}</h2>
            <p>{form.id?'Update how this account is classified and used.':'Create an account to track money in your books.'}</p>
          </div>
          <button type="button" className="am-create-drawer-close" aria-label="Close create account" onClick={close}><IconX size={20}/></button>
        </div>
        <form className="am-create-drawer-form" onSubmit={submit}>
          <div className="am-create-drawer-body">
            {error&&<div className="am-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={15}/></button></div>}

            <section className="am-drawer-section">
              <div className="am-drawer-grid">
                <Field label="Account Name *" className="am-wide">
                  <input autoFocus required maxLength={100} value={form.name||''} placeholder="Enter account name" onChange={event=>set('name',event.target.value)}/>
                  {duplicate&&<small className="am-inline-error">An account with this name already exists.</small>}
                </Field>
                <Field label="Account Code">
                  <input value={form.code||''} placeholder={nextCode(db.accounts,type)} maxLength={24} disabled={locked} onChange={event=>set('code',event.target.value)}/>
                  <small>{locked?'A posted account keeps its code.':'Optional. Leave blank to use '+nextCode(db.accounts,type)+'.'}</small>
                </Field>
                <Field label="Account Group *">
                  <AccountGroupPicker groups={groupOptions} value={`${type}::${purpose}`} disabled={locked} onChange={next=>{const [nextType,nextPurpose]=next.split('::');applyGroup(nextType,nextPurpose)}}/>
                </Field>
                <Field label="Description (Optional)" className="am-wide">
                  <textarea maxLength={200} value={form.description||''} placeholder="Add a short note about when this account should be used" onChange={event=>set('description',event.target.value)}/>
                  <small className="am-drawer-char-count">{String(form.description||'').length}/200</small>
                </Field>
              </div>
            </section>

            <section className="am-drawer-section am-availability-section">
              <div className="am-availability-row">
                <div className="am-availability-heading">
                  <h3>Organisation Availability</h3>
                  <p>{availabilityOn?'Select multiple organisations and branches':'Use current organisation only'}</p>
                </div>
                <label className="am-drawer-switch">
                  <span>{availabilityOn?'ON':'OFF'}</span>
                  <input type="checkbox" role="switch" checked={availabilityOn} onChange={event=>toggleAvailability(event.target.checked)}/>
                </label>
              </div>
              {!availabilityOn?(
                <div className="am-availability-summary">
                  <span className="am-availability-org">{primaryOrganisation.name}</span>
                  <span className="am-availability-branch"><IconBuildingStore size={14}/>{primaryBranch?primaryBranch.name:NO_BRANCH}</span>
                </div>
              ):(
                <>
                  <p className="am-scope-strip">{scope.strip}</p>
                  <div className="am-drawer-grid am-availability-fields">
                    <MultiSelect label="Select Organisations" placeholder="Select organisations" options={demoOrganizations.map(item=>({value:item.id,label:item.name,meta:item.code}))} selected={selectedOrgIds} onChange={updateOrganisations}/>
                    {scope.showBranch?<MultiSelect label="Select Branches" placeholder="Select branches" options={availableBranches.map(item=>({value:item.id,label:item.name,meta:`${item.organisationName} · ${item.code}`}))} selected={effectiveBranchIds} onChange={updateBranches}/>:(<div className="am-field am-scope-resolved"><span className="am-drawer-field-label">Branch</span><span className="am-scope-fixed">{scope.rows[0]?.noBranches?`${NO_BRANCH} — the organisation itself is the scope`:`${scope.rows[0]?.branchName||NO_BRANCH} — resolved automatically`}</span></div>)}
                  </div>
                </>
              )}
              {currencyMismatch&&<p className="am-context-warning">The selected organisations use different base currencies ({currencies.join(', ')}). Select organisations with the same currency before creating this account.</p>}
            </section>
          </div>
          <footer className="am-create-drawer-footer">
            <button type="button" className="am-drawer-cancel" onClick={close}>Cancel</button>
            <button className="primary" type="submit" disabled={!!duplicate||currencyMismatch}><IconCheck size={17}/>{form.id?'Save Changes':'Create Account'}</button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function Field({label,className,children}){
  return <label className={`am-field ${className||''}`}><span className="am-drawer-field-label">{label}</span>{children}</label>;
}

function MultiSelect({label,placeholder,options,selected,onChange}){
  const summary=options.filter(option=>selected.includes(option.value)).map(option=>option.label).join(', ');
  return (
    <div className="am-field am-multi-field">
      <span className="am-drawer-field-label">{label}</span>
      <details className="am-drawer-multi">
        <summary className="am-drawer-multi-trigger"><span className={summary?'':'am-drawer-multi-placeholder'}>{summary||placeholder}</span><IconChevronDown size={17}/></summary>
        <div className="am-drawer-multi-menu">
          {options.map(option=>{
            const checked=selected.includes(option.value);
            return (
              <label key={option.value} className="am-drawer-multi-option">
                <input type="checkbox" checked={checked} onChange={()=>onChange(checked?selected.filter(value=>value!==option.value):[...selected,option.value])}/>
                <span><b>{option.label}</b><small>{option.meta}</small></span>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}
