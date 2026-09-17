import {useState} from 'react';
import {IconArrowLeft,IconBan,IconCircleCheck,IconCopy,IconDots,IconEdit,IconEye,IconHistory,IconInfoCircle,IconPackage,IconPhotoPlus,IconPlus,IconReceipt,IconSearch,IconTrash} from '@tabler/icons-react';
import {blankItem,generateSku,gstSplit,itemOrganisationIds,ITEM_CESS_RATES,ITEM_TAX_RATES,ITEM_TAX_TREATMENTS,ITEM_UNITS,openingValue,validateItem} from './item-master.js';
import {readAccounts,writeAccounts} from './account-store.js';
import {journal,minor} from './invoice-engine.js';
import {getScopeOrganisations} from './organisation-context.js';
import OrganisationBranchScope from './OrganisationBranchScope.jsx';
import './items.css';

const base=blankItem({salesAccount:'4000',purchaseAccount:'5000',inventoryAccount:'1200',cogsAccount:'5000'});
const seed=[{...base,id:'item-1',name:'Office stationery box',sku:'ITEM-0001',unit:'box',category:'Products',hsnSac:'4820',price:'850',cost:'600'},{...base,id:'item-2',name:'Consulting service',sku:'ITEM-0002',type:'Service',unit:'hour',category:'Services',hsnSac:'9983',price:'2500',salesAccount:'4100',purchase:false,trackInventory:false}];
export {seed as itemSeeds};
const currentContext=()=>({organizationId:localStorage.getItem('wayvida-demo-company')||'abc',warehouseId:localStorage.getItem('wayvida-demo-branch')||'Kochi Branch',currency:'INR'});
const firstMatch=(rows,pattern)=>rows.find(row=>pattern.test(row[1]))?.[0]||rows[0]?.[0]||'';
const itemDefaults=(accounts,type='Goods')=>({...currentContext(),taxRate:'18',salesAccount:firstMatch(accounts.Income||[],type==='Service'?/service/i:/sales|income/i),purchaseAccount:firstMatch(accounts.Expenses||[],type==='Service'?/professional|service|expense/i:/cost of goods|purchase|direct/i),inventoryAccount:firstMatch(accounts.Assets||[],/inventory|stock/i),cogsAccount:firstMatch(accounts.Expenses||[],/cost of goods|purchase|direct/i)});
const legacyItem=(item,defaults)=>{const organizationIds=itemOrganisationIds(item),branchIds=Array.from(new Set([...(item.branchIds||[]),item.warehouseId].filter(Boolean)));return {...blankItem(defaults),...item,organizationIds,branchIds,active:item.active!==false,auditTrail:Array.isArray(item.auditTrail)?item.auditTrail:[],taxPreference:item.taxPreference||(item.taxApplicable===false?'Non-taxable':'Taxable'),interStateTaxRate:String(item.interStateTaxRate||item.taxRate||defaults.taxRate||'18')}};
function Section({title,children}){return <section className="itemSection">{title&&<div className="itemSectionTitle">{title}</div>}{children}</section>}

