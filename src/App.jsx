import{useEffect,useState}from'react';import{ResponsiveContainer,LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,PieChart,Pie,Cell}from'recharts';import{IconHome,IconUsers,IconFileInvoice,IconBuildingBank,IconChartBar,IconSettings,IconSearch,IconPlus,IconMenu2,IconX,IconCheck,IconDotsVertical,IconEdit,IconTrash,IconBell,IconHelpCircle,IconChevronDown,IconRefresh,IconReceipt,IconTrendingUp,IconTrendingDown,IconBuilding,IconLock,IconArrowRight,IconAlertTriangle,IconCashBanknote,IconChevronRight,IconChevronLeft,IconFolder,IconBook,IconFilter,IconCirclePlus,IconDownload,IconEye,IconPaperclip,IconCalendar,IconPlusMinus,IconLayoutSidebarLeftCollapse,IconLayoutSidebarLeftExpand,IconMoon,IconSun}from'@tabler/icons-react';
import Items from './Items.jsx';
import Customers from './Customers.jsx';
import SalesOrders from './SalesOrders.jsx';
import Vendors from './Vendors.jsx';
import Purchases from './Purchases.jsx';
import GoodsReceipts from './GoodsReceipts.jsx';
import DebitNotes from './DebitNotes.jsx';
import VendorPayments from './VendorPayments.jsx';
import PurchaseReports from './PurchaseReports.jsx';
import Navigation from './Navigation.jsx';
import { isReportPage } from './ReportsSecondaryNav.jsx';
import Receipts from './Receipts.jsx';
import AccountWorkspace from './AccountWorkspace.jsx';
import CompanySetup from './CompanySetup.jsx';
import Banking from './Banking.jsx';
import OperationalModules from './OperationalModules.jsx';
import BudgetWorkspace from './BudgetWorkspace.jsx';
import InventoryAdjustments from './InventoryAdjustments.jsx';
import QuickCreateMenu from './QuickCreateMenu.jsx';
import WorkingContextSwitcher from './WorkingContextSwitcher.jsx';
import {useAccountOptions} from './account-store.js';
import {useTerminology, getAccountingLabel} from './terminology.jsx';
import {useExperienceMode} from './ExperienceModeContext.jsx';
const nav=['Dashboard','Customers','Invoices','Payments Received','Vendors','Bills','Bank Accounts','Bank Reconciliation','Chart of Accounts','Journal Entries','General Ledger','Trial Balance','Balance Sheet','Expense Claims','Financial Reports','GST Reports','Audit Reports','Company','Branches','Users & Roles','Tax Settings'];
const stats=[['Total Receivables','₹4,50,000.00'],['Total Payables','₹2,80,000.00'],['Total Revenue','₹24,50,000.00'],['Total Expenses','₹12,30,000.00'],['Net Profit','₹12,20,000.00']];
export function App(){const accountOptions=useAccountOptions(coaSeed);const {mode,setMode,canSwitch,activeRole}=useExperienceMode();let[a,setA]=useState(()=>new URLSearchParams(window.location.search).get('view')==='accounts'?'Chart of Accounts':new URLSearchParams(window.location.search).get('view')==='receipts'?'Payments Received':'Dashboard'),[menu,setMenu]=useState(false),[modal,setModal]=useState(false),[toast,setToast]=useState(''),[f,setF]=useState({customer:'',amount:''}),[err,setErr]=useState({});const [brandDark,setBrandDark]=useState(()=>{try{return localStorage.getItem('finance-erp-brand-theme')==='dark'}catch{return false}});function toggleBrandTheme(){const d=!brandDark;setBrandDark(d);try{localStorage.setItem('finance-erp-brand-theme',d?'dark':'light');localStorage.setItem('finance-erp-nav-theme',d?'dark':'light')}catch{}window.dispatchEvent(new CustomEvent('nav-theme-change',{detail:d?'dark':'light'}))}useEffect(()=>{if(brandDark)document.documentElement.setAttribute('data-theme','dark');else document.documentElement.removeAttribute('data-theme')},[brandDark]);const [nav,setNav]=useState(()=>{try{return localStorage.getItem('finance-erp-nav-collapsed')==='1'}catch{return false}});function toggleNav(){const n=!nav;setNav(n);try{localStorage.setItem('finance-erp-nav-collapsed',n?'1':'0')}catch{}}useEffect(()=>{if(nav)document.body.classList.add('navCollapsed');else document.body.classList.remove('navCollapsed')},[nav]);useEffect(()=>{const openMenus=()=>document.querySelectorAll('.profileMenu[open]');const closeOnPointerDown=event=>{openMenus().forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const closeOnEscape=event=>{if(event.key==='Escape')openMenus().forEach(node=>node.removeAttribute('open'))};document.addEventListener('pointerdown',closeOnPointerDown);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeOnPointerDown);document.removeEventListener('keydown',closeOnEscape)}},[]);const closeProfileMenu=()=>{document.querySelectorAll('.profileMenu[open]').forEach(node=>node.removeAttribute('open'))};let notify=x=>{setToast(x);setTimeout(()=>setToast(''),1800)},save=e=>{e.preventDefault();let z={};if(!f.customer)z.customer='Customer is required';if(!f.amount||f.amount<=0)z.amount='Enter a valid amount';setErr(z);if(!Object.keys(z).length){setModal(false);notify('Invoice saved as draft')}};  const operational=['Expense Claims','Expense Categories','Asset Register','Depreciation','Asset Transactions','GST Reports','TDS Reports','Financial Reports'];return <div className={'app'+(nav?' navCollapsed':'')}><aside id="appNav" className={menu?'open':''}><div className="brand"><span className="wayvidaLogo"><img src="/wayvida-logo-transparent.png" alt=""/></span><span>Wayvida Books</span><button type="button" className="brandThemeToggle" aria-label={brandDark?'Switch to light mode':'Switch to dark mode'} title={brandDark?'Switch to light mode':'Switch to dark mode'} onClick={toggleBrandTheme}>{brandDark?<IconSun size={16}/>:<IconMoon size={16}/>}</button><button onClick={()=>setMenu(false)}><IconX/></button></div><Navigation active={a} collapsed={nav} onNavigate={page=>{setA(page);setMenu(false);if(isReportPage(page))setNav(true)}} onToggleNav={toggleNav}/></aside><header><button type="button" className="navToggle" style={{ color: 'var(--wayvida-primary, #3478f6)' }} aria-label={nav?'Expand navigation':'Collapse navigation'} aria-expanded={!nav} aria-controls="appNav" title={nav?'Expand navigation':'Collapse navigation'} onClick={toggleNav}>{nav?<IconChevronRight size={19}/>:<IconChevronLeft size={19}/>}</button><button className="hamb" onClick={()=>setMenu(true)}><IconMenu2/></button><WorkingContextSwitcher theme="light"/><div className="headerActions"><button className="topSelect yearSelect" aria-label="Select financial year"><span>FY 2026–27</span><IconChevronDown/></button><QuickCreateMenu activePage={a} role="Admin" onNavigate={setA}/><div className="headericons"><button aria-label="Notifications"><IconBell/><i/></button><button aria-label="Help"><IconHelpCircle/></button><button aria-label="Settings"><IconSettings/></button></div><details className="profileMenu"><summary className="profileButton" aria-label="Open profile menu"><span className="adminpic">AS</span><span className="adminname"><b>Admin</b><small>{activeRole}</small></span><IconChevronDown className="adminchev"/></summary><div className="profileMenuPanel"><div className="profileMenuHead"><span className="adminpic">AS</span><span><b>Admin</b><small>{activeRole}</small></span></div>{canSwitch?(<><p className="profileMenuLabel">Experience Mode</p><button type="button" className={'profileMenuRole'+(mode==='easy'?' active':'')} aria-pressed={mode==='easy'} onClick={()=>{setMode('easy');closeProfileMenu()}}><span><b>Easy</b><small>Business owner view</small></span>{mode==='easy'&&<IconCheck size={17}/>}</button><button type="button" className={'profileMenuRole'+(mode==='accounting'?' active':'')} aria-pressed={mode==='accounting'} onClick={()=>{setMode('accounting');closeProfileMenu()}}><span><b>Accounting</b><small>Finance team view</small></span>{mode==='accounting'&&<IconCheck size={17}/>}</button></>):(<div style={{padding:'8px 12px',fontSize:'12px',color:'#667085'}}>Experience Mode: <b style={{textTransform:'capitalize',color:'#101828'}}>{mode}</b></div>)}</div></details></div></header><main>{!(isReportPage(a)||a==='Budgets')&&<div className="welcome"><div><h1>{a==='Dashboard'?'Hello, Admin 👋':a}</h1><p>{a==='Dashboard'?"Here’s what’s happening with your business today.":'Manage '+a.toLowerCase()+' for ABC Technologies Pvt Ltd.'}</p></div><span>Last updated: 03 Sep 2026, 10:30 AM</span></div>}{['GST Reports','TDS Reports'].includes(a)?null:operational.includes(a)?<OperationalModules key={a} page={a} onNavigate={setA} notify={notify}/>:['Bank Accounts','Bank Transactions','Bank Reconciliation','Bank Transfers','Banking Settings'].includes(a)?<Banking key={a} page={a} onNavigate={setA} notify={notify}/>:a==='Payments Received'?<Receipts seed={coaSeed} onNavigate={setA} notify={notify}/>:['Credit Notes','Customer Statement'].includes(a)?<CreditNotes key={a} accounts={accountOptions} notify={notify} onNavigate={setA} page={a}/>:['Invoices','Payments Received','General Ledger'].includes(a)?<InvoiceWorkspace key={a} accounts={accountOptions} page={a} notify={notify} onNavigate={setA}/>:a==='Dashboard'?<ExactDashboard notify={notify}/>:a==='Sales Orders'?<SalesOrders notify={notify} accounts={accountOptions} onNavigate={setA}/>:a==='Vendors'?<Vendors onNavigate={setA}/>:['Purchase Orders','Purchase Bills'].includes(a)?<Purchases key={a} page={a} onNavigate={setA}/>:a==='Goods Receipts'?<GoodsReceipts onNavigate={setA}/>:a==='Debit Notes'?<DebitNotes onNavigate={setA}/>:a==='Payments Made'?<VendorPayments onNavigate={setA}/>:a==='Purchase Reports'?<PurchaseReports onNavigate={setA}/>:a==='Customers'?<Customers accounts={accountOptions} notify={notify} onNavigate={setA}/>:a==='Items'?<Items accounts={accountOptions} notify={notify}/>:a==='Inventory Adjustments'?<InventoryAdjustments seed={coaSeed} notify={notify} onNavigate={setA}/>:a==='Chart of Accounts'?<AccountWorkspace seed={coaSeed} notify={notify} onNavigate={setA}/>:a==='Budgets'?<BudgetWorkspace key={a} page={a} notify={notify} onNavigate={setA}/>:a==='General Ledger'?<GeneralLedger notify={notify}/>:a==='Journal Entries'?<InvoiceWorkspace accounts={accountOptions} page={a} notify={notify} onNavigate={setA}/>:a==='Company'||a==='Branches'?<OrgList key={a} type={a} notify={notify}/>:a==='Users & Roles'||a==='Tax Settings'?<SettingsWorkspace onNavigate={setA} notify={notify}/>:isReportPage(a)?null:a!=='Dashboard'?<div className="empty card"><IconCheck/><h2>{a} is ready</h2><button className="primary" onClick={()=>setA('Invoices')}>Create invoice</button></div>:<><div className="stats">{stats.map((x,i)=><article className="card stat"><i><IconChartBar/></i><span>{x[0]}</span><strong>{x[1]}</strong><footer><b>This FY</b><b>{i<2?'Overdue ₹1,30,000':'↑ 15.6% vs Last FY'}</b></footer></article>)}</div><div className="grid"><Panel title="Cash Flow"><div className="bars">{[28,55,62,41,48,35,65,39,70,52,38,25].map(x=><i style={{height:x+'%'}}/>)}</div></Panel><Panel title="Receivables Ageing"><Donut total="₹4,50,000"/></Panel></div><div className="grid three"><Panel title="Payables Ageing"><Donut total="₹2,80,000"/></Panel><Panel title="Top Expenses">{[['Salaries & Wages',100],['Rent',43],['Utilities',22],['Marketing',18],['Travel',14]].map(x=><p className="expense"><span>{x[0]}</span><i><b style={{width:x[1]+'%'}}/></i></p>)}</Panel><Panel title="Bank Accounts">{['HDFC Bank - 1234','ICICI Bank - 5678','Axis Bank - 9012'].map((x,i)=><p className="bank"><i>₹</i><span>{x}<small>Current Balance</small></span><b>₹{[875000,245000,110000][i].toLocaleString('en-IN')}</b></p>)}<button className="add" onClick={()=>notify('Bank account form opened')}><IconPlus/>Add Bank Account</button></Panel></div><div className="grid"><Panel title="Task List">{['5 invoices are overdue','3 bills are pending approval','GST filing for Aug 2026 is due','Bank reconciliation pending'].map(x=><button className="row" onClick={()=>notify(x)}><span>{x}<small>Requires your attention</small></span><b>Open →</b></button>)}</Panel><Panel title="Recent Transactions">{['INV-2026-0012','BILL-2026-0009','PAY-2026-0015','JE-2026-0008'].map((x,i)=><p className="tx"><span><b>{x}</b><small>ABC Pvt Ltd</small></span><b>₹{[50000,25000,20000,10000][i].toLocaleString('en-IN')}</b><i>Posted</i></p>)}</Panel></div></>}</main>{modal&&<div className="overlay"><form onSubmit={save}><div><h2>New sales invoice</h2><button type="button" onClick={()=>setModal(false)}><IconX/></button></div><label>Customer<input autoFocus value={f.customer} onChange={e=>setF({...f,customer:e.target.value})}/><small>{err.customer}</small></label><label>Invoice amount (₹)<input type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/><small>{err.amount}</small></label><footer><button type="button" onClick={()=>setModal(false)}>Cancel</button><button className="primary">Save draft</button></footer></form></div>}{toast&&<div className="toast"><IconCheck/>{toast}</div>}</div>}
function Panel(p){return <article className="card panel"><div className="head"><h3>{p.title}</h3><button>As on Today⌄</button></div>{p.children}</article>}function Donut(p){return <div className="donut"><div><b>{p.total}<small>Total</small></b></div><p>🔵 Current 71%<br/>🟢 1–30 Days 13%<br/>🟠 31–60 Days 9%<br/>🔴 90+ Days 3%</p></div>}
const companyFields=[['Company Name','text','ABC Technologies Pvt Ltd'],['Legal Name','text','ABC Technologies Private Limited'],['Company Code','text','ABC01'],['Registration Number','text','U72900KL2020PTC123456'],['PAN','text','AABCA1234F'],['TAN','text','COCA12345B'],['GSTIN','text','32AABCA1234F1Z5'],['CIN','text','U72900KL2020PTC123456'],['Business Type','select',['Private Limited','LLP','Partnership','Proprietorship']],['Industry','text','Information Technology'],['Registered Address','textarea','Infopark Road, Kakkanad, Kochi'],['Contact Details','text','Finance Office'],['Email','email','finance@abctech.in'],['Website','url','https://abctech.in'],['Base Currency','select',['INR - Indian Rupee','USD - US Dollar']],['Financial Year','select',['April – March','January – December']],['Time Zone','select',['Asia/Kolkata (IST)','UTC']],['Date Format','select',['DD MMM YYYY','DD/MM/YYYY','YYYY-MM-DD']],['Number Format','select',['1,23,456.78','123,456.78']],['Status','select',['Active','Inactive']]];
const branchFields=[['Branch Name','text','Kochi Branch'],['Branch Code','text','KOC01'],['Company','select',['ABC Technologies Pvt Ltd']],['Address','textarea','Infopark Road, Kakkanad'],['State','select',['Kerala','Karnataka','Tamil Nadu','Maharashtra']],['City','text','Kochi'],['PIN Code','text','682042'],['GSTIN','text','32AABCA1234F1Z5'],['Contact Person','text','Arun Nair'],['Contact Number','tel','+91 98765 43210'],['Status','select',['Active','Inactive']]];
function OrgScreen({type,notify}){let isCo=type==='Company',fields=isCo?companyFields:branchFields,[data,setData]=useState(Object.fromEntries(fields.map(x=>[x[0],Array.isArray(x[2])?x[2][0]:x[2]]))),[errors,setErrors]=useState({}),[saved,setSaved]=useState(true);function submit(ev){ev.preventDefault();let z={};['Company Name','Company Code','Branch Name','Branch Code','GSTIN','Email','PIN Code'].forEach(k=>{if(k in data&&!String(data[k]).trim())z[k]='Required'});if(data.Email&&!/^[^@]+@[^@]+\.[^@]+$/.test(data.Email))z.Email='Enter a valid email';if(data.GSTIN&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(data.GSTIN))z.GSTIN='Enter a valid GSTIN';if(data['PIN Code']&&!/^\d{6}$/.test(data['PIN Code']))z['PIN Code']='Enter a 6-digit PIN';setErrors(z);if(!Object.keys(z).length){setSaved(true);notify((isCo?'Company':'Branch')+' settings saved')}}return <form className="org" onSubmit={submit}><div className="orgbar"><div><h2>{isCo?'Company profile':'Branch details'}</h2><p>{isCo?'Legal identity, statutory registrations and regional defaults.':'Branch identity, tax registration and accounting dimension.'}</p></div><span className="status">● Active</span></div>{!isCo&&<div className="dimension card"><IconCheck/><span><b>Accounting dimension enabled</b><small>Transactions and reports can be filtered by this branch.</small></span><label><input type="checkbox" defaultChecked/> Use branch as dimension</label></div>}<section className="formcard card"><div className="formhead"><h3>{isCo?'Organization information':'Branch information'}</h3><span>{saved?'All changes saved':'Unsaved changes'}</span></div><div className="formgrid">{fields.map(([name,kind,opt])=><label className={kind==='textarea'?'wide':''}><span>{name}{['Company Name','Company Code','Branch Name','Branch Code','GSTIN'].includes(name)&&<b>*</b>}</span>{kind==='select'?<select value={data[name]||''} onChange={e=>{setData({...data,[name]:e.target.value});setSaved(false)}}>{opt.map(v=><option>{v}</option>)}</select>:kind==='textarea'?<textarea value={data[name]||''} onChange={e=>{setData({...data,[name]:e.target.value});setSaved(false)}}/>:<input type={kind} value={data[name]||''} onChange={e=>{setData({...data,[name]:e.target.value});setSaved(false)}}/>}{errors[name]&&<small className="fielderror">{errors[name]}</small>}</label>)}</div></section><footer className="sticky"><span>{saved?'No pending changes':'Review your changes before saving.'}</span><button className="secondary" type="button" onClick={()=>notify('Changes discarded')}>Cancel</button><button className="primary" type="submit"><IconCheck/>Save changes</button></footer></form>}





