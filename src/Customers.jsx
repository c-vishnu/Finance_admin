import {useEffect,useState} from 'react';
import {IconArrowLeft,IconBan,IconBook2,IconCircleCheck,IconCopy,IconDots,IconEdit,IconEye,IconHistory,IconInfoCircle,IconPlus,IconReceipt,IconSearch,IconTrash,IconUsers,IconX} from '@tabler/icons-react';
import './items.css';
import './customers.css';
import {KEY,initial as emptyAccounting} from './invoice-engine.js';
import {customerCreditSummary,customerStatement} from './credit-note-service.js';

const CUSTOMERS_KEY='wayvida-customers';
const SALES_ORDERS_KEY='wayvida-sales-orders';
const DEFAULT_TAB='Basic Data';
const DETAIL_TABS=['Basic Data','Transactions','History'];
const readAccounting=()=>{try{return JSON.parse(localStorage.getItem(KEY))||emptyAccounting()}catch{return emptyAccounting()}};
const readCustomers=()=>{try{const stored=JSON.parse(localStorage.getItem(CUSTOMERS_KEY));return Array.isArray(stored)?stored:customerSeeds}catch{return customerSeeds}};
const readSalesOrders=()=>{try{const stored=JSON.parse(localStorage.getItem(SALES_ORDERS_KEY));return Array.isArray(stored)?stored:[]}catch{return []}};
const trail=row=>Array.isArray(row.auditTrail)?row.auditTrail:[];
/* One dismissal owner for every three-dot menu on the page: the register row menus and the detail header menu share
   the .customerKebab class, so a single page-level pointerdown / Escape effect closes whichever one is open. */
const closeCustomerMenus=()=>document.querySelectorAll('.customerKebab[open]').forEach(node=>node.removeAttribute('open'));
export const nextCustomerCode=rows=>{const used=new Set((rows||[]).map(row=>String(row.code||'').toUpperCase()));let count=0,code='';do{count+=1;code='CUS'+String(count).padStart(3,'0')}while(used.has(code));return code};

