import {KEY,initial,command,journal,outstanding} from './invoice-engine.js';
import {MANUAL_JOURNAL_KEY,reversalRecord,sampleJournalRecords} from './simple-journal-transaction.js';
import {receiptCommand} from './receipt-engine.js';
import {vendorSeeds,VENDOR_KEY} from './vendor-store.js';
import {OPERATIONS_KEY,seedOperations} from './operations-store.js';
import {BANKING_KEY,initialBanking,createBankingDemo} from './banking-service.js';
import {PURCHASE_ORDER_KEY,PURCHASE_BILL_KEY,GOODS_RECEIPT_KEY,VENDOR_PAYMENT_KEY,DEBIT_NOTE_KEY,savePurchaseOrder,savePurchaseBill,postPurchaseBill,recordPurchasePayment} from './purchase-service.js';

export const DEMO_VERSION=2;
export const DEMO_MARKER='wayvida-demo-data-version';
const customerSeeds=[
 {id:'cus-1',name:'ABC Retail Pvt Ltd',code:'CUS001',contact:'Anjali Menon',email:'accounts@abcretail.example',phone:'9876543210',billing:'MG Road, Kochi',shipping:'MG Road, Kochi',state:'Kerala',limit:'100000',opening:'45000',account:'1100',status:'Active'},
 {id:'cus-2',name:'Northstar Services',code:'CUS002',contact:'Rahul Kumar',email:'finance@northstar.example',phone:'9876543211',billing:'Indiranagar, Bengaluru',shipping:'Indiranagar, Bengaluru',state:'Karnataka',limit:'75000',opening:'20000',account:'1100',status:'Active'}
];
const itemSeeds=[
 {id:'item-1',name:'Office stationery box',type:'Goods',unit:'box',sales:true,purchase:true,price:'850',cost:'600',salesAccount:'4000',purchaseAccount:'5000',taxApplicable:true,taxRate:'18',cessRate:'0',priceTaxMode:'exclusive'},
 {id:'item-2',name:'Consulting service',type:'Service',unit:'hour',sales:true,purchase:false,price:'2500',cost:'0',salesAccount:'4100',purchaseAccount:'',taxApplicable:true,taxRate:'18',cessRate:'0',priceTaxMode:'exclusive'}
];
const read=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}};
const empty=(storage,key)=>{const value=read(storage,key,null);return value==null||(Array.isArray(value)&&value.length===0)};
const writeEmpty=(storage,key,value)=>{if(empty(storage,key))storage.setItem(key,JSON.stringify(value))};

const accounts=[
 ['1000','Cash','Assets'],['1010','Bank','Assets'],['1100','Accounts Receivable','Assets'],['1200','Inventory','Assets'],
 ['1410','Input CGST','Assets'],['1420','Input SGST','Assets'],['1430','Input IGST','Assets'],['1440','Input Cess','Assets'],
 ['2000','Accounts Payable','Liabilities'],['2100','GST Payable','Liabilities'],['2200','Customer Advances','Liabilities'],
 ['3000','Opening Balance Equity','Equity'],['4000','Sales','Income'],['4100','Service Income','Income'],
 ['5000','Purchase','Expenses'],['5300','Utilities','Expenses'],['5400','Travel','Expenses'],['5600','Professional Fees','Expenses'],['5700','Bank Charges','Expenses'],['5800','Depreciation','Expenses'],['5900','Other Expenses','Expenses']
].map(([code,name,type])=>({id:`demo-account-${code}`,code,name,type,nature:['Assets','Expenses'].includes(type)?'Debit':'Credit',active:true,isGroup:false,system:true,revision:1}));

function salesDemo(){
 let state={...initial(),accounts,config:{...initial().config,sales:'4000',receipts:{advanceAccount:'2200',threshold:5000000,closedThrough:''}}};
 const invoiceInput=(number,customer,date,rate,description)=>({number,date,dueDate:'2026-09-30',customerId:customer.id,customerName:customer.name,billing:customer.billing,shipping:customer.shipping,place:customer.state,reference:`DEMO-${number}`,lines:[{id:`line-${number}`,item:'item-1',description,unit:'box',qty:'1',rate,discount:'0',discountType:'%',tax:'18',cess:'0',income:'4000'}],notes:'Demo transaction',termsAndConditions:'Payment due within 30 days'});
 let result=command(state,'save',invoiceInput('INV-00001',customerSeeds[0],'2026-09-02','1000','Office stationery supply'));state=result.state;state=command(state,'post',{id:result.result.id}).state;
 result=command(state,'save',invoiceInput('INV-00002',customerSeeds[1],'2026-09-05','2500','Implementation consulting'));state=result.state;state=command(state,'post',{id:result.result.id}).state;
 let receipt=receiptCommand(state,'save',{date:'2026-09-04',customerId:customerSeeds[0].id,amount:'590',kind:'Normal',bank:'1010',mode:'Bank Transfer',reference:'UTR-DEMO-1001',allocations:[{invoiceId:state.invoices[0].id,amount:'590'}]},{role:'Admin',actor:'Demo Admin',customers:customerSeeds});
 receipt=receiptCommand(receipt.state,'submit',{id:receipt.result.id},{role:'Admin',actor:'Demo Admin',customers:customerSeeds});
 receipt=receiptCommand(receipt.state,'post',{id:receipt.result.id},{role:'Admin',actor:'Demo Admin',customers:customerSeeds});
 return receipt.state;
}

