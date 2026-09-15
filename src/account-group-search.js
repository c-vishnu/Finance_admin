/* Account Group search: the pure filtering behind the Create Account / Edit
   Account group picker. It lives outside the component the same way
   journal-templates.js holds matchesAccountQuery for the Journal lines account
   picker, so the matching rules are testable without a DOM. */
export const accountGroupKey=option=>String(option?.type||'')+'::'+String(option?.purpose||'');
const fold=value=>String(value||'').toLowerCase();

export function matchesAccountGroup(option,query){
 const needle=fold(query).trim();
 if(!needle)return true;
 return fold([option?.label,option?.type,option?.purpose,option?.group].join(' ')).includes(needle);
}

export function flattenAccountGroups(groups=[]){
 return (groups||[]).flatMap(group=>(group?.options||[]).map(option=>({type:option.type||group.type||'',purpose:option.purpose||'',label:option.label||option.purpose||'',group:group.label||group.type||''})));
}

export function accountGroupRows(groups=[],query=''){
 const rows=[],keys=[];
 for(const group of groups||[]){
  const label=group?.label||group?.type||'';
  const options=flattenAccountGroups([group]).filter(option=>matchesAccountGroup(option,query));
  if(!options.length)continue;
  rows.push({section:label});
  for(const option of options){keys.push(rows.length);rows.push({option})}
 }
 return {rows,keys};
}

export function selectedAccountGroup(groups=[],value=''){
 const key=String(value||'');
 return flattenAccountGroups(groups).find(option=>accountGroupKey(option)===key)||null;
}
