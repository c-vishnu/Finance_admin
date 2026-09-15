import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import PeriodClosing from './PeriodClosing.jsx';
import Vendors from './Vendors.jsx';
import Purchases from './Purchases.jsx';
import GoodsReceipts from './GoodsReceipts.jsx';
import VendorPayments from './VendorPayments.jsx';
import PurchaseReports from './PurchaseReports.jsx';
import DebitNotes from './DebitNotes.jsx';
import SettingsWorkspace from './SettingsWorkspace.jsx';
import HelpCenter from './HelpCenter.jsx';
import AuditLog from './AuditLog.jsx';
import TransactionRegister from './TransactionRegister.jsx';
import BalanceSheet from './BalanceSheet.jsx';
import {IconChevronRight,IconHome,IconBook,IconPackage,IconShoppingCart,IconTruck,IconBuildingBank,IconReceipt,IconBuilding,IconShieldCheck,IconReport,IconSettings,IconHelpCircle} from '@tabler/icons-react';
import './navigation.css';
import './settings-portal.css';
import {pageLabel,useTerminology} from './terminology.jsx';

const leaf=(label,page=label)=>({label,page});
const sections=[
  {...leaf('Dashboard'),icon:IconHome},
  {label:'Accounting',icon:IconBook,children:[leaf('Chart of Accounts'),leaf('Journal Entries'),leaf('Budgets'),leaf('Period Closing')]},
  {label:'Inventory',icon:IconPackage,children:[leaf('Items')]},
  {label:'Sales',icon:IconShoppingCart,children:[leaf('Customers'),leaf('Sales Orders'),leaf('Invoices'),leaf('Credit Notes'),leaf('Receipts','Payments Received')]},
  {label:'Purchases',icon:IconTruck,children:[leaf('Vendors'),leaf('Purchase Orders'),leaf('Goods Receipts'),leaf('Purchase Bills'),leaf('Debit Notes'),leaf('Vendor Payments','Payments Made')]},
  {label:'Banking',icon:IconBuildingBank,children:[leaf('Bank Accounts'),leaf('Transactions','Bank Transactions'),leaf('Reconciliation','Bank Reconciliation'),leaf('Settings','Banking Settings')]},
  {label:'Expenses',icon:IconReceipt,children:[leaf('Expenses','Expense Claims'),leaf('Expense Categories')]},
  {label:'Assets',icon:IconBuilding,children:[leaf('Asset Register'),leaf('Depreciation'),leaf('Asset Transactions')]},
  {label:'Tax & Compliance',icon:IconShieldCheck,children:[leaf('GST','GST Reports'),leaf('TDS','TDS Reports')]},
  {label:'Reports',icon:IconReport,children:[leaf('Transaction Register'),{label:'Financial Statements',children:[leaf('Balance Sheet'),leaf('Profit & Loss','Financial Reports'),leaf('Cash Flow Statement','Financial Reports')]},{label:'Accounting Reports',children:[leaf('Trial Balance'),leaf('General Ledger'),leaf('Account Ledger','General Ledger'),leaf('Day Book')]},leaf('Purchase Reports'),leaf('Audit Log')]},
  {label:'Settings',icon:IconSettings,children:[leaf('Settings Center'),leaf('Company'),leaf('Branch','Branches')]},
  {...leaf('Help Center'),icon:IconHelpCircle}
];
const contains=(node,page)=>node.page===page||node.children?.some(child=>contains(child,page));

