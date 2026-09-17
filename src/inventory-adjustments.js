/* Inventory Adjustments - the pure engine behind Inventory > Inventory Adjustments.

   A correction to stock is its own document, never an edit of a purchase or a sale:
   it names one organisation and branch, one adjustment account from the Chart of
   Accounts and one reason, and it carries item lines that move either quantity or
   value. Nothing here touches storage, React or the DOM, so the same rules are used
   by the list, the create page and the detail page.

   The one flow the whole module is held to:

     adjustment -> quantity/value difference -> financial impact -> inventory
     position -> journal entry -> posted transaction -> financial statements

   Draft and Cancelled documents change nothing. Only an Adjusted document moves the
   inventory position and posts to the ledger, and the posted entry is never edited:
   it is mirrored by a correcting reversal instead. */

import {journal,today} from './invoice-engine.js';

export const ADJUSTMENT_TYPES=['Quantity Adjustment','Value Adjustment'];
export const ADJUSTMENT_STATUSES=['Draft','Pending Approval','Adjusted','Cancelled'];
export const ADJUSTMENT_ENTRY_MODES=['Adjust By','Set New Value'];
export const ADJUSTMENT_REASONS=['Physical Stock Count','Damaged Stock','Lost Stock','Expired Stock','Theft / Shrinkage','Data Entry Correction','Opening Stock Correction','Revaluation','Other'];
export const ADJUSTMENT_ACTIONS={Draft:['View','Edit','Duplicate','Export','Cancel'],'Pending Approval':['View','Export','Cancel'],Adjusted:['View','Duplicate','Export','Reverse'],Cancelled:['View','Duplicate','Export']};

/* The local role selector is a simulation of approval duty, never authentication.
   The same boundary is enforced in the command, not only by hiding buttons. */
export const ADJUSTMENT_ROLES=['Accountant','Finance Manager','Admin'];
const permissions={
 Accountant:['save','submit','cancel','export'],
 'Finance Manager':['save','submit','cancel','export','approve','post','reverse'],
 Admin:['save','submit','cancel','export','approve','post','reverse']
};
export const adjustmentAllowed=(role,action)=>(permissions[role]||[]).includes(action);
/* The command names an action after what it does, the role duty names what it
   requires, and this is the one place the two vocabularies meet so a screen can
   never grant more than the command does. */
const ADJUSTMENT_DUTY={save:'save','save-and-adjust':'post',submit:'submit',adjust:'post',cancel:'cancel',reverse:'reverse'};

const copy=value=>JSON.parse(JSON.stringify(value));
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row?.[key])||0),0);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const roundQty=value=>Math.round((Number(value)||0)*1000)/1000;
export const quantityOf=value=>{const text=String(value??'').replace(/[,\s]/g,'');if(!text||!Number.isFinite(Number(text)))return NaN;return roundQty(text)};
export const toMinor=value=>{const text=String(value??'').replace(/[,\s\u20b9]/g,'');if(!text||!Number.isFinite(Number(text)))return NaN;return Math.round(Number(text)*100)};
export const formatQuantity=value=>roundQty(Number(value)||0).toLocaleString('en-IN',{maximumFractionDigits:3});
export const entryModeLabel=mode=>mode==='Set New Value'?'Set New Value':'Adjust By';

/* An item carries a rate, not a value: opening stock is quantity x rate, and every
   later movement is priced with the same rate so a quantity adjustment can never
   invent a value of its own. */
export const itemRate=item=>{const value=Number(String(item?.openingRate??item?.cost??'').replace(/,/g,''));return Number.isFinite(value)&&value>0?Math.round(value*100):0};
export const itemName=item=>item?.name||'Unknown item';
export const isStockItem=item=>item&&item.type!=='Service'&&item.trackInventory!==false;
export const itemsForOrganisation=(items,organisationId)=>items.filter(item=>isStockItem(item)&&(!organisationId||String(item.organizationId||'')===String(organisationId)));
/* An item records the location it was created in as whatever the header context
   held at the time - a branch id, a branch code or a branch name - while the
   register always works in branch ids. Both sides are therefore resolved through
   the one branch list before a position is keyed, so a stored location can never
   miss the stock that belongs to it. */
