// Additive account metadata. Existing codes remain the journal reference key.
import {applyAccountSettings} from './account-settings.js';
import {validateScope} from './organisation-scope.js';
export const TYPES = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];
export const ACCOUNT_SCOPES=['Organisation Account','Branch Specific Account'];
export const ACCOUNT_NATURES={
  Assets:['Cash','Bank','Accounts Receivable','Inventory','Fixed Assets','Current Assets','Other Assets'],
  Liabilities:['Accounts Payable','Loans','GST Payable','Tax Liability','Current Liabilities','Long-term Liabilities'],
  Equity:['Capital','Reserves','Retained Earnings','Drawings'],
  Income:['Sales Income','Other Income'],
  Expenses:['Operating Expense','Administrative Expense','Direct Expense','Cost of Goods Sold','Financial Expense']
};
export const ACCOUNT_CATEGORIES={
  Assets:['Bank','Cash','Inventory','Receivable','Fixed Asset','Other Asset'],
  Liabilities:['Payable','Tax Liability','Loan','Other Liability'],
  Equity:['Capital','Reserves','Retained Earnings','Drawings'],
  Income:['Sales Revenue','Other Income'],
  Expenses:['Salary','Rent','Marketing','Direct Cost','Finance Cost','Other Expense']
};
export const ACCOUNT_PURPOSES={
  Assets:{
    'Bank Account':{nature:'Bank',category:'Bank',group:'Cash and Bank',modules:['Banking · Bank Ledger','Payments','Receipts'],reconciliationRequired:true,taxApplicable:false,allowManualPosting:true},
    Cash:{nature:'Cash',category:'Cash',group:'Cash and Bank',modules:['Banking · Cash Ledger','Payments','Receipts'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    'Customer Receivable':{nature:'Accounts Receivable',category:'Receivable',group:'Current Assets',modules:['Sales · Accounts Receivable','Receipts'],reconciliationRequired:true,taxApplicable:false,allowManualPosting:false,controlAccount:true},
    'Fixed Asset':{nature:'Fixed Assets',category:'Fixed Asset',group:'Fixed Assets',modules:['Assets · Fixed Asset'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    'Inventory Asset':{nature:'Inventory',category:'Inventory',group:'Current Assets',modules:['Inventory · Inventory Asset','Purchases · Inventory'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:false,controlAccount:true},
    'Other Current Asset':{nature:'Current Assets',category:'Other Asset',group:'Current Assets',modules:['Accounting · Current Asset'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true}
  },
  Liabilities:{
    'Supplier Payable':{nature:'Accounts Payable',category:'Payable',group:'Current Liabilities',modules:['Purchases · Accounts Payable','Payments'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:false,controlAccount:true},
    'GST Payable':{nature:'GST Payable',category:'Tax Liability',group:'Current Liabilities',modules:['Tax · Output GST','GST Reports'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Output GST',allowManualPosting:false,controlAccount:true},
    Loan:{nature:'Loans',category:'Loan',group:'Long-term Liabilities',modules:['Banking · Loan','Accounting · Liability'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    'Credit Card':{nature:'Current Liabilities',category:'Other Liability',group:'Current Liabilities',modules:['Banking · Credit Card','Expenses · Expense'],reconciliationRequired:true,taxApplicable:false,allowManualPosting:true},
    'Other Liability':{nature:'Current Liabilities',category:'Other Liability',group:'Current Liabilities',modules:['Accounting · Liability'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true}
  },
  Equity:{
    Capital:{nature:'Capital',category:'Capital',group:'Equity',modules:['Accounting · Equity'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    Reserves:{nature:'Reserves',category:'Reserves',group:'Equity',modules:['Accounting · Equity'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    'Retained Earnings':{nature:'Retained Earnings',category:'Retained Earnings',group:'Equity',modules:['Accounting · Equity'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:false,controlAccount:true},
    Drawings:{nature:'Drawings',category:'Drawings',group:'Equity',modules:['Accounting · Equity'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true}
  },
  Income:{
    'Sales Income':{nature:'Sales Income',category:'Sales Revenue',group:'Operating Income',modules:['Sales · Revenue','Credit Notes'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Output GST',allowManualPosting:true},
    'Service Income':{nature:'Sales Income',category:'Sales Revenue',group:'Operating Income',modules:['Sales · Revenue','Credit Notes'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Output GST',allowManualPosting:true},
    'Other Income':{nature:'Other Income',category:'Other Income',group:'Other Income',modules:['Sales · Revenue','Banking · Income'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true}
  },
  Expenses:{
    'Salary Expense':{nature:'Operating Expense',category:'Salary',group:'Operating Expenses',modules:['Payroll · Salary','Expenses · Expense'],reconciliationRequired:false,taxApplicable:false,allowManualPosting:true},
    'Rent Expense':{nature:'Operating Expense',category:'Rent',group:'Operating Expenses',modules:['Expenses · Expense','Purchases · Expense'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Input GST',allowManualPosting:true},
    'Marketing Expense':{nature:'Operating Expense',category:'Marketing',group:'Operating Expenses',modules:['Expenses · Expense','Purchases · Expense'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Input GST',allowManualPosting:true},
    'Travel Expense':{nature:'Operating Expense',category:'Other Expense',group:'Operating Expenses',modules:['Expenses · Expense','Purchases · Expense'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Input GST',allowManualPosting:true},
    'Other Expense':{nature:'Operating Expense',category:'Other Expense',group:'Operating Expenses',modules:['Expenses · Expense','Purchases · Expense'],reconciliationRequired:false,taxApplicable:true,taxTreatment:'Input GST',allowManualPosting:true}
  }
};
export function accountPurposeDefaults(type,purpose){
  const defaults=ACCOUNT_PURPOSES[type]?.[purpose];
  if(!defaults)throw Error('Invalid accounting combination. Please select the correct account purpose.');
  return {...defaults,type,purpose,accountNature:defaults.nature,nature:CATEGORY[type].nature,report:CATEGORY[type].report,currency:'INR',allowDirectTransactions:true,taxMode:defaults.taxApplicable?'transaction':'none',taxTreatment:defaults.taxTreatment||'GST Exempt',defaultTaxRate:'18'};
}
export const CATEGORY = {
  Income: {label:'Money In', detail:'Income your business earns', report:'Profit & Loss', nature:'Credit', start:4000},
  Expenses: {label:'Money Out', detail:'Costs of running your business', report:'Profit & Loss', nature:'Debit', start:5000},
  Assets: {label:'Things I Own', detail:'Cash, receivables and assets', report:'Balance Sheet', nature:'Debit', start:1000},
  Liabilities: {label:'Things I Owe', detail:'Bills, loans and tax obligations', report:'Balance Sheet', nature:'Credit', start:2000},
  Equity: {label:"Owner’s Funds", detail:'Capital, reserves and drawings', report:'Balance Sheet', nature:'Credit', start:3000},
};
export const SUGGESTIONS = {
  Income:['Product Sales','Service Income','Other Income'],
  Expenses:['Office Rent','Internet Expense','Employee Salary','Marketing','Travel','Software Subscriptions'],
  Assets:['Business Bank Account','Equipment','Furniture'],
  Liabilities:['Business Loan','Accrued Expenses'],
  Equity:['Owner Capital','Retained Earnings'],
};
export function inferAccountNature(account){
  const text=[account.name,account.group].join(' ').toLowerCase(),options=ACCOUNT_NATURES[account.type]||[];
  const match=options.find(value=>text.includes(value.toLowerCase()))
    ||(account.type==='Assets'&&(/bank/.test(text)?'Bank':/cash/.test(text)?'Cash':/receivable/.test(text)?'Accounts Receivable':/inventory/.test(text)?'Inventory':/fixed/.test(text)?'Fixed Assets':'Current Assets'))
    ||(account.type==='Liabilities'&&(/payable/.test(text)?'Accounts Payable':/gst/.test(text)?'GST Payable':/tax/.test(text)?'Tax Liability':/loan/.test(text)?'Loans':'Current Liabilities'))
    ||(account.type==='Income'&&(/sales|service/.test(text)?'Sales Income':'Other Income'))
    ||(account.type==='Expenses'&&(/bank|interest|finance/.test(text)?'Financial Expense':/cost of goods|purchase/.test(text)?'Cost of Goods Sold':'Operating Expense'));
  return match||options[0]||account.type;
}
export function normalizeAccounts(state, seed={}) {
  const records=state.accounts?.length ? state.accounts : Object.entries(seed).flatMap(([type,rows])=>rows.map(([code,name])=>({code,name,type,active:true,system:true})));
  return {...state,accounts:records.map(a=>{const scope=ACCOUNT_SCOPES.includes(a.scope)?a.scope:'Organisation Account',control=!!a.controlAccount,branchId=scope==='Branch Specific Account'?(a.branchId||a.branch||''):null,organizationIds=Array.isArray(a.organizationIds)&&a.organizationIds.length?[...new Set(a.organizationIds)]:[a.organizationId||'default'];return {...a,id:a.id||'legacy:'+a.code,displayName:a.displayName||a.name||'',purposeDescription:a.purposeDescription||a.description||'',organizationId:organizationIds[0],organizationIds,scope,branchId,applicableBranches:scope==='Branch Specific Account'?(a.applicableBranches?.length?a.applicableBranches:[branchId].filter(Boolean)):[],nature:a.nature||CATEGORY[a.type]?.nature||'Debit',accountNature:a.accountNature||inferAccountNature(a),accountCategory:a.system?'System Account':'Custom Account',reportingCategory:a.reportingCategory||ACCOUNT_CATEGORIES[a.type]?.[0]||a.type,parent:a.parent||'',group:accountGroupFor(a),isGroup:!!a.isGroup,allowManualPosting:a.allowManualPosting??!control,allowDirectTransactions:a.allowDirectTransactions??true,moduleMappings:Array.isArray(a.moduleMappings)?a.moduleMappings:[],taxApplicable:a.taxApplicable??a.taxMode!=='none',taxTreatment:a.taxTreatment||'GST Exempt',defaultTaxRate:String(a.defaultTaxRate||'18'),currency:a.currency||'INR',reconciliationRequired:a.reconciliationRequired??(a.accountNature==='Bank'||a.accountNature==='Accounts Receivable'||/bank/i.test(a.name||'')),revision:a.revision||0}}),accountAudit:state.accountAudit||[]};
}
export function nextCode(accounts,type) {
  let n=CATEGORY[type].start;
  while(accounts.some(a=>String(a.code)===String(n)))n++;
  return String(n);
}
export function suggestedGroup(name,type){
  return accountGroupFor({name,type,group:'',accountNature:inferAccountNature({name,type,group:''})});
}
export function accountGroupFor(account){
  const savedGroup=String(account.group||'').trim();
  if(savedGroup && savedGroup!==account.type)return savedGroup;
  const validNature=ACCOUNT_NATURES[account.type]?.includes(account.accountNature);
  const nature=validNature?account.accountNature:inferAccountNature({...account,group:''});
  const groups={Cash:'Cash and Bank',Bank:'Cash and Bank','Accounts Receivable':'Current Assets',Inventory:'Current Assets','Current Assets':'Current Assets','Fixed Assets':'Fixed Assets','Other Assets':'Other Assets','Accounts Payable':'Current Liabilities','GST Payable':'Current Liabilities','Tax Liability':'Current Liabilities','Current Liabilities':'Current Liabilities',Loans:'Long-term Liabilities',Capital:'Equity',Reserves:'Equity','Retained Earnings':'Equity',Drawings:'Equity','Sales Income':'Operating Income','Other Income':'Other Income','Operating Expense':'Operating Expenses','Cost of Goods Sold':'Cost of Goods Sold','Financial Expense':'Operating Expenses'};
  return groups[nature]||savedGroup;
}
export function accountUsed(s,code){
  return (s.journals||[]).some(j=>j.lines.some(l=>l.account===code));
}
export function references(s,code,external=[]){
  return [...Object.entries(s.config||{}).filter(([k,v])=>['sales','ar','cgst','sgst','igst','cess','round'].includes(k)&&v===code).map(([k])=>'Default '+k+' mapping'),
    ...s.accounts.filter(a=>a.tds?.enabled&&a.tds.account===code).map(a=>'TDS mapping: '+a.name),
    ...(s.invoices||[]).filter(i=>i.status!=='Cancelled'&&(i.arAccount===code||i.lines?.some(l=>l.income===code))).map(i=>'Invoice '+i.number),
    ...(s.creditNotes||[]).filter(c=>c.status!=='Cancelled'&&c.lines?.some(l=>l.income===code)).map(c=>'Credit note '+c.number),
    ...external.filter(r=>r.code===code).map(r=>r.label)];
}
const fail=message=>{throw Error(message)};
const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
export function changeAccount(state,action,payload,external=[],organisations=[]) {
  const s=normalizeAccounts(JSON.parse(JSON.stringify(state))),p={...payload};
  const old=s.accounts.find(a=>a.id===p.id);
  if(p.id&&!old)fail('This account no longer exists. Refresh the list.');
  if(old&&p.revision!==old.revision)fail('This account changed elsewhere. Reopen it before saving.');
  let record;
  if(action==='save'){
    const type=p.type||old?.type;
    if(!TYPES.includes(type))fail('Choose what you want to track.');
    const purpose=p.accountPurpose||old?.accountPurpose||'';
    const purposeDefaults=purpose?accountPurposeDefaults(type,purpose):null;
    const name=String(p.name||'').trim(),code=String(p.code||nextCode(s.accounts,type)).trim();
    if(!name)fail('Enter an account name.');
    if(name.length>100)fail('Use an account name of 100 characters or fewer.');
    if(!/^[A-Za-z0-9_-]{1,24}$/.test(code))fail('Use a code of up to 24 letters, numbers, hyphens or underscores.');
    if(s.accounts.some(a=>a.id!==old?.id&&same(a.code,code)))fail('Account code already exists. Choose a unique code.');
    if(s.accounts.some(a=>a.id!==old?.id&&same(a.name,name)))fail('An account with this name already exists. Use the existing account or a distinct name.');
    const parent=p.parent||'',parentAccount=s.accounts.find(a=>a.code===parent);
    if(parent){
      if(!parentAccount||!parentAccount.active||parentAccount.type!==type)fail('Select an active parent account of the same account type.');
      let ancestor=parent;const visited=new Set([code,old?.code].filter(Boolean));
      while(ancestor){if(visited.has(ancestor))fail('Circular hierarchy is not allowed.');visited.add(ancestor);ancestor=s.accounts.find(a=>a.code===ancestor)?.parent;}
    }
    const nature=p.nature||purposeDefaults?.nature||CATEGORY[type].nature;
    if(!['Debit','Credit'].includes(nature))fail('Choose a valid normal balance.');
    if(old&&(old.system||accountUsed(s,old.code)||s.accounts.some(a=>a.parent===old.code)||references(s,old.code,external).length)&&type!==old.type)fail('This account is protected, used or referenced. Its code and accounting structure cannot be changed.');
    const accountNature=purposeDefaults?.accountNature||p.accountNature||inferAccountNature({name,type,group:p.group});
    if(!ACCOUNT_NATURES[type]?.includes(accountNature))fail('Choose an account nature that belongs to the selected account type.');
    const reportingCategory=purposeDefaults?.category||p.reportingCategory||old?.reportingCategory||ACCOUNT_CATEGORIES[type][0];
    if(!ACCOUNT_CATEGORIES[type]?.includes(reportingCategory))fail('Choose an account category that belongs to the selected account type.');
    const scope=p.scope||old?.scope||'Organisation Account',applicableBranches=scope==='Branch Specific Account'?(Array.isArray(p.applicableBranches)&&p.applicableBranches.length?p.applicableBranches:[p.branchId].filter(Boolean)):[],branchId=applicableBranches[0]||null,organizationIds=Array.isArray(p.organizationIds)&&p.organizationIds.length?[...new Set(p.organizationIds)]:old?.organizationIds?.length?[...old.organizationIds]:[p.organizationId||old?.organizationId||'default'];
    if(!ACCOUNT_SCOPES.includes(scope))fail('Choose a valid account scope.');
    if(scope==='Branch Specific Account'&&!branchId)fail('Choose at least one applicable branch.');
    // Domain guard for the shared organisation/branch scope rule: when the caller supplies the
    // organisation list, a branch may only come from an organisation that is actually selected.
    // A legacy placeholder organisation id stays tolerated, exactly like the rest of this module
    // tolerates it, and an id that no longer resolves is rejected rather than silently accepted.
    const declaredOrganisationIds=(Array.isArray(organisations)&&organisations.length?organizationIds:[]).filter(id=>id&&id!=='default');
    if(declaredOrganisationIds.length&&applicableBranches.length){
      const scopeCheck=validateScope({organisations,organisationIds:declaredOrganisationIds,branchIds:applicableBranches,requireBranch:false});
      if(!scopeCheck.ok)fail(scopeCheck.message);
    }
    if(parentAccount&&(parentAccount.accountNature!==accountNature||parentAccount.scope!==scope))fail('Parent and child accounts must have the same account type, nature and scope.');
    const moduleMappings=Array.isArray(p.moduleMappings)?p.moduleMappings:purposeDefaults?.modules||old?.moduleMappings||[];
    if(p.mappingRequired&&p.allowDirectTransactions!==false&&Array.isArray(p.moduleMappings)&&!moduleMappings.length)fail('Select at least one Accounting Mapping when module posting is enabled.');
    if(p.openingAmount&&p.openingSide&&p.openingSide!==CATEGORY[type].nature)fail(`Opening balance for ${type} accounts must default to ${CATEGORY[type].nature}.`);
    record={...old,id:old?.id||crypto.randomUUID(),name,displayName:String(p.displayName||name).trim(),purposeDescription:String(p.purposeDescription||p.description||'').trim(),code,type,nature,accountNature,accountPurpose:purpose,reportingCategory,organizationId:organizationIds[0],organizationIds,scope,branchId,applicableBranches,parent,group:String(p.group||purposeDefaults?.group||suggestedGroup(name,type)),description:String(p.description||''),isGroup:!!p.isGroup,branchRequired:scope==='Branch Specific Account'||!!p.branchRequired,costCentreRequired:!!p.costCentreRequired,allowManualPosting:p.allowManualPosting??purposeDefaults?.allowManualPosting??old?.allowManualPosting??true,allowDirectTransactions:p.allowDirectTransactions??purposeDefaults?.allowDirectTransactions??old?.allowDirectTransactions??true,moduleMappings,taxApplicable:p.taxApplicable??purposeDefaults?.taxApplicable??old?.taxApplicable??true,taxTreatment:(p.taxApplicable??purposeDefaults?.taxApplicable)===false?'GST Exempt':p.taxTreatment||purposeDefaults?.taxTreatment||old?.taxTreatment||'GST Exempt',defaultTaxRate:String(p.defaultTaxRate||purposeDefaults?.defaultTaxRate||old?.defaultTaxRate||'18'),currency:p.currency||old?.currency||purposeDefaults?.currency||'INR',reconciliationRequired:p.reconciliationRequired??purposeDefaults?.reconciliationRequired??old?.reconciliationRequired??(accountNature==='Bank'||accountNature==='Accounts Receivable'),active:p.active??old?.active??true,system:old?.system??false,accountCategory:old?.system?'System Account':'Custom Account',revision:(old?.revision||0)+1,createdAt:old?.createdAt||new Date().toISOString(),createdBy:old?.createdBy||'Local user',modifiedAt:new Date().toISOString(),modifiedBy:'Local user'};
    if(old){
      const locked=['code','type','nature','accountNature','parent','isGroup','scope','branchId'];
      const dependents=s.accounts.some(a=>a.parent===old.code)||references(s,old.code,external).length;
      const branchScopeChanged=JSON.stringify(record.applicableBranches||[])!==JSON.stringify(old.applicableBranches||[]);
      if((old.system||accountUsed(s,old.code)||dependents)&&(locked.some(k=>record[k]!==old[k])||branchScopeChanged))fail('This account is protected, used or referenced. Its code and accounting structure cannot be changed.');
      if(old.system&&['branchRequired','costCentreRequired'].some(k=>!!record[k]!==!!old[k]))fail('System account requirements are protected.');
    }
    const mappingsBefore={...s.config};
    applyAccountSettings(s,old,record,p);
    if(JSON.stringify(mappingsBefore)!==JSON.stringify(s.config))s.accountAudit.push({id:crypto.randomUUID(),accountId:record.id,action:'GST mappings updated',at:new Date().toISOString(),by:'Local user',before:mappingsBefore,after:{...s.config}});
    s.accounts=old?s.accounts.map(a=>a.id===old.id?record:a):[...s.accounts,record];
  }else{
    if(!old)fail('Account not found.');
    const refs=references(s,old.code,external);
    if(action==='delete'||old.active){
      if(s.accounts.some(a=>a.parent===old.code))fail('This account has child accounts. Update them first.');
      if(refs.length)fail('This account is mapped or referenced: '+refs[0]+'. Update that reference first.');
    }
    if(action==='delete'){
      if(accountUsed(s,old.code))fail('Accounts used in posted transactions cannot be deleted.');
      s.accounts=s.accounts.filter(a=>a.id!==old.id);record=old;
    }else if(action==='toggle'){
      if(!old.active&&old.parent&&!s.accounts.some(a=>a.code===old.parent&&a.active))fail('Activate the parent account first.');
      record={...old,active:!old.active,revision:old.revision+1,modifiedAt:new Date().toISOString(),modifiedBy:'Local user'};
      s.accounts=s.accounts.map(a=>a.id===old.id?record:a);
    }else fail('Unknown account action.');
  }
  s.accountAudit.push({id:crypto.randomUUID(),accountId:record.id,action:action==='save'?(old?'Updated':'Created'):action==='delete'?'Deleted':record.active?'Activated':'Deactivated',at:new Date().toISOString(),by:'Local user',before:old||null,after:action==='delete'?null:record});
  return {state:s,record};
}
export function parseAccountCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){if(row.some(x=>x.trim()))rows.push(row);row=[];}}else cell+=c;}
  if(quoted)fail('The CSV has an unclosed quote.');
  row.push(cell.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
  const header=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase());
  if(!header?.includes('name')||!header.includes('type'))fail('CSV needs Name and Type columns. Optional: Code, Description.');
  if(rows.length>500)fail('Import up to 500 accounts at a time.');
  if(!rows.length)fail('No accounts found in this file.');
  return rows.map(r=>{const get=k=>r[header.indexOf(k)]||'';return {name:get('name'),type:get('type'),code:get('code'),description:get('description')};});
}
export function importAccounts(state,rows,external=[]){
  let next=state;
  rows.forEach((row,n)=>{try{next=changeAccount(next,'save',row,external).state}catch(e){fail('Row '+(n+2)+': '+e.message)}});
  return next;
}