export default function Items({accounts,seed:accountSeed,notify}){
 const organisations=getScopeOrganisations();
 const contextDefaults=itemDefaults(accounts),contextOrganisation=organisations.find(org=>org.code===contextDefaults.organizationId||org.id===contextDefaults.organizationId),contextBranch=(contextOrganisation?.branches||[]).find(branch=>branch.id===contextDefaults.warehouseId||branch.name===contextDefaults.warehouseId);
 const defaults={...contextDefaults,organizationIds:[contextDefaults.organizationId],branchIds:contextBranch?[contextBranch.id]:[],warehouseId:contextBranch?.id||contextDefaults.warehouseId};
 const [items,setItems]=useState(()=>{try{return (JSON.parse(localStorage.getItem('finance-erp-items'))||seed).map(item=>legacyItem(item,defaults))}catch{return seed.map(item=>legacyItem(item,defaults))}}),[query,setQuery]=useState(''),[filter,setFilter]=useState('All types'),[form,setForm]=useState(null),[errors,setErrors]=useState({}),[uploadBusy,setUploadBusy]=useState(false),[selectedId,setSelectedId]=useState(''),[detailTab,setDetailTab]=useState('Basic Data');
 const set=(key,value)=>setForm(current=>({...current,[key]:value}));
 const start=(item=null)=>{setSelectedId('');setForm(item?legacyItem(item,defaults):blankItem(defaults));setErrors({})};
 const changeType=type=>setForm(current=>({...current,type,unit:type==='Service'?'hour':'pcs',hsnSac:'',trackInventory:type==='Goods',...itemDefaults(accounts,type)}));
 async function upload(e){const file=e.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setErrors(x=>({...x,image:'Choose a JPG, PNG or WebP image up to 2 MB.'}));e.target.value='';return}setUploadBusy(true);const reader=new FileReader();reader.onload=()=>{set('image',reader.result);setErrors(x=>({...x,image:''}));setUploadBusy(false)};reader.onerror=()=>{setErrors(x=>({...x,image:'Unable to read image. Try another file.'}));setUploadBusy(false)};reader.readAsDataURL(file)}
 const persist=next=>{localStorage.setItem('finance-erp-items',JSON.stringify(next));setItems(next)};
 const audit=(action,detail='')=>({id:crypto.randomUUID(),action,detail,actor:'Admin',at:new Date().toISOString()});
 function save(e){e.preventDefault();const nextErrors=validateItem(form,items,accounts);setErrors(nextErrors);if(Object.keys(nextErrors).length)return;const isNew=!form.id,id=form.id||crypto.randomUUID(),taxable=form.taxPreference==='Taxable',organizationIds=itemOrganisationIds(form),branchIds=Array.from(new Set(form.branchIds||[]));const item={...form,id,organizationIds,organizationId:organizationIds[0]||form.organizationId,branchIds,warehouseId:form.warehouseId||branchIds[0]||'',name:form.name.trim(),sku:form.sku.trim(),taxApplicable:taxable,taxRate:taxable?String(form.taxRate):'0',cessRate:taxable?String(form.cessRate||0):'0',interStateTaxRate:taxable?String(form.interStateTaxRate||form.taxRate||0):'0',mappingEffectiveFrom:new Date().toISOString(),auditTrail:[...(form.auditTrail||[]),audit(isNew?'Item created':'Item updated')]};delete item.vendor;const next=form.id?items.map(x=>x.id===form.id?item:x):[item,...items];let accounting=null;try{if(isNew&&form.type==='Goods'&&form.trackInventory&&openingValue(form)>0){accounting=structuredClone(readAccounts(accountSeed||accounts));const amount=minor(openingValue(form).toFixed(2));const offset=accounting.accounts.find(a=>a.active&&!a.isGroup&&a.type==='Equity');if(!offset)throw Error('An active Equity account is required to post the opening stock value.');const entry=journal(accounting,{id,number:item.sku||item.name,organizationId:item.organizationId,branchId:item.warehouseId,role:'Admin',periodModule:'Inventory'},'Inventory Opening Balance',[{account:item.inventoryAccount,debit:amount,credit:0,branch:item.warehouseId},{account:offset.code,debit:0,credit:amount,branch:item.warehouseId}],item.openingDate,'item-opening:'+id);item.openingJournalId=entry.id;}localStorage.setItem('finance-erp-items',JSON.stringify(next));if(accounting)writeAccounts(accounting)}catch(error){setErrors({save:error.message||'Unable to save this item.'});return}setItems(next);setForm(null);notify(form.id?'Item updated':'Item created')}
 const toggleItem=item=>{const next=items.map(row=>row.id===item.id?{...row,active:row.active===false,auditTrail:[...(row.auditTrail||[]),audit(row.active===false?'Item enabled':'Item disabled')]}:row);persist(next);notify(item.active===false?'Item enabled':'Item disabled')};
 const duplicateItem=item=>{const copy={...legacyItem(item,defaults),id:crypto.randomUUID(),name:item.name+' Copy',sku:generateSku(items,item.organizationId),openingQuantity:'',openingRate:'',openingJournalId:'',auditTrail:[audit('Item duplicated','Created from '+item.name)]};persist([copy,...items]);notify('Item duplicated')};
 const deleteItem=item=>{if(!window.confirm('Delete '+item.name+'? This cannot be undone.'))return;persist(items.filter(row=>row.id!==item.id));if(selectedId===item.id)setSelectedId('');notify('Item deleted')};
 const visible=items.filter(x=>(x.name+' '+x.sku+' '+x.hsnSac).toLowerCase().includes(query.toLowerCase())&&(filter==='All types'||x.type===filter)),money=value=>Number(value).toLocaleString('en-IN',{style:'currency',currency:'INR'});
 const selected=items.find(item=>item.id===selectedId)||null;
 let accountingState={journals:[],invoices:[],purchases:[],inventoryAdjustments:[]};try{accountingState=readAccounts(accountSeed||accounts)}catch{}
 const itemTransactions=item=>[
  ...(accountingState.journals||[]).filter(row=>row.id===item.openingJournalId||row.sourceId===item.id||(row.lines||[]).some(line=>line.itemId===item.id)).map(row=>({id:row.id,type:'Journal',number:row.number||row.id,date:row.date,status:row.status||'Posted'})),
  ...(accountingState.invoices||[]).filter(row=>(row.lines||row.items||[]).some(line=>line.itemId===item.id||line.item===item.id)).map(row=>({id:row.id,type:'Sales invoice',number:row.number||row.id,date:row.date,status:row.status||'Draft'})),
  ...(accountingState.purchases||[]).filter(row=>(row.lines||row.items||[]).some(line=>line.itemId===item.id||line.item===item.id)).map(row=>({id:row.id,type:'Purchase',number:row.number||row.id,date:row.date,status:row.status||'Draft'})),
  ...(accountingState.inventoryAdjustments||[]).filter(row=>(row.lines||[]).some(line=>line.itemId===item.id)).map(row=>({id:row.id,type:'Inventory adjustment',number:row.number||row.id,date:row.date,status:row.status||'Draft'}))
 ].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const organisationNames=item=>itemOrganisationIds(item).map(id=>organisations.find(org=>org.code===id||org.id===id)?.name||id);
 const branchNames=item=>(item.branchIds||[]).map(id=>organisations.flatMap(org=>org.branches||[]).find(branch=>branch.id===id||branch.name===id)?.name||id);
 const accountName=code=>Object.values(accounts).flat().find(row=>row[0]===code)?.[1]||code||'Not configured';
 const gstPercent=value=>{const rate=Math.max(0,Number(value)||0);return (Number.isInteger(rate)?rate:Number(rate.toFixed(2)))+'%'};
 const isTaxable=form?.taxPreference==='Taxable',taxSplit=gstSplit(form?.taxRate),interTaxSplit=gstSplit(form?.interStateTaxRate);
 const setTaxable=yes=>set('taxPreference',yes?'Taxable':(ITEM_TAX_TREATMENTS.includes(form?.taxPreference)?form.taxPreference:'Non-taxable'));
 const changeScope=scope=>setForm(current=>({...current,organizationIds:scope.companyIds,organizationId:scope.companyIds[0]||'',branchIds:scope.branchIds,warehouseId:scope.branchIds.includes(current.warehouseId)?current.warehouseId:(scope.branchIds[0]||'')}));
 const priceField=(label,key,required=false)=><label>{label}{required?' *':''}<input type="number" min="0" step="0.01" value={form[key]} onChange={e=>set(key,e.target.value)} aria-invalid={!!errors[key]}/>{errors[key]&&<small className="itemError">{errors[key]}</small>}</label>;
 const accountField=(label,group,key,pattern)=>{const all=accounts[group]||[],preferred=all.filter(row=>pattern.test(row[1])),rows=preferred.length?preferred:all;return <label>{label} *<select value={form[key]} onChange={e=>set(key,e.target.value)} aria-invalid={!!errors[key]}><option value="">Select an account</option>{rows.map(x=><option value={x[0]} key={x[0]}>{x[0]} — {x[1]}</option>)}</select><small className={errors[key]?'itemError':''}>{errors[key]||'From your Chart of Accounts'}</small></label>};
 const openingStockDetails=!form?.id&&form?.type==='Goods'&&form?.trackInventory?<details className="itemSubDetails"><summary>Opening stock <span>Optional</span></summary><div className="itemFormGrid"><label>Quantity<input type="number" min="0" step="0.001" value={form.openingQuantity} onChange={e=>set('openingQuantity',e.target.value)} aria-invalid={!!errors.openingQuantity}/>{errors.openingQuantity&&<small className="itemError">{errors.openingQuantity}</small>}</label><label>Rate ({form.currency})<input type="number" min="0" step="0.01" value={form.openingRate} onChange={e=>set('openingRate',e.target.value)} aria-invalid={!!errors.openingRate}/>{errors.openingRate&&<small className="itemError">{errors.openingRate}</small>}</label><label>Opening value<output>{money(openingValue(form))}</output><small>Quantity × rate, calculated automatically</small></label><label>Branch / warehouse *<input value={form.warehouseId} onChange={e=>set('warehouseId',e.target.value)} aria-invalid={!!errors.warehouseId}/>{errors.warehouseId&&<small className="itemError">{errors.warehouseId}</small>}</label><label>As of date<input type="date" value={form.openingDate} onChange={e=>set('openingDate',e.target.value)}/></label></div><p className="itemNotice"><IconInfoCircle size={16}/>A balanced inventory opening journal is posted only when quantity and rate create a value.</p></details>:null;
  if(selected){
    const transactions=itemTransactions(selected),history=[...(selected.auditTrail||[])].reverse();
    return <section className="itemsPage itemDetailPage">
      <div className="itemDetailHead"><button type="button" className="itemBack" aria-label="Back to Items" onClick={()=>{setSelectedId('');setDetailTab('Basic Data')}}>
          <IconArrowLeft size={19}/>
        </button><h1>Item Details</h1></div><div className="itemDetailBody">
        <section className="itemDetailPanel">
          <div className="itemDetailIdentity">
            {selected.image?<img src={selected.image} alt=""/>:<span><IconPackage size={26}/></span>}
            <div className="itemDetailName">
              <h2>{selected.name}</h2>
              <p>{selected.sku||'No SKU'} · {selected.type} · {selected.unit} · {selected.type==='Goods'?'HSN':'SAC'} {selected.hsnSac||'Not provided'}</p>
            </div>
            <div className="itemDetailActions"><span className={'itemStatus '+(selected.active===false?'disabled':'active')}>{selected.active===false?'Disabled':'Active'}</span>
              <button type="button" className="itemDetailEdit" onClick={()=>start(selected)}>
                <IconEdit size={16}/>Edit Item
              </button>
              <details className="itemMore itemDetailMore"><summary aria-label="More item actions"><IconDots size={17}/></summary>
                <div className="itemMoreMenu">
                  <button type="button" onClick={()=>toggleItem(selected)}>
                    {selected.active===false?<IconCircleCheck size={16}/>:<IconBan size={16}/>} {selected.active===false?'Enable Item':'Disable Item'}
                  </button>
                  <button type="button" onClick={()=>duplicateItem(selected)}>
                    <IconCopy size={16}/>Duplicate Item
                  </button>
                  <button type="button" className="itemDanger" onClick={()=>deleteItem(selected)}>
                    <IconTrash size={16}/>Delete
                  </button>
                </div>
              </details>
            </div>
          </div>
          <nav className="itemDetailTabs" aria-label="Item detail sections">
            {['Basic Data','Transactions','History'].map(tab=><button type="button" key={tab} className={detailTab===tab?'active':''} aria-current={detailTab===tab?'page':undefined} onClick={()=>setDetailTab(tab)}>
              {tab}
              {tab==='Transactions'&&<span>{transactions.length}</span>}
              {tab==='History'&&<span>{history.length}</span>}
            </button>)}
          </nav>
        </section>

        {detailTab==='Basic Data'&&<div className="itemDetailCardsGrid">
          <section className="itemDetailCard">
            <div className="itemDetailSectionTitle">
              <IconInfoCircle size={18}/>
              <h2>Basic data</h2>
            </div>
            <dl className="itemDetailFacts">
              <div><dt>SKU</dt><dd>{selected.sku||'—'}</dd></div>
              <div><dt>Type</dt><dd>{selected.type}</dd></div>
              <div><dt>Unit</dt><dd>{selected.unit}</dd></div>
              <div><dt>{selected.type==='Goods'?'HSN code':'SAC code'}</dt><dd>{selected.hsnSac||'—'}</dd></div>
              <div><dt>Organisations</dt><dd>{organisationNames(selected).join(', ')||'—'}</dd></div>
              <div><dt>Branches</dt><dd>{branchNames(selected).join(', ')||'All branches'}</dd></div>
            </dl>
          </section>

          <section className="itemDetailCard">
            <div className="itemDetailSectionTitle">
              <IconReceipt size={18}/>
              <h2>Sales & Purchases</h2>
            </div>
            <dl className="itemDetailFacts">
              <div><dt>Selling price</dt><dd>{selected.sales?money(selected.price):'Not sold'}</dd></div>
              <div><dt>Purchase price</dt><dd>{selected.purchase&&selected.cost!==''?money(selected.cost):'Not purchased'}</dd></div>
              <div><dt>Tax treatment</dt><dd>{selected.taxPreference||'Non-taxable'}</dd></div>
              <div><dt>GST / IGST</dt><dd>{selected.taxApplicable===false?'Not applicable':`${selected.taxRate||0}% / ${selected.interStateTaxRate||selected.taxRate||0}%`}</dd></div>
              <div><dt>Sales account</dt><dd>{accountName(selected.salesAccount)}</dd></div>
              <div><dt>Purchase account</dt><dd>{accountName(selected.purchaseAccount)}</dd></div>
            </dl>
          </section>

          <section className="itemDetailCard">
            <div className="itemDetailSectionTitle">
              <IconPackage size={18}/>
              <h2>Inventory & Stock</h2>
            </div>
            <dl className="itemDetailFacts">
              <div><dt>Track inventory</dt><dd>{selected.trackInventory?'Yes':'No'}</dd></div>
              <div><dt>Inventory asset</dt><dd>{accountName(selected.inventoryAccount)}</dd></div>
              <div><dt>Cost of goods sold</dt><dd>{accountName(selected.cogsAccount)}</dd></div>
              <div><dt>Opening stock</dt><dd>{selected.openingQuantity||'0'} {selected.unit} at {selected.openingRate?money(selected.openingRate):'—'}</dd></div>
            </dl>
          </section>
        </div>}

        {detailTab==='Transactions'&&<section className="itemDetailCard">
          <div className="itemDetailSectionTitle">
            <IconReceipt size={18}/>
            <h2>Transactions</h2>
            <span>{transactions.length}</span>
          </div>
          {transactions.length?<div className="itemDetailTableWrap">
            <table>
              <thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>{transactions.map(row=><tr key={row.type+row.id}><td>{row.date||'—'}</td><td>{row.type}</td><td>{row.number}</td><td>{row.status}</td></tr>)}</tbody>
            </table>
          </div>:<p className="itemDetailEmpty">No transactions reference this item yet.</p>}
        </section>}

        {detailTab==='History'&&<section className="itemDetailCard">
          <div className="itemDetailSectionTitle">
            <IconHistory size={18}/>
            <h2>Audit log / History</h2>
            <span>{history.length}</span>
          </div>
          {history.length?<ol className="itemHistory">
            {history.map(entry=><li key={entry.id}>
              <span></span>
              <div>
                <b>{entry.action}</b>
                {entry.detail&&<p>{entry.detail}</p>}
                <small>{entry.actor||'Admin'} · {entry.at?new Date(entry.at).toLocaleString('en-IN'):'Time not recorded'}</small>
              </div>
            </li>)}
          </ol>:<p className="itemDetailEmpty">No item history has been recorded yet.</p>}
        </section>}
      </div>
    </section>;
  }
 return <section className="itemsPage"><div className="itemsHeading"><div><h1>Items</h1><p>Manage the goods and services you sell and purchase.</p></div><button className="primary" onClick={()=>start()}><IconPlus size={18}/>Create Item</button></div><div className="itemsCard"><div className="itemsTools"><label><IconSearch size={18}/><input aria-label="Search items" placeholder="Search name, SKU or HSN/SAC…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter item type" value={filter} onChange={e=>setFilter(e.target.value)}><option>All types</option><option>Goods</option><option>Service</option></select><span>{visible.length} items</span></div><div className="itemsTableWrap"><table><thead><tr><th>Item Details</th><th>Type</th><th>Unit</th><th>Selling price</th><th>Purchase price</th><th>Default tax</th><th>Actions</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><div className="itemIdentity">{item.image?<img src={item.image} alt=""/>:<span><IconPackage size={20}/></span>}<span className="itemIdentityCopy"><b>{item.name}</b><small>{item.sku||'No SKU'} · {item.type==='Goods'?'HSN':'SAC'} {item.hsnSac||'Not provided'}</small></span></div></td><td><span className="itemType">{item.type}</span>{item.active===false&&<span className="itemDisabledBadge">Disabled</span>}</td><td>{item.unit}</td><td>{item.sales?money(item.price):'—'}</td><td>{item.purchase&&item.cost!==''?money(item.cost):'—'}</td><td>{item.taxPreference==='Exempt'?'Exempt':item.taxApplicable===false?'Non-taxable':`GST ${item.taxRate||18}% · ${item.priceTaxMode==='inclusive'?'Inclusive':'Exclusive'}`}</td><td><div className="itemRowActions"><button type="button" className="itemView" onClick={()=>setSelectedId(item.id)}><IconEye size={16}/>View Details</button><details className="itemMore"><summary aria-label={'More actions for '+item.name}><IconDots size={17}/></summary><div className="itemMoreMenu"><button type="button" onClick={()=>start(item)}><IconEdit size={16}/>Edit Item</button><button type="button" onClick={()=>toggleItem(item)}>{item.active===false?<IconCircleCheck size={16}/>:<IconBan size={16}/>} {item.active===false?'Enable Item':'Disable Item'}</button><button type="button" onClick={()=>duplicateItem(item)}><IconCopy size={16}/>Duplicate Item</button><button type="button" className="itemDanger" onClick={()=>deleteItem(item)}><IconTrash size={16}/>Delete</button></div></details></div></td></tr>)}</tbody></table>{!visible.length&&<div className="itemsEmpty"><IconPackage size={32}/><h3>No items found</h3><p>{query?'Try another search.':'Create your first item to get started.'}</p></div>}</div></div>{form&&<form className="itemCreatePage" aria-labelledby="itemDialogTitle" onSubmit={save} noValidate><div className="itemDialogHead"><button type="button" className="itemBack" aria-label="Back to Items" onClick={()=>setForm(null)}><IconArrowLeft size={19}/></button><div className="itemHeadText"><h2 id="itemDialogTitle">{form.id?'Edit Item':'Create Item'}</h2>{form.id&&<small className="itemHeadHint">Editing <b>{form.name||form.sku}</b></small>}</div></div><div className="itemDialogBody">
 <Section title="Basic information"><div className="itemFormGrid"><label>Item name *<input autoFocus value={form.name} onChange={e=>set('name',e.target.value)} aria-invalid={!!errors.name}/>{errors.name&&<small className="itemError">{errors.name}</small>}</label><fieldset className="itemTypeField"><legend>Item type *</legend><div className="itemRadioGroup">{['Goods','Service'].map(value=><label key={value}><input type="radio" name="item-type" value={value} checked={form.type===value} onChange={()=>changeType(value)}/><span>{value}</span></label>)}</div></fieldset></div><div className="itemFormGrid itemFormGrid3"><label>SKU <span className="itemInputAction"><input value={form.sku} onChange={e=>set('sku',e.target.value)} placeholder="Optional unique code" aria-invalid={!!errors.sku}/><button type="button" onClick={()=>set('sku',generateSku(items,form.organizationId))}>Generate</button></span>{errors.sku&&<small className="itemError">{errors.sku}</small>}</label><label>{form.type==='Goods'?'HSN':'SAC'} code<input inputMode="numeric" maxLength={8} value={form.hsnSac} onChange={e=>set('hsnSac',e.target.value.replace(/\D/g,''))} placeholder="Optional" aria-invalid={!!errors.hsnSac}/>{errors.hsnSac&&<small className="itemError">{errors.hsnSac}</small>}</label><label>Unit *<select value={form.unit} onChange={e=>set('unit',e.target.value)}>{ITEM_UNITS.map(value=><option key={value}>{value}</option>)}</select></label></div><div className="itemScopeField"><span>Organisations and branches *</span><OrganisationBranchScope organisations={organisations} companyIds={form.organizationIds||[form.organizationId]} branchIds={form.branchIds||[]} onChange={changeScope} label="Item availability" showLine={false} multiple/>{errors.organizationIds&&<small className="itemError">{errors.organizationIds}</small>}</div></Section>
 <Section><label className="itemCheck"><input type="checkbox" role="switch" checked={form.sales} onChange={e=>set('sales',e.target.checked)}/><span><b>Sell this item</b><small>Show it in sales invoices and credit notes.</small></span></label>{form.sales&&<div className="itemFormGrid">{priceField(`Selling price (${form.currency})`,'price',true)}{accountField('Sales Account','Income','salesAccount',/sales|service|income/i)}</div>}</Section>
 <Section><label className="itemCheck"><input type="checkbox" role="switch" checked={form.purchase} onChange={e=>set('purchase',e.target.checked)}/><span><b>Purchase this item</b><small>Show it in purchase bills and expenses.</small></span></label>{form.purchase&&<div className="itemFormGrid">{priceField(`Purchase price (${form.currency})`,'cost')}{accountField('Purchase Account','Expenses','purchaseAccount',form.type==='Service'?/professional|service|expense/i:/cost of goods|purchase|direct/i)}</div>}</Section>
 {form.type==='Goods'&&<Section><label className="itemCheck"><input type="checkbox" role="switch" checked={form.trackInventory} onChange={e=>set('trackInventory',e.target.checked)}/><span><b>Track inventory</b><small>Keep quantity and stock value up to date.</small></span></label>{form.trackInventory&&<div className="itemFormGrid">{accountField('Inventory Asset Account','Assets','inventoryAccount',/inventory|stock/i)}{accountField('Cost of Goods Sold Account','Expenses','cogsAccount',/cost of goods|purchase|direct/i)}</div>}</Section>}
 <details className="itemAdvanced"><summary>Advanced settings <span>Optional</span></summary>{openingStockDetails&&<div className="itemAdvancedGroup itemOpeningStockGroup">{openingStockDetails}</div>}<div className="itemAdvancedGroup"><div className="itemAdvancedTitle">Tax settings</div><div className="itemTaxHead"><span className="itemTaxLabel">Tax treatment</span><div className="itemSegmented" role="group" aria-label="Tax treatment">{['Taxable','Non-taxable'].map(value=><button type="button" key={value} className={isTaxable===(value==='Taxable')?'active':''} aria-pressed={isTaxable===(value==='Taxable')} onClick={()=>setTaxable(value==='Taxable')}>{value}</button>)}</div>{!isTaxable&&<span className="itemTaxHint">This item is not subject to GST.</span>}</div>{isTaxable&&<><div className="itemFormGrid itemTaxFormGrid"><label>Intra-State Tax Rate *<select value={form.taxRate} onChange={e=>set('taxRate',e.target.value)} aria-invalid={!!errors.taxRate}>{ITEM_TAX_RATES.map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select>{errors.taxRate&&<small className="itemError">{errors.taxRate}</small>}</label><label>Inter-State Tax Rate *<select value={form.interStateTaxRate} onChange={e=>set('interStateTaxRate',e.target.value)} aria-invalid={!!errors.interStateTaxRate}>{ITEM_TAX_RATES.map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select>{errors.interStateTaxRate&&<small className="itemError">{errors.interStateTaxRate}</small>}</label><label>Cess rate<select value={form.cessRate} onChange={e=>set('cessRate',e.target.value)}>{ITEM_CESS_RATES.map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select></label><label>Price includes tax?<select value={form.priceTaxMode} onChange={e=>set('priceTaxMode',e.target.value)}><option value="exclusive">No, add tax separately</option><option value="inclusive">Yes, tax is included</option></select></label></div><p className="itemTaxNote">Intra-state transactions use CGST + SGST. Inter-state transactions use IGST.</p><dl className="itemTaxPreview" aria-label="Tax split preview"><div><dt>CGST</dt><dd>{gstPercent(taxSplit.cgst)}</dd></div><div><dt>SGST</dt><dd>{gstPercent(taxSplit.sgst)}</dd></div><div><dt>IGST</dt><dd>{gstPercent(interTaxSplit.igst)}</dd></div></dl></>}</div><div className="itemAdvancedGroup"><div className="itemAdvancedTitle">Item image</div><div className="itemImageField"><label className="itemImageUpload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/><span className="itemImageIcon"><IconPhotoPlus size={20}/></span><span className="itemImageCopy"><b>{form.image?'Replace image':'Choose image'}</b><small>JPG, PNG or WebP · Maximum 2 MB</small></span><span className="itemImageChoose">Browse</span></label>{form.image&&<div className="itemPreview"><img src={form.image} alt="Item preview"/><span><b>Image ready</b><small>Saved when you create the item.</small></span><button type="button" onClick={()=>set('image','')}>Remove</button></div>}{errors.image&&<small className="itemError">{errors.image}</small>}</div></div></details>{errors.save&&<p role="alert" className="itemError itemSaveError">{errors.save}</p>}</div><footer className="itemDialogFooter"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary" disabled={uploadBusy}>{uploadBusy?'Processing image…':form.id?'Save changes':'Create Item'}</button></footer></form>}</section>;
}
