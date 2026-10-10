import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import PeriodClosing from './PeriodClosing.jsx';
import SettingsWorkspace from './SettingsWorkspace.jsx';
import HelpCenter from './HelpCenter.jsx';
import AuditLog from './AuditLog.jsx';
import TransactionRegister from './TransactionRegister.jsx';
import GstTaxReports from './GstTaxReports.jsx';
import TdsReports from './TdsReports.jsx';
import BalanceSheet from './BalanceSheet.jsx';
import TrialBalance from './TrialBalance.jsx';
import ProfitLoss from './ProfitLoss.jsx';
import CashFlowStatement from './CashFlowStatement.jsx';
import CustomerOutstanding from './CustomerOutstanding.jsx';
import SupplierOutstanding from './SupplierOutstanding.jsx';
import SalesReport from './SalesReport.jsx';
import PurchaseReport from './PurchaseReport.jsx';
import ExpenseReport from './ExpenseReport.jsx';
import IncomeReport from './IncomeReport.jsx';
import CashAndBankBook from './CashAndBankBook.jsx';
import BankReconciliationReport from './BankReconciliationReport.jsx';
import JournalReport from './JournalReport.jsx';
import CustomerAging from './CustomerAging.jsx';
import SupplierAging from './SupplierAging.jsx';
import ReportsSecondaryNav, { isReportPage } from './ReportsSecondaryNav.jsx';
import {IconChevronRight,IconHome,IconBook,IconPackage,IconShoppingCart,IconTruck,IconBuildingBank,IconReceipt,IconBuilding,IconShieldCheck,IconReport,IconSettings,IconHelpCircle,IconMoon,IconSun,IconChartHistogram,IconCashBanknote,IconListDetails,IconCalculator,IconChartPie,IconUsers} from '@tabler/icons-react';
import './navigation.css';
import './settings-portal.css';
import {pageLabel,useTerminology} from './terminology.jsx';

const leaf=(label,page=label)=>({label,page});
const sections=[
  {...leaf('Dashboard'),icon:IconHome},
  {label:'Accounting',icon:IconBook,children:[leaf('Chart of Accounts'),leaf('Journal','Journal Entries')]},
  {...leaf('Items'),icon:IconPackage},
  {...leaf('Income','Income'),icon:IconCashBanknote},
  {...leaf('Expenses','Expense Claims'),icon:IconReceipt},
  {label:'Sales',icon:IconShoppingCart,children:[leaf('Customers'),leaf('Sales Orders'),leaf('Invoices'),leaf('Receipts','Payments Received'),leaf('Credit Notes')]},
  {label:'Purchases',icon:IconTruck,children:[leaf('Vendors'),leaf('Purchase Orders'),leaf('Purchase Bills'),leaf('Debit Notes'),leaf('Payments Made')]},
  {label:'Banking',icon:IconBuildingBank,children:[leaf('Bank Accounts'),leaf('Bank Transactions'),leaf('Bank Reconciliation'),leaf('Bank Transfers')]},
  {label:'Assets',icon:IconBuilding,children:[leaf('Asset Register'),leaf('Depreciation'),leaf('Asset Transactions')]},
  /* leaf('Transaction Register') is the default report leaf */
  {...leaf('Reports','Transaction Register'),icon:IconReport},
  {label:'Settings',icon:IconSettings,children:[leaf('Settings Center'),leaf('Company'),leaf('Branch','Branches'),{label:'Other',children:[leaf('Budgets'),leaf('Period Lock'),leaf('Inventory Adjustments')]}]},
  {...leaf('Help Center'),icon:IconHelpCircle}
];
const contains=(node,page)=>{
  if(node.label==='Reports')return isReportPage(page);
  return node.page===page||node.children?.some(child=>contains(child,page));
};

