import {useEffect,useMemo,useState} from 'react';
import {
 IconArrowLeft,IconBuildingBank,IconCalendar,IconChevronDown,IconFileText,IconPaperclip,
 IconReceipt2,IconTag,IconUser,IconX
} from '@tabler/icons-react';
import {
 TRANSACTION_TYPES,buildSimpleJournal,categoryAccounts,counterpartyAccount,formatMoney,generateSummary,
 getAccountingPreview,getValidationErrors,journalAllowed,moneyAccounts,transactionTypeLabel
} from './simple-journal-transaction.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {billBalance,documentInScope,invoiceBalance} from './journal-entry-reference.js';
import './record-transaction.css';

/* One entry-mode control, rendered by the simple page and by the advanced editor it
   switches to, so the two never drift apart. */
export function ModeToggle({mode='simple',onSimple,onAdvanced}){
 return <div className="rt-mode-toggle" role="group" aria-label="Entry mode">
  <button type="button" className={mode==='simple'?'active':''} aria-pressed={mode==='simple'} onClick={mode==='simple'?undefined:onSimple}>Simple</button>
  <button type="button" className={mode==='advanced'?'active':''} aria-pressed={mode==='advanced'} onClick={mode==='advanced'?undefined:onAdvanced}>Advanced</button>
 </div>;
}

const localToday=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
const readAttachments=files=>Promise.all([...files].map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type,data:reader.result});reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})));
const shortDate=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not selected';

const blank=()=>({
 transactionType:TRANSACTION_TYPES[0][0],name:'',date:localToday(),amount:'',moneyAccount:'',toAccount:'',category:'',
 partyId:'',documentId:'',description:'',reference:'',attachments:[],organizationId:'',branchId:''
});

/* The form asks three questions in the order a non-accountant answers them:
   what happened, where the money moved, and anything else worth recording. */
function Field({label,error,icon:Icon,hint,children}){
 return <label className="rt-field">
  <span>{label}</span>
  <span className="rt-control">{Icon&&<Icon size={18} stroke={1.8} aria-hidden="true"/>}{children}</span>
  {hint&&!error&&<small className="rt-hint">{hint}</small>}
  {error&&<small role="alert">{error}</small>}
 </label>;
}

function AccountSelect({value,onChange,options,placeholder}){
 return <select value={value} onChange={event=>onChange(event.target.value)}>
  <option value="">{placeholder}</option>
  {options.map(account=><option key={account.code} value={account.code}>{account.name} · {account.code}</option>)}
 </select>;
}

/* The read-only facts the operator needs before settling an invoice or a bill,
   so the payment is never made blind. */
function DocumentFacts({kind,row,balance}){
 if(!row)return null;
 const total=kind==='Invoice'?row.totals?.total:row.total;
 return <dl className="rt-document-facts">
  <div><dt>{kind} number</dt><dd>{row.number}</dd></div>
  <div><dt>{kind} date</dt><dd>{shortDate(row.date)}</dd></div>
  <div><dt>{kind} total</dt><dd>{formatMoney(Number(total||0)/100)}</dd></div>
  <div><dt>Current balance</dt><dd><b>{formatMoney(Number(balance||0)/100)}</b></dd></div>
 </dl>;
}

