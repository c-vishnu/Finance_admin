import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import PeriodClosing from './PeriodClosing.jsx';
import SettingsWorkspace from './SettingsWorkspace.jsx';
import HelpCenter from './HelpCenter.jsx';
import AuditLog from './AuditLog.jsx';
import TransactionRegister from './TransactionRegister.jsx';
import BalanceSheet from './BalanceSheet.jsx';
import {IconChevronRight,IconHome,IconBook,IconPackage,IconShoppingCart,IconTruck,IconBuildingBank,IconReceipt,IconBuilding,IconShieldCheck,IconReport,IconSettings,IconHelpCircle,IconMoon,IconSun} from '@tabler/icons-react';
import './navigation.css';
import WorkingContextSwitcher from './WorkingContextSwitcher.jsx';
import './settings-portal.css';
import {pageLabel,useTerminology} from './terminology.jsx';

const leaf=(label,page=label)=>({label,page});
const sections=[
  {...leaf('Dashboard'),icon:IconHome},
  {label:'Accounting',icon:IconBook,children:[leaf('Chart of Accounts'),leaf('Journal','Journal Entries')]},
  {...leaf('Items'),icon:IconPackage},
  {label:'Sales',icon:IconShoppingCart,children:[leaf('Customers'),leaf('Sales Orders'),leaf('Invoices'),leaf('Receipts','Payments Received'),leaf('Credit Notes')]},
  {label:'Purchases',icon:IconTruck,children:[leaf('Vendors'),leaf('Purchase Orders'),leaf('Goods Receipts'),leaf('Purchase Bills'),leaf('Debit Notes'),leaf('Vendor Payments','Payments Made')]},
  {label:'Banking',icon:IconBuildingBank,children:[leaf('Bank Accounts'),leaf('Transactions','Bank Transactions'),leaf('Reconciliation','Bank Reconciliation'),leaf('Settings','Banking Settings')]},
  {label:'Expenses',icon:IconReceipt,children:[leaf('Expenses','Expense Claims'),leaf('Expense Categories')]},
  {label:'Assets',icon:IconBuilding,children:[leaf('Asset Register'),leaf('Depreciation'),leaf('Asset Transactions')]},
  {label:'Tax & Compliance',icon:IconShieldCheck,children:[leaf('GST','GST Reports'),leaf('TDS','TDS Reports')]},
  {label:'Reports',icon:IconReport,children:[leaf('Transaction Register'),{label:'Financial Statements',children:[leaf('Balance Sheet'),leaf('Profit & Loss','Financial Reports'),leaf('Cash Flow Statement','Financial Reports')]},{label:'Accounting Reports',children:[leaf('Trial Balance'),leaf('General Ledger'),leaf('Account Ledger','General Ledger'),leaf('Day Book')]},leaf('Purchase Reports'),leaf('Audit Log')]},
  {label:'Settings',icon:IconSettings,children:[leaf('Settings Center'),leaf('Company'),leaf('Branch','Branches'),{label:'Other',children:[leaf('Budgets'),leaf('Period Lock'),leaf('Inventory Adjustments')]}]},
  {...leaf('Help Center'),icon:IconHelpCircle}
];
const contains=(node,page)=>node.page===page||node.children?.some(child=>contains(child,page));

