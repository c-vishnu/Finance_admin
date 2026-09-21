// Browser-local repository. All monetary values are integer paise; one commit per command.
import {validatePostingDate} from './period-locking.js';
export const KEY='wayvida-accounting-v1';
/* How an invoice can repeat. One vocabulary, read by the register dialog and checked by the engine. */
export const RECURRING_FREQUENCIES=['Monthly','Quarterly','Half-Yearly','Yearly'];
export const money=n=>((n||0)/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
export const today=()=>new Date().toLocaleDateString('en-CA');
export function minor(value){if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('Enter a non-negative amount with at most two decimals.');const [a,b='']=String(value).split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>1e13)throw Error('Amount is too large.');return n}
export function calculate(doc,config){
 if(!doc.lines?.length)throw Error('Add at least one item.');
 if(!doc.place?.trim()||!config.state?.trim())throw Error('Company state and place of supply are required.');const intra=doc.place.trim().toLowerCase()===config.state.trim().toLowerCase();
 const lines=doc.lines.map(l=>{const qty=Number(l.qty),rate=minor(l.rate||'0'),discount=Number(l.discount||0);if(!l.description?.trim()||!l.unit||!Number.isFinite(qty)||qty<=0||qty>1e6)throw Error('Each item needs a selection, unit and positive quantity.');const enteredGross=Math.round(qty*rate),rates=lineTaxes(l,intra),combinedRate=Number(rates.cgst||0)+Number(rates.sgst||0)+Number(rates.igst||0)+Number(rates.cess||0),gross=l.priceTaxMode==='inclusive'&&combinedRate?Math.round(enteredGross*100/(100+combinedRate)):enteredGross,off=l.discountType==='fixed'?minor(l.discount||'0'):Math.round(gross*discount/100);if(!Number.isFinite(off)||off<0||off>gross)throw Error('Discount cannot exceed the item amount.');const taxable=gross-off,{cgst,sgst,igst,cessAmount}=calculateTax(l,intra,taxable);return {...l,enteredGross,gross,off,taxable,cgst,sgst,igst,cessAmount,total:taxable+cgst+sgst+igst+cessAmount}});
 const sum=k=>lines.reduce((s,l)=>s+l[k],0);const raw=sum('total'),total=config.roundRupee?Math.round(raw/100)*100:raw;if(!Number.isSafeInteger(total)||total>1e13)throw Error('Invoice total is too large.');return {lines,intra,subtotal:sum('gross'),discount:sum('off'),taxable:sum('taxable'),cgst:sum('cgst'),sgst:sum('sgst'),igst:sum('igst'),cess:sum('cessAmount'),roundOff:total-raw,total};
}
export function initial(){return {version:1,invoices:[],payments:[],journals:[],audit:[],accounts:[],config:{state:'Kerala',roundRupee:false,sales:'4100',ar:'1100',cgst:'2100',sgst:'2100',igst:'2100',cess:'2100',round:'5900'}}}
export function seedAccounts(state,seed){if(state.accounts.length)return state;state.accounts=Object.entries(seed).flatMap(([type,rows])=>rows.map(([code,name])=>({code,name,type,active:true,system:true})));return state}
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=m=>{throw Error(m)};
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const RESERVED_POSTING_ACCOUNTS={
 '1100':{name:'Accounts Receivable',type:'Assets',nature:'Debit',group:'Current Assets',controlAccount:true},
 '4000':{name:'Sales',type:'Income',nature:'Credit',group:'Operating Income',controlAccount:false},
 '4100':{name:'Service Income',type:'Income',nature:'Credit',group:'Operating Income',controlAccount:false},
 '2100':{name:'GST Payable',type:'Liabilities',nature:'Credit',group:'Current Liabilities',controlAccount:true},
 '5900':{name:'Rounding Adjustment',type:'Expenses',nature:'Debit',group:'Other Expenses',controlAccount:false},
};
export function account(s,code,type){
 let a=s.accounts.find(row=>row.code===code);
 const reserved=RESERVED_POSTING_ACCOUNTS[code];
 if(reserved&&type?.includes(reserved.type)&&(!a||!a.active||a.isGroup||a.type!==reserved.type)){
  if(!a){a={id:'system:'+code,code,...reserved,parent:'',active:true,isGroup:false,system:true,revision:1};s.accounts.push(a)}
  else Object.assign(a,{...reserved,name:a.name||reserved.name,group:a.group||reserved.group,active:true,isGroup:false,system:true,revision:(a.revision||0)+1});
 }
 if(!a?.active||a.isGroup||type&&!type.includes(a.type))fail('Configure an active posting '+(type?.join('/')||'ledger')+' account for '+(code||'missing mapping')+'.');return code
}
const periodModule=source=>/invoice|customer payment|credit note|receipt/i.test(source)?'Sales':/purchase|vendor payment|debit note/i.test(source)?'Purchases':/bank|transfer/i.test(source)?'Banking':/expense/i.test(source)?'Expenses':/inventory|stock/i.test(source)?'Inventory':/asset|depreciation/i.test(source)?'Assets':/payroll|salary/i.test(source)?'Payroll':/tax|gst|tds/i.test(source)?'Tax':'Accounting';
const periodContext=(inv,source)=>{if(typeof localStorage==='undefined')return null;const value=inv.companyId||inv.organizationId||localStorage.getItem('wayvida-demo-company')||'ABC01',companyId={abc:'ABC01',northstar:'NSR02',malabar:'MTC03',bluewave:'BWS04'}[value]||value;return {companyId,branchId:inv.branchId||inv.branch||localStorage.getItem('wayvida-demo-branch')||undefined,module:inv.periodModule||periodModule(source)}};
export function journal(s,inv,source,lines,date,token){const old=s.journals.find(j=>j.token===token);if(old)return old;const context=periodContext(inv,source);if(context){const lock=validatePostingDate(date,inv.role||'Business User',context);if(!lock.allowed)fail(lock.message)}lines=lines.filter(l=>l.debit||l.credit);if(!lines.length||lines.some(l=>!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0)||lines.reduce((n,l)=>n+l.debit-l.credit,0)!==0)fail('Accounting entry is unbalanced. Nothing was posted.');lines.forEach(l=>{account(s,l.account);const a=s.accounts.find(a=>a.code===l.account);if((a.controlAccount||a.allowManualPosting===false)&&['Journal Entry','Manual Journal'].includes(source))fail('Account '+a.code+' requires a source transaction and does not allow manual journal posting.');const branch=l.branch||inv.branch||inv.branchId,costCentre=l.costCentre||inv.costCentre||inv.costCentreId,allowedBranches=a.applicableBranches?.length?a.applicableBranches:[a.branchId].filter(Boolean);if(a.branchRequired&&!branch)fail('Account '+a.code+' requires a branch. Configure the source transaction before posting.');if(a.scope==='Branch Specific Account'&&allowedBranches.length&&!allowedBranches.includes(branch))fail('Account '+a.code+' is restricted to applicable branches: '+allowedBranches.join(', ')+'.');if(a.costCentreRequired&&!costCentre)fail('Account '+a.code+' requires a cost centre. Configure the source transaction before posting.');if(branch)l.branch=branch;if(costCentre)l.costCentre=costCentre;});const j={id:crypto.randomUUID(),number:'JE-'+String(s.journals.length+1).padStart(6,'0'),invoiceId:inv.originalInvoiceId||inv.id,creditNoteId:inv.creditNoteId||null,reference:inv.number,customerId:inv.customerId,companyId:context?.companyId,branchId:context?.branchId,module:context?.module,source,date,createdAt:new Date().toISOString(),createdBy:inv.role||'Admin',status:'Posted',token,lines};s.journals.push(j);return j}
export function outstanding(s,i){return i.status==='Cancelled'?0:i.totals.total-s.payments.filter(p=>p.invoiceId===i.id&&!p.reversed).reduce((n,p)=>n+p.amount,0)-(s.receiptAllocations||[]).filter(a=>a.invoiceId===i.id&&!a.voided).reduce((n,a)=>n+a.amount,0)-(s.creditApplications||[]).filter(a=>a.invoiceId===i.id&&!a.voided).reduce((n,a)=>n+a.amount,0)}
export function paymentStatus(s,i,date=today()){if(i.status==='Cancelled')return '—';const balance=outstanding(s,i);return i.posted&&balance===0?'Paid':i.posted&&balance>0&&i.dueDate<date?'Overdue':balance<i.totals.total?'Partially Paid':'Unpaid'}
export function command(state,action,payload){const s=clone(state),p=clone(payload);let i=s.invoices.find(x=>x.id===p.id),result;
 if(action==='save'){
  if(i&&i.revision!==p.revision)fail('This draft changed elsewhere. Reopen it before saving.');if(i&&i.status!=='Draft')fail('Only draft invoices can be edited.');if(!p.customerId||!p.customerName)fail('Select a customer.');if(!dateOK(p.date)||!dateOK(p.dueDate)||p.dueDate<p.date)fail('Due date must be on or after the invoice date.');if(!p.place)fail('Place of supply is required.');
  const number=p.number?.trim()||'INV-'+String(s.invoices.length+1).padStart(4,'0');if(s.invoices.some(x=>x.number.toLowerCase()===number.toLowerCase()&&x.id!==p.id))fail('Invoice number already exists.');const totals=calculate(p,s.config);result={...p,id:i?.id||crypto.randomUUID(),number,totals,revision:(i?.revision||0)+1,taxPolicy:{state:s.config.state,roundRupee:s.config.roundRupee},status:'Draft',posted:false,createdAt:i?.createdAt||new Date().toISOString()};s.invoices=i?s.invoices.map(x=>x.id===i.id?result:x):[...s.invoices,result];
 }else if(action==='config'){Object.assign(s.config,p);result=s.config;
 }else{
  if(!i)fail('Invoice not found.');result=i;
  if(action==='submit'){if(i.status!=='Draft')fail('Only drafts may be submitted.');i.status='Pending Approval';}
  else if(action==='post'){
   if(i.posted)return {state:s,result:i};if(!['Draft','Pending Approval'].includes(i.status))fail('Invoice cannot be posted.');const t=calculate(i,i.taxPolicy||s.config);if(t.total<=0)fail('Invoice total must be positive.');validateAccountTaxes(s,t);const ar=account(s,i.receivableAccount||s.config.ar,['Assets']);const lines=[{account:ar,debit:t.total,credit:0}];t.lines.forEach(l=>lines.push({account:account(s,l.income||s.config.sales,['Income']),debit:0,credit:l.taxable}));for(const k of ['cgst','sgst','igst','cess'])if(t[k])lines.push({account:account(s,s.config[k],['Liabilities']),debit:0,credit:t[k],description:k.toUpperCase()});if(t.roundOff)lines.push({account:account(s,s.config.round,['Expenses']),debit:Math.max(-t.roundOff,0),credit:Math.max(t.roundOff,0)});const j=journal(s,i,'Sales Invoice',lines,i.date,'invoice:'+i.id);Object.assign(i,{posted:true,status:'Approved',totals:t,journalId:j.id,arAccount:ar,postedAt:j.createdAt});
  }else if(action==='send'){if(!i.posted||i.status==='Cancelled')fail('Post the invoice first.');i.status='Sent';}
  else if(action==='pay'){
   if(s.payments.some(x=>x.token===p.token))return {state:s,result:i};if(!p.token)fail('Payment request ID required.');if(!i.posted||i.status==='Cancelled')fail('Only posted invoices can receive payments.');if(!dateOK(p.date)||p.date<i.date)fail('Payment date must be on or after invoice date.');const amount=minor(p.amount);if(amount<=0||amount>outstanding(s,i))fail('Payment must be positive and cannot exceed outstanding.');const bank=s.accounts.find(a=>a.code===p.bank&&a.active&&a.type==='Assets'&&/bank|cash/i.test(a.name));if(!bank)fail('Select an active cash or bank account.');const j=journal(s,i,'Customer Payment',[{account:bank.code,debit:amount,credit:0},{account:i.arAccount,debit:0,credit:amount}],p.date,'payment:'+p.token);s.payments.push({id:crypto.randomUUID(),number:'PAY-'+String(s.payments.length+1).padStart(4,'0'),invoiceId:i.id,customerId:i.customerId,amount,date:p.date,bank:p.bank,reference:p.reference||'',journalId:j.id,token:p.token});
  }else if(action==='cancel'){
   if(i.status==='Cancelled')return {state:s,result:i};if(!p.reason?.trim())fail('A cancellation reason is required.');if(s.payments.some(x=>x.invoiceId===i.id&&!x.reversed)||(s.receiptAllocations||[]).some(a=>a.invoiceId===i.id&&!a.voided))fail('This invoice has payments. A credit note and refund workflow is required; cancellation is blocked.');if((s.creditNotes||[]).some(c=>c.originalInvoiceId===i.id&&c.status!=='Cancelled'&&c.posted)||(s.creditApplications||[]).some(a=>a.invoiceId===i.id&&!a.voided))fail('Cancel or reverse the related credit notes first.');if(i.posted){const original=s.journals.find(j=>j.id===i.journalId);journal(s,i,'Invoice Reversal',original.lines.map(l=>({...l,debit:l.credit,credit:l.debit})),today(),'reverse:'+i.id)}i.status='Cancelled';i.reason=p.reason;
  }else if(action==='recurring'){
   /* A repeat schedule is a setting on a real invoice, never a second posting: it stores the
      cadence and the next date on the invoice and stops there. Nothing is generated or posted by
      this action, and the register says so where the operator sets it. Clearing it writes null
      rather than deleting the key, so an invoice that was once recurring still reads honestly. */
   if(i.status==='Cancelled')fail('A cancelled invoice cannot be made recurring.');
   if(p.off){i.recurring=null;}
   else{
    if(!i.posted)fail('Post the invoice before setting a recurring schedule.');
    if(!RECURRING_FREQUENCIES.includes(p.frequency))fail('Choose how often the invoice repeats.');
    if(!dateOK(p.nextDate))fail('Choose the next invoice date.');
    if(p.endDate&&!dateOK(p.endDate))fail('Enter a valid end date.');
    if(p.endDate&&p.endDate<p.nextDate)fail('The end date must be on or after the next invoice date.');
    i.recurring={frequency:p.frequency,nextDate:p.nextDate,endDate:p.endDate||'',setAt:new Date().toISOString()};
   }
  }else fail('Unknown command.');
 }
 s.audit.push({id:crypto.randomUUID(),action,invoiceId:result.id||null,at:new Date().toISOString(),by:'Admin',journalId:result.journalId||null,reason:p.reason||''});return {state:s,result};
}
export function ledger(s){const balances={};return [...s.journals].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)).flatMap(j=>j.lines.map((l,index)=>{balances[l.account]=(balances[l.account]||0)+l.debit-l.credit;return {...l,...j,lines:undefined,id:j.id+':'+index,journalId:j.id,balance:balances[l.account]}}))}
export function reports(s){const rows=s.accounts.map(a=>{const balance=s.journals.reduce((n,j)=>n+j.lines.filter(l=>l.account===a.code).reduce((x,l)=>x+l.debit-l.credit,0),0);return {...a,balance,debit:Math.max(balance,0),credit:Math.max(-balance,0)}});const sum=t=>rows.filter(a=>a.type===t).reduce((n,a)=>n+a.balance,0),revenue=0-sum('Income'),expenses=sum('Expenses');return {rows,revenue,expenses,profit:revenue-expenses,assets:sum('Assets'),liabilities:0-sum('Liabilities'),equity:0-sum('Equity'),debit:rows.reduce((n,a)=>n+a.debit,0),credit:rows.reduce((n,a)=>n+a.credit,0)}}
import {calculateTax,lineTaxes} from './invoice-tax.js';
function validateAccountTaxes(s,t){for(const l of t.lines){const a=s.accounts.find(a=>a.code===(l.income||s.config.sales)),r=lineTaxes(l,t.intra),gst=Number(r.cgst||0)+Number(r.sgst||0)+Number(r.igst||0);if(a?.taxMode==='none'&&(gst||Number(r.cess)))fail('This account requires zero GST / Cess.');if(a?.taxMode==='validate'&&Math.abs(gst-Number(a.gstRate))>0.00001)fail('Tax selection does not match the configured account GST rate.');}}
