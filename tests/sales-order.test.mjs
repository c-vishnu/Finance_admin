import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,seedAccounts,command} from '../src/invoice-engine.js';
import {ordersCsv,saveSalesOrder,convertSalesOrder} from '../src/sales-order-service.js';
const data={number:'SO-00001',date:'2026-09-04',dueDate:'2026-10-04',terms:'30',customerId:'abc',customerName:'ABC Technologies',billing:'Kochi billing',shipping:'Kochi shipping',place:'Kerala',reference:'REF-1',lines:[{item:'website',description:'Website Development',unit:'hour',qty:'1',rate:'100000',discount:'10',discountType:'%',taxes:{cgst:9,sgst:9,igst:0,cess:1},income:'4100'}]};
test('sales order stays non-posting; invoice carries exact fields and posts only on request',()=>{const state=seedAccounts(initial(),{Assets:[['1100','Receivable']],Income:[['4100','Service Income']],Liabilities:[['2100','GST Payable']]});const {order}=saveSalesOrder([],data,state.config,'Confirmed');assert.equal(state.invoices.length,0);assert.equal(state.journals.length,0);const output=convertSalesOrder(state,order);const invoice=output.result;assert.equal(invoice.status,'Draft');assert.equal(invoice.posted,false);assert.equal(output.state.journals.length,0);for(const k of ['billing','shipping','place','dueDate','terms','reference','customerId'])assert.equal(invoice[k],order[k]);assert.deepEqual(invoice.lines,order.lines);assert.equal(invoice.totals.total,order.totals.total);assert.equal(invoice.totals.total,10710000);assert.equal(convertSalesOrder(output.state,order).state.invoices.length,1);const sourced=convertSalesOrder(state,saveSalesOrder([],{...data,placeSource:'shipping_address',placeCode:'32'},state.config,'Confirmed').order).result;assert.equal(sourced.place,'Kerala','the place of supply itself is carried unchanged');assert.equal(sourced.placeSource,'shipping_address','the invoice inherits the place of supply AND where the order got it from');assert.equal(sourced.placeCode,'32','with the GST state code alongside it')});
test('cancelled orders and invalid dates are blocked; duplicate numbers rejected',()=>{const state=initial();const saved=saveSalesOrder([],data,state.config,'Draft');assert.throws(()=>convertSalesOrder(state,{...saved.order,status:'Cancelled'}),/Cancelled/);assert.throws(()=>saveSalesOrder(saved.orders,data,state.config,'Draft'),/unique/);assert.throws(()=>saveSalesOrder([],{...data,dueDate:'2026-01-01'},state.config,'Draft'),/date/);assert.throws(()=>convertSalesOrder(state,{...saved.order,schemaVersion:1}),/legacy/)});

test('the invoice inherits the order scope and the customer receivable ledger',()=>{
 const state=seedAccounts(initial(),{Assets:[['1100','Receivable']],Income:[['4100','Service Income']],Liabilities:[['2100','GST Payable']]});
 const {order}=saveSalesOrder([],{...data,organizationId:'abc',organizationName:'ABC Technologies Pvt Ltd',branchId:'abc-kochi',branchName:'Kochi Branch',receivableAccount:'1100'},state.config,'Confirmed');
 const invoice=convertSalesOrder(state,order).result;
 assert.equal(invoice.organizationId,'abc','the order organisation travels to the invoice, so period locking uses the order branch');
 assert.equal(invoice.branchId,'abc-kochi','and so does its branch');
 assert.equal(invoice.organizationName,'ABC Technologies Pvt Ltd');
 assert.equal(invoice.receivableAccount,'1100','and the customer ledger, so posting can use the customer account');
});

test('a legacy order with a TDS/TCS withholding is refused rather than silently dropped',()=>{
 const state=initial();
 const {order}=saveSalesOrder([],data,state.config,'Confirmed');
 assert.throws(()=>convertSalesOrder(state,{...order,taxRate:'2'}),/TDS\/TCS/);
 assert.throws(()=>convertSalesOrder(state,{...order,adjustment:'500'}),/TDS\/TCS/);
 assert.equal(convertSalesOrder(state,{...order,taxRate:'0',adjustment:'0'}).result.status,'Draft','an order without a withholding still converts');
});

test('the register export quotes only what needs quoting',()=>{
 const rows=[{number:'SO-00001',date:'2026-09-04',customerName:'Rao, Kumar & Co',organizationName:'ABC',branchName:'Kochi',status:'Confirmed',dueDate:'2026-10-04',reference:'PO "7"',total:1003}];
 const csv=ordersCsv(rows),lines=csv.split('\n');
 assert.equal(lines.length,2);
 assert.equal(lines[0],'Order number,Order date,Customer,Organisation,Branch,Status,Due date,Reference,Total');
 assert.ok(lines[1].startsWith('SO-00001,2026-09-04,"Rao, Kumar & Co",ABC,Kochi,Confirmed'),'a customer name with a comma is quoted');
 assert.ok(lines[1].includes('"PO ""7"""'),'an embedded quote is doubled');
 assert.ok(lines[1].endsWith('1003.00'));
 assert.equal(ordersCsv([]).split('\n').length,1,'an empty register still exports its header');
});