export const canonicalLocation=(value,branches=[])=>{const text=String(value||'');if(!text)return '';const match=(branches||[]).find(branch=>String(branch?.id||'')===text||String(branch?.code||'')===text||String(branch?.name||'')===text);return match?String(match.id):text};
export const canonicalItems=(items,branches=[])=>(items||[]).map(item=>({...item,warehouseId:canonicalLocation(item?.warehouseId,branches)}));

/* The stored per-line impact is what posting uses, so a reversal cancels its original
   figure exactly; the live computation below is only ever the preview of an unsaved
   document. */
export const storedLines=doc=>(doc?.lines||[]).filter(line=>line.itemId);

export function inventoryPosition(state,items){
 const position={};
 for(const item of items||[]){
  const key=item.id+'::'+(item.warehouseId||'');
  const quantity=quantityOf(item.openingQuantity);
  const opening=Number.isFinite(quantity)?quantity:0;
  position[key]={quantity:roundQty(opening),value:Math.round(opening*itemRate(item))};
 }
 for(const row of adjustmentRows(state)){
  if(!row.posted)continue;
  for(const line of storedLines(row)){
   const key=line.itemId+'::'+(line.locationId||'');
   const entry=position[key]||(position[key]={quantity:0,value:0});
   entry.quantity=roundQty(entry.quantity+(Number(line.qtyDelta)||0));
   entry.value=Math.round(entry.value+(Number(line.valueImpact)||0));
  }
 }
 return position;
}
export const positionAt=(position,itemId,locationId)=>position[itemId+'::'+(locationId||'')]||{quantity:0,value:0};

/* One line of the item table, resolved against the position the document would be
   posted into. `entry` is the raw value the user typed in the mode that is currently
   editable; the other two figures of the pair are always derived from it. */
export function computeLine(state,items,line,{type=ADJUSTMENT_TYPES[0],entryMode=ADJUSTMENT_ENTRY_MODES[0],position}={}){
 const item=(items||[]).find(entry=>entry.id===line.itemId)||null;
 const resolved=position||inventoryPosition(state,items);
 const stock=positionAt(resolved,line.itemId,line.locationId);
 const rate=itemRate(item);
 const currentQty=roundQty(stock.quantity);
 const currentValue=stock.value;
 const quantityType=type!==ADJUSTMENT_TYPES[1];
 const qtyDelta=!quantityType?0:entryMode==='Set New Value'?(Number.isFinite(quantityOf(line.newQty))?roundQty(quantityOf(line.newQty)-currentQty):0):(Number.isFinite(quantityOf(line.qtyDelta))?quantityOf(line.qtyDelta):0);
 const valueDelta=quantityType?0:entryMode==='Set New Value'?(Number.isFinite(toMinor(line.newValue))?toMinor(line.newValue)-currentValue:0):(Number.isFinite(toMinor(line.valueDelta))?toMinor(line.valueDelta):0);
 const newQty=quantityType?roundQty(currentQty+qtyDelta):currentQty;
 const newValue=quantityType?Math.round(currentValue+qtyDelta*rate):currentValue+valueDelta;
 return {
  id:line.id,itemId:line.itemId,name:itemName(item),sku:item?.sku||'',unit:item?.unit||'',
  inventoryAccount:item?.inventoryAccount||'',locationId:line.locationId||'',rate,
  currentQty,currentValue,qtyDelta,valueDelta,newQty,newValue,
  valueImpact:quantityType?Math.round(qtyDelta*rate):valueDelta
 };
}

export function adjustmentImpact(state,items,doc={}){
 const position=inventoryPosition(state,items);
 const lines=storedLines(doc).map(line=>computeLine(state,items,line,{type:doc.type,entryMode:doc.entryMode,position}));
 const quantity=doc.type!==ADJUSTMENT_TYPES[1];
 const increased=sum(lines.filter(line=>line.qtyDelta>0),'qtyDelta');
 const decreased=sum(lines.filter(line=>line.qtyDelta<0),'qtyDelta');
 return {
  lines,position,quantity,
  totals:{
   items:lines.length,
   increased:roundQty(increased),
   decreased:roundQty(decreased),
   netQuantity:roundQty(increased+decreased),
   currentValue:sum(lines,'currentValue'),
   valueDelta:sum(lines,'valueDelta'),
   newValue:sum(lines,'newValue'),
   valueImpact:sum(lines,'valueImpact')
  }
 };
}