const seededCompanies=[{id:1,name:'ABC Technologies Pvt Ltd',code:'ABC01',type:'Private Limited',status:true,branches:3},{id:2,name:'Northstar Retail LLP',code:'NSR02',type:'LLP',status:true,branches:2},{id:3,name:'Malabar Trading Co.',code:'MTC03',type:'Partnership',status:true,branches:2},{id:4,name:'Bluewave Services Pvt Ltd',code:'BWS04',type:'Private Limited',status:true,branches:2}];
const seededBranches=[{id:1,name:'Kochi Branch',code:'KOC01',company:'ABC Technologies Pvt Ltd',status:true},{id:2,name:'Bengaluru Branch',code:'BLR02',company:'ABC Technologies Pvt Ltd',status:true},{id:3,name:'Trivandrum Branch',code:'TVM03',company:'ABC Technologies Pvt Ltd',status:true},{id:4,name:'Chennai Branch',code:'CHE01',company:'Northstar Retail LLP',status:true},{id:5,name:'Coimbatore Branch',code:'CBE02',company:'Northstar Retail LLP',status:true},{id:6,name:'Calicut Branch',code:'CLT01',company:'Malabar Trading Co.',status:true},{id:7,name:'Kannur Branch',code:'CNN02',company:'Malabar Trading Co.',status:true},{id:8,name:'Mumbai Branch',code:'MUM01',company:'Bluewave Services Pvt Ltd',status:true},{id:9,name:'Pune Branch',code:'PUN02',company:'Bluewave Services Pvt Ltd',status:true}];
function OrgList({type,notify}){
 const isCo=type==='Company';
 const stored=()=>{try{const saved=JSON.parse(localStorage.getItem('wayvida-companies-v2')||'[]');return saved.length?saved.map(x=>({id:x.id,name:x.name,code:x.code,type:x.businessType,status:x.status==='Active'})):seededCompanies}catch{return seededCompanies}};
 const [rows,setRows]=useState(isCo?stored():seededBranches),[editing,setEditing]=useState(false),[menu,setMenu]=useState(null);
 function toggle(id){setRows(rows.map(r=>r.id===id?{...r,status:!r.status}:r));setMenu(null);notify('Status updated')}
 function remove(id){setRows(rows.filter(r=>r.id!==id));setMenu(null);notify((isCo?'Company':'Branch')+' deleted')}
 if(editing&&isCo)return <CompanySetup notify={notify} onCancel={()=>setEditing(false)} onComplete={()=>{window.location.search=''}}/>;
 if(editing)return <div className="orgEditShell"><button className="backlink" onClick={()=>setEditing(false)}><IconChevronLeft size={17}/>Back to branches</button><OrgScreen type={type} notify={x=>{notify(x);setEditing(false)}}/></div>;
 return <section className="orglist"><div className="listbar"><div><h2>{isCo?'Companies':'Branches'}</h2><p>{isCo?'Manage legal entities and their accounting setup.':'Manage operating locations and company assignments.'}</p></div><button className="primary" onClick={()=>setEditing(true)}><IconPlus/>Add {isCo?'company':'branch'}</button></div><div className="tablecard card"><div className="tabletools"><b>{rows.length} {isCo?'companies':'branches'}</b><label><IconSearch/><input placeholder={'Search '+(isCo?'companies':'branches')+'...'}/></label></div><div className="orgtable"><div className="tr th"><span>{isCo?'Company name':'Branch name'}</span><span>Code</span><span>{isCo?'Business type':'Company'}</span><span>Status</span><span>Actions</span></div>{rows.map(r=><div className="tr" key={r.id}><span className="entity"><i>{r.name.slice(0,2).toUpperCase()}</i><b>{r.name}</b></span><span><code>{r.code}</code></span><span>{isCo?r.type:r.company}</span><span><label className="switch"><input type="checkbox" checked={r.status} onChange={()=>toggle(r.id)}/><i/></label><em className={r.status?'enabled':'disabled'}>{r.status?'Active':'Inactive'}</em></span><span className="actionscol"><button className="editbtn" onClick={()=>setEditing(true)}><IconEdit/>Edit</button><button className="dots" onClick={()=>setMenu(menu===r.id?null:r.id)} aria-label="More actions"><IconDotsVertical/></button>{menu===r.id&&<div className="moremenu">{isCo&&<button onClick={()=>notify('Branches for '+r.name+' opened')}>View branches</button>}<button onClick={()=>toggle(r.id)}>{r.status?'Disable':'Enable'} status</button><button className="danger" onClick={()=>remove(r.id)}><IconTrash/>Delete</button></div>}</span></div>)}{!rows.length&&<div className="noRows">No {isCo?'companies':'branches'} found.</div>}</div></div></section>
}

