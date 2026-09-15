export const QUICK_CREATE_KEY='wayvida-quick-create';

export const quickCreateActions=[
 {id:'invoice',label:'Invoice',category:'Sales',page:'Invoices',roles:['Admin','Sales Executive'],keywords:'sales customer'},
 {id:'quotation',label:'Quotation',category:'Sales',page:'Sales Orders',roles:['Admin','Sales Executive'],keywords:'quote estimate'},
 {id:'sales-order',label:'Sales Order',category:'Sales',page:'Sales Orders',roles:['Admin','Sales Executive'],keywords:'customer order'},
 {id:'credit-note',label:'Credit Note',category:'Sales',page:'Credit Notes',roles:['Admin','Sales Executive','Accountant'],keywords:'customer adjustment'},
 {id:'customer-payment',label:'Customer Payment',category:'Sales',page:'Payments Received',roles:['Admin','Sales Executive','Accountant'],keywords:'receipt receive money'},
 {id:'purchase-order',label:'Purchase Order',category:'Purchases',page:'Purchase Orders',roles:['Admin','Accountant'],keywords:'vendor order'},
 {id:'purchase-bill',label:'Purchase Bill',category:'Purchases',page:'Purchase Bills',roles:['Admin','Accountant'],keywords:'vendor invoice'},
 {id:'debit-note',label:'Debit Note',category:'Purchases',page:'Debit Notes',roles:['Admin','Accountant'],keywords:'vendor credit purchase return'},
 {id:'vendor-payment',label:'Vendor Payment',category:'Purchases',page:'Payments Made',roles:['Admin','Accountant'],keywords:'pay supplier'},
 {id:'journal-entry',label:'Journal Entry',category:'Accounting',page:'Journal Entries',roles:['Admin','Accountant'],keywords:'manual adjustment'},
 {id:'bank-transfer',label:'Bank Transfer',category:'Accounting',page:'Bank Transactions',roles:['Admin','Accountant'],keywords:'transfer money'},
 {id:'expense',label:'Expense',category:'Accounting',page:'Expense Claims',roles:['Admin','Accountant'],keywords:'claim spend'},
 {id:'customer',label:'Customer',category:'Masters',page:'Customers',roles:['Admin','Sales Executive'],keywords:'client'},
 {id:'vendor',label:'Vendor',category:'Masters',page:'Vendors',roles:['Admin','Accountant'],keywords:'supplier'},
 {id:'account',label:'Account',category:'Masters',page:'Chart of Accounts',roles:['Admin','Accountant'],keywords:'ledger coa'},
 {id:'item',label:'Item',category:'Masters',page:'Items',roles:['Admin','Sales Executive','Accountant'],keywords:'product service'},
 {id:'bank-account',label:'Bank Account',category:'Masters',page:'Bank Accounts',roles:['Admin','Accountant'],keywords:'cash bank ledger'},
 {id:'asset',label:'Asset',category:'Assets',page:'Asset Register',roles:['Admin','Accountant'],keywords:'fixed asset'},
 {id:'task',label:'Task',category:'Other',page:'Dashboard',roles:['Admin','Sales Executive','Accountant'],keywords:'todo'},
 {id:'note',label:'Note',category:'Other',page:'Dashboard',roles:['Admin','Sales Executive','Accountant'],keywords:'memo'}
];

const contextCategory=page=>/Purchase|Vendor|Debit|Goods/.test(page)?'Purchases':/Invoice|Sales|Customer|Credit|Receipt/.test(page)?'Sales':/Bank/.test(page)?'Accounting':/Account|Journal|Ledger|Trial/.test(page)?'Accounting':'';
export function visibleQuickActions(role='Admin',query='',activePage='Dashboard'){
 const term=query.trim().toLowerCase(),priority=contextCategory(activePage);
 return quickCreateActions.filter(action=>action.roles.includes(role)&&(!term||`${action.label} ${action.category} ${action.keywords}`.toLowerCase().includes(term))).sort((a,b)=>(b.category===priority)-(a.category===priority)||quickCreateActions.indexOf(a)-quickCreateActions.indexOf(b));
}
export function openQuickAction(action,onNavigate){
 if(typeof sessionStorage!=='undefined')sessionStorage.setItem(QUICK_CREATE_KEY,action.id);
 onNavigate(action.page);
}
