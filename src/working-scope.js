import {useEffect,useState} from 'react';

/* The header switcher stores the organisations and branches the operator chose. A
   single organisation and a single branch are the default reading context, so a
   register does not need to repeat those values on every row. The columns are only
   useful when the selected view spans more than one organisation or more than one
   branch. */
const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
const readList=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)&&value.length?value:fallback}catch{return fallback}};

export function readWorkingScopeVisibility(){
 const companyIds=readList('wayvida-context-companies',[read('wayvida-demo-company','abc')]);
 const branchIds=readList('wayvida-context-branches',[read('wayvida-demo-branch','abc-kochi')]);
 return {showOrganisation:companyIds.length>1,showBranch:branchIds.length>1,companyCount:companyIds.length,branchCount:branchIds.length};
}

export function useWorkingScopeVisibility(){
 const [scope,setScope]=useState(readWorkingScopeVisibility);
 useEffect(()=>{
  const refresh=()=>setScope(readWorkingScopeVisibility());
  window.addEventListener('wayvida-working-context-change',refresh);
  window.addEventListener('wayvida-organization-change',refresh);
  window.addEventListener('storage',refresh);
  return()=>{
   window.removeEventListener('wayvida-working-context-change',refresh);
   window.removeEventListener('wayvida-organization-change',refresh);
   window.removeEventListener('storage',refresh);
  };
 },[]);
 return scope;
}

/* Column widths are renormalised after the scope columns are dropped, so a narrow
   single-org register keeps its remaining columns at 100% instead of leaving the
   hidden columns' space empty. */
export function visibleScopeColumns(columns,scope){
 const visible=columns.filter(column=>column.scope!=='organisation'||scope.showOrganisation).filter(column=>column.scope!=='branch'||scope.showBranch);
 const total=visible.reduce((sum,column)=>sum+(column.weight||10),0);
 return visible.map(column=>({...column,width:((column.weight||10)*100/total).toFixed(3).replace(/\.?0+$/,'')+'%'}));
}
