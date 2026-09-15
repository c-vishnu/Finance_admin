/* Organisation and branch scope - the single rule for the whole accounting module.
   Period Locking, Chart of Accounts and Create Journal Entry all resolve their
   organisation/branch scope through this module, so the three screens can never
   drift apart again. Pure data only: no React, no storage, no side effects.

   The rule, in one place:
     showOrganisation = more than one organisation in scope
     showBranch       = more than one organisation in scope, or any organisation in
                        scope owns more than one branch
   A one-branch organisation is therefore auto-resolved, a branchless organisation
   IS the scope (and prints as an em dash), and a branch can only ever be chosen
   from the organisation it belongs to. */

export const NO_BRANCH='\u2014';
export const ALL_BRANCHES='All branches';
export const ALL_ORGANISATIONS='All organisations';

const asId=value=>String(value??'').trim();

export function organisationScopeList(organisations=[]){
 return (Array.isArray(organisations)?organisations:[]).filter(Boolean).map(organisation=>({...organisation,branches:(Array.isArray(organisation.branches)?organisation.branches:[]).filter(Boolean)}));
}

export function organisationReference(organisation){return asId(organisation?.id||organisation?.code||organisation?.name)}

export function branchReference(branch){return asId(branch?.id||branch?.name)}

export function findOrganisation(reference,organisations=[]){
 const wanted=asId(reference);
 if(!wanted)return null;
 const list=organisationScopeList(organisations);
 return list.find(organisation=>asId(organisation.id)===wanted||asId(organisation.code)===wanted||asId(organisation.name)===wanted)||null;
}

export function getBranchesForOrganisation(reference,organisations=[]){
 const organisation=findOrganisation(reference,organisations);
 return organisation?organisation.branches:[];
}

export function getBranchIdsForOrganisation(reference,organisations=[]){return getBranchesForOrganisation(reference,organisations).map(branchReference)}

export function organisationContainsBranch(reference,branchReferenceValue,organisations=[]){
 const wanted=asId(branchReferenceValue);
 return Boolean(wanted)&&getBranchesForOrganisation(reference,organisations).some(branch=>branchReference(branch)===wanted||asId(branch.name)===wanted);
}

/* Every branch of the given organisations, each tagged with the organisation it
   belongs to. Chart of Accounts building a branch picker and the account detail
   panel grouping branches both read from here, so a branch is never offered
   outside the organisation that owns it. */
export function organisationBranches(organisations=[]){
 return organisationScopeList(organisations).flatMap(organisation=>organisation.branches.map(branch=>({...branch,organisationId:organisation.id,organisationCode:organisation.code,organisationName:organisation.name})));
}

export function selectedOrganisations(references,organisations=[],{fallbackToList=true}={}){
 const list=organisationScopeList(organisations),wanted=(Array.isArray(references)?references:[references]).map(asId).filter(Boolean);
 if(!wanted.length)return fallbackToList?list:[];
 const selected=list.filter(organisation=>wanted.includes(asId(organisation.id))||wanted.includes(asId(organisation.code))||wanted.includes(asId(organisation.name)));
 return selected.length||!fallbackToList?selected:[];
}
/* The state an organisation/branch picker renders from: which selectors the
   available list justifies, the resolved selection, the branch options of the
   chosen organisation (never another organisation’s branch) and the context
   line. Create Journal Entry, the Period Closing lock drawer and the request
   unlock drawer all render from this, so the control cannot drift. */