export default function Navigation({active,onNavigate,collapsed=false}){
  const {t}=useTerminology();
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem('finance-erp-nav-theme')!=='light'}catch{return true}});
  const [expanded,setExpanded]=useState({});
  const [railMenu,setRailMenu]=useState(null);
  function setTheme(next){const isDark=next==='dark';setDark(isDark);try{localStorage.setItem('finance-erp-nav-theme',isDark?'dark':'light')}catch{}window.dispatchEvent(new CustomEvent('nav-theme-change',{detail:isDark?'dark':'light'}))}
  useEffect(()=>{const sync=e=>{setDark(e.detail==='dark')};window.addEventListener('nav-theme-change',sync);return()=>window.removeEventListener('nav-theme-change',sync)},[])
  useEffect(()=>{
    const notifications=document.querySelector('.app>header button[aria-label="Notifications"]');
    const help=document.querySelector('.app>header button[aria-label="Help"]');
    const settings=document.querySelector('.app>header button[aria-label="Settings"]');
    const showNotifications=()=>onNavigate('Audit Log'),openHelp=()=>onNavigate('Help Center'),openSettings=()=>onNavigate('Settings Center');
    notifications?.addEventListener('click',showNotifications);help?.addEventListener('click',openHelp);settings?.addEventListener('click',openSettings);
    return()=>{notifications?.removeEventListener('click',showNotifications);help?.removeEventListener('click',openHelp);settings?.removeEventListener('click',openSettings)};
  },[onNavigate]);
  useEffect(()=>{if(!collapsed)setRailMenu(null)},[collapsed]);
  useEffect(()=>{const close=event=>{if(event.key==='Escape')setRailMenu(null)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
  function choose(page){setRailMenu(null);onNavigate(page)}
  function railItems(nodes,parent=''){
    return nodes.map(node=>node.children?<div className="railSubGroup" key={`${parent}/${node.label}`}><span>{node.label}</span>{railItems(node.children,`${parent}/${node.label}`)}</div>:<button type="button" key={`${parent}/${node.label}`} className={active===node.page?'selected':''} onClick={()=>choose(node.page)}>{pageLabel(node.page,t)}</button>);
  }
  function render(node,parent='',depth=0){
    const id=parent?`${parent}/${node.label}`:node.label;
    const Icon=node.icon;
    if(!node.children){const label=pageLabel(node.page,t);return <li key={id}><button type="button" className={`navLeaf ${active===node.page?'selected':''} ${depth===0?'navStandalone':''}`} aria-label={label} title={label} aria-current={active===node.page?'page':undefined} onClick={()=>choose(node.page)}>{Icon&&<Icon size={17}/>}<span>{label}</span></button></li>}
    const open=expanded[id]??contains(node,active);
    const railOpen=railMenu?.id===id;
    return <li key={id} className="navGroup"><button type="button" className={`navGroupButton ${contains(node,active)?'hasActive':''}`} aria-label={node.label} title={node.label} aria-expanded={collapsed?railOpen:open} aria-controls={collapsed?'rail-submenu':`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} onClick={event=>{if(collapsed){const box=event.currentTarget.getBoundingClientRect();setRailMenu(previous=>previous?.id===id?null:{id,node,top:Math.max(8,Math.min(box.top,window.innerHeight-380))});return}setExpanded(previous=>({...previous,[id]:!open}))}}>{Icon&&<Icon size={17}/>}<span>{node.label}</span><IconChevronRight size={14} className={open?'expanded':''}/></button><ul id={`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} hidden={!open}>{node.children.map(child=>render(child,id,depth+1))}</ul></li>;
  }
  const railFlyout=collapsed&&railMenu&&createPortal(<><button type="button" className="railSubmenuBackdrop" aria-label="Close navigation submenu" onClick={()=>setRailMenu(null)}/><section id="rail-submenu" className="railSubmenu" data-theme={dark?'dark':'light'} style={{top:railMenu.top}} aria-label={`${railMenu.node.label} submenu`}><strong>{railMenu.node.label}</strong><div>{railItems(railMenu.node.children,railMenu.id)}</div></section></>,document.body);
  return <><nav className="erpNavigation" data-theme={dark?'dark':'light'} aria-label="Main navigation"><ul>{sections.filter(node=>node.label!=='Help Center').map(node=>render(node))}</ul><div className="navSidebarFooter"><WorkingContextSwitcher theme="light"/></div></nav>{railFlyout}{active==='Balance Sheet'&&createPortal(<div className="transactionPortal"><BalanceSheet notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Transaction Register'&&createPortal(<div className="transactionPortal"><TransactionRegister onNavigate={onNavigate}/></div>,document.body)}{active==='Audit Log'&&createPortal(<div className="auditPortal"><AuditLog/></div>,document.body)}{active==='Help Center'&&createPortal(<div className="helpPortal"><HelpCenter onNavigate={onNavigate}/></div>,document.body)}{active==='Settings Center'&&createPortal(<div className="settingsPortal"><SettingsWorkspace onNavigate={onNavigate}/></div>,document.body)}{active==='Period Lock'&&createPortal(<PeriodClosing onNavigate={onNavigate}/>,document.body)}</>;
}