function purchaseDemo(accounting){
 const line={id:'demo-po-line-1',itemId:'item-1',description:'Office stationery box',qty:'10',unit:'box',rate:'600',discount:'0',taxRate:'18',cessRate:'0',priceTaxMode:'exclusive',purchaseAccount:'5000'};
 const base={vendorId:vendorSeeds[0].id,vendorName:vendorSeeds[0].name,vendorGstin:vendorSeeds[0].gstin,date:'2026-09-03',dueDate:'2026-10-03',paymentTerms:'30 Days',placeOfSupply:'Kerala',lines:[line],payableAccount:'2000'};
 const order=savePurchaseOrder([],{...base,number:'PO-00001',expectedDate:'2026-09-08',reference:'DEMO-PO'},'Sent To Vendor').order;
 const receipt={id:'demo-grn-1',number:'GRN-00001',orderId:order.id,orderNumber:order.number,vendorId:order.vendorId,vendorName:order.vendorName,date:'2026-09-06',reference:'DELIVERY-1001',notes:'Demo goods receipt',lines:[{orderLineId:line.id,itemId:line.itemId,description:line.description,unit:line.unit,orderedQty:10,previouslyReceived:0,receivedQty:10,pendingQty:0}],status:'Posted',createdBy:'Demo Admin',createdAt:'2026-09-06T10:00:00.000Z'};
 const completed={...order,status:'Received',lines:[{...line,orderedQty:10,receivedQty:10}]};
 const bill=savePurchaseBill([],{...base,number:'BILL-00001',vendorInvoice:'KOS/2026/184',referenceOrder:order.number,sourceOrderId:order.id},'Draft').bill;
 /* Both engines resolve the accounting period from the posting context, so the demo states the scope it seeds. */
 const periodOptions={companyId:'ABC01',branchId:'abc-kochi',module:'Purchases'};
 let posted=postPurchaseBill(accounting,bill,{periodOptions}),payment=recordPurchasePayment(posted.state,posted.bill,{amount:'3000',date:'2026-09-07',reference:'NEFT-DEMO-2001',periodOptions});
 return {accounting:payment.state,orders:[completed],bills:[payment.bill],receipts:[receipt],payments:payment.state.vendorPayments||[]};
}

/* The journal register's demo content. Five journal-backed transactions cover
   every status, and the two settlement rows are posted by the document engines so
   their balances and their postings stay truthful. Sample codes map onto the
   existing chart of accounts; the transaction name carries the narrative. */
function journalDemo(accounting,purchases){
 const records=sampleJournalRecords({accounts:accounting.accounts,organization:'Wayvida Learning',branch:'Kochi'});
 let state=accounting,bills=purchases.bills,payments=purchases.payments;
 const context=record=>({number:record.number,role:'Admin',companyId:'ABC01',branchId:'abc-kochi',periodModule:'Accounting'});
 const paise=record=>(record.lines||[]).map(line=>({account:line.account,debit:Math.round(Number(line.debit||0)*100),credit:Math.round(Number(line.credit||0)*100),branch:'abc-kochi',costCentre:'Operations',description:line.description||''}));
 /* Iterate a snapshot: the reversal record is appended to the same list. */
 for(const record of records.slice()){
  if(record.status!=='Approved'&&record.status!=='Reversed')continue;
  const entry=journal(state,context(record),'Journal Transaction',paise(record),record.date,'sample-journal:'+record.number);
  record.ledgerJournalId=entry.id;record.publishedBy='Admin';record.publishedAt=entry.createdAt;
  if(record.status==='Reversed'){
   const base=reversalRecord(record,record.reversalDate,record.reversalReason);
   const reversal=journal(state,context(base),'Journal Reversal',paise(base),base.date,'sample-reversal:'+record.number);
   reversal.reversalOf=entry.id;
   record.reversalJournalId=reversal.id;record.reversedBy='Admin';record.reversedAt=reversal.createdAt;
   records.push({...base,ledgerJournalId:reversal.id,reversedBy:'Admin',reversedAt:reversal.createdAt});
  }
 }
 const invoice=(state.invoices||[]).find(row=>row.posted&&row.status!=='Cancelled');
 const invoiceOpen=invoice?outstanding(state,invoice):0;
 if(invoice&&invoiceOpen>0)state=command(state,'pay',{id:invoice.id,amount:(invoiceOpen/100).toFixed(2),date:'2026-09-04',bank:'1010',reference:'UTR-DEMO-2002',token:'sample-customer-payment'}).state;
 const bill=bills[0],billOpen=bill&&bill.posted?bill.total-(bill.paidAmount||0)-(bill.creditApplied||0):0;
 if(bill&&billOpen>0){const result=recordPurchasePayment(state,bill,{amount:(billOpen/100).toFixed(2),date:'2026-09-05',bankAccount:'1010',reference:'NEFT-DEMO-2002',role:'Admin',periodOptions:{companyId:'ABC01',branchId:'abc-kochi',module:'Purchases'}});state=result.state;bills=[result.bill];payments=state.vendorPayments||[]}
 return {accounting:state,records,bills,payments};
}