/* Every quantity movement is priced at the item rate, so the entry is built from the
   signed line impacts alone: the inventory asset accounts carry the movement and the
   single adjustment account carries the balance, which is why debit always equals
   credit. A movement worth nothing posts no entry at all. Debits are listed
   before credits, as every other document in this ledger does, and the one
   adjustment account takes whichever side balances the movement. */
export const accountCodeOf=value=>String(value||'').split(/[\s\u00b7]/)[0].trim();
export const configuredInventoryAsset=settings=>accountCodeOf(settings?.accountMappings?.inventoryAsset)||'1200';
export const configuredAdjustmentAccount=settings=>accountCodeOf(settings?.accountMappings?.stockAdjustment)||'';
export const suggestedAdjustmentAccount=(accounts=[])=>['inventory loss','write-off','write off','stock adjustment','inventory adjustment','shrinkage'].map(name=>accounts.find(account=>String(account.name||'').toLowerCase().includes(name))).find(Boolean)?.code||'';

export function entryLines(doc,items,settings){
 const rows=new Map();
 for(const line of storedLines(doc)){
  const item=(items||[]).find(entry=>entry.id===line.itemId);
  const code=item?.inventoryAccount||configuredInventoryAsset(settings);
  rows.set(code,Math.round((rows.get(code)||0)+(Number(line.valueImpact)||0)));
 }
 const movement=[...rows.values()].reduce((total,amount)=>total+amount,0);
 const debits=[],credits=[];
 for(const [code,amount] of rows){if(amount>0)debits.push({account:code,debit:amount,credit:0});else if(amount<0)credits.push({account:code,debit:0,credit:-amount})}
 if(movement<0)debits.push({account:doc.account,debit:-movement,credit:0});
 else if(movement>0)credits.push({account:doc.account,debit:0,credit:movement});
 return [...debits,...credits];
}

export function accountingPreview(state,items,doc,settings,accounts=[]){
 const impact=adjustmentImpact(state,items,doc);
 const name=code=>accounts.find(row=>row.code===code)?.name||code;
 const lines=entryLines({...doc,lines:impact.lines.map(line=>({...line,locationId:line.locationId,valueImpact:line.valueImpact}))},items,settings)
  .map(line=>({...line,amount:line.debit||line.credit,side:line.debit?'Dr':'Cr',name:name(line.account)}));
 return {
  lines,
  totalDebit:sum(lines,'debit'),
  totalCredit:sum(lines,'credit'),
  balanced:sum(lines,'debit')===sum(lines,'credit'),
  note:lines.length?'Debit and credit are generated from the adjustment and always balance.':'No accounting entry: the adjusted items carry no stock value.'
 };
}

/* The activity trail is written by the command, never composed by a screen, so the
   detail page and the audit log can never disagree about what happened. */
export function adjustmentActivity(row={}){
 return (row.activity||[]).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at)));
}

export function nextAdjustmentNumber(state){
 const used=new Set(adjustmentRows(state).map(row=>String(row.number||'').toUpperCase()));
 let number=1;
 while(used.has('ADJ-'+String(number).padStart(5,'0')))number++;
 return 'ADJ-'+String(number).padStart(5,'0');
}

export function adjustmentRows(state){return [...(state?.inventoryAdjustments||[])].filter(Boolean)}

export function blankAdjustment({date=today(),organisation={},account='',reason='',items=[],type=ADJUSTMENT_TYPES[0]}={}){
 return {
  id:'',number:'',date,type,entryMode:ADJUSTMENT_ENTRY_MODES[0],
  companyId:organisation.companyId||'',companyName:organisation.companyName||'',
  branchId:organisation.branchId||'',branchName:organisation.branchName||'',
  account,reason,notes:'',lines:[blankLine()],reversalOf:'',status:'Draft'
 };
}

export function blankLine(itemId='',locationId=''){
 return {id:crypto.randomUUID(),itemId,locationId,qtyDelta:'',newQty:'',valueDelta:'',newValue:''};
}

/* The list page numbers a duplicated document into the next free reference, and a
   stored reference is never reused. */
export function duplicateAdjustment(state,row){
 const number=nextAdjustmentNumber(state);
 return {...copy(row),id:'',number,date:today(),status:'Draft',posted:false,journalId:'',postedAt:'',postedBy:'',createdAt:'',createdBy:'',updatedAt:'',updatedBy:'',submittedAt:'',submittedBy:'',cancelledAt:'',cancelledBy:'',reversedBy:'',activity:[],lines:storedLines(row).map(line=>({...blankLine(line.itemId,line.locationId),qtyDelta:'',newQty:'',valueDelta:'',newValue:''}))};
}

export function validateAdjustment(state,doc,{items=[],settings={}}={}){
 const errors={};
 if(!ADJUSTMENT_TYPES.includes(doc.type))errors.type='Select a quantity or value adjustment.';
 if(!validDate(doc.date))errors.date='Choose a valid adjustment date.';
 if(!doc.companyId)errors.companyId='Select the organisation.';
 if(!doc.branchId)errors.branchId='Select the branch or location.';
 if(!doc.account)errors.account='Select the adjustment account.';
 else if(!(state?.accounts||[]).some(account=>account.code===doc.account&&account.active&&!account.isGroup))errors.account='Choose an active posting account from the Chart of Accounts.';
 if(!ADJUSTMENT_REASONS.includes(doc.reason))errors.reason='Select the reason for this adjustment.';
 const rows=storedLines(doc);
 if(!rows.length)errors.lines='Add at least one item to adjust.';
 else{
  const position=inventoryPosition(state,items),seen=new Set();
  rows.forEach((line,index)=>{
   const key='line-'+index,item=items.find(entry=>entry.id===line.itemId);
   if(!item){errors[key]='Choose an item.';return}
   if(!line.locationId){errors[key]='Choose the location for '+itemName(item)+'.';return}
   if(seen.has(line.itemId+'::'+line.locationId)){errors[key]=itemName(item)+' appears more than once for this location.';return}
   seen.add(line.itemId+'::'+line.locationId);
   const computed=computeLine(state,items,line,{type:doc.type,entryMode:doc.entryMode,position});
   const entered=doc.entryMode==='Set New Value'?(doc.type===ADJUSTMENT_TYPES[1]?line.newValue:line.newQty):(doc.type===ADJUSTMENT_TYPES[1]?line.valueDelta:line.qtyDelta);
   if(!(doc.type===ADJUSTMENT_TYPES[1])&&doc.entryMode==='Set New Value'&&!Number.isFinite(quantityOf(line.newQty))){errors[key]='Enter the new quantity for '+itemName(item)+'.';return}
   if(doc.type!==ADJUSTMENT_TYPES[1]&&!Number.isFinite(quantityOf(entered))&&doc.entryMode!=='Set New Value'){errors[key]='Enter the quantity to adjust for '+itemName(item)+'.';return}
   if(doc.type===ADJUSTMENT_TYPES[1]&&!Number.isFinite(toMinor(entered))){errors[key]='Enter the value to adjust for '+itemName(item)+'.';return}
   if(doc.type!==ADJUSTMENT_TYPES[1]&&computed.newQty<0&&!settings?.inventory?.negativeStock)errors[key]=itemName(item)+' cannot be reduced below zero stock. Adjust the quantity or enable negative stock in settings.';
   if(doc.type===ADJUSTMENT_TYPES[1]&&computed.newValue<0)errors[key]=itemName(item)+' cannot carry a negative inventory value.';
  });
 }
 return errors;
}

/* One command boundary for every mutation, so period locking, role duty, balanced
   posting and the audit trail are applied once for all callers. */
export function adjustmentCommand(state,action,payload={},ctx={}){
 const s=copy(state),p=copy(payload||{}),actor=ctx.actor||'Local user',now=new Date().toISOString();
 s.inventoryAdjustments=[...(s.inventoryAdjustments||[])];
 const row=p.id?s.inventoryAdjustments.find(entry=>entry.id===p.id):null;
 if(ctx.role&&!adjustmentAllowed(ctx.role,ADJUSTMENT_DUTY[action]||action))throw Error('Your inventory adjustment role ('+ctx.role+') cannot '+action.replaceAll('-',' ')+'. Ask a finance manager or administrator.');
 const settings=ctx.settings||{};
 const items=ctx.items||[];
 const before=row?.status||null;
 const push=(entry,label,note='')=>{(entry.activity??=[]).push({id:crypto.randomUUID(),at:now,action:label,by:actor,note});};

 if(action==='save'||action==='save-and-adjust'){
  if(row&&row.status!=='Draft')throw Error('Only draft adjustments can be edited. An adjusted record is corrected with a reversal.');
  const number=String(p.number||'').trim()||row?.number||nextAdjustmentNumber(s);
  if(s.inventoryAdjustments.some(entry=>entry.id!==row?.id&&String(entry.number).toLowerCase()===number.toLowerCase()))throw Error('Adjustment reference '+number+' already exists.');
  const position=inventoryPosition(s,items);
  const lines=storedLines(p).map(line=>{const computed=computeLine(s,items,line,{type:p.type,entryMode:p.entryMode,position});return {...computed,id:line.id,previousQty:computed.currentQty,previousValue:computed.currentValue}});
  const document={...p,id:row?.id||crypto.randomUUID(),number,lines,status:'Draft',posted:false,journalId:'',createdAt:row?.createdAt||now,createdBy:row?.createdBy||actor,updatedAt:now,updatedBy:actor,activity:row?.activity||[]};
  const target=row||document;
  Object.assign(target,document);
  if(!row)s.inventoryAdjustments.push(target);
  push(target,row?'Adjustment updated':'Adjustment created',p.notes||'');
  if(action==='save-and-adjust'){
   if(settings?.approvals&&settings.approvals.inventoryAdjustments!==false)throw Error('Approval is required for inventory adjustments. Save the draft and submit it for approval.');
   const errors=validateAdjustment(s,target,{items,settings});
   if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);
   postAdjustment(s,target,ctx,now,items,settings);
  }
  return finish(s,target,action,before,ctx,now,{numbers:[number],reason:p.reason||''});
 }
 if(!row)throw Error('Inventory adjustment not found.');

 if(action==='submit'){
  if(row.status!=='Draft')throw Error('Only a draft adjustment can be submitted for approval.');
  if(settings?.approvals&&settings.approvals.inventoryAdjustments===false)throw Error('Approval is switched off. Use Save & Adjust to post this draft.');
  const errors=validateAdjustment(s,row,{items,settings});
  if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);
  row.status='Pending Approval';row.submittedAt=now;row.submittedBy=actor;
  push(row,'Adjustment submitted for approval');
  return finish(s,row,action,before,ctx,now,{});
 }
 if(action==='adjust'){
  if(row.status==='Adjusted')return {state:s,result:row};
  if(!['Draft','Pending Approval'].includes(row.status))throw Error('A cancelled adjustment cannot be adjusted.');
  if(row.status==='Pending Approval'&&ctx.role&&!adjustmentAllowed(ctx.role,'approve'))throw Error('A finance manager or administrator must approve this adjustment.');
  if(row.status==='Pending Approval'&&settings?.approvals?.segregationOfDuties&&row.createdBy===actor)throw Error('This adjustment was created by '+row.createdBy+'. Another approver must approve it.');
  const errors=validateAdjustment(s,row,{items,settings});
  if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);
  if(row.status==='Pending Approval')push(row,'Adjustment approved','Approved by '+actor);
  postAdjustment(s,row,ctx,now,items,settings);
  return finish(s,row,action,before,ctx,now,{journalId:row.journalId});
 }
 if(action==='cancel'){
  if(!['Draft','Pending Approval'].includes(row.status))throw Error('Only a draft or pending adjustment can be cancelled.');
  if(!String(p.cancellationReason||p.reason||'').trim())throw Error('Enter a cancellation reason.');
  row.status='Cancelled';row.cancelledAt=now;row.cancelledBy=actor;row.cancellationReason=String(p.cancellationReason||p.reason).trim();
  push(row,'Adjustment cancelled',row.cancellationReason);
  return finish(s,row,action,before,ctx,now,{reason:row.cancellationReason});
 }
 if(action==='reverse'){
  if(row.status!=='Adjusted'||!row.posted)throw Error('Only an adjusted record can be reversed.');
  if(row.reversedBy)throw Error('A correcting adjustment already exists for '+row.number+'.');
  if(!String(p.reason||'').trim())throw Error('Enter a reason for the reversal.');
  const date=validDate(p.date)?p.date:today();
  if(date<row.date)throw Error('A reversal cannot be dated before the adjustment it corrects.');
  const mirror={...copy(row),id:crypto.randomUUID(),number:nextAdjustmentNumber(s),date,reversalOf:row.id,reason:'Reversal',notes:String(p.reason).trim(),status:'Draft',posted:false,journalId:'',postedAt:'',postedBy:'',createdAt:now,createdBy:actor,updatedAt:now,updatedBy:actor,reversedBy:'',activity:[],
   lines:storedLines(row).map(line=>({...line,id:crypto.randomUUID(),qtyDelta:-(Number(line.qtyDelta)||0),valueDelta:-(Number(line.valueDelta)||0),valueImpact:-(Number(line.valueImpact)||0),newQty:line.previousQty??line.currentQty,newValue:line.previousValue??line.currentValue}))};
  s.inventoryAdjustments.push(mirror);
  push(mirror,'Correcting adjustment created','Reversal of '+row.number+' - '+mirror.notes);
  postAdjustment(s,mirror,ctx,now,items,settings);
  row.reversedBy=mirror.id;row.reversedAt=now;row.reversedByUser=actor;row.status='Adjusted';
  push(row,'Correcting adjustment raised');
  return finish(s,mirror,action,before,ctx,now,{journalId:mirror.journalId});
 }
 throw Error('Unknown inventory adjustment action.');
}