const cashFlow=[['Apr',15,-12,0],['May',35,-22,20],['Jun',39,-30,23],['Jul',26,-24,0],['Aug',29,-28,2],['Sep',24,-27,-6],['Oct',36,-27,9],['Nov',20,-32,-5],['Dec',41,-22,0],['Jan',28,-13,3],['Feb',17,-12,4],['Mar',10,-13,1]].map(x=>({month:x[0],opening:x[3]+20,inflow:x[1],outflow:Math.abs(x[2]),closing:x[3]+22}));
const ageData=[{name:'Current',value:320,color:'#3478f6',pct:'71.11%'},{name:'1–30 Days',value:60,color:'#58c98b',pct:'13.33%'},{name:'31–60 Days',value:40,color:'#f5b94f',pct:'8.89%'},{name:'61–90 Days',value:20,color:'#ed8a42',pct:'4.44%'},{name:'90+ Days',value:10,color:'#ec5757',pct:'2.22%'}];

function Box({title,filter='As on Today',children,link,state='normal',onRetry}){
  return (
    <section className="exactBox" aria-label={title}>
      <div className="exactHead">
        <h3>{title}</h3>
        {link ? (
          <a href="#" onClick={(e)=>{e.preventDefault();if(typeof link==='object'&&link.onClick)link.onClick();}}>
            {typeof link==='object'?link.label:link}
          </a>
        ) : (
          <button aria-label={`${title} filter: ${filter}`} title={`Filter ${title}`}>
            {filter} <IconChevronDown aria-hidden="true" />
          </button>
        )}
      </div>
      {state==='loading' ? (
        <div className="widgetSkeleton"><div className="skBar"/><div className="skBar w70"/><div className="skBar w40"/></div>
      ) : state==='empty' ? (
        <div className="widgetState emptyState">
          <p>No data available for the selected period.</p>
        </div>
      ) : state==='error' ? (
        <div className="widgetState errorState">
          <p>Unable to load widget data.</p>
          {onRetry && <button onClick={onRetry}>Retry</button>}
        </div>
      ) : state==='no-permission' ? (
        <div className="widgetState noPermState">
          <p>Access Restricted: Additional permissions required.</p>
        </div>
      ) : children}
    </section>
  );
}

