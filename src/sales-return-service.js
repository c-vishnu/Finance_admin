import {today} from './invoice-engine.js';
import {adjustmentCommand,blankLine,nextAdjustmentNumber,ADJUSTMENT_ENTRY_MODES,ADJUSTMENT_TYPES} from './inventory-adjustments.js';
import {returnableQuantity} from './credit-note-service.js';

/* Sales Returns - the physical half of a goods return.

   A return is its own business event, never a side effect of a credit note:

     Sales Return  ->  stock and the inventory journal   (this module)
     Credit Note   ->  receivable, revenue and GST       (src/credit-note-service.js)

   The stock movement is not implemented here. It is posted by the inventory engine
   (`adjustmentCommand`, reason `Sales Return`), so the item rate, the valuation and the
   journal all come from the one place that already owns them; this module owns only what
   a return is, the quantity rule, and the link back to the invoice and the credit note. */

export const SALES_RETURN_CONDITIONS=['Resalable','Damaged','Expired','Needs repair'];
export const SALES_RETURN_STATUSES=['Posted','Cancelled'];

const copy=value=>JSON.parse(JSON.stringify(value));
const dateOK=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export const salesReturnRows=s=>[...(s?.salesReturns||[])].filter(Boolean);
export function nextSalesReturnNumber(s){
 const used=new Set(salesReturnRows(s).map(row=>String(row.number||'').toUpperCase()));
 let n=1;
 while(used.has('SR-'+String(n).padStart(4,'0')))n++;
 return 'SR-'+String(n).padStart(4,'0');
}
export const salesReturnOfNote=(s,note)=>(s.salesReturns||[]).find(r=>r.id===note?.salesReturnId)||null;

/* The account a stock correction posts against, resolved the way the Inventory Adjustments
   screen resolves it: the configured mapping first, then an account that names inventory or
   stock, then any active expense account. A caller that already knows the account passes it. */
export function salesReturnAccount(s,settings={}){
 const mapped=settings?.accountMappings?.inventoryAdjustment||settings?.accountMappings?.inventory||'';
 const active=(s.accounts||[]).filter(a=>a.active&&!a.isGroup);
 if(mapped&&active.some(a=>a.code===mapped))return mapped;
 const named=active.find(a=>/inventory|stock/i.test(a.name||''));
 return (named||active.find(a=>a.type==='Expenses')||{}).code||'';
}

/* One sales return: validated, posted to stock through the inventory engine, and recorded.
   The credit note points at it with `salesReturnId`, and the return points back at the invoice. */
export function raiseSalesReturn({state,payload={},items=[],settings={},scope={},actor='Admin',role='Admin',now=new Date().toISOString()}){
 let s=copy(state);
 const invoice=s.invoices.find(i=>i.id===payload.invoiceId);
 if(!invoice)throw Error('Select the invoice the goods were sold on.');
 if(!invoice.posted||invoice.status==='Cancelled')throw Error('Only a posted, non-cancelled invoice can take a return.');
 if(!dateOK(payload.date))throw Error('Choose a valid return date.');
 if(payload.date<invoice.date)throw Error('A return cannot precede the invoice it returns.');
 if(!SALES_RETURN_CONDITIONS.includes(payload.condition))throw Error('Select the condition of the returned goods.');
 const warehouseId=payload.warehouseId||scope.branchId||'';
 if(!warehouseId)throw Error('Select the warehouse the goods come back into.');
 const lines=(payload.lines||[]).filter(line=>Number(line.qty)>0);
 if(!lines.length)throw Error('Enter the quantity coming back.');
 const resolved=lines.map(line=>{
  const index=Number(line.invoiceItemIndex);
  const source=invoice.lines[index];
  if(!source)throw Error('The return names an item the invoice does not carry.');
  const available=returnableQuantity(s,invoice,index);
  if(Number(line.qty)>available+1e-9)throw Error('Only '+available+' of '+source.description+' can still come back.');
  const itemId=line.itemId||source.item;
  if(!itemId)throw Error(source.description+' is not linked to an item in the Item master, so its stock cannot move.');
  return {invoiceItemIndex:index,itemId,description:source.description,qty:Number(line.qty),unit:source.unit||'',rate:source.rate||''};
 });
 /* The inventory engine debits the mapped inventory asset and falls back to code 1200, so a chart
    that has neither would fail deep inside the journal. It is checked here, where the message can
    name the mapping the operator has to fill in. */
 const inventoryAsset=String(settings?.accountMappings?.inventoryAsset||'').trim();
 if(!inventoryAsset&&!(s.accounts||[]).some(a=>a.code==='1200'&&a.active&&!a.isGroup))throw Error('Set the Inventory Asset Account in the credit note Account Mapping first - a sales return has to debit a stock account.');
 const account=payload.account||salesReturnAccount(s,settings);
 if(!account)throw Error('No account is available for the stock correction. Configure the inventory adjustment account, or record the return in Inventory Adjustments.');
 const number=nextSalesReturnNumber(s);
 /* The inventory engine writes the stock and its own journal; its state is the state we keep. */
 const out=adjustmentCommand(s,'save-and-adjust',{
  number:nextAdjustmentNumber(s),date:payload.date,type:ADJUSTMENT_TYPES[0],entryMode:ADJUSTMENT_ENTRY_MODES[0],
  companyId:scope.companyId||'',companyName:scope.companyName||'',branchId:warehouseId,branchName:scope.branchName||'',
  account,reason:'Sales Return',notes:payload.notes||'',
  lines:resolved.map(line=>({...blankLine(line.itemId,warehouseId),qtyDelta:String(line.qty)}))
 },{items,settings,actor,role});
 s=out.state;
 const record={
  id:crypto.randomUUID(),number,date:payload.date,status:'Posted',
  invoiceId:invoice.id,invoiceNumber:invoice.number,customerId:invoice.customerId,customerName:invoice.customerName,
  warehouseId,warehouseName:scope.branchName||'',condition:payload.condition,notes:payload.notes||'',
  lines:resolved,
  inventoryAdjustmentId:out.result?.id||'',inventoryAdjustmentNumber:out.result?.number||'',
  createdAt:now,createdBy:actor,activity:[{id:crypto.randomUUID(),at:now,action:'Sales return posted',by:actor,note:payload.notes||''}]
 };
 s.salesReturns=[...salesReturnRows(s),record];
 return {state:s,result:record};
}