export function bootstrapDemoData(storage=globalThis.localStorage){
 if(!storage||Number(storage.getItem(DEMO_MARKER)||0)>=DEMO_VERSION)return {loaded:false};
 /* The accounting period a posting resolves through is chosen by the working
    context, so the demo seeds its own company and branch before any journal is
    written. Without them a fresh install has no period to post against, which is
    why the seeded registers used to arrive empty. */
 if(!storage.getItem('wayvida-demo-company'))storage.setItem('wayvida-demo-company','abc');if(!storage.getItem('wayvida-demo-branch'))storage.setItem('wayvida-demo-branch','abc-kochi');
 writeEmpty(storage,'wayvida-customers',customerSeeds);writeEmpty(storage,'finance-erp-items',itemSeeds);writeEmpty(storage,VENDOR_KEY,vendorSeeds);writeEmpty(storage,OPERATIONS_KEY,seedOperations());
 let accounting=read(storage,KEY,null);if(!accounting?.invoices?.length)accounting=salesDemo();
 const needsPurchaseDemo=empty(storage,PURCHASE_BILL_KEY),purchases=needsPurchaseDemo?purchaseDemo(accounting):{accounting,orders:read(storage,PURCHASE_ORDER_KEY,[]),bills:read(storage,PURCHASE_BILL_KEY,[]),receipts:read(storage,GOODS_RECEIPT_KEY,[]),payments:read(storage,VENDOR_PAYMENT_KEY,[])};accounting=purchases.accounting;
 writeEmpty(storage,PURCHASE_ORDER_KEY,purchases.orders);writeEmpty(storage,PURCHASE_BILL_KEY,purchases.bills);writeEmpty(storage,GOODS_RECEIPT_KEY,purchases.receipts);writeEmpty(storage,VENDOR_PAYMENT_KEY,purchases.payments);if(purchases.bills[0])writeEmpty(storage,DEBIT_NOTE_KEY,[{id:'demo-dn-1',number:'DN-2026-0001',vendorId:vendorSeeds[0].id,vendorName:vendorSeeds[0].name,billId:purchases.bills[0].id,billNumber:purchases.bills[0].number,date:'2026-09-07',reason:'Two boxes returned damaged',status:'Draft',posted:false,total:141600,appliedAmount:0,lines:[{...purchases.bills[0].lines[0],qty:'2'}],createdBy:'Demo Admin',createdAt:'2026-09-07T11:00:00.000Z'}]);
 const journalSeed=journalDemo(accounting,purchases);accounting=journalSeed.accounting;
 writeEmpty(storage,MANUAL_JOURNAL_KEY,journalSeed.records);
 if(journalSeed.bills!==purchases.bills)storage.setItem(PURCHASE_BILL_KEY,JSON.stringify(journalSeed.bills));
 if(journalSeed.payments!==purchases.payments)storage.setItem(VENDOR_PAYMENT_KEY,JSON.stringify(journalSeed.payments));
 const banking=createBankingDemo(read(storage,BANKING_KEY,initialBanking()),accounting);storage.setItem(KEY,JSON.stringify(banking.accounting));if(empty(storage,BANKING_KEY)||Number(read(storage,BANKING_KEY,{}).demoVersion||0)<2)storage.setItem(BANKING_KEY,JSON.stringify(banking.banking));
 writeEmpty(storage,'wayvida-sales-orders',[{id:'demo-so-1',number:'SO-00001',schemaVersion:2,date:'2026-09-01',dueDate:'2026-10-01',shipment:'2026-09-08',customerId:customerSeeds[0].id,customer:customerSeeds[0].id,customerName:customerSeeds[0].name,billing:customerSeeds[0].billing,shipping:customerSeeds[0].shipping,place:customerSeeds[0].state,reference:'WEB-DEMO-1001',status:'Confirmed',lines:[{id:'demo-so-line',item:'item-1',description:'Office stationery box',unit:'box',qty:'4',rate:'850',discount:'0',discountType:'%',tax:'18',cess:'0',income:'4000'}],total:4012,totals:{subtotal:340000,taxable:340000,cgst:30600,sgst:30600,igst:0,cess:0,total:401200},taxPolicy:{state:'Kerala',roundRupee:false},notes:'Demo confirmed order'}]);
 storage.setItem(DEMO_MARKER,String(DEMO_VERSION));return {loaded:true};
}