export function scopePickerState({organisations=[],companyIds=[],branchIds=[],label='Locking for'}={}){
 const visibility=getScopeVisibility({organisations,label});
 const rows=visibility.rows;
 const wanted=(companyIds||[]).map(asId).filter(Boolean);
 const selectedRow=rows.find(row=>wanted.includes(asId(row.companyId)))||rows[0]||null;
 const branches=selectedRow?getBranchesForOrganisation(selectedRow.companyId,organisations):[];
 const chosen=branches.find(branch=>(branchIds||[]).map(asId).includes(branchReference(branch)))||(branches.length===1?branches[0]:null);
 const branchLabel=!branches.length?NO_BRANCH:(chosen?chosen.name:ALL_BRANCHES);
 const line=selectedRow?(label+': '+selectedRow.organisationName+' · '+branchLabel):(label+': no organisation selected');
 const chosenIds=(branchIds||[]).map(asId).filter(Boolean);
 const inScope=selectedOrganisations(companyIds,organisations);
 const branchesAll=organisationBranches(inScope);
 const resolved=normaliseScope({organisations,companyIds:inScope.map(organisation=>organisation.code),branchIds:chosenIds});
 const resolvedBranchIds=resolved.branchIds.map(asId);
 const resolvedBranches=branchesAll.filter(branch=>resolvedBranchIds.includes(asId(branch.id)));
 const organisationSummary=inScope.length===1?inScope[0].name:(wanted.length?inScope.length+' organisations':ALL_ORGANISATIONS);
 const narrowed=Boolean(chosenIds.length&&resolvedBranches.length);
 const branchSummary=!branchesAll.length?NO_BRANCH:(resolvedBranches.length===1?resolvedBranches[0].name:(narrowed?resolvedBranches.length+' branches':ALL_BRANCHES));
 return {showOrganisation:visibility.showOrgColumn,showBranch:visibility.showBranchColumn,organisationId:selectedRow?selectedRow.organisationId:'',companyId:selectedRow?selectedRow.companyId:'',organisationName:selectedRow?selectedRow.organisationName:'',branchId:chosen?chosen.id:'',branchOptions:branches.map(branch=>({id:branch.id,name:branch.name})),organisationOptions:rows.map(row=>({id:row.organisationId,code:row.companyId,name:row.organisationName})),branchLabel,line,allBranches:!chosen,branchesAll,selectedCompanyIds:wanted,chosenBranchIds:chosenIds,selectedBranchIds:resolved.branchIds,organisationSummary,branchSummary,allOrganisations:!wanted.length};
}

export function getScopeVisibility({organisations=[],organisationIds=[],companyIds=[],branchIds=[],label='Locking for'}={}){
 const list=organisationScopeList(organisations);
 const wanted=[...(organisationIds||[]),...(companyIds||[])].map(asId).filter(Boolean);
 const selected=wanted.length?list.filter(organisation=>wanted.includes(asId(organisation.id))||wanted.includes(asId(organisation.code))):list;
 const chosenBranches=(branchIds||[]).map(asId);
 const organisationCount=selected.length,anySelectedOrgHasMultipleBranches=selected.some(organisation=>organisation.branches.length>1);
 const showOrganisation=organisationCount>1,showBranch=organisationCount>1||anySelectedOrgHasMultipleBranches;
 const rows=selected.map(organisation=>{const branches=organisation.branches,singleBranch=branches.length===1,chosen=singleBranch?branches[0]:branches.find(branch=>chosenBranches.includes(branchReference(branch)));return {organisationId:organisation.id,companyId:organisation.code,organisationName:organisation.name,branchId:chosen?.id||'',branchName:branches.length?(chosen?.name||branches[0].name):NO_BRANCH,branchOptions:branches.map(branch=>branch.name),singleBranch,branchRequired:branches.length>1,noBranches:!branches.length,allBranches:branches.length>1&&!chosen}});
 const only=rows[0],strip=organisationCount===1?`${label}: ${selected[0].name} \u00b7 ${only.singleBranch?only.branchName:ALL_BRANCHES}`:organisationCount?`${label}: ${organisationCount} organisations \u00b7 ${ALL_BRANCHES}`:`${label}: no organisation selected`;
 return {organisations:selected,rows,organisationCount,orgCount:organisationCount,anySelectedOrgHasMultipleBranches,showOrganisation,showBranch,showOrgColumn:showOrganisation,showBranchColumn:showBranch,strip,branchRequired:selected.some(organisation=>organisation.branches.length>1)};
}

export function scopeVisibility(scope={}){return getScopeVisibility(scope)}

export function normaliseScope({organisations=[],companyIds=[],organisationIds=[],branchIds=[]}={}){
 const list=organisationScopeList(organisations);
 const wanted=[...(organisationIds||[]),...(companyIds||[])].map(asId).filter(Boolean);
 const selected=wanted.length?list.filter(organisation=>wanted.includes(asId(organisation.id))||wanted.includes(asId(organisation.code))):list;
 const keep=(branchIds||[]).map(asId);
 const resolved=selected.map(organisation=>{const branches=organisation.branches;if(!branches.length)return {companyId:organisation.code,organisationName:organisation.name,branchIds:[],branchNames:[]};const allowed=branches.filter(branch=>keep.includes(branchReference(branch))).map(branch=>branch.id);const chosen=branches.length===1?[branches[0].id]:(allowed.length?allowed:[]);return {companyId:organisation.code,organisationName:organisation.name,branchIds:chosen,branchNames:branches.filter(branch=>chosen.includes(branch.id)).map(branch=>branch.name)}});
 return {companyIds:selected.map(organisation=>organisation.code),branchIds:resolved.flatMap(item=>item.branchIds),scopeType:resolved.length===1&&!resolved[0].branchIds.length?'Organisation':'\u2014',organisations:resolved};
}

