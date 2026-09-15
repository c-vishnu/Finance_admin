/* Working organisation context - the storage-backed list of organisations and
   branches the header selector has made available. Create Journal Entry and
   Period Closing both read their available scope from here, so the shared
   organisation/branch rule in src/organisation-scope.js is applied to one list
   and can never drift between screens.

   Two lists come out of the same storage pair:
     getAccessibleOrganizations - the working context the header is narrowed to
     getScopeOrganisations      - every organisation and branch the header
                                  Change / Customize drawer can offer, which is
                                  the universe a deliberate scope is chosen from
   Create Budget plans over the second one, because a plan may cover any
   organisation the user can work with, while the journal lines stay on the
   first: the working context is a view filter, a planning scope is a choice. */
import {demoOrganizations} from './HeaderOrgSelectors.jsx';

export const readOrgSetting=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
export const readOrgList=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)&&value.length?value:fallback}catch{return fallback}};

/* The list a storage pair resolves to: the organisations the company key names,
   each narrowed to the branches the branch key names. A pair that resolves to
   nothing keeps the whole demo list, so no caller is ever handed an empty
   universe to choose from. */
const scopedOrganisations=(companyKey,branchKey,companyFallback,branchFallback)=>{
  const companies=readOrgList(companyKey,companyFallback),branches=readOrgList(branchKey,branchFallback);
  const scoped=demoOrganizations.filter(item=>companies.includes(item.id)).map(item=>({...item,branches:item.branches.filter(branch=>branches.includes(branch.id))})).filter(item=>item.branches.length);
  return scoped.length?scoped:demoOrganizations;
};

export const getAccessibleOrganizations=()=>scopedOrganisations(
  'wayvida-context-companies','wayvida-context-branches',
  [readOrgSetting('wayvida-demo-company',demoOrganizations[0].id)],
  [readOrgSetting('wayvida-demo-branch',demoOrganizations[0].branches[0].id)]
);

/* The universe a scope may be chosen from - the same list the header Change /
   Customize drawer offers. Create Budget picks its planning scope from here, so
   a narrowed working context can never leave the scope control with nothing to
   choose. */
export const getScopeOrganisations=()=>scopedOrganisations(
  'wayvida-accessible-organizations','wayvida-accessible-branches',
  demoOrganizations.map(item=>item.id),
  demoOrganizations.flatMap(item=>item.branches.map(branch=>branch.id))
);

export const getCurrentOrganizationContext=()=>{const organizations=getAccessibleOrganizations();const companyId=readOrgSetting('wayvida-demo-company',organizations[0].id);const company=organizations.find(item=>item.id===companyId)||organizations[0];const branchId=readOrgSetting('wayvida-demo-branch',company.branches[0].id);const branch=company.branches.find(item=>item.id===branchId)||company.branches[0];return{company,branch}};