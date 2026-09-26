import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,seedAccounts,command} from '../src/invoice-engine.js';
import {raiseSalesReturn,salesReturnRows,salesReturnAccount,nextSalesReturnNumber,SALES_RETURN_CONDITIONS} from '../src/sales-return-service.js';
import {returnableQuantity} from '../src/credit-note-service.js';

const seed={Assets:[['ar','Receivable'],['bank','Bank'],['stock','Inventory']],Income:[['sales','Sales'],['returns','Sales adjustment']],Liabilities:[['gst','GST']],Expenses:[['5900','Stock adjustment']]};
/* the Item master carries the inventory account, which is what the inventory engine posts against */
/* the mapping the app passes once the Inventory Asset and Stock Adjustment accounts are set */
const settings={accountMappings:{inventoryAsset:'stock',stockAdjustment:'5900'}};
const items=[{id:'item-1',name:'Office stationery box',type:'Goods',unit:'box',trackInventory:true,cost:'600',openingQuantity:'5',warehouseId:'wh-1',inventoryAccount:'stock'}];
function posted(qty){
 const s=seedAccounts(initial(),seed);
 s.accounts=s.accounts.map(a=>a.code==='stock'?{...a,name:'Inventory'}:a);
 const draft=command(s,'save',{date:'2026-09-19',dueDate:'2026-10-19',customerId:'cus-1',customerName:'ABC Retail Pvt Ltd',place:'Kerala',lines:[{description:'Office stationery box',qty:String(qty),unit:'box',rate:'1000',discount:'0',discountType:'%',tax:'18',cess:'0',item:'item-1'}]});
 return {state:command(draft.state,'post',{id:draft.result.id}).state,invoice:draft.result};
}

test('a sales return posts stock through the inventory engine and links to its invoice',()=>{
 const {state,invoice}=posted(10);
 const before=(state.inventoryAdjustments||[]).length,journals=(state.journals||[]).length;
 const out=raiseSalesReturn({state,payload:{invoiceId:invoice.id,date:'2026-09-20',condition:'Resalable',warehouseId:'wh-1',lines:[{invoiceItemIndex:0,qty:2}]},items,settings,scope:{companyId:'C1',companyName:'Wayvida',branchId:'wh-1',branchName:'Kochi Branch'}});
 const record=out.result;
 assert.equal(record.number,'SR-0001');
 assert.equal(record.status,'Posted');
 assert.equal(record.invoiceId,invoice.id,'the return states the invoice it came from');
 assert.equal(record.customerId,invoice.customerId);
 assert.equal(record.lines[0].qty,2);
 assert.equal(record.lines[0].itemId,'item-1','the line carries the item the stock belongs to');
 assert.equal((out.state.inventoryAdjustments||[]).length,before+1,'the stock movement is an inventory adjustment, not a second engine');
 assert.equal(out.state.inventoryAdjustments.at(-1).reason,'Sales Return');
 assert.equal(out.state.inventoryAdjustments.at(-1).status,'Adjusted','and it is posted, so stock has moved');
 assert.ok(out.state.inventoryAdjustments.at(-1).journalId,'which means the inventory engine posted its journal');
 assert.equal((out.state.journals||[]).length,journals+1);
 assert.equal(salesReturnRows(out.state).length,1);
 assert.equal(nextSalesReturnNumber(out.state),'SR-0002','the next return takes the next number');
 assert.equal(returnableQuantity(out.state,invoice,0),8,'and the invoice now has 8 of 10 left to return');
});

test('a return cannot take back more than the invoice has left, and refuses bad input',()=>{
 const {state,invoice}=posted(10);
 const base={invoiceId:invoice.id,date:'2026-09-20',condition:'Resalable',warehouseId:'wh-1'};
 const call=payload=>()=>raiseSalesReturn({state,payload:{...base,...payload},items,settings,scope:{companyId:'C1',branchId:'wh-1'}});
 assert.throws(call({lines:[{invoiceItemIndex:0,qty:11}]}),/can still come back/,'eleven of ten is refused');
 assert.throws(call({lines:[{invoiceItemIndex:0,qty:0}]}),/quantity coming back/);
 assert.throws(call({condition:'',lines:[{invoiceItemIndex:0,qty:1}]}),/condition/);
 assert.throws(()=>raiseSalesReturn({state,payload:{...base,warehouseId:'',lines:[{invoiceItemIndex:0,qty:1}]},items,settings,scope:{companyId:'C1'}}),/warehouse/,'a return with no warehouse - not even the working context one - is refused');
 assert.throws(call({date:'4 October',lines:[{invoiceItemIndex:0,qty:1}]}),/valid return date/);
 assert.throws(call({date:'2026-09-01',lines:[{invoiceItemIndex:0,qty:1}]}),/cannot precede the invoice/);
 assert.throws(call({lines:[{invoiceItemIndex:9,qty:1}]}),/does not carry/);
 assert.throws(()=>raiseSalesReturn({state,payload:{...base,invoiceId:'nope',lines:[{invoiceItemIndex:0,qty:1}]},items,settings,scope:{}}),/invoice the goods were sold on/);
 /* the second return sees the first, so the two together can never exceed the invoice */
 const first=raiseSalesReturn({state,payload:{...base,lines:[{invoiceItemIndex:0,qty:8}]},items,settings,scope:{companyId:'C1',branchId:'wh-1'}});
 assert.throws(()=>raiseSalesReturn({state:first.state,payload:{...base,lines:[{invoiceItemIndex:0,qty:3}]},items,settings,scope:{companyId:'C1',branchId:'wh-1'}}),/can still come back/);
 assert.equal(raiseSalesReturn({state:first.state,payload:{...base,lines:[{invoiceItemIndex:0,qty:2}]},items,settings,scope:{companyId:'C1',branchId:'wh-1'}}).result.lines[0].qty,2,'and the remainder is still returnable');
});

test('a return needs a stock account before it can post anything',()=>{
 const {state,invoice}=posted(2);
 const noAccounts={...state,accounts:[]};
 assert.throws(()=>raiseSalesReturn({state:noAccounts,payload:{invoiceId:invoice.id,date:'2026-09-20',condition:'Resalable',warehouseId:'wh-1',lines:[{invoiceItemIndex:0,qty:1}]},items,settings,scope:{companyId:'C1',branchId:'wh-1'}}),/stock correction/);
 assert.equal(salesReturnAccount(state,{}),'stock','an account that names inventory or stock is preferred for the stock correction');
 assert.equal(salesReturnAccount(state,{accountMappings:{inventoryAdjustment:'5900'}}),'5900','a configured inventory adjustment account wins over the guess');
 const plain={...state,accounts:state.accounts.map(a=>a.code==='stock'?{...a,name:'General adjustment'}:a)};
 assert.equal(salesReturnAccount(plain,{}),'5900','and with nothing named, an active expense account is used');
 assert.ok(SALES_RETURN_CONDITIONS.includes('Resalable'));
});