export default function Navigation({active,onNavigate,collapsed=false,onToggleNav}){
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
    if(!node.children){
      const label=pageLabel(node.label,t);
      const isSelected=node.label==='Reports'?isReportPage(active):active===node.page;
      return <li key={id}><button type="button" className={`navLeaf ${isSelected?'selected':''} ${depth===0?'navStandalone':''}`} aria-label={label} title={label} aria-current={isSelected?'page':undefined} onClick={()=>choose(node.page)}>{Icon&&<Icon size={19}/>}<span>{label}</span></button></li>;
    }
    const open=expanded[id]??contains(node,active);
    const railOpen=railMenu?.id===id;
    return <li key={id} className="navGroup"><button type="button" className={`navGroupButton ${contains(node,active)?'hasActive':''}`} aria-label={node.label} title={node.label} aria-expanded={collapsed?railOpen:open} aria-controls={collapsed?'rail-submenu':`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} onClick={event=>{if(collapsed){const box=event.currentTarget.getBoundingClientRect();setRailMenu(previous=>previous?.id===id?null:{id,node,top:Math.max(8,Math.min(box.top,window.innerHeight-380))});return}setExpanded(previous=>({...previous,[id]:!open}))}}>{Icon&&<Icon size={19}/>}<span>{node.label}</span><IconChevronRight size={15} className={open?'expanded':''}/></button><ul id={`nav-${id.replaceAll('/','-').replaceAll(' ','-')}`} hidden={!open}>{node.children.map(child=>render(child,id,depth+1))}</ul></li>;
  }
  const railFlyout=collapsed&&railMenu&&createPortal(<><button type="button" className="railSubmenuBackdrop" aria-label="Close navigation submenu" onClick={()=>setRailMenu(null)}/><section id="rail-submenu" className="railSubmenu" data-theme={dark?'dark':'light'} style={{top:railMenu.top}} aria-label={`${railMenu.node.label} submenu`}><strong>{railMenu.node.label}</strong><div>{railItems(railMenu.node.children,railMenu.id)}</div></section></>,document.body);
  return <><nav className="erpNavigation" data-theme={dark?'dark':'light'} aria-label="Main navigation"><ul>{sections.filter(node=>node.label!=='Help Center').map(node=>render(node))}</ul></nav>{isReportPage(active)&&<ReportsSecondaryNav active={active} onNavigate={onNavigate}/>}{railFlyout}{active==='Balance Sheet'&&createPortal(<div className="transactionPortal"><BalanceSheet notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Trial Balance'&&createPortal(<div className="transactionPortal"><TrialBalance notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Profit & Loss'&&createPortal(<div className="transactionPortal"><ProfitLoss notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Cash Flow Statement'&&createPortal(<div className="transactionPortal"><CashFlowStatement notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Customer Outstanding'&&createPortal(<div className="transactionPortal"><CustomerOutstanding notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Supplier Outstanding'&&createPortal(<div className="transactionPortal"><SupplierOutstanding notify={()=>{}} onNavigate={onNavigate}/></div>,document.body)}{active==='Transaction Register'&&createPortal(<div className="transactionPortal"><TransactionRegister onNavigate={onNavigate}/></div>,document.body)}{active==='GST Reports'&&createPortal(<div className="transactionPortal"><GstTaxReports onNavigate={onNavigate}/></div>,document.body)}{active==='TDS Reports'&&createPortal(<div className="transactionPortal"><TdsReports onNavigate={onNavigate}/></div>,document.body)}{active==='Sales Report'&&createPortal(<div className="transactionPortal"><SalesReport onNavigate={onNavigate}/></div>,document.body)}{active==='Purchase Report'&&createPortal(<div className="transactionPortal"><PurchaseReport onNavigate={onNavigate}/></div>,document.body)}{active==='Expense Report'&&createPortal(<div className="transactionPortal"><ExpenseReport onNavigate={onNavigate}/></div>,document.body)}{active==='Income'&&createPortal(<div className="transactionPortal"><IncomeReport page="Income" onNavigate={onNavigate}/></div>,document.body)}{active==='Cash & Bank Book'&&createPortal(<div className="transactionPortal"><CashAndBankBook onNavigate={onNavigate}/></div>,document.body)}{active==='Bank Reconciliation Report'&&createPortal(<div className="transactionPortal"><BankReconciliationReport onNavigate={onNavigate}/></div>,document.body)}{active==='Journal Report'&&createPortal(<div className="transactionPortal"><JournalReport onNavigate={onNavigate}/></div>,document.body)}{active==='Customer Aging'&&createPortal(<div className="transactionPortal"><CustomerAging onNavigate={onNavigate}/></div>,document.body)}{active==='Supplier Aging'&&createPortal(<div className="transactionPortal"><SupplierAging onNavigate={onNavigate}/></div>,document.body)}{active==='Audit Log'&&createPortal(<div className="auditPortal"><AuditLog/></div>,document.body)}{active==='Help Center'&&createPortal(<div className="helpPortal"><HelpCenter onNavigate={onNavigate}/></div>,document.body)}{active==='Settings Center'&&createPortal(<div className="settingsPortal"><SettingsWorkspace onNavigate={onNavigate}/></div>,document.body)}{active==='Period Lock'&&createPortal(<PeriodClosing onNavigate={onNavigate}/>,document.body)}</>;
}