function Ageing({pay=false, notify=()=>{}}){
  const { mode } = useExperienceMode();
  let d=pay?ageData.map((x,i)=>({...x,value:[180,50,30,15,5][i],pct:['64.29%','17.86%','10.71%','5.36%','1.79%'][i]})):ageData;
  let total=pay?'₹2,80,000':'₹4,50,000';
  let label=pay ? (mode === 'easy' ? 'To Pay' : 'Payable') : (mode === 'easy' ? 'To Receive' : 'Outstanding');
  return (
    <div className="exactDonut">
      <div className="piechart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={d} dataKey="value" innerRadius="64%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none">
              {d.map(x=><Cell key={x.name} fill={x.color}/>)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span><b>{total}</b><small style={{fontWeight:600,color:'#475569'}}>{label}</small></span>
      </div>
      <div className="agelegend">
        {d.map(x=>
          <button 
            key={x.name} 
            type="button"
            onClick={()=>notify(`${pay ? 'Payables' : 'Receivables'} ${x.name} ageing bucket selected`)}
            aria-label={`${x.name}: ₹${x.value.toLocaleString('en-IN')},000 (${x.pct})`}
          >
            <p>
              <i style={{background:x.color}} aria-hidden="true"/>
              <span>{x.name}<b>₹{x.value.toLocaleString('en-IN')},000 <small>({x.pct})</small></b></span>
            </p>
          </button>
        )}
      </div>
    </div>
  );
}

const cashFlowBarData = [
  ['Apr', 150, 80], ['May', 165, 85], ['Jun', 180, 92], ['Jul', 155, 88],
  ['Aug', 190, 100], ['Sep', 200, 108], ['Oct', 210, 112], ['Nov', 205, 115],
  ['Dec', 240, 130], ['Jan', 220, 120], ['Feb', 250, 135], ['Mar', 270, 145]
].map(([m, inF, outF]) => ({ month: m, Inflow: inF, Outflow: outF, isForecast: ['Nov','Dec','Jan','Feb','Mar'].includes(m) }));

const trendData=[
  ['Apr',160,82],['May',185,88],['Jun',205,96],['Jul',178,90],
  ['Aug',215,104],['Sep',225,112],['Oct',240,116],['Nov',232,121],
  ['Dec',268,135],['Jan',250,124],['Feb',285,142],['Mar',310,151]
].map(x=>({month:x[0],Revenue:x[1],Expenses:x[2],Profit:x[1]-x[2],isForecast:['Nov','Dec','Jan','Feb','Mar'].includes(x[0])}));

const CustomTrendTooltip = ({ active, payload, label, title, color }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const val = payload[0].value;
    const isForecast = data.isForecast;
    return (
      <div style={{background:'#0f172a',color:'#fff',padding:'8px 12px',borderRadius:'6px',fontSize:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
        <div style={{fontWeight:600,color:'#94a3b8',marginBottom:'4px'}}>{label} 2026 {isForecast ? '· Forecast' : ''}</div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <span style={{width:8,height:8,borderRadius:2,background:color}}/>
          <span>{title}:</span>
          <b style={{color:'#fff'}}>₹{(val * 1000).toLocaleString('en-IN')}</b>
        </div>
      </div>
    );
  }
  return null;
};

function MiniTrendCard({ title, amount, comparison, dataKey, color, state, notify }) {
  return (
    <Box title={title} filter="This FY" state={state}>
      <div className="miniTrendHead">
        <strong>{amount}</strong>
        <span className={`trendBadge ${color === '#ec5757' ? 'neutral' : 'good'}`}>
          {comparison}
        </span>
      </div>
      <div className="miniTrendChart">
        <ResponsiveContainer>
          <LineChart data={trendData} margin={{top:10,right:12,left:-20,bottom:0}}>
            <CartesianGrid vertical={false} stroke="#edf0f4"/>
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fontSize:11,fontWeight:500}}/>
            <YAxis tickFormatter={v=>'₹'+v+'K'} tickLine={false} axisLine={false} tick={{fontSize:11,fontWeight:500}}/>
            <Tooltip content={<CustomTrendTooltip title={title} color={color}/>}/>
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.4} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Box>
  );
}