const empty={name:'',code:'',type:'Business',contact:'',email:'',phone:'',billing:'',shipping:'',pan:'',gstin:'',state:'',limit:'0',days:'30',opening:'0',account:'1100',status:'Active'};
export const customerSeeds=[{...empty,id:'cus-1',name:'ABC Retail Pvt Ltd',code:'CUS001',contact:'Anjali Menon',email:'accounts@abcretail.example',phone:'9876543210',billing:'MG Road, Kochi',shipping:'MG Road, Kochi',state:'Kerala',limit:'100000',opening:'45000'},{...empty,id:'cus-2',name:'Northstar Services',code:'CUS002',contact:'Rahul Kumar',email:'finance@northstar.example',phone:'9876543211',state:'Karnataka',limit:'75000',opening:'20000'}];
export const customerStates=['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
export default function Customers({accounts,notify,onNavigate}){
 const live=readAccounting();
 const [rows,setRows]=useState(readCustomers);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('All statuses'),[form,setForm]=useState(null),[errors,setErrors]=useState({});
 const [selectedId,setSelectedId]=useState(''),[detailTab,setDetailTab]=useState(DEFAULT_TAB);
 const receivables=(accounts.Assets||[]).filter(x=>/receivable/i.test(x[1]));
 const accountName=code=>Object.values(accounts).flat().find(row=>row[0]===code)?.[1]||code||'Not configured';
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 const money=value=>Number(value||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});
 const audit=(action,detail='')=>({id:crypto.randomUUID(),action,detail,actor:'Admin',at:new Date().toISOString()});
 const persist=next=>{try{localStorage.setItem(CUSTOMERS_KEY,JSON.stringify(next));setRows(next);return true}catch{return false}};
 useEffect(()=>{const onPointerDown=event=>{document.querySelectorAll('.customerKebab[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const onEscape=event=>{if(event.key==='Escape')closeCustomerMenus()};document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onEscape);return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onEscape)}},[]);
 const start=row=>{closeCustomerMenus();setErrors({});setSelectedId('');setForm(row?{...row}:{...empty,account:receivables[0]?.[0]||''})};
 const openDetail=row=>{closeCustomerMenus();setDetailTab(DEFAULT_TAB);setSelectedId(row.id)};
 const openStatement=customer=>{closeCustomerMenus();sessionStorage.setItem('wayvida-credit-customer',customer.id);onNavigate('Customer Statement')};
 function save(e){e.preventDefault();const err={};if(!form.name.trim())err.name='Enter a customer name.';if(!form.code.trim())err.code='Enter a customer code.';else if(rows.some(x=>x.id!==form.id&&x.code.toLowerCase()===form.code.trim().toLowerCase()))err.code='Customer code must be unique.';if(form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))err.email='Enter a valid email address.';if(form.phone&&!/^\+?[\d\s()-]{7,20}$/.test(form.phone))err.phone='Enter a valid phone number.';if(form.pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan))err.pan='Use PAN format ABCDE1234F.';if(form.gstin&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(form.gstin))err.gstin='Enter a valid 15-character GSTIN.';for(const key of ['limit','days','opening']){if(form[key]===''||!Number.isFinite(Number(form[key]))||Number(form[key])<0)err[key]='Enter a non-negative number.';}if(!err.days&&!Number.isInteger(Number(form.days)))err.days='Credit days must be a whole number.';if(!receivables.some(x=>x[0]===form.account))err.account='Select a receivable account.';setErrors(err);if(Object.keys(err).length)return;const row={...form,name:form.name.trim(),code:form.code.trim().toUpperCase(),id:form.id||crypto.randomUUID(),auditTrail:[...trail(form),audit(form.id?'Customer updated':'Customer created')]};const next=form.id?rows.map(x=>x.id===form.id?row:x):[row,...rows];if(!persist(next)){setErrors({save:'Unable to save. Browser storage may be full or unavailable.'});return}setForm(null);notify(form.id?'Customer updated':'Customer created')}
 const toggleStatus=customer=>{const deactivating=customer.status==='Active';const next=rows.map(row=>row.id===customer.id?{...row,status:deactivating?'Inactive':'Active',auditTrail:[...trail(row),audit(deactivating?'Customer deactivated':'Customer activated')]}:row);closeCustomerMenus();if(!persist(next)){notify('Unable to update this customer. Browser storage may be unavailable.');return}notify(deactivating?customer.name+' is now inactive':customer.name+' is now active')};
 const duplicateCustomer=customer=>{const copy={...structuredClone(customer),id:crypto.randomUUID(),name:customer.name+' Copy',code:nextCustomerCode(rows),auditTrail:[audit('Customer duplicated','Created from '+customer.name)]};closeCustomerMenus();if(!persist([copy,...rows])){notify('Unable to duplicate this customer. Browser storage may be unavailable.');return}notify('Customer duplicated')};
 /* A customer that already appears on a document is never deleted - the documents would be left pointing at a
     missing master. Deactivation is the supported way to retire a customer that has history. */
 const referenceCount=id=>[live.invoices,live.payments,live.receipts,live.creditNotes,readSalesOrders()].reduce((total,list)=>total+(Array.isArray(list)?list.filter(row=>row&&(row.customerId===id||row.customer===id)).length:0),0);
 const deleteCustomer=customer=>{closeCustomerMenus();if(referenceCount(customer.id)){notify(customer.name+' has transactions. Mark the customer inactive instead.');return}if(!window.confirm('Delete '+customer.name+'? This cannot be undone.'))return;if(!persist(rows.filter(row=>row.id!==customer.id))){notify('Unable to delete this customer. Browser storage may be unavailable.');return}if(selectedId===customer.id)setSelectedId('');notify('Customer deleted')}; const field=(key,label,type='text',options=null)=> <label key={key}>{label}{options?<select value={form[key]} onChange={e=>update(key,e.target.value)} aria-invalid={!!errors[key]}>{options.map(x=><option key={Array.isArray(x)?x[0]:x} value={Array.isArray(x)?x[0]:x}>{Array.isArray(x)?x[1]:x}</option>)}</select>:type==='textarea'?<textarea value={form[key]} onChange={e=>update(key,e.target.value)}/>:<input autoFocus={key==='name'} type={type} min={type==='number'?0:undefined} step={type==='number'?(key==='days'?1:'0.01'):undefined} value={form[key]} onChange={e=>update(key,['pan','gstin'].includes(key)?e.target.value.toUpperCase():e.target.value)} aria-invalid={!!errors[key]}/>} {errors[key]&&<small className="itemError">{errors[key]}</small>}</label>;
 const visible=rows.filter(x=>[x.name,x.code,x.email,x.contact,x.phone].join(' ').toLowerCase().includes(query.toLowerCase())&&(status==='All statuses'||x.status===status)).map(x=>({...x,credit:customerCreditSummary(live,x.id)}));
 const selected=rows.find(row=>row.id===selectedId)||null;
 if(selected){
  const credit=customerCreditSummary(live,selected.id),entries=customerStatement(live,selected.id),history=[...trail(selected)].reverse();
  return <section className="itemsPage customersPage customerDetailPage">
   <div className="customerDetailHead"><button type="button" className="customerBack" aria-label="Back to Customers" onClick={()=>{setSelectedId('');setDetailTab(DEFAULT_TAB)}}><IconArrowLeft size={19}/></button><h1>Customer Details</h1></div>
   <div className="customerDetailBody">
    <section className="customerDetailPanel">
     <div className="customerDetailIdentity">
      <span><IconUsers size={26}/></span>
      <div className="customerDetailName"><h2>{selected.name}</h2><p>{selected.code||'No customer code'} · {selected.type||'Business'} · {Number(selected.days||0)} credit days</p></div>
      <div className="customerDetailActions"><span className={'customerStatus '+(selected.status==='Active'?'active':'')}>{selected.status||'Active'}</span>
       <button type="button" className="customerDetailEdit" onClick={()=>start(selected)}><IconEdit size={16}/>Edit Customer</button>
       <details className="customerKebab customerDetailMore"><summary aria-label="More customer actions"><IconDots size={17}/></summary>
        <div className="customerMoreMenu">
         <button type="button" onClick={()=>{closeCustomerMenus();setDetailTab('Transactions')}}><IconReceipt size={16}/>View transactions</button>
         <button type="button" onClick={()=>openStatement(selected)}><IconBook2 size={16}/>Statement & credits</button>
         <button type="button" onClick={()=>toggleStatus(selected)}>{selected.status==='Active'?<IconBan size={16}/>:<IconCircleCheck size={16}/>}{selected.status==='Active'?'Deactivate Customer':'Activate Customer'}</button>
         <button type="button" onClick={()=>duplicateCustomer(selected)}><IconCopy size={16}/>Duplicate Customer</button>
         <button type="button" className="customerDanger" onClick={()=>deleteCustomer(selected)}><IconTrash size={16}/>Delete Customer</button>
        </div>
       </details>
      </div>
     </div>
     <nav className="customerDetailTabs" aria-label="Customer detail sections">{DETAIL_TABS.map(tab=><button type="button" key={tab} className={detailTab===tab?'active':''} aria-current={detailTab===tab?'page':undefined} onClick={()=>setDetailTab(tab)}>{tab}{tab==='Transactions'&&<span>{entries.length}</span>}{tab==='History'&&<span>{history.length}</span>}</button>)}</nav>
    </section>

    {detailTab==='Basic Data'&&<div className="customerDetailCardsGrid">
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconUsers size={18}/><h2>Customer details</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Customer code</dt><dd>{selected.code||'—'}</dd></div>
       <div><dt>Customer type</dt><dd>{selected.type||'Business'}</dd></div>
       <div><dt>Status</dt><dd>{selected.status||'Active'}</dd></div>
       <div><dt>Contact person</dt><dd>{selected.contact||'Not provided'}</dd></div>
       <div><dt>Email</dt><dd>{selected.email||'Not provided'}</dd></div>
       <div><dt>Phone</dt><dd>{selected.phone||'Not provided'}</dd></div>
      </dl>
     </section>
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconInfoCircle size={18}/><h2>Addresses & tax information</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Billing address</dt><dd className="customerAddress">{selected.billing||'Not provided'}</dd></div>
       <div><dt>Shipping address</dt><dd className="customerAddress">{selected.shipping||selected.billing||'Not provided'}</dd></div>
       <div><dt>State / place of supply</dt><dd>{selected.state||'Not provided'}</dd></div>
       <div><dt>PAN</dt><dd>{selected.pan||'Not provided'}</dd></div>
       <div><dt>GSTIN</dt><dd>{selected.gstin||'Not registered'}</dd></div>
      </dl>
     </section>
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconReceipt size={18}/><h2>Credit & receivable</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Credit limit</dt><dd>{money(selected.limit)}</dd></div>
       <div><dt>Credit days</dt><dd>{Number(selected.days||0)} days</dd></div>
       <div><dt>Opening balance</dt><dd>{money(selected.opening)}</dd></div>
       <div><dt>Receivable account</dt><dd>{accountName(selected.account)}</dd></div>
       <div><dt>Net receivable</dt><dd>{money(credit.outstanding/100)}</dd></div>
       <div><dt>Available credit</dt><dd>{money(credit.available/100)}</dd></div>
      </dl>
     </section>
    </div>}    {detailTab==='Transactions'&&<section className="customerDetailCard">
     <div className="customerDetailSectionTitle"><IconReceipt size={18}/><h2>Transactions</h2><span>{entries.length}</span><button type="button" className="customerStatementLink" onClick={()=>openStatement(selected)}>Open customer statement</button></div>
     {entries.length?<div className="customerDetailTableWrap">
      <table>
       <thead><tr><th>Date</th><th>Reference</th><th>Source</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
       <tbody>{entries.map(row=><tr key={row.id}><td>{row.date||'—'}</td><td>{row.reference||'—'}</td><td>{row.source||'—'}</td><td>{row.debit?money(row.debit):'—'}</td><td>{row.credit?money(row.credit):'—'}</td><td>{money(row.balance)}</td></tr>)}</tbody>
      </table>
     </div>:<p className="customerDetailEmpty">No transactions reference this customer yet.</p>}
     <p className="customerDetailNote">Posted invoices, receipts, credit notes and their credit allocations from the shared ledger.</p>
    </section>}

    {detailTab==='History'&&<section className="customerDetailCard">
     <div className="customerDetailSectionTitle"><IconHistory size={18}/><h2>Audit log / History</h2><span>{history.length}</span></div>
     {history.length?<ol className="customerHistory">
      {history.map(entry=><li key={entry.id}>
       <span/>
       <div>
        <b>{entry.action}</b>
        {entry.detail?<p>{entry.detail}</p>:null}
        <small>{entry.at?new Date(entry.at).toLocaleString('en-IN'):'Not recorded'} · {entry.actor||'Admin'}</small>
       </div>
      </li>)}
     </ol>:<p className="customerDetailEmpty">No customer history has been recorded yet.</p>}
    </section>}
   </div>
  </section>;
 } return <section className="itemsPage customersPage"><div className="itemsHeading"><div><h1>Customers</h1><p>Manage customer contacts, addresses and credit terms.</p></div><button className="primary" onClick={()=>start()}><IconPlus size={18}/>Create Customer</button></div><div className="itemsCard"><div className="itemsTools"><label><IconSearch size={18}/><input aria-label="Search customers" placeholder="Search name, code, contact or email…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter customer status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Active','Inactive'].map(x=><option key={x}>{x}</option>)}</select><span>{visible.length} customers</span></div><div className="itemsTableWrap"><table><thead><tr>{['Customer Details','Type','Email / Phone','Net receivable','Available credit','Status','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(x=><tr key={x.id}><td><div className="itemIdentity"><span><IconUsers size={20}/></span><span className="itemIdentityCopy"><b>{x.name}</b><small>{x.code||'No customer code'}</small></span></div></td><td>{x.type||'Business'}</td><td><div className="customerContact"><span>{x.email||'—'}</span><small>{x.phone||'—'}</small></div></td><td>{money(x.credit.outstanding/100)}</td><td>{money(x.credit.available/100)}</td><td><span className={'customerStatus '+(x.status==='Active'?'active':'')}>{x.status||'Active'}</span></td><td className="customerActionsCell"><div className="customerRowActions"><button type="button" className="customerView" onClick={()=>openDetail(x)}><IconEye size={16}/>View Customer</button><details className="customerKebab"><summary aria-label={'More actions for '+x.name}><IconDots size={17}/></summary><div className="customerMoreMenu"><button type="button" onClick={()=>start(x)}><IconEdit size={16}/>Edit Customer</button><button type="button" onClick={()=>toggleStatus(x)}>{x.status==='Active'?<IconBan size={16}/>:<IconCircleCheck size={16}/>}{x.status==='Active'?'Deactivate Customer':'Activate Customer'}</button><button type="button" onClick={()=>duplicateCustomer(x)}><IconCopy size={16}/>Duplicate Customer</button><button type="button" className="customerDanger" onClick={()=>deleteCustomer(x)}><IconTrash size={16}/>Delete Customer</button></div></details></div></td></tr>)}</tbody></table>{!visible.length&&<div className="itemsEmpty"><IconUsers size={32}/><h3>No customers found</h3><p>Try another search or create a customer.</p></div>}</div></div> {form&&<form className="itemCreatePage" aria-labelledby="customerDialogTitle" onSubmit={save} noValidate>
 <div className="itemDialogHead"><button type="button" className="itemBack" aria-label="Back to Customers" onClick={()=>setForm(null)}><IconArrowLeft size={19}/></button><div className="itemHeadText"><h2 id="customerDialogTitle">{form.id?'Edit Customer':'Create Customer'}</h2>{form.id&&<small className="itemHeadHint">Editing <b>{form.name||form.code}</b></small>}</div></div>
 <div className="itemDialogBody">
  <section className="itemSection">
   <div className="itemSectionTitle">Customer details</div>
   <div className="itemFormGrid">{field('name','Customer Name *')}{field('code','Customer Code *')}{field('type','Customer Type','text',['Business','Individual'])}{field('contact','Contact Person')}{field('email','Email','email')}{field('phone','Phone','tel')}</div>
  </section>
  <section className="itemSection">
   <div className="itemSectionTitle">Addresses & tax information</div>
   <div className="itemFormGrid">{field('billing','Billing Address','textarea')}{field('shipping','Shipping Address','textarea')}{field('pan','PAN')}{field('gstin','GSTIN')}{field('state','State','text',[['','Select state'],...customerStates])}</div>
   <button type="button" className="copyAddress" onClick={()=>update('shipping',form.billing)}>Copy billing to shipping address</button>
  </section>
  <section className="itemSection">
   <div className="itemSectionTitle">Credit & accounting</div>
   <div className="itemFormGrid">{field('limit','Credit Limit (₹)','number')}{field('days','Credit Days','number')}{field('opening','Opening Balance (₹)','number')}{field('account','Receivable Account *','text',[['','Select account'],...receivables.map(x=>[x[0],`${x[0]} — ${x[1]}`])])}{field('status','Status','text',['Active','Inactive'])}</div>
  </section>
  {errors.save&&<p className="itemError itemSaveError" role="alert">{errors.save}</p>}
 </div>
 <footer className="itemDialogFooter"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary">{form.id?'Save changes':'Create Customer'}</button></footer>
</form>}
</section>;
}