export default function Navigation({active,onNavigate}){
  const {t}=useTerminology();
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem('finance-erp-nav-theme')!=='light'}catch{return true}});
  function toggleTheme(){const next=!dark;setDark(next);try{localStorage.setItem('finance-erp-nav-theme',next?'dark':'light')}catch{/* Keep the switch usable when storage is unavailable. */}}
  const [expanded,setExpanded]=useState({});
  useEffect(()=>{
    const notifications=document.querySelector('.app>header button[aria-label="Notifications"]');
    const help=document.querySelector('.app>header button[aria-label="Help"]');
    const settings=document.querySelector('.app>header button[aria-label="Settings"]');
    const showNotifications=()=>onNavigate('Audit Log'),openHelp=()=>onNavigate('Help Center'),openSettings=()=>onNavigate('Settings Center');
    notifications?.addEventListener('click',showNotifications);help?.addEventListener('click',openHelp);settings?.addEventListener('click',openSettings);
    return()=>{notifications?.removeEventListener('click',showNotifications);help?.removeEventListener('click',openHelp);settings?.removeEventListener('click',openSettings)};
  },[onNavigate]);
  function render(node,parent='',depth=0){
    const id=parent?`${parent}/${node.label}`:node.label;
    const Icon=node.icon;
    if(!node.children)return <li key={id}><button type="button" className={`navLeaf ${active===node.page?'selected':''} ${depth===0?'navStandalone':''}`} aria-current={active===node.page?'page':undefined} onClick={()=>onNavigate(node.page)}>{Icon&&<Icon size={17}/>}<span>{pageLabel(node.page,t)}</span></button></li>;
    const open=expanded[id]??contains(node,active);
    return <li key={id} className="navGroup"><button type="button" className={`navGroupButton ${contains(node,active)?'hasActive':''}`} aria-expanded={open} aria-controls={`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} onClick={()=>setExpanded(previous=>({...previous,[id]:!open}))}>{Icon&&<Icon size={17}/>}<span>{node.label}</span><IconChevronRight size={14} className={open?'expanded':''}/></button><ul id={`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} hidden={!open}>{node.children.map(child=>render(child,id,depth+1))}</ul></li>;
  }
  return <><nav className="erpNavigation" data-theme={dark?'dark':'light'} aria-label="Main navigation"><ul>{sections.filter(node=>node.label!=='Help Center').map(node=>render(node))}</ul><div className="navThemeFooter"><button type="button" className={`navLeaf navHelp ${active==='Help Center'?'selected':''}`} onClick={()=>onNavigate('Help Center')}><IconHelpCircle size={17}/><span>Help Center</span></button><button type="button" className="navThemeSwitch" role="switch" aria-checked={dark} aria-label="Dark navigation" onClick={toggleTheme}><span>Dark navigation</span><i className="navThemeTrack" aria-hidden="true"/></button></div></nav>{active==='Balance Sheet'&&createPortal(<div className="transactionPortal"><BalanceSheet notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Transaction Register'&&createPortal(<div className="transactionPortal"><TransactionRegister onNavigate={onNavigate}/></div>,document.body)}{active==='Audit Log'&&createPortal(<div className="auditPortal"><AuditLog/></div>,document.body)}{active==='Help Center'&&createPortal(<div className="helpPortal"><HelpCenter onNavigate={onNavigate}/></div>,document.body)}{active==='Settings Center'&&createPortal(<div className="settingsPortal"><SettingsWorkspace onNavigate={onNavigate}/></div>,document.body)}{active==='Period Closing'&&createPortal(<PeriodClosing onNavigate={onNavigate}/>,document.body)}{active==='Vendors'&&createPortal(<div className="vendorPortal"><Vendors onNavigate={onNavigate}/></div>,document.body)}{active==='Goods Receipts'&&createPortal(<div className="purchasePortal"><GoodsReceipts/></div>,document.body)}{active==='Debit Notes'&&createPortal(<div className="purchasePortal"><DebitNotes onNavigate={onNavigate}/></div>,document.body)}{active==='Payments Made'&&createPortal(<div className="purchasePortal"><VendorPayments onNavigate={onNavigate}/></div>,document.body)}{active==='Purchase Reports'&&createPortal(<div className="purchasePortal"><PurchaseReports onNavigate={onNavigate}/></div>,document.body)}{['Purchase Orders','Purchase Bills'].includes(active)&&createPortal(<div className="purchasePortal"><Purchases key={active} page={active} onNavigate={onNavigate}/></div>,document.body)}</>;
}