/* Posting is the only place inventory and accounting move together. */
function postAdjustment(s,row,ctx,now,items,settings){
 const lines=entryLines(row,items,settings);
 if(lines.length){
  /* The journal carries the adjustment as its own source document, never as an
     invoice, so no other register mistakes it for one. */
  const entry=journal(s,{number:row.number,organizationId:row.companyId,branchId:row.branchId,branch:row.branchId,role:ctx.periodRole||ctx.role||'Admin',periodModule:'Inventory'},row.reversalOf?'Inventory Adjustment Reversal':'Inventory Adjustment',lines,row.date,'inventory-adjustment:'+row.id);
  Object.assign(entry,{adjustmentId:row.id,sourceId:row.id,reference:row.number,companyId:row.companyId,branchId:row.branchId,createdBy:ctx.actor||'Local user'});
  row.journalId=entry.id;
 }
 row.status='Adjusted';row.posted=true;row.postedAt=now;row.postedBy=ctx.actor||'Local user';
 (row.activity??=[]).push({id:crypto.randomUUID(),at:now,action:'Inventory and accounting updated',by:ctx.actor||'Local user',note:row.journalId?'Journal '+row.number+' posted':'Inventories updated without a journal entry: the adjusted lines carry no stock value'});
 return row;
}

function finish(s,row,action,before,ctx,now,extra={}){
 row.updatedAt=now;row.updatedBy=ctx.actor||'Local user';
 const existing=new Set((ctx.state?.journals||[]).map(entry=>entry.id));
 for(const entry of s.journals)if(!existing.has(entry.id))entry.createdBy=ctx.actor||'Local user';
 (s.audit??=[]).push({id:crypto.randomUUID(),adjustmentId:row.id,action:'inventory-adjustment-'+action,at:now,by:ctx.actor||'Local user',fromStatus:before,toStatus:row.status,reason:extra.reason||'',journalId:row.journalId||''});
 return {state:s,result:row};
}

export function adjustmentCsv(row,{items=[],settings={}}={}){
 const money=value=>((Number(value)||0)/100).toFixed(2);
 const rows=[
  ['Reference',row.number],['Date',row.date],['Adjustment type',row.type],['Status',row.status],
  ['Organisation',row.companyName||row.companyId],['Branch / location',row.branchName||row.branchId],
  ['Reason',row.reason],['Adjustment account',row.account],['Created by',row.createdBy||''],
  ['Notes',String(row.notes||'').replace(/[\r\n]+/g,' ')],[], 
  [row.type===ADJUSTMENT_TYPES[1]?'Item':'Item','Location',row.type===ADJUSTMENT_TYPES[1]?'Current quantity':'Current quantity',row.type===ADJUSTMENT_TYPES[1]?'Current value':'Quantity adjusted',row.type===ADJUSTMENT_TYPES[1]?'Value adjusted':'New quantity',row.type===ADJUSTMENT_TYPES[1]?'New value':'Value impact']
 ];
 for(const line of storedLines(row)){
  rows.push(row.type===ADJUSTMENT_TYPES[1]
   ?[line.name,line.locationId,formatQuantity(line.currentQty),money(line.currentValue),money(line.valueDelta),money(line.newValue)]
   :[line.name,line.locationId,formatQuantity(line.currentQty),formatQuantity(line.qtyDelta),formatQuantity(line.newQty),money(line.valueImpact)]);
 }
 return rows.map(columns=>columns.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
}