function ExactDashboard({notify}){
  const { mode } = useExperienceMode();
  const [widgetState, setWidgetState] = useState('normal');
  const [financialYear, setFinancialYear] = useState('FY 2026–27 (This FY)');

  const bizMetrics = [
    [getAccountingLabel('revenue', mode), '₹24,50,000.00', IconTrendingUp, 'green', '↑ 15.6% vs Last FY', 'Revenue breakdown opened', 'good'],
    [getAccountingLabel('expenses', mode), '₹12,30,000.00', IconTrendingDown, 'purple', '↓ 4.2% vs Last FY', 'Expense breakdown opened', 'neutral'],
    ['Net Profit', '₹12,20,000.00', IconCashBanknote, 'cyan', '49.8% margin · ↑ 28.4% vs Last FY', 'Profit & Loss opened', 'good'],
    [getAccountingLabel('cashAndCashEquivalents', mode), '₹11,30,000.00', IconBuildingBank, 'blue', '4 accounts · ₹25,000 unreconciled', 'Cash & Bank summary opened', 'blue']
  ];

  const attentionMetrics = [
    [getAccountingLabel('accountsReceivable', mode), '₹4,50,000.00', IconUsers, 'blue', '₹1,30,000 overdue · 5 invoices', 'Customer outstanding opened', 'amber'],
    [getAccountingLabel('accountsPayable', mode), '₹2,80,000.00', IconReceipt, 'orange', '₹1,00,000 overdue · 3 due soon', 'Vendor outstanding opened', 'orange'],
    [getAccountingLabel('gstPayable', mode), '₹3,28,740.00', IconReceipt, 'amber', 'OVERDUE · Due 20 Sep 2026', 'GST summary opened', 'bad'],
    [getAccountingLabel('tdsPayable', mode), '₹86,500.00', IconReceipt, 'rose', 'OVERDUE · Due 07 Sep 2026', 'TDS summary opened', 'bad']
  ];

  const renderMetricGrid = (metricsList, sectionLabel) => (
    <div className="metricGrid compactGrid" role="group" aria-label={sectionLabel}>
      {metricsList.map(([t, v, I, c, trend, actionMsg, badgeType]) => (
        <section 
          className="metric compactMetric clickableMetric" 
          key={t}
          role="button"
          tabIndex={0}
          onClick={() => notify(actionMsg)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); notify(actionMsg); } }}
          aria-label={`${t}: ${v}. ${trend}`}
        >
          <div className="metricHeader">
            <i className={c} aria-hidden="true"><I/></i>
            <b>{t}</b>
          </div>
          <div className="metricValueRow">
            <strong>{v}</strong>
            <span className={`trendBadge ${badgeType || 'good'}`}>
              {trend}
            </span>
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="exactDash">
      <div className="dashIntro">
        <div>
          <h1>Hello, Admin 👋</h1>
          <p>Here’s what’s happening with your business today.</p>
        </div>
        <div className="dashHeaderRight">
          <label className="dashFyPicker">
            <span>Period:</span>
            <select 
              value={financialYear} 
              onChange={(e) => {
                setFinancialYear(e.target.value);
                notify(`Switched dashboard view to ${e.target.value}`);
              }}
              aria-label="Select Financial Year"
            >
              <option value="FY 2026–27 (This FY)">FY 2026–27 (This FY)</option>
              <option value="FY 2025–26 (Last FY)">FY 2025–26 (Last FY)</option>
              <option value="FY 2024–25">FY 2024–25</option>
            </select>
          </label>
        </div>
      </div>

      {renderMetricGrid(bizMetrics, "Business Performance Metrics")}
      {renderMetricGrid(attentionMetrics, "Working Capital & Tax Attention Metrics")}
      
      {/* ROW 3: Revenue Trend, Expense Trend, Net Profit Trend */}
      <div className="exactGrid detailGrid">
        <MiniTrendCard 
          title="Revenue Trend" 
          amount="₹24,50,000" 
          comparison="↑ 15.6% vs Last FY" 
          dataKey="Revenue" 
          color="#3478f6" 
          state={widgetState} 
          notify={notify}
        />
        <MiniTrendCard 
          title="Expense Trend" 
          amount="₹12,30,000" 
          comparison="↓ 4.2% vs Last FY" 
          dataKey="Expenses" 
          color="#ec5757" 
          state={widgetState} 
          notify={notify}
        />
        <MiniTrendCard 
          title="Net Profit Trend" 
          amount="₹12,20,000" 
          comparison="↑ 28.4% vs Last FY" 
          dataKey="Profit" 
          color="#2dad68" 
          state={widgetState} 
          notify={notify}
        />
      </div>

      {/* ROW 4: Cash Movement / Cash Flow, Receivables Ageing, Payables Ageing */}
      <div className="exactGrid detailGrid">
        <Box title={mode === 'easy' ? 'Cash Movement' : 'Cash Flow'} filter="This Financial Year" state={widgetState}>
          <div className="cashFlowKpiRow">
            <span>{mode === 'easy' ? 'Money In' : 'Inflow'}<b className="good">₹18.50L</b></span>
            <span>{mode === 'easy' ? 'Money Out' : 'Outflow'}<b className="bad">₹11.20L</b></span>
            <span>{mode === 'easy' ? 'Net Change' : 'Net Cash'}<b className="good">+₹7.30L</b></span>
            <span>{mode === 'easy' ? 'Ending Balance' : 'Closing'}<b className="good">₹11.30L</b></span>
          </div>
          <div className="flowchart" style={{height: 165}}>
            <ResponsiveContainer>
              <BarChart data={cashFlowBarData} margin={{top:10,right:12,left:-20,bottom:0}}>
                <CartesianGrid vertical={false} stroke="#edf0f4"/>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fontSize:11,fontWeight:500}}/>
                <YAxis tickFormatter={v=>v+'K'} tickLine={false} axisLine={false} tick={{fontSize:11,fontWeight:500}}/>
                <Tooltip formatter={(val, name, item) => [`₹${val.toLocaleString('en-IN')},000`, item.payload.isForecast ? `${name} (Forecast)` : name]}/>
                <Bar dataKey="Inflow" name={mode === 'easy' ? 'Money In' : 'Inflow'} fill="#2dad68" radius={[3,3,0,0]} />
                <Bar dataKey="Outflow" name={mode === 'easy' ? 'Money Out' : 'Outflow'} fill="#ec5757" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Box>
        <Box title={mode === 'easy' ? 'Customer Payments by Age' : 'Receivables Ageing'} state={widgetState}>
          <Ageing notify={notify}/>
        </Box>
        <Box title={mode === 'easy' ? 'Supplier Payments by Age' : 'Payables Ageing'} state={widgetState}>
          <Ageing pay notify={notify}/>
        </Box>
      </div>

      {/* ROW 5: Top Expenses, Bank Accounts, Tax & Compliance */}
      <div className="exactGrid detailGrid">
        <Box title="Top Expenses" filter="This Financial Year" state={widgetState}>
          <div className="topExpenses">
            {[
              ['Salaries & Wages', 420, 100, '34%'],
              ['Rent', 180, 42, '15%'],
              ['Utilities', 90, 21, '7%'],
              ['Marketing', 75, 18, '6%'],
              ['Travel', 60, 14, '5%']
            ].map(x => (
              <p 
                key={x[0]} 
                onClick={()=>notify(`${x[0]} expense details opened`)}
                role="button"
                tabIndex={0}
                aria-label={`${x[0]}: ₹${x[1].toLocaleString('en-IN')},000 (${x[3]} share)`}
              >
                <span>{x[0]} <small style={{color:'#667085'}}>({x[3]})</small></span>
                <i aria-hidden="true"><b style={{width:x[2]+'%'}}/></i>
                <strong>₹{x[1].toLocaleString('en-IN')},000</strong>
              </p>
            ))}
            <a href="#" onClick={(e)=>{e.preventDefault();notify('Expense report opened');}}>
              View All Expenses <IconArrowRight aria-hidden="true"/>
            </a>
          </div>
        </Box>
        <Box 
          title="Bank Accounts" 
          link={{label: 'View All', onClick: ()=>notify('Bank accounts page opened')}}
          state={widgetState}
        >
          <div className="exactBanks">
            {[
              ['HDFC Bank - 1234', '₹8,75,000.00', 'H'],
              ['ICICI Bank - 5678', '₹2,45,000.00', 'I'],
              ['Axis Bank - 9012 (OD)', '-₹1,10,000.00', 'A'],
              ['Petty Cash / Cash in Hand', '₹1,20,000.00', 'P']
            ].map(x => (
              <p key={x[0]}>
                <i aria-hidden="true">{x[2]}</i>
                <span>{x[0]}<small>Current Balance</small></span>
                <b style={{color: x[1].startsWith('-') ? '#b42318' : '#172033'}}>{x[1]}</b>
              </p>
            ))}
            <div className="bankFooterNote">
              Total bank balance ₹11,30,000 · 4 accounts
            </div>
            <button 
              onClick={()=>notify('Bank account form opened')}
              aria-label="Add account"
              title="Add account"
            >
              <IconPlus aria-hidden="true"/>Add account
            </button>
          </div>
        </Box>
        <Box title="Tax & Compliance" state={widgetState}>
          <div className="taxComplianceWidget">
            <div className="taxComplianceRow">
              <span>
                GST Return
                <small>Next filing: 20 Oct 2026</small>
              </span>
              <strong style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>20 Oct 2026</strong>
            </div>
            <div className="taxComplianceRow">
              <span>
                TDS Payment
                <small>Next payment: 07 Oct 2026</small>
              </span>
              <strong style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>07 Oct 2026</strong>
            </div>
            <div className="taxComplianceRow">
              <span>
                Input GST Credit
                <small>Available to claim</small>
              </span>
              <strong style={{color:'#18794e'}}>₹1,12,400.00</strong>
            </div>
            <div className="taxComplianceRow">
              <span>
                Compliance Status
                <small>Required filings & action</small>
              </span>
              <strong style={{color:'#b91c1c'}}>2 overdue actions</strong>
            </div>
            <a href="#" onClick={(e)=>{e.preventDefault();notify('GST & TDS tax details opened');}}>
              View tax details <IconArrowRight aria-hidden="true"/>
            </a>
          </div>
        </Box>
      </div>

      {/* ROW 6: Needs Attention, Recent Transactions */}
      <div className="exactGrid lowerGrid">
        <Box title="Needs Attention" state={widgetState}>
          <div className="exactTasks">
            {[
              ['GST payment overdue','GST due 20 Sep 2026 · ₹3,28,740 overdue','Pay GST','red','Critical'],
              ['TDS payment overdue','Payment due 07 Sep 2026 · ₹86,500 overdue','Pay TDS','red','Critical'],
              ['Negative cash/bank balance','Axis OD account below zero (-₹1,10,000)','View account','red','Critical'],
              ['Journal entries needing correction','2 entries need correction','Fix entries','red','Needs review'],
              ['Overdue customer invoices','5 invoices · ₹1,30,000 overdue','View invoices','amber','Overdue'],
              ['Overdue vendor bills','3 bills · ₹75,000 overdue','View bills','amber','Overdue'],
              ['Pending bank reconciliation','2 accounts not reconciled','Reconcile now','amber','Needs review'],
              ['Unapproved expenses','6 claims · ₹42,500','Review expenses','amber','Needs review'],
              ['Unposted transactions','8 drafts awaiting posting','Review drafts','blue','Draft']
            ].map(x => (
              <button 
                key={x[0]}
                onClick={()=>notify(x[2]+' opened')}
                aria-label={`${x[0]}: ${x[1]} (${x[4]})`}
              >
                <i className={x[3] === 'red' ? '' : x[3]} aria-hidden="true"><IconAlertTriangle/></i>
                <span>
                  <b>{x[0]} <span className={`taskSeverity ${x[3]}`}>{x[4]}</span></b>
                  <small>{x[1]}</small>
                </span>
                <em>{x[2]}<IconArrowRight aria-hidden="true"/></em>
              </button>
            ))}
          </div>
        </Box>

        <Box 
          title="Recent Transactions" 
          link={{label: 'View All', onClick: ()=>notify('Recent transactions list opened')}}
          state={widgetState}
        >
          <div className="exactTxWrapper" style={{overflowX:'auto',width:'100%'}}>
            <div className="exactTx" style={{minWidth: 520}}>
              <div className="exactTxHead" style={{display:'grid',gridTemplateColumns:'22px 1.2fr 1fr 0.8fr 0.8fr 0.7fr',gap:8,padding:'10px 14px',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #edf0f4',textTransform:'uppercase',letterSpacing:'0.03em',background:'#f8fafc'}}>
                <span></span>
                <span>Document</span>
                <span>Type</span>
                <span>Date</span>
                <span style={{textAlign:'right'}}>Amount</span>
                <span style={{textAlign:'right'}}>Status</span>
              </div>
              {[
                ['INV-2026-0012','ABC Pvt Ltd','Invoice','₹50,000.00','Posted'],
                ['BILL-2026-0009','XYZ Suppliers','Bill','₹25,000.00','Draft'],
                ['PAY-2026-0015','ABC Pvt Ltd','Payment Received','₹20,000.00','Posted'],
                ['PAY-2026-0012','XYZ Suppliers','Payment Made','₹15,000.00','Posted'],
                ['JE-2026-0008','Journal Entry','Journal Entry','₹10,000.00','Posted']
              ].map((x,i) => (
                <p key={x[0]} tabIndex={0} role="button" onClick={()=>notify(`${x[0]} document opened`)} style={{cursor:'pointer',display:'grid',gridTemplateColumns:'22px 1.2fr 1fr 0.8fr 0.8fr 0.7fr',gap:8,alignItems:'center',minHeight:42,padding:'0 14px',borderTop:'1px solid #f1f5f9',fontSize:12}}>
                  <IconLock aria-hidden="true" title="Posted — accounting entry locked"/>
                  <span>
                    <b style={{color:'#2563eb',textDecoration:'underline'}}>{x[0]}</b>
                    <small style={{color:'#64748b',fontSize:11,display:'block'}}>{x[1]}</small>
                  </span>
                  <em className={'type t'+(i%4)}>{x[2]}</em>
                  <time style={{color:'#64748b',fontSize:11.5}}>03 Sep 2026</time>
                  <strong style={{textAlign:'right',fontSize:12.5,color:'#0f172a'}}>{x[3]}</strong>
                  <em className="posted">{x[4]}</em>
                </p>
              ))}
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
}

function RevenueTrend({state='normal'}){
  return (
    <div className="trendBox">
      <Box title="Revenue & Expense Trend" filter="This Financial Year" state={state}>
        <div className="trendSummary">
          <span><i className="rev" aria-hidden="true"/>Revenue <b>₹24.50L</b></span>
          <span><i className="exp" aria-hidden="true"/>Expenses <b>₹12.30L</b></span>
          <span><i className="profit" aria-hidden="true"/>Profit <b>₹12.20L</b></span>
        </div>
        <div className="trendChart">
          <ResponsiveContainer>
            <LineChart data={trendData} margin={{top:5,right:20,left:-5,bottom:0}}>
              <CartesianGrid vertical={false} stroke="#edf0f4"/>
              <XAxis dataKey="month" tickLine={false} axisLine={false}/>
              <YAxis tickFormatter={v=>'₹'+v+'K'} tickLine={false} axisLine={false}/>
              <Tooltip/>
              <Line type="monotone" dataKey="Revenue" stroke="#3478f6" strokeWidth={2.4} dot={{r:2}}/>
              <Line type="monotone" dataKey="Expenses" stroke="#ec5757" strokeWidth={2.2} dot={{r:2}}/>
              <Line type="monotone" dataKey="Profit" stroke="#58c98b" strokeWidth={2.2} dot={{r:2}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Box>
    </div>
  );
}








const coaSeed={Assets:[['1000','Cash','₹1,25,000'],['1010','Bank','₹10,05,000'],['1100','Accounts Receivable','₹4,50,000'],['1200','Inventory','₹6,80,000'],['1300','Fixed Assets','₹18,40,000'],['1400','Other Current Assets','₹90,000'],['1500','Other Assets','₹2,10,000']],Liabilities:[['2000','Accounts Payable','₹2,80,000'],['2100','GST Payable','₹3,28,740'],['2200','TDS Payable','₹86,500'],['2300','Loans','₹8,50,000'],['2400','Other Current Liabilities','₹1,20,000'],['2500','Long-term Liabilities','₹12,00,000']],Equity:[['3000','Capital','₹20,00,000'],['3100','Reserves','₹4,20,000'],['3200','Retained Earnings','₹8,75,000'],['3300','Drawings','₹1,10,000']],Income:[['4000','Sales','₹22,50,000'],['4100','Service Income','₹1,20,000'],['4200','Other Income','₹50,000'],['4300','Interest Income','₹30,000']],Expenses:[['5000','Purchase','₹5,20,000'],['5100','Salary','₹4,20,000'],['5200','Rent','₹1,80,000'],['5300','Utilities','₹90,000'],['5400','Travel','₹60,000'],['5500','Marketing','₹75,000'],['5600','Professional Fees','₹1,10,000'],['5700','Bank Charges','₹25,000'],['5800','Depreciation','₹85,000'],['5900','Other Expenses','₹65,000']]};
function ChartAccountsSimple({notify}){const live=reports(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(initial())));const movement=code=>live.rows.find(r=>r.code===code)?.balance||0;let[open,setOpen]=useState(['Assets']),[query,setQuery]=useState(''),[type,setType]=useState('All Accounts'),[status,setStatus]=useState('Active'),[selected,setSelected]=useState({group:'Assets',data:coaSeed.Assets[1]}),[tab,setTab]=useState('Overview'),[modal,setModal]=useState(false);let groups=Object.entries(coaSeed).filter(([g])=>type==='All Accounts'||g===type),matches=x=>(x[0]+' '+x[1]).toLowerCase().includes(query.toLowerCase()),total=a=>a.reduce((n,x)=>n+(Number(String(x[2]).replace(/[^0-9]/g,''))||0),0).toLocaleString('en-IN');return <section className="coaSimple"><div className="coaWorkspace card"><div className="coaList"><div className="coaSimpleTitle"><i><IconBook/></i><span><h2>Chart of Accounts</h2><p>Manage your financial accounts and ledgers.</p></span></div><div className="coaSimpleTools"><label><IconSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts, e.g. bank, rent, 5300"/></label><select value={type} onChange={e=>setType(e.target.value)}><option>All Accounts</option>{Object.keys(coaSeed).map(x=><option key={x}>{x}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option>Active</option><option>Inactive</option><option>All status</option></select><button className="primary" onClick={()=>setModal(true)}><IconPlus/>New Account</button></div><div className="simpleGroups">{groups.map(([group,accounts])=>{let expanded=open.includes(group),visible=accounts.filter(matches);return <div className={'simpleGroup '+group.toLowerCase()} key={group}><button className="simpleGroupRow" onClick={()=>setOpen(expanded?open.filter(x=>x!==group):[...open,group])}><IconChevronRight className={expanded?'down':''}/><i><IconFolder/></i><b>{group}</b><strong>₹{total(accounts)}</strong><IconChevronDown/></button>{expanded&&visible.map(x=>{let active=selected.data===x;return <button className={'simpleAccount '+(active?'selected':'')} key={x[0]} onClick={()=>{setSelected({group,data:x});setTab('Overview')}}><i><IconFileInvoice/></i><span>{x[1]}</span><code>{x[0]}</code><strong>{x[2]}</strong><IconDotsVertical/></button>})}</div>})}</div></div><aside className="accountDetails"><div className="detailTitle"><button aria-label="Back"><IconChevronLeft/></button><b>Account Details</b><button aria-label="More"><IconDotsVertical/></button></div><div className="accountHero"><i><IconBuildingBank/></i><div><h2>{selected.data[1]} <small>{selected.group==='Assets'?'Asset Account':selected.group+' Account'}</small></h2><dl><div><dt>Account Code</dt><dd>{selected.data[0]}</dd></div><div><dt>Account Type</dt><dd>{selected.group.slice(0,-1)||selected.group}</dd></div><div><dt>Status</dt><dd className="activeDot">● Active</dd></div><div><dt>Sample opening balance</dt><dd>{selected.data[2]}</dd></div><div><dt>Live invoice ledger (Dr − Cr)</dt><dd>{money(movement(selected.data[0]))}</dd></div></dl></div></div><div className="detailTabs">{['Overview','Transactions','Ledger','Settings'].map(x=><button className={tab===x?'onTab':''} onClick={()=>setTab(x)} key={x}>{x}</button>)}</div>{tab==='Overview'?<><div className="recentBox"><header><b>Recent Transactions</b><button onClick={()=>setTab('Transactions')}>View All</button></header><div className="recentHead"><span>Date</span><span>Description</span><span>Debit</span><span>Credit</span></div>{[['03 Sep 2026','Customer Payment','₹50,000','—'],['04 Sep 2026','Office Expense','—','₹5,000'],['05 Sep 2026','Customer Payment','₹75,000','—']].map(r=><div className="recentRow" key={r[0]}>{r.map((v,i)=><span key={i}>{v}</span>)}</div>)}</div><div className="reconcileBox"><i><IconBuildingBank/></i><span><b>Reconciliation</b><small>Last reconciled on 28 Aug 2026</small></span><button onClick={()=>notify('Reconciliation opened')}>Reconcile</button></div></>:<div className="tabEmpty"><IconCheck/><h3>{tab}</h3><p>{tab==='Transactions'?'All account transactions will appear here.':tab==='Ledger'?'Open the complete account ledger.':'Configure account controls and tax settings.'}</p></div>}<footer><button onClick={()=>notify('General Ledger opened')}>View General Ledger</button><button onClick={()=>setModal(true)}>Edit Account</button><button aria-label="More"><IconDotsVertical/></button></footer></aside></div>{modal&&<div className="overlay"><form><div><h2>{selected.data?'Edit account':'New account'}</h2><button type="button" onClick={()=>setModal(false)}><IconX/></button></div><label>Account name<input autoFocus defaultValue={selected.data?.[1]||''}/></label><label>Account code<input defaultValue={selected.data?.[0]||''}/></label><footer><button type="button" onClick={()=>setModal(false)}>Cancel</button><button type="button" className="primary" onClick={()=>{setModal(false);notify('Account saved')}}>Save account</button></footer></form></div>}</section>}function ChartAccounts({notify}){let[open,setOpen]=useState(['Assets','Liabilities','Equity','Income','Expenses']),[query,setQuery]=useState(''),[type,setType]=useState('All types'),[modal,setModal]=useState(false),[form,setForm]=useState({name:'',code:'',type:'Assets',parent:''}),[errors,setErrors]=useState({});let groups=Object.entries(coaSeed).filter(([g])=>type==='All types'||g===type),count=Object.values(coaSeed).flat().length;function save(e){e.preventDefault();let z={};if(!form.name.trim())z.name='Account name is required';if(!form.code.trim())z.code='Account code is required';if(Object.values(coaSeed).flat().some(x=>x[0]===form.code))z.code='Account code must be unique';setErrors(z);if(!Object.keys(z).length){setModal(false);notify('Account '+form.code+' created')}}return <section className="coa"><div className="coaTop"><div><h2>Chart of Accounts</h2><p>Organize the accounts that power your ledger and financial reports.</p></div><button className="primary" onClick={()=>setModal(true)}><IconPlus/>Add account</button></div><div className="coaStats"><span><b>{count}</b>Total accounts</span><span><b>5</b>Account types</span><span><b>28</b>Active accounts</span><span><b>3</b>System accounts</span></div><div className="coaCard card"><div className="coaTools"><label><IconSearch/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search account name or code..."/></label><div><IconFilter/><select value={type} onChange={e=>setType(e.target.value)}><option>All types</option>{Object.keys(coaSeed).map(x=><option>{x}</option>)}</select></div><span>{count} accounts</span></div><div className="coaHeader"><span>Account</span><span>Code</span><span>Type</span><span>Balance</span><span>Status</span><span/></div>{groups.map(([group,accounts])=>{let visible=accounts.filter(x=>(x[0]+' '+x[1]).toLowerCase().includes(query.toLowerCase()));return <div className={'coaGroup '+group.toLowerCase()}><button className="groupRow" onClick={()=>setOpen(open.includes(group)?open.filter(x=>x!==group):[...open,group])}><IconChevronRight className={open.includes(group)?'down':''}/><i><IconFolder/></i><span><b>{group}</b><small>{accounts.length} accounts</small></span><em>{open.includes(group)?'Expanded':'Collapsed'}</em></button>{open.includes(group)&&visible.map((x,i)=><div className="accountRow"><span><i className="branchline"/><b>{x[1]}</b>{i<1&&<small>System account</small>}</span><code>{x[0]}</code><em>{group}</em><strong>{x[2]}</strong><span className="activeDot">● Active</span><button onClick={()=>notify(x[1]+' opened')}><IconDotsVertical/></button></div>)}</div>})}</div>{modal&&<div className="coaModal"><form onSubmit={save}><div className="modalTitle"><div><h2>Add account</h2><p>Create a ledger account in the chart of accounts.</p></div><button type="button" onClick={()=>setModal(false)}><IconX/></button></div><div className="coaForm"><label>Account name *<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Petty Cash"/><small>{errors.name}</small></label><label>Account code *<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="e.g. 1020"/><small>{errors.code}</small></label><label>Account type *<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.keys(coaSeed).map(x=><option>{x}</option>)}</select></label><label>Parent account<select value={form.parent} onChange={e=>setForm({...form,parent:e.target.value})}><option value="">No parent account</option>{coaSeed[form.type].map(x=><option>{x[0]} — {x[1]}</option>)}</select></label><label>Nature *<select><option>Debit</option><option>Credit</option></select></label><label>Opening balance<input type="number" placeholder="0.00"/></label><label>Opening balance type<select><option>Debit</option><option>Credit</option></select></label><label>Tax configuration<select><option>Not applicable</option><option>GST 18%</option><option>GST 12%</option><option>GST 5%</option><option>TDS applicable</option></select></label><label className="full">Description<textarea placeholder="Describe this account and its intended use"/></label><label className="checkfield"><input type="checkbox"/> Cost centre required</label><label className="checkfield"><input type="checkbox"/> Branch required</label><label>Status<select><option>Active</option><option>Inactive</option></select></label></div><div className="ruleNote"><IconCheck/><span><b>Account controls enabled</b><small>Unique codes, valid parent hierarchy, circular-reference prevention, protected system accounts and transaction-safe deletion are enforced.</small></span></div><footer><button type="button" onClick={()=>setModal(false)}>Cancel</button><button className="primary"><IconCirclePlus/>Create account</button></footer></form></div>}</section>}

const ledgerRows=[['03 Sep 2026','JV-2026-0048','Journal','5100 · Salary','August payroll accrual','₹4,20,000','—','PAY-AUG-26','Kochi','Operations','Admin','03 Sep, 10:24'],['03 Sep 2026','INV-2026-0012','Sales Invoice','1100 · Accounts Receivable','Invoice — ABC Pvt Ltd','₹50,000','—','PO-8821','Kochi','Sales','Admin','03 Sep, 09:42'],['03 Sep 2026','INV-2026-0012','Sales Invoice','4000 · Sales','Revenue recognition','—','₹42,373','PO-8821','Kochi','Sales','Admin','03 Sep, 09:42'],['03 Sep 2026','INV-2026-0012','Sales Invoice','2100 · GST Payable','Output GST @ 18%','—','₹7,627','PO-8821','Kochi','Sales','Admin','03 Sep, 09:42'],['02 Sep 2026','PAY-2026-0015','Receipt','1010 · Bank','Payment received — ABC Pvt Ltd','₹20,000','—','UTR89302','Kochi','Sales','Priya N.','02 Sep, 16:18'],['02 Sep 2026','PAY-2026-0015','Receipt','1100 · Accounts Receivable','Invoice allocation','—','₹20,000','UTR89302','Kochi','Sales','Priya N.','02 Sep, 16:18'],['01 Sep 2026','BILL-2026-0009','Purchase Bill','5000 · Purchase','Materials — XYZ Suppliers','₹25,000','—','XYZ/884','Bengaluru','Operations','Arun K.','01 Sep, 14:06'],['01 Sep 2026','BILL-2026-0009','Purchase Bill','2000 · Accounts Payable','Vendor liability','—','₹25,000','XYZ/884','Bengaluru','Operations','Arun K.','01 Sep, 14:06']];
function GeneralLedger({notify}){let[q,setQ]=useState(''),[side,setSide]=useState('All'),[detail,setDetail]=useState(null);let rows=ledgerRows.filter(x=>(x.join(' ').toLowerCase().includes(q.toLowerCase()))&&(side==='All'||(side==='Debit'?x[5]!=='—':x[6]!=='—')));return <section className="ledger"><div className="pageTop"><div><h2>General Ledger</h2><p>Complete accounting history from posted transactions.</p></div><button className="export" onClick={()=>notify('Ledger exported to Excel')}><IconDownload/>Export</button></div><div className="ledgerSummary"><span><small>Opening balance</small><b>₹32,40,000</b></span><span><small>Total debits</small><b className="good">₹5,15,000</b></span><span><small>Total credits</small><b className="bad">₹5,15,000</b></span><span><small>Closing balance</small><b>₹32,40,000</b></span></div><div className="ledgerCard card"><div className="ledgerFilters"><label><IconSearch/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search voucher, account or reference..."/></label><input type="date" defaultValue="2026-09-01"/><input type="date" defaultValue="2026-09-03"/><select><option>All branches</option><option>Kochi</option><option>Bengaluru</option></select><select><option>All cost centres</option><option>Sales</option><option>Operations</option></select><select value={side} onChange={e=>setSide(e.target.value)}><option>All</option><option>Debit</option><option>Credit</option></select></div><div className="ledgerTable"><div className="lr lrh">{['Date','Voucher','Type','Account','Description','Debit','Credit','Reference','Branch','Cost centre','Created by','Created date',''].map(x=><span>{x}</span>)}</div>{rows.map(x=><div className="lr">{x.map((v,i)=><span className={i===5?'debit':i===6?'credit':''}>{v}</span>)}<button onClick={()=>setDetail(x)} title="Drill down"><IconEye/></button></div>)}</div><footer className="tableFoot"><span>Showing {rows.length} ledger entries</span><b>Total debit ₹5,15,000  Total credit ₹5,15,000</b></footer></div>{detail&&<div className="drawer"><button onClick={()=>setDetail(null)}><IconX/></button><h2>Source transaction</h2><span className="postedPill">Posted</span><dl>{[['Voucher number',detail[1]],['Voucher type',detail[2]],['Account',detail[3]],['Description',detail[4]],['Reference',detail[7]],['Branch',detail[8]],['Cost centre',detail[9]],['Created by',detail[10]],['Created date',detail[11]]].map(x=><div><dt>{x[0]}</dt><dd>{x[1]}</dd></div>)}</dl><button className="primary" onClick={()=>notify('Source voucher opened')}>Open full voucher</button></div>}</section>}
function JournalEntries({notify}){let[mode,setMode]=useState('list'),[rows,setRows]=useState([{account:'',description:'',debit:'',credit:'',cost:'Operations',tax:'No tax',reference:''},{account:'',description:'',debit:'',credit:'',cost:'Operations',tax:'No tax',reference:''}]),[error,setError]=useState('');let journals=[['JE-2026-0048','03 Sep 2026','August payroll accrual','Kochi','₹4,20,000','Pending Approval'],['JE-2026-0047','02 Sep 2026','Bank charges adjustment','Kochi','₹2,500','Posted'],['JE-2026-0046','01 Sep 2026','Opening balance correction','Bengaluru','₹85,000','Approved'],['JE-2026-0045','31 Aug 2026','Month-end accrual','Kochi','₹1,25,000','Reversed'],['JE-2026-0044','30 Aug 2026','Travel advance','Kochi','₹30,000','Draft']];let debit=rows.reduce((a,r)=>a+(+r.debit||0),0),credit=rows.reduce((a,r)=>a+(+r.credit||0),0),update=(i,k,v)=>setRows(rows.map((r,n)=>n===i?{...r,[k]:v}:r));function post(){if(!debit||debit!==credit){setError('Journal is unbalanced. Total debit must equal total credit.');return}if(rows.some(r=>!r.account)){setError('Select an account for every journal line.');return}setError('');notify('Journal submitted for approval');setMode('list')}if(mode==='list')return <section className="journals"><div className="pageTop"><div><h2>Journal Entries</h2><p>Create, approve, post and reverse manual accounting entries.</p></div><button className="primary" onClick={()=>setMode('create')}><IconPlus/>New journal entry</button></div><div className="statusTabs">{['All','Draft','Pending Approval','Approved','Posted','Reversed'].map(x=><button>{x}</button>)}</div><div className="journalCard card"><div className="journalHead"><label><IconSearch/><input placeholder="Search journal or narration..."/></label><select><option>All branches</option><option>Kochi</option><option>Bengaluru</option></select><input type="date" defaultValue="2026-09-03"/></div><div className="jtable"><div className="jr jrh"><span>Voucher number</span><span>Date</span><span>Narration</span><span>Branch</span><span>Amount</span><span>Status</span><span/></div>{journals.map((x,i)=><div className="jr">{x.map((v,n)=><span className={n===5?'jstatus s'+i:''}>{v}</span>)}<button onClick={()=>notify(x[0]+' opened')}><IconEye/></button></div>)}</div></div></section>;return <section className="journalCreate"><div className="pageTop"><div><button className="backlink" onClick={()=>setMode('list')}>← Journal entries</button><h2>New journal entry</h2><p>Debit and credit totals must balance before posting.</p></div><span className="draftPill">Draft</span></div><div className="journalHeader card"><div className="jhgrid"><label>Voucher number<input value="Auto — JE-2026-0049" disabled/></label><label>Date<input type="date" defaultValue="2026-09-03"/></label><label>Reference<input placeholder="External reference"/></label><label>Branch<select><option>Kochi Branch</option><option>Bengaluru Branch</option></select></label><label>Cost centre<select><option>Operations</option><option>Sales</option><option>Marketing</option></select></label><label>Attachment<button type="button"><IconPaperclip/>Attach document</button></label><label className="narration">Narration<textarea placeholder="Explain the purpose of this journal entry"/></label></div></div><div className="journalLines card"><div className="lineTitle"><h3>Journal lines</h3><button onClick={()=>setRows([...rows,{account:'',description:'',debit:'',credit:'',cost:'Operations',tax:'No tax',reference:''}])}><IconPlus/>Add line</button></div><div className="linegrid linehead"><span>Account *</span><span>Description</span><span>Debit (₹)</span><span>Credit (₹)</span><span>Cost centre</span><span>Tax</span><span>Reference</span><span/></div>{rows.map((r,i)=><div className="linegrid"><select value={r.account} onChange={e=>update(i,'account',e.target.value)}><option value="">Select account</option><option>1000 · Cash</option><option>1010 · Bank</option><option>4000 · Sales</option><option>5000 · Purchase</option><option>5100 · Salary</option></select><input value={r.description} onChange={e=>update(i,'description',e.target.value)} placeholder="Line description"/><input type="number" value={r.debit} onChange={e=>update(i,'debit',e.target.value)} placeholder="0.00"/><input type="number" value={r.credit} onChange={e=>update(i,'credit',e.target.value)} placeholder="0.00"/><select value={r.cost} onChange={e=>update(i,'cost',e.target.value)}><option>Operations</option><option>Sales</option></select><select value={r.tax} onChange={e=>update(i,'tax',e.target.value)}><option>No tax</option><option>GST 18%</option></select><input value={r.reference} onChange={e=>update(i,'reference',e.target.value)} placeholder="Reference"/><button onClick={()=>rows.length>2&&setRows(rows.filter((_,n)=>n!==i))}><IconTrash/></button></div>)}<div className="balance"><span>Total</span><b>₹{debit.toLocaleString('en-IN')}</b><b>₹{credit.toLocaleString('en-IN')}</b><em className={debit===credit&&debit?'balanced':'unbalanced'}>{debit===credit&&debit?'Balanced':'Difference ₹'+Math.abs(debit-credit).toLocaleString('en-IN')}</em></div>{error&&<div className="journalError"><IconAlertTriangle/>{error}</div>}</div><footer className="journalActions"><button onClick={()=>{notify('Journal saved as draft');setMode('list')}}>Save draft</button><button onClick={()=>notify('Journal sent for approval')}>Submit for approval</button><button className="primary" onClick={post}>Post journal</button></footer></section>}

import InvoiceWorkspace from './InvoiceWorkspace.jsx';
import {KEY, initial, reports, money} from './invoice-engine.js';
import CreditNotes from './CreditNotes.jsx';