/* Rejects a scope that cannot be trusted: an organisation that no longer exists, a
   branch that belongs to another organisation, or a multiple-branch organisation
   left without a choice. One-option branches and branchless organisations resolve
   themselves and never fail here. */
export function validateScope({organisations=[],companyIds=[],organisationIds=[],branchIds=[],requireBranch=true}={}){
 const list=organisationScopeList(organisations);
 const wanted=[...(organisationIds||[]),...(companyIds||[])].map(asId).filter(Boolean);
 if(!wanted.length)return {ok:false,code:'NO_SCOPE',message:'Select at least one organisation in scope.'};
 const unknown=wanted.filter(reference=>!list.some(organisation=>asId(organisation.id)===reference||asId(organisation.code)===reference));
 if(unknown.length)return {ok:false,code:'UNKNOWN_ORGANISATION',message:'These organisations are no longer available: '+unknown.join(', ')+'.',unknown};
 const selected=list.filter(organisation=>wanted.includes(asId(organisation.id))||wanted.includes(asId(organisation.code)));
 const chosen=(branchIds||[]).map(asId).filter(Boolean);
 const allowed=selected.flatMap(organisation=>organisation.branches.map(branchReference));
 const foreign=chosen.filter(reference=>!allowed.includes(reference));
 if(foreign.length)return {ok:false,code:'BRANCH_NOT_IN_ORGANISATION',message:'A selected branch does not belong to the selected organisation.',foreign};
 for(const organisation of selected){
  if(!requireBranch||organisation.branches.length<2)continue;
  if(!organisation.branches.some(branch=>chosen.includes(branchReference(branch))))return {ok:false,code:'BRANCH_REQUIRED',message:'Choose a branch for '+organisation.name+', which has more than one branch.',organisationId:organisation.id};
 }
 return {ok:true,code:'OK',message:'',scope:normaliseScope({organisations:list,companyIds:selected.map(organisation=>organisation.code),branchIds:chosen})};
}

export function assertValidScope(scope){const result=validateScope(scope);if(!result.ok)throw Error(result.message);return result}

export function scopeLabel(row,{separator=' \u00b7 '}={}){
 if(!row)return '';
 const organisation=row.organisationName||row.organisation||row.companyId||'',branch=row.branchName||row.branch||NO_BRANCH;
 return [organisation,branch].filter(Boolean).join(separator);
}

/* The rows a multi-select scope control renders, and the toggling rule behind
   them. Both are pure, so the control stays presentation only while the
   "All organisations" / "All branches" reset, branch ownership and the
   clearing of an incompatible branch keep living in this module. */
export function scopePickerRows(state={}){
 const chosenOrganisations=(state.selectedCompanyIds||[]).map(asId);
 const chosenBranches=(state.chosenBranchIds||[]).map(asId);
 const organisationRows=!state.showOrganisation?[]:[
  {key:'all-organisations',kind:'organisation',ref:'',label:ALL_ORGANISATIONS,meta:'every organisation in scope',checked:!chosenOrganisations.length},
  ...(state.organisationOptions||[]).map(option=>({key:'organisation:'+asId(option.code),kind:'organisation',ref:asId(option.code),label:option.name,meta:option.code,checked:chosenOrganisations.includes(asId(option.code))}))
 ];
 const branchRows=!state.showBranch?[]:[
  {key:'all-branches',kind:'branch',ref:'',label:ALL_BRANCHES,meta:'every branch in scope',checked:!chosenBranches.length},
  ...(state.branchesAll||[]).map(branch=>({key:'branch:'+asId(branch.id),kind:'branch',ref:asId(branch.id),label:branch.name,meta:branch.organisationName||'',checked:chosenBranches.includes(asId(branch.id))}))
 ];
 return {organisationRows,branchRows};
}

export function toggleScopePicker(state={},row={}){
 const chosenOrganisations=(state.selectedCompanyIds||[]).map(asId);
 const chosenBranches=(state.chosenBranchIds||[]).map(asId);
 const flip=(list,ref)=>list.includes(ref)?list.filter(value=>value!==ref):[...list,ref];
 if(row.kind==='organisation')return {companyIds:row.ref?flip(chosenOrganisations,row.ref):[],branchIds:chosenBranches};
 return {companyIds:chosenOrganisations,branchIds:row.ref?flip(chosenBranches,row.ref):[]};
}
