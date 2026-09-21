import {calculate,command} from './invoice-engine.js';
import {itemOrganisationIds} from './item-master.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function saveSalesOrder(orders,input,config,status){
 const form=clone(input),existing=orders.find(o=>o.id===form.id);
 if(existing&&(existing.invoice||['Cancelled','Completed'].includes(existing.status)))throw Error('This order is locked. Its linked invoice is managed separately.');
 if(!['Draft','Confirmed'].includes(status))throw Error('Invalid order status.');
 if(!form.customerId||!form.customerName)throw Error('Select an active customer.');
 if(!validDate(form.date)||!validDate(form.dueDate)||form.dueDate<form.date)throw Error('Enter a valid order date and due date.');
 if(form.shipment&&(!validDate(form.shipment)||form.shipment<form.date))throw Error('Shipment cannot be before the order date.');
 let n=1;while(orders.some(o=>o.number===`SO-${String(n).padStart(5,'0')}`))n++;
 const number=form.number.trim()||`SO-${String(n).padStart(5,'0')}`;
 if(orders.some(o=>o.id!==form.id&&o.number.toLowerCase()===number.toLowerCase()))throw Error('Sales order number must be unique.');
 const totals=calculate(form,config);
 const order={...form,id:form.id||crypto.randomUUID(),number,schemaVersion:2,customer:form.customerId,status,totals,total:totals.total/100,taxPolicy:{state:config.state,roundRupee:config.roundRupee},updatedAt:new Date().toISOString()};
 return {order,orders:existing?orders.map(o=>o.id===order.id?order:o):[order,...orders]};
}
export function convertSalesOrder(state,order){
 const linked=state.invoices.find(i=>i.sourceOrder===order.id);if(linked)return {state,result:linked};
 if(order.status==='Cancelled')throw Error('Cancelled orders cannot generate invoices.');
 if(order.schemaVersion!==2)throw Error('Open and save this legacy order in the new form before generating its invoice.');
 if(Number(order.taxRate||0)!==0||Number(order.adjustment||0)!==0)throw Error('This order carries a TDS/TCS withholding that the invoice form cannot post. Re-record the order in the current form, or post the invoice and adjust the withholding separately.');
 const config={...state.config,...order.taxPolicy};
 /* The invoice keeps the order's own organisation and branch rather than the working context the
    operator happens to be in when they convert it: period locking resolves the posting period from
    these, so a lock on the order's branch has to be the one that applies. The customer's receivable
    ledger travels too, so posting can post to the customer's own account. */
 const output=command({...state,config},'save',{sourceOrder:order.id,sourceOrderNumber:order.number,reference:order.reference||order.number,customerId:order.customerId,customerName:order.customerName,date:order.date,dueDate:order.dueDate,terms:order.terms,billing:order.billing,shipping:order.shipping,place:order.place,placeSource:order.placeSource||'',placeCode:order.placeCode||'',lines:clone(order.lines),notes:order.notes||'',termsAndConditions:order.termsAndConditions||'',organizationId:order.organizationId||'',organizationName:order.organizationName||'',branchId:order.branchId||'',branchName:order.branchName||'',receivableAccount:order.receivableAccount||''});
 output.state.config=state.config;
 return output;
}

/* An order line is only meaningful where the item is actually set up. The Item master decides
   that: `organizationIds` is the organisation scope, and a stocked Good carries the branches it
   lives in (`branchIds`, falling back to the single `warehouseId` it was created with). A Service
   is never branch-bound, and an item that tracks no inventory has no stock to be missing, so the
   branch rule only applies to a stocked Good that declares a scope.

   The Item master is written from two screens that disagree on which reference they store: the
   create form seeds an organisation id (`abc`) while its scope picker writes the organisation code
   (`ABC01`), and the opening-stock branch field accepts an id or a name. Both sides are therefore
   compared as reference sets rather than one value against one value, so a valid item is never
   reported as out of scope just because the two screens name the same scope differently. */
const scopeRefs=(...values)=>Array.from(new Set(values.flat(2).map(value=>String(value??'').trim()).filter(Boolean)));
const sharesReference=(a,b)=>a.some(value=>b.includes(value));
export function itemScopeError(item,{organisationId,organisationCode,organisationRefs,branchId,branchName,branchRefs,organisationName}={}){
 if(!item)return '';
 const wantedOrganisations=scopeRefs(organisationRefs,organisationId,organisationCode);
 const ownedOrganisations=scopeRefs(itemOrganisationIds(item));
 if(wantedOrganisations.length&&ownedOrganisations.length&&!sharesReference(wantedOrganisations,ownedOrganisations))
  return (item.name||'This item')+' is not set up for '+(organisationName||'the selected organisation')+' in the Item master.';
 const wantedBranches=scopeRefs(branchRefs,branchId,branchName);
 if(item.type==='Goods'&&item.trackInventory&&wantedBranches.length){
  const ownedBranches=scopeRefs(Array.isArray(item.branchIds)?item.branchIds:[],item.warehouseId);
  if(!ownedBranches.length)
   return (item.name||'This item')+' tracks inventory but has no branch or location set in the Item master.';
  if(!sharesReference(wantedBranches,ownedBranches))
   return (item.name||'This item')+' tracks inventory but is not stocked in '+(branchName||'the selected branch')+'.';
 }
 return '';
}

/* The first line that cannot be fulfilled from the chosen scope, so the screen can name it. */
export function orderScopeError(lines,items,scope={}){
 for(const line of Array.isArray(lines)?lines:[]){
  const item=(items||[]).find(entry=>entry.id===line.item||entry.id===line.itemId);
  if(!item)continue;
  const message=itemScopeError(item,scope);
  if(message)return message;
 }
 return '';
}

/* The register export: one line per order, the facts the grid shows. Quoted only where a value
   contains a comma, a quote or a newline, so a customer called 'Rao, Kumar & Co' survives Excel. */
export function ordersCsv(orders){
 const cell=value=>{const text=String(value??'');return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text};
 const head=['Order number','Order date','Customer','Organisation','Branch','Status','Due date','Reference','Total'];
 const rows=(orders||[]).map(order=>[order.number,order.date,order.customerName,order.organizationName,order.branchName,order.status,order.dueDate,order.reference,(Number(order.total)||0).toFixed(2)].map(cell).join(','));
 return [head.map(cell).join(','),...rows].join('\n');
}
