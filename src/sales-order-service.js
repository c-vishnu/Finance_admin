import {calculate,command} from './invoice-engine.js';
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
 const config={...state.config,...order.taxPolicy};
 const output=command({...state,config},'save',{sourceOrder:order.id,sourceOrderNumber:order.number,reference:order.reference||order.number,customerId:order.customerId,customerName:order.customerName,date:order.date,dueDate:order.dueDate,terms:order.terms,billing:order.billing,shipping:order.shipping,place:order.place,lines:clone(order.lines),notes:order.notes||'',termsAndConditions:order.termsAndConditions||''});
 output.state.config=state.config;
 return output;
}