export default function SimpleTransactionForm({accounts,role='Admin',error,setError,initial=null,invoicesState,billsState,onBack,onSave,onAdvanced}){
 const editing=Boolean(initial?.id);
 const [state,setState]=useState(()=>{
  const base=blank(),context=getCurrentOrganizationContext();
  const seeded={...base,organizationId:context.company?.id||'',branchId:context.branch?.id||''};
  if(!initial)return seeded;
  const simple=initial.simpleTransaction||{};
  return {...seeded,...simple,amount:simple.amount||(Number(initial.amount||0)/100||''),date:initial.date||base.date,
   description:simple.description||'',reference:simple.externalReference||initial.reference||'',attachments:initial.attachments||[],
   organizationId:initial.organizationId||seeded.organizationId,branchId:initial.branchId||seeded.branchId};
 });
 const [attempted,setAttempted]=useState(false);
 const [showEntry,setShowEntry]=useState(false);
 /* The accounting entry is a tooltip, never a disclosure that reflows the page. */
 useEffect(()=>{
  if(!showEntry)return undefined;
  const close=event=>{if(event.type==='keydown'&&event.key!=='Escape')return;if(event.type==='pointerdown'&&event.target.closest('.rt-accounting'))return;setShowEntry(false)};
  document.addEventListener('pointerdown',close);
  document.addEventListener('keydown',close);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)};
 },[showEntry]);
 const active=accounts.filter(account=>account.active&&!account.isGroup);
 const cash=moneyAccounts(active);
 const type=state.transactionType;
 const customers=useMemo(()=>{try{const rows=JSON.parse(localStorage.getItem('wayvida-customers')||'null');return Array.isArray(rows)?rows.filter(row=>row.status!=='Inactive'):[]}catch{return []}},[]);
 const vendors=useMemo(()=>{try{const rows=JSON.parse(localStorage.getItem('wayvida-vendors-v1')||'null');return Array.isArray(rows)?rows.filter(row=>row.status!=='Blocked'):[]}catch{return []}},[]);
 const organisations=getAccessibleOrganizations(),context=getCurrentOrganizationContext();
 const organisation=organisations.find(row=>row.id===state.organizationId)||organisations.find(row=>row.id===context.company?.id)||organisations[0]||null;
 const branches=organisation?.branches||[];
 const branch=branches.find(row=>row.id===state.branchId)||branches[0]||null;
 /* The working context is a view filter, so a picker only appears when the
    context itself holds more than one organisation or branch. */
 const showOrganisation=organisations.length>1,showBranch=branches.length>1;
 const documentKind=type==='customer_payment'?'Invoice':type==='vendor_payment'?'Bill':'';
 const documentOptions=useMemo(()=>{
  if(!documentKind||!state.partyId)return [];
  const invoices=invoicesState?.invoices||[],bills=billsState?.purchaseBills||[];
  if(documentKind==='Invoice')return invoices.filter(row=>row.customerId===state.partyId&&row.posted&&row.status!=='Cancelled'&&row.date<=state.date&&documentInScope(row,organisation,branch)&&invoiceBalance(invoicesState,row)>0);
  return bills.filter(row=>row.vendorId===state.partyId&&row.posted&&row.status!=='Cancelled'&&row.date<=state.date&&documentInScope(row,organisation,branch)&&billBalance(row)>0);
 },[documentKind,state.partyId,state.date,invoicesState,billsState,organisation,branch]);
 const documents=documentOptions.map(row=>({id:row.id,kind:documentKind,number:row.number,date:row.date,outstanding:documentKind==='Invoice'?invoiceBalance(invoicesState,row):billBalance(row)}));
 const selected=documentOptions.find(row=>row.id===state.documentId)||null;
 const selectedFact=documents.find(row=>row.id===state.documentId)||null;
 const ctx={accounts:active,customers,vendors,documents};
 const errors=attempted?getValidationErrors(state,ctx):{};
 const categoryOptions=categoryAccounts(active,type);
 const change=(key,value)=>{setState(current=>({...current,[key]:value,...(key==='transactionType'||key==='partyId'?{documentId:''}:{})}));if(error)setError('')};
 const chooseOrganisation=id=>setState(current=>({...current,organizationId:id,branchId:organisations.find(row=>row.id===id)?.branches?.[0]?.id||''}));
 const partyLabel=type==='customer_payment'?(customers.find(row=>row.id===state.partyId)?.name||''):type==='vendor_payment'?(vendors.find(row=>row.id===state.partyId)?.name||''):'';
 const nameFor=(code,fallback='Not selected')=>active.find(account=>account.code===code)?.name||(code?'':fallback);
 const summary=type?generateSummary(state,ctx):'Select a transaction type to continue.';
 const accounting=getAccountingPreview(state,ctx);
 const amountPreview=Number(state.amount)>0?formatMoney(state.amount):'—';

 function commit(target){
  setAttempted(true);
  const validation=getValidationErrors(state,ctx);
  if(Object.keys(validation).length){setError('Please complete the highlighted details.');return}
  try{
   if(selectedFact&&Number(state.amount)*100>Number(selectedFact.outstanding)+0.5)throw Error(`The amount is more than the open ${documentKind.toLowerCase()} balance of ${formatMoney(Number(selectedFact.outstanding)/100)}.`);
   const built=buildSimpleJournal({state,ctx,organization:organisation?.name||'',branch:branch?.name||''});
   const stamp=new Date().toISOString();
   onSave({target,document:selected?{type:documentKind,id:selected.id,number:selected.number}:null,payload:{
    id:initial?.id||crypto.randomUUID(),
    number:initial?.number||'',
    date:state.date,
    type:'Business Transaction',
    reference:state.reference,
    narration:state.name,
    attachments:state.attachments,
    status:target,
    createdBy:initial?.createdBy||'Admin',
    createdAt:initial?.createdAt||stamp,
    modifiedAt:stamp,
    organizationId:organisation?.id||'',
    organizationName:organisation?.name||'',
    branchId:branch?.id||'',
    branchName:branch?.name||'',
    amount:Math.round(Number(state.amount)*100),
    lines:built.lines,
    simpleTransaction:{
     transactionType:type,
     label:transactionTypeLabel(type),
     name:state.name,
     moneyAccount:state.moneyAccount,
     toAccount:state.toAccount,
     categoryAccount:state.category,
     categoryLabel:documentKind?(selected?documentKind+' settlement':''):nameFor(state.category,''),
     counterpartyAccount:documentKind?counterpartyAccount(state,ctx):'',
     partyId:state.partyId,
     partyName:partyLabel,
     documentId:state.documentId,
     documentNumber:selected?.number||'',
     description:state.description,
     externalReference:state.reference,
     amount:state.amount
    }
   }});
  }catch(reason){setError(reason.message)}
 }

 return <section className="rt-page">
  <div className="rt-header">
   <button className="rt-back" type="button" aria-label="Back to Journal Entries" onClick={onBack}><IconArrowLeft size={19}/></button>
   <h1>{editing?'Edit transaction':'Record Transaction'}</h1>
   <ModeToggle mode="simple" onAdvanced={onAdvanced}/>
  </div>
  <form className="rt-shell" onSubmit={event=>{event.preventDefault();commit('Draft')}}>
   <div className="rt-form-card">
    <div className="rt-section-head">
     <h3>Journal details</h3>
     <p>Everything this transaction needs is on this page. A journal reaches the ledger only after it is approved.</p>
    </div>
    {showOrganisation
     ?<Field label="Organisation *" icon={IconBuildingBank}><select value={organisation?.id||''} onChange={event=>chooseOrganisation(event.target.value)}>{organisations.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
     :<Field label="Organisation" icon={IconBuildingBank}><input value={organisation?.name||'Not selected'} readOnly/></Field>}
    {showBranch
     ?<Field label="Branch *" icon={IconBuildingBank}><select value={branch?.id||''} onChange={event=>change('branchId',event.target.value)}>{branches.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
     :<Field label="Branch" icon={IconBuildingBank}><input value={branch?.name||'Not selected'} readOnly/></Field>}
    <Field label="Transaction type *" error={errors.transactionType}>
     <select aria-label="Transaction type" value={type} onChange={event=>change('transactionType',event.target.value)}>
      {TRANSACTION_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select>
    </Field>
    <Field label="Transaction name *" error={errors.name} icon={IconFileText}>
     <input value={state.name} onChange={event=>change('name',event.target.value)} placeholder="e.g. Bought office printer"/>
    </Field>
    <Field label="Date *" error={errors.date} icon={IconCalendar}>
     <input type="date" value={state.date} onChange={event=>change('date',event.target.value)}/>
    </Field>
    {type==='expense'&&<>
     <Field label="Pay From *" error={errors.moneyAccount} icon={IconBuildingBank} hint="Select the account the money was paid from">
      <AccountSelect value={state.moneyAccount} onChange={value=>change('moneyAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
     <Field label="Category *" error={errors.category} icon={IconTag} hint="Choose an expense category">
      <AccountSelect value={state.category} onChange={value=>change('category',value)} options={categoryOptions} placeholder="Select a category"/>
     </Field>
    </>}
    {type==='income'&&<>
     <Field label="Deposit To *" error={errors.moneyAccount} icon={IconBuildingBank} hint="Select the account the money was received into">
      <AccountSelect value={state.moneyAccount} onChange={value=>change('moneyAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
     <Field label="Category *" error={errors.category} icon={IconTag} hint="Choose an income category">
      <AccountSelect value={state.category} onChange={value=>change('category',value)} options={categoryOptions} placeholder="Select a category"/>
     </Field>
    </>}
    {type==='transfer'&&<>
     <Field label="From Account *" error={errors.moneyAccount} icon={IconBuildingBank} hint="Select the account the money moved from">
      <AccountSelect value={state.moneyAccount} onChange={value=>change('moneyAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
     <Field label="To Account *" error={errors.toAccount} icon={IconBuildingBank} hint="Select the account the money moved to">
      <AccountSelect value={state.toAccount} onChange={value=>change('toAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
    </>}
    {type==='customer_payment'&&<>
     <Field label="Customer *" error={errors.partyId} icon={IconUser}>
      <select value={state.partyId} onChange={event=>change('partyId',event.target.value)}>
       <option value="">Choose the customer who paid</option>
       {customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}
      </select>
     </Field>
     <Field label="Invoice" error={errors.documentId} icon={IconReceipt2} hint={!state.partyId?'Choose the customer first.':documentOptions.length?'Optional — choose one to update its paid balance.':'No open invoice for this customer, date and organisation.'}>
      <select value={state.documentId} onChange={event=>change('documentId',event.target.value)} disabled={!documentOptions.length}>
       <option value="">{documentOptions.length?'No invoice — keep this on account':'No open invoice'}</option>
       {documentOptions.map(row=><option key={row.id} value={row.id}>{row.number} · {formatMoney(invoiceBalance(invoicesState,row)/100)} open</option>)}
      </select>
     </Field>
     <Field label="Deposit To *" error={errors.moneyAccount} icon={IconBuildingBank} hint="Select the account the money was received into">
      <AccountSelect value={state.moneyAccount} onChange={value=>change('moneyAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
     <DocumentFacts kind="Invoice" row={selected} balance={selectedFact?.outstanding}/>
    </>}
    {type==='vendor_payment'&&<>
     <Field label="Vendor *" error={errors.partyId} icon={IconUser}>
      <select value={state.partyId} onChange={event=>change('partyId',event.target.value)}>
       <option value="">Choose the vendor who was paid</option>
       {vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
      </select>
     </Field>
     <Field label="Bill" error={errors.documentId} icon={IconReceipt2} hint={!state.partyId?'Choose the vendor first.':documentOptions.length?'Optional — choose one to update its paid balance.':'No open bill for this vendor, date and organisation.'}>
      <select value={state.documentId} onChange={event=>change('documentId',event.target.value)} disabled={!documentOptions.length}>
       <option value="">{documentOptions.length?'No bill — keep this on account':'No open bill'}</option>
       {documentOptions.map(row=><option key={row.id} value={row.id}>{row.number} · {formatMoney(billBalance(row)/100)} open</option>)}
      </select>
     </Field>
     <Field label="Pay From *" error={errors.moneyAccount} icon={IconBuildingBank} hint="Select the account the money was paid from">
      <AccountSelect value={state.moneyAccount} onChange={value=>change('moneyAccount',value)} options={cash} placeholder="Select an account"/>
     </Field>
     <DocumentFacts kind="Bill" row={selected} balance={selectedFact?.outstanding}/>
    </>}
    <Field label="Amount *" error={errors.amount}>
     <span className="rt-currency">₹</span>
     <input type="number" min="0.01" step="0.01" value={state.amount} onChange={event=>change('amount',event.target.value)} placeholder="0.00"/>
    </Field>
    <details className="rt-details"><summary><span>Additional details</span><small>Description, reference and attachments (optional)</small><IconChevronDown size={17}/></summary>
     <div>
      <Field label="Description"><input value={state.description} onChange={event=>change('description',event.target.value)} placeholder="Add a description"/></Field>
      <Field label="Reference number"><input value={state.reference} onChange={event=>change('reference',event.target.value)} placeholder="Reference number"/></Field>
      <div className="rt-field"><span>Attachment</span><label className="rt-attach-button"><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={async event=>{const files=[...event.target.files];if(files.length){const attached=await readAttachments(files);setState(current=>({...current,attachments:[...(current.attachments||[]),...attached]}))}event.target.value=''}}/><IconPaperclip size={16}/>Attach files</label></div>
      <p className="rt-note">GST is determined by the invoice, bill or document you settle. A manual journal posts exactly the amount you enter.</p>
      {state.attachments?.length>0&&<ul className="rt-selected-files">{state.attachments.map((file,index)=>{const fileName=typeof file==='string'?file:file.name||`Attachment ${index+1}`;return <li key={`${fileName}-${index}`}>{fileName}<button type="button" aria-label={`Remove ${fileName}`} onClick={()=>setState(current=>({...current,attachments:current.attachments.filter((_,position)=>position!==index)}))}><IconX size={14}/></button></li>})}</ul>}
     </div>
    </details>
   </div>
   <footer className="rt-footer">
    {error&&<p className="rt-error" role="alert">{error}</p>}
    <div className="rt-footer-note">
     <p className="rt-summary">{summary}</p>
     <span className="rt-accounting">
      <button type="button" className="rt-accounting-trigger" aria-expanded={showEntry} aria-describedby="rt-accounting-tip" onClick={()=>setShowEntry(value=>!value)}><IconFileText size={16}/>View accounting entry</button>
      {showEntry&&<span className="rt-accounting-tip" id="rt-accounting-tip" role="tooltip">
       <span><b>Dr</b>{accounting.debit}<em>{amountPreview}</em></span>
       <span><b>Cr</b>{accounting.credit}<em>{amountPreview}</em></span>
      </span>}
     </span>
    </div>
    <div className="rt-actions">
     <button type="button" onClick={onBack}>Cancel</button>
     <button type="button" className="primary" onClick={()=>commit('Draft')}>Save draft</button>
     <button type="button" onClick={()=>commit('Pending Approval')}>Submit for approval</button>
     {journalAllowed(role,'post')&&<button type="button" className="primary" onClick={()=>commit('Approved')}>Publish now</button>}
    </div>
   </footer>
  </form>
 </section>;
}
