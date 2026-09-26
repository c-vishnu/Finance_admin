import {NO_BRANCH,organisationScopeList} from './organisation-scope.js';

const branchPairs=organisations=>organisations.map(organisation=>`${organisation.name}: ${organisation.branches.length?organisation.branches.map(branch=>branch.name).join(', '):NO_BRANCH}`);

/* The Finance Categories register reflects the global working-context selection,
   not an individual account's storage scope. The compact labels preserve the
   exact selected names as a native hover title for constrained table cells. */
export function financeCategoryScope(organisations=[]){
  const selected=organisationScopeList(organisations),branches=selected.flatMap(organisation=>organisation.branches);
  const detail=branchPairs(selected).join('; ');
  return {
    organisation:selected.length===1?selected[0].name:`${selected.length} Organisations`,
    branch:branches.length===0?NO_BRANCH:branches.length===1?branches[0].name:`${branches.length} Branches`,
    detail
  };
}
