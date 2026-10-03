import {KEY,initial,command,journal,outstanding} from './invoice-engine.js';
import {MANUAL_JOURNAL_KEY,reversalRecord,sampleJournalRecords} from './simple-journal-transaction.js';
import {receiptCommand} from './receipt-engine.js';
import {vendorDefaults,VENDOR_KEY} from './vendor-store.js';
import {OPERATIONS_KEY,seedOperations} from './operations-store.js';
import {BANKING_KEY,initialBanking,createBankingDemo} from './banking-service.js';
import {PURCHASE_ORDER_KEY,PURCHASE_BILL_KEY,GOODS_RECEIPT_KEY,VENDOR_PAYMENT_KEY,DEBIT_NOTE_KEY,savePurchaseOrder,savePurchaseBill,postPurchaseBill,recordPurchasePayment,createGoodsReceipt,saveDebitNote,submitDebitNote,approveDebitNote,issueDebitNote} from './purchase-service.js';
import {saveSalesOrder} from './sales-order-service.js';
import {creditCommand} from './credit-note-service.js';
import {BUDGET_STORAGE,emptyBudgetState,createBudget} from './budget-store.js';
import {adjustmentCommand} from './inventory-adjustments.js';

export const DEMO_VERSION=8;
export const DEMO_MARKER='wayvida-demo-data-version';
/* The stores this seed wrote. A later demo version re-seeds exactly these and leaves every
   other store alone, so a workspace that holds records the demo never created is not
   overwritten by a dataset it never asked for. */
export const DEMO_OWNED_KEY='wayvida-demo-owned-keys';

/* Every register is seeded to at least ten rows, so each table, list and report has more
   than one page to show. Transaction registers are written through the real engines
   (command, receiptCommand, the purchase service, creditCommand, journal, adjustmentCommand)
   rather than by hand, so balances, postings, period locking and the audit trail stay
   truthful and every journal still balances. */

const business='Business',individual='Individual';
const SALES_ORDERS_KEY='wayvida-sales-orders';

/* name, code, contact, email, phone, address, state, gstin, credit limit, opening, status, type */
const customerRows=[
 ['ABC Retail Pvt Ltd','CUS001','Anjali Menon','accounts@abcretail.example','9876543210','MG Road, Kochi','Kerala','32ABCDE1234F1Z5','100000','45000','Active',business],
 ['Northstar Services','CUS002','Rahul Kumar','finance@northstar.example','9876543211','Indiranagar, Bengaluru','Karnataka','29AAACN1234P1Z8','75000','20000','Active',business],
 ['Green Valley Foods','CUS003','Meera Nair','ap@greenvalley.example','9876543212','Marine Drive, Kochi','Kerala','32AAGCG5678K1Z2','150000','0','Active',business],
 ['Sunrise Interiors','CUS004','Deepak Rao','deepak@sunriseinteriors.example','9876543213','Jayanagar, Bengaluru','Karnataka','29AAECS9012L1Z6','90000','12000','Active',business],
 ['Coastal Traders','CUS005','Fathima Beevi','accounts@coastaltraders.example','9876543214','Beach Road, Kozhikode','Kerala','32AAEFC3456M1Z9','60000','5000','Active',business],
 ['Pixel Studio Design','CUS006','Arjun Das','hello@pixelstudio.example','9876543215','T Nagar, Chennai','Tamil Nadu','33AAGFP7890N1Z3','80000','0','Active',business],
 ['Meridian Logistics','CUS007','Sneha Iyer','billing@meridianlog.example','9876543216','Andheri East, Mumbai','Maharashtra','27AAHCM2345Q1Z7','250000','30000','Active',business],
 ['Bluepeak Software','CUS008','Karthik Reddy','finance@bluepeak.example','9876543217','Hitech City, Hyderabad','Telangana','36AAICB6789R1Z1','200000','0','Active',business],
 ['Aurora Pharma Distributors','CUS009','Neha Sharma','accounts@aurorapharma.example','9876543218','Connaught Place, New Delhi','Delhi','07AAJCA1234S1Z5','300000','60000','Active',business],
 ['Lakeview Hotels','CUS010','Thomas Mathew','purchase@lakeviewhotels.example','9876543219','Kumarakom, Kottayam','Kerala','32AAKCL5678T1Z8','120000','15000','Active',business],
 ['Western Ghats Coffee','CUS011','Divya Menon','accounts@ghatscoffee.example','9876543220','Somwarpet, Coorg','Karnataka','29AALCW9012U1Z2','50000','0','Inactive',business],
 ['Orchid Events','CUS012','Vishal Jain','events@orchidevents.example','9876543221','Panjim, Goa','Goa','30AAMCO3456V1Z6','40000','8000','Active',individual]
];
const customerSeeds=customerRows.map(([name,code,contact,email,phone,address,state,gstin,limit,opening,status,type],index)=>({id:`cus-${index+1}`,name,code,contact,email,phone,billing:address,shipping:address,state,gstin,limit,opening,account:'1100',status,type,days:'30'}));

/* name, type, unit, price, cost, sales account, purchase account, tax rate, opening qty, opening rate */
const itemRows=[
 ['Office stationery box','Goods','box','850','600','4000','5000','18','120','600'],
 ['Consulting service','Service','hour','2500','0','4100','','18','0','0'],
 ['A4 copier paper (ream)','Goods','pack','320','240','4000','5000','18','400','240'],
 ['Toner cartridge','Goods','pcs','4200','3100','4000','5000','18','35','3100'],
 ['Ergonomic chair','Goods','pcs','9500','7200','4000','5000','18','18','7200'],
 ['Laptop stand','Goods','pcs','1800','1250','4000','5000','18','60','1250'],
 ['Annual maintenance contract','Service','hour','3200','0','4100','','18','0','0'],
 ['Website redesign','Service','hour','4500','0','4100','','18','0','0'],
 ['Brand identity package','Service','set','65000','0','4100','','18','0','0'],
 ['Tax filing service','Service','day','5500','0','4100','','18','0','0'],
 ['Network switch 24-port','Goods','pcs','12500','9800','4000','5000','18','12','9800'],
 ['UPS battery bank','Goods','pcs','6800','5200','4000','5000','18','24','5200']
];
const buildItem=(name,type,unit,price,cost,salesAccount,purchaseAccount,taxRate,openingQuantity,openingRate,index)=>({id:`item-${index+1}`,name,type,unit,sku:`ITEM-${String(index+1).padStart(4,'0')}`,category:type==='Service'?'Professional Services':'Products',hsnSac:'',description:'',image:'',sales:true,purchase:type!=='Service',price,cost,salesAccount,purchaseAccount,trackInventory:type!=='Service',inventoryAccount:type!=='Service'?'1200':'',cogsAccount:type!=='Service'?'5000':'',openingQuantity,openingRate,openingDate:'2026-09-05',warehouseId:type!=='Service'?'abc-kochi':'',taxPreference:'Taxable',taxApplicable:true,taxRate,interStateTaxRate:taxRate,cessRate:'0',priceTaxMode:'exclusive',organizationId:'abc',organizationIds:['abc'],branchIds:type!=='Service'?['abc-kochi']:[],active:true,auditTrail:[],currency:'INR'});
const itemSeeds=itemRows.map((row,index)=>buildItem(...row,index));
const itemOf=id=>itemSeeds.find(row=>row.id===id);

/* name, type, contact, email, gstin, pan, payment terms, credit limit, opening, status, city, balance */
const vendorRows=[
 ['Kerala Office Supplies','Distributor','Anoop Krishnan','accounts@keralaoffice.example','32ABCDE1234F1Z5','ABCDE1234F','30 Days','500000','50000','Active','Kochi'],
 ['Cloudstack Services','Service Provider','Rekha Pillai','billing@cloudstack.example','29AAACC1206D1ZQ','AAACC1206D','15 Days','250000','0','Active','Bengaluru'],
 ['Metro Maintenance Works','Contractor','Sabu Joseph','sabu@metromaintenance.example','','','Due Immediately','0','0','Blocked','Kochi'],
 ['Trident Stationers','Supplier','Latha Nair','sales@tridentstationers.example','32AAGCT1122H1Z4','AAGCT1122H','30 Days','300000','15000','Active','Kochi'],
 ['Bharat Paper House','Distributor','Manoj Verma','orders@bharatpaper.example','27AAHCB3344J1Z9','AAHCB3344J','45 Days','750000','0','Active','Mumbai'],
 ['Southern Furniture Co','Supplier','Priya Balan','priya@southernfurniture.example','32AAJCS5566K1Z3','AAJCS5566K','30 Days','400000','25000','Active','Kochi'],
 ['Nimbus Technologies','Service Provider','Vivek Shetty','accounts@nimbustech.example','29AALCN7788L1Z7','AALCN7788L','15 Days','200000','0','Active','Bengaluru'],
 ['Sagar Electricals','Supplier','Ranjith Kumar','sales@sagarelectricals.example','32AAMCS9900M1Z2','AAMCS9900M','30 Days','150000','5000','Active','Kottayam'],
 ['Vertex Software Licences','Service Provider','Aisha Khan','billing@vertexlicences.example','36AANCV1234N1Z6','AANCV1234N','Due Immediately','500000','0','Active','Hyderabad'],
 ['Harbour Freight Movers','Transporter','Joseph Thomas','ops@harbourfreight.example','32AAOCH3456P1Z1','AAOCH3456P','30 Days','250000','10000','Active','Kochi'],
 ['Everest Print Solutions','Supplier','Nithin Raj','nithin@everestprint.example','29AAPCE5678Q1Z5','AAPCE5678Q','45 Days','350000','0','Active','Bengaluru'],
 ['Prime Security Services','Contractor','Girish Menon','girish@primesecurity.example','32AAQCP7890R1Z9','AAQCP7890R','30 Days','100000','0','Inactive','Kochi']
];
const vendorTdsMap={
 0:{tdsApplicable:true,tdsSection:'194Q',tdsRate:'0.1'},
 1:{tdsApplicable:true,tdsSection:'194J',tdsRate:'10'},
 2:{tdsApplicable:true,tdsSection:'194C',tdsRate:'1'},
 5:{tdsApplicable:true,tdsSection:'194C',tdsRate:'2'},
 6:{tdsApplicable:true,tdsSection:'194J',tdsRate:'10'},
 8:{tdsApplicable:true,tdsSection:'194J',tdsRate:'10'},
 10:{tdsApplicable:true,tdsSection:'194C',tdsRate:'2'},
 11:{tdsApplicable:true,tdsSection:'194C',tdsRate:'2'}
};
const vendorSeeds=vendorRows.map(([name,type,contactName,email,gstin,pan,paymentTerms,creditLimit,openingBalance,status,city],index)=>({
 ...vendorDefaults,
 id:`ven-${index+1}`,
 code:`VEN-${String(index+1).padStart(5,'0')}`,
 name,
 displayName:name,
 type,
 contactName,
 phone:`+91 98470 1${String(index+10).padStart(4,'0')}`,
 email,
 gstRegistered:Boolean(gstin),
 gstin,
 gstTreatment:gstin?'Registered Business':'Unregistered Business',
 pan,
 paymentTerms,
 creditLimit,
 openingBalance,
 status,
 branch:city,
 branchName:city,
 balance:0,
 createdBy:'Admin',
 createdAt:`2026-09-${String(index+1).padStart(2,'0')}T09:30:00.000Z`,
 ...(vendorTdsMap[index]||{})
}));

/* The chart of accounts the demo ledger posts against. Codes match the module defaults. */
const accounts=[
 ['1000','Cash','Assets'],['1010','Bank','Assets'],['1020','ICICI Current Account','Assets'],['1100','Accounts Receivable','Assets'],['1200','Inventory','Assets'],['1300','Fixed Assets','Assets'],['1350','Accumulated Depreciation','Assets'],
 ['1410','Input CGST','Assets'],['1420','Input SGST','Assets'],['1430','Input IGST','Assets'],['1440','Input Cess','Assets'],
 ['2000','Accounts Payable','Liabilities'],['2100','GST Payable','Liabilities'],['2200','Customer Advances','Liabilities'],
 ['3000','Opening Balance Equity','Equity'],['4000','Sales','Income'],['4100','Service Income','Income'],
 ['5000','Purchase','Expenses'],['5100','Stock Adjustment','Expenses'],['5300','Utilities','Expenses'],['5400','Travel','Expenses'],['5600','Professional Fees','Expenses'],['5700','Bank Charges','Expenses'],['5800','Depreciation','Expenses'],['5900','Other Expenses','Expenses']
].map(([code,name,type])=>({id:`demo-account-${code}`,code,name,type,nature:['Assets','Expenses'].includes(type)?'Debit':'Credit',active:true,isGroup:false,system:true,revision:1}));

const demoConfig={...initial().config,sales:'4000',receipts:{advanceAccount:'2200',threshold:5000000,closedThrough:''}};
const reads=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}};
const hasRows=value=>value==null?false:Array.isArray(value)?value.length>0:typeof value==='object'?Object.keys(value).length>0:true;
const rupees=minor=>Number(minor/100).toFixed(2);
/* A percentage of an amount in paise, rounded to whole rupees, as a decimal string. */
const portion=(minor,perCent)=>rupees(Math.round(minor*perCent/100/100)*100);
const plusDays=(date,days)=>{const at=new Date(date+'T12:00:00Z');at.setUTCDate(at.getUTCDate()+days);return at.toISOString().slice(0,10)};
const scope={organizationId:'abc',branchId:'abc-kochi'};
const purchasePeriod={companyId:'ABC01',branchId:'abc-kochi',module:'Purchases'};


/* ------------------------------------------------------------------- sales ---- */

/* customer, date, due, item, qty, rate, description */
const invoiceRows=[
 [0,'2026-09-02','2026-09-20','item-1','1','1000','Office stationery supply'],
 [1,'2026-09-05','2026-09-25','item-2','4','2500','Implementation consulting'],
 [2,'2026-09-07','2026-09-28','item-3','20','320','Copier paper for the Kochi plant'],
 [3,'2026-09-08','2026-10-08','item-5','6','9500','Ergonomic chairs for the design studio'],
 [4,'2026-09-09','2026-09-24','item-4','3','4200','Printer consumables'],
 [5,'2026-09-11','2026-10-11','item-8','10','4500','Website redesign sprint'],
 [6,'2026-09-12','2026-10-12','item-9','1','65000','Brand identity package'],
 [7,'2026-09-15','2026-10-15','item-7','12','3200','Annual maintenance support'],
 [8,'2026-09-17','2026-10-17','item-11','4','12500','Network switches for the new wing'],
 [9,'2026-09-19','2026-09-29','item-6','15','1800','Laptop stands for the service desk'],
 [10,'2026-09-22','2026-10-22','item-12','5','6800','UPS battery replacement'],
 [11,'2026-09-24','2026-10-24','item-10','3','5500','Quarterly tax filing support']
];
/* The share of each invoice its seeded receipt settles. The eleventh invoice is settled
   through the invoice engine payment path instead, so both settlement routes carry data. */
const receiptShares=[50,50,50,40,100,50,40,50,40,40];

/* Twelve confirmed and draft sales orders, one per invoice, through the order service. */
function seedSalesOrders(){
 let orders=[];
 for(const [index,[customer,date,due,item,qty,rate,description]] of invoiceRows.entries()){
  const buyer=customerSeeds[customer],unit=itemOf(item).unit;
  const input={...scope,organizationName:'Wayvida Learning',branchName:'Kochi',number:`SO-${String(index+1).padStart(5,'0')}`,date,dueDate:due,shipment:date,customerId:buyer.id,customerName:buyer.name,billing:buyer.billing,shipping:buyer.shipping,place:buyer.state,reference:`WEB-DEMO-${String(index+1).padStart(3,'0')}`,terms:'30',lines:[{id:`demo-so-line-${index+1}`,item,description,unit,qty,rate,discount:'0',discountType:'%',tax:'18',cess:'0',income:itemOf(item).salesAccount}],notes:'Demo sales order'};
  orders=saveSalesOrder(orders,input,demoConfig,index%5===4?'Draft':'Confirmed').orders;
 }
 return orders;
}

/* Twelve invoices, each posted through the invoice engine, then ten receipts through the
   receipt engine and one invoice payment through the payment path. */
function seedSales(accounting){
 let state=accounting;
 const invoices=[];
 for(const [index,[customer,date,due,item,qty,rate,description]] of invoiceRows.entries()){
  const buyer=customerSeeds[customer];
  const payload={...scope,number:`INV-${String(index+1).padStart(5,'0')}`,date,dueDate:due,customerId:buyer.id,customerName:buyer.name,place:buyer.state,reference:`DEMO-${String(index+1).padStart(4,'0')}`,lines:[{id:`demo-invoice-line-${index+1}`,item,description,unit:itemOf(item).unit,qty,rate,discount:'0',discountType:'%',tax:'18',cess:'0',income:itemOf(item).salesAccount}],notes:'Demo transaction',termsAndConditions:'Payment due within 30 days'};
  const saved=command(state,'save',payload);
  state=command(saved.state,'post',{id:saved.result.id}).state;
  invoices.push(state.invoices.find(row=>row.id===saved.result.id));
 }
 const ctx={role:'Admin',actor:'Demo Admin',customers:customerSeeds};
 for(const [index,perCent] of receiptShares.entries()){
  const invoice=invoices[index],amount=portion(invoice.totals.total,perCent);
  let saved=receiptCommand(state,'save',{date:plusDays(invoice.date,2),customerId:invoice.customerId,amount,kind:'Normal',bank:'1010',mode:'Bank Transfer',reference:`UTR-DEMO-2${String(index+1).padStart(3,'0')}`,allocations:[{invoiceId:invoice.id,amount}]},ctx);
  saved=receiptCommand(saved.state,'submit',{id:saved.result.id},ctx);
  saved=receiptCommand(saved.state,'post',{id:saved.result.id},ctx);
  state=saved.state;
 }
 const legacy=invoices[10],legacyOpen=outstanding(state,legacy);
 state=command(state,'pay',{id:legacy.id,amount:portion(legacyOpen,40),date:plusDays(legacy.date,2),bank:'1010',reference:'UTR-DEMO-9011',token:'sample-customer-payment'}).state;
 return state;
}

/* --------------------------------------------------------------- purchases ---- */

/* vendor, date, expected, item, qty, rate, description */
const purchaseRows=[
 [0,'2026-09-02','2026-09-06','item-1','40','600','Office stationery boxes'],
 [1,'2026-09-03','2026-09-10','item-2','30','1800','Cloud migration consulting'],
 [3,'2026-09-04','2026-09-09','item-3','120','240','A4 copier paper (ream)'],
 [5,'2026-09-05','2026-09-12','item-5','10','7200','Ergonomic chairs for the Kochi floor'],
 [6,'2026-09-06','2026-09-13','item-7','40','2400','Application maintenance support'],
 [7,'2026-09-08','2026-09-14','item-11','6','9800','Network switches'],
 [9,'2026-09-09','2026-09-16','item-12','12','5200','UPS battery banks'],
 [10,'2026-09-10','2026-09-18','item-9','10','5200','Brand collateral printing'],
 [8,'2026-09-11','2026-09-17','item-4','20','3100','Toner cartridges'],
 [4,'2026-09-13','2026-09-21','item-3','200','230','Bulk copier paper order'],
 [1,'2026-09-12','2026-09-20','item-10','10','4200','Statutory filing support'],
 [0,'2026-09-14','2026-09-22','item-6','30','1250','Laptop stands for the service desk']
];
const purchaseOrderStatus=['Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Sent To Vendor','Draft'];

/* Twelve purchase orders, eleven received into goods receipts and eleven billed. Ten of the
   bills are posted and partly paid, and each carries one issued debit note, so every stage of
   the purchase lifecycle is present. The posted ten name ten different vendors, so the supplier
   outstanding report opens on a supplier for every one of them. */
function seedPurchases(accounting){
 let state=accounting,orders=[],receipts=[],bills=[],debitNotes=[];
 const billInputs=[];
 for(const [index,[vendor,date,expected,item,qty,rate,description]] of purchaseRows.entries()){
  const supplier=vendorSeeds[vendor],unit=itemOf(item).unit;
  const line={id:`demo-po-line-${index+1}`,itemId:item,description,qty,unit,rate,discount:'0',taxRate:'18',cessRate:'0',priceTaxMode:'exclusive',purchaseAccount:'5000'};
  const base={...scope,vendorId:supplier.id,vendorName:supplier.name,vendorGstin:supplier.gstin,date,dueDate:expected,paymentTerms:supplier.paymentTerms,placeOfSupply:supplier.branchName==='Bengaluru'||supplier.branchName==='Mumbai'||supplier.branchName==='Hyderabad'?'Karnataka':'Kerala',lines:[line],payableAccount:'2000'};
  const saved=savePurchaseOrder(orders,{...base,number:`PO-${String(index+1).padStart(5,'0')}`,expectedDate:expected,reference:`DEMO-PO-${String(index+1).padStart(3,'0')}`},purchaseOrderStatus[index]);
  orders=saved.rows;
  if(purchaseOrderStatus[index]!=='Sent To Vendor')continue;
  const goods=createGoodsReceipt(orders,receipts,{orderId:saved.order.id,date:expected,reference:`DELIVERY-1${String(index+1).padStart(3,'0')}`,notes:'Demo goods receipt',lines:[{orderLineId:line.id,receivedQty:Number(qty)}]});
  orders=goods.orders;receipts=goods.receipts;
  const received=goods.order;
  const billLines=received.lines.map(source=>({...source,orderLineId:source.id,qty:String(source.receivedQty),maxQty:Number(source.receivedQty)}));
  const bill=savePurchaseBill(bills,{...base,number:`BILL-${String(index+1).padStart(5,'0')}`,vendorInvoice:`VINV/2026/${180+index}`,referenceOrder:received.number,sourceOrderId:received.id,lines:billLines},'Draft').bill;
  bills=[bill,...bills];
  billInputs.push({index,bill});
 }
 for(const entry of billInputs.slice(0,10)){
  const posted=postPurchaseBill(state,entry.bill,{periodOptions:purchasePeriod});
  state=posted.state;bills=bills.map(row=>row.id===posted.bill.id?posted.bill:row);
  const payment=recordPurchasePayment(state,posted.bill,{amount:portion(posted.bill.total,40),date:'2026-09-24',bankAccount:'1010',reference:`NEFT-DEMO-3${String(entry.index+1).padStart(2,'0')}`,periodOptions:purchasePeriod});
  state=payment.state;bills=bills.map(row=>row.id===payment.bill.id?payment.bill:row);
 }
 for(const entry of billInputs.slice(0,10)){
  const bill=state.purchaseBills.find(row=>row.id===entry.bill.id);
  const [vendor,date,expected,item,qty,rate]=purchaseRows[entry.index];
  const line={id:`demo-dn-line-${entry.index+1}`,itemId:item,description:'Short supply returned to vendor',qty:String(Math.max(1,Math.round(Number(qty)*0.1))),unit:itemOf(item).unit,rate,discount:'0',taxRate:'18',cessRate:'0',priceTaxMode:'exclusive',purchaseAccount:'5000'};
  const saved=saveDebitNote(debitNotes,bills,{number:`DN-2026-${String(entry.index+1).padStart(4,'0')}`,date:'2026-09-25',billId:bill.id,vendorId:bill.vendorId,vendorName:bill.vendorName,placeOfSupply:bill.placeOfSupply,reason:'Short supply received on delivery',lines:[line],payableAccount:'2000'},'Draft');
  const submitted=submitDebitNote(saved.rows,saved.note);
  const approved=approveDebitNote(submitted.rows,submitted.note,{role:'Admin'});
  const issued=issueDebitNote(state,approved.note,{role:'Admin',periodOptions:purchasePeriod});
  state=issued.state;
  debitNotes=[issued.note,...debitNotes];
 }
 /* The register keeps every bill, drafts included, while the ledger keeps the posted ones the purchase service wrote. */
 const registerBills=bills.map(row=>state.purchaseBills.find(updated=>updated.id===row.id)||row);
 return {accounting:state,orders,bills:registerBills,receipts,debitNotes};
}

/* ----------------------------------------------------------- credit notes ---- */

/* invoice number, date, reason, percentage of the invoice credited */
const creditRows=[
 ['INV-00001','2026-09-18','Pricing Correction',5],
 ['INV-00003','2026-09-19','Wrong Billing',4],
 ['INV-00004','2026-09-20','Discount Adjustment',6],
 ['INV-00005','2026-09-21','Pricing Correction',5],
 ['INV-00006','2026-09-22','Service Cancellation',8],
 ['INV-00007','2026-09-23','Discount Adjustment',4],
 ['INV-00008','2026-09-24','Wrong Billing',5],
 ['INV-00009','2026-09-25','Pricing Correction',5],
 ['INV-00010','2026-09-26','Service Cancellation',6],
 ['INV-00012','2026-09-27','Discount Adjustment',5]
];
const creditStages=['draft','draft','submit','submit','approve','approve','issue','issue','issue','issue'];

/* Ten credit notes covering every stage of the approval flow; one issued note is partly
   applied to its invoice so the application workflow also carries demo data. */
function seedCreditNotes(accounting){
 let state=accounting;
 for(const [order,[number,date,reason,perCent]] of creditRows.entries()){
  const target=state.invoices.find(row=>row.number===number);
  if(!target)continue;
  const payload={...scope,date,type:'Against Invoice',reason,originalInvoiceId:target.id,customerId:target.customerId,place:target.place,creditMethod:'Amount Based Credit',adjustmentAmount:portion(target.totals.total,perCent)};
  let out=creditCommand(state,'save',payload);state=out.state;
  const stage=creditStages[order];
  if(stage==='draft')continue;
  out=creditCommand(state,'submit',{id:out.result.id});state=out.state;
  if(stage==='submit')continue;
  out=creditCommand(state,'approve',{id:out.result.id});state=out.state;
  if(stage==='approve')continue;
  out=creditCommand(state,'issue',{id:out.result.id});state=out.state;
 }
 const note=state.creditNotes.find(row=>row.number===`CN-${String(creditRows.length).padStart(4,'0')}`);
 if(note?.posted){
  const target=state.invoices.find(row=>row.id===note.originalInvoiceId),open=target?outstanding(state,target):0;
  const amount=portion(Math.min(open,note.totals.total),50);
  if(amount&&Number(amount)>0)state=creditCommand(state,'apply',{id:note.id,date:'2026-09-28',token:'demo-credit-application',allocations:[{invoiceId:target.id,amount}]}).state;
 }
 return state;
}

/* ------------------------------------------------------ inventory ledger ---- */

/* item index, date, reason, type, quantity delta, value delta, stage */
const adjustmentRows=[
 [0,'2026-09-03','Physical Stock Count','Quantity Adjustment','-4','','Draft'],
 [2,'2026-09-04','Damaged Stock','Quantity Adjustment','-12','','Draft'],
 [3,'2026-09-05','Physical Stock Count','Quantity Adjustment','2','','Draft'],
 [4,'2026-09-06','Theft / Shrinkage','Quantity Adjustment','-1','','submit'],
 [5,'2026-09-07','Physical Stock Count','Quantity Adjustment','6','','submit'],
 [10,'2026-09-08','Expired Stock','Quantity Adjustment','-1','','submit'],
 [11,'2026-09-09','Physical Stock Count','Quantity Adjustment','3','','Draft'],
 [0,'2026-09-10','Lost Stock','Quantity Adjustment','-2','','cancel'],
 [2,'2026-09-11','Opening Stock Correction','Quantity Adjustment','5','','Draft'],
 [4,'2026-09-12','Revaluation','Value Adjustment','','-2500','Draft']
];

/* Ten stock adjustments across every stage a draft can be in, written through the
   inventory command so the impact figures and the audit trail are the engine's. */
function seedInventory(accounting){
 let state=accounting;
 for(const [order,[index,date,reason,type,quantityDelta,valueDelta,stage]] of adjustmentRows.entries()){
  const item=itemSeeds[index];
  const line={id:`demo-adjustment-line-${order+1}`,itemId:item.id,locationId:'abc-kochi',qtyDelta:quantityDelta,newQty:'',valueDelta,newValue:''};
  const payload={number:`ADJ-2026-${String(order+1).padStart(4,'0')}`,date,type,entryMode:'Adjust By',companyId:'ABC01',companyName:'Wayvida Learning',branchId:'abc-kochi',branchName:'Kochi',account:'5100',reason,notes:'Seeded demo adjustment',lines:[line],reversalOf:''};
  const context={actor:'Demo Admin',role:'Admin',items:itemSeeds,settings:{},periodRole:'Admin'};
  let out=adjustmentCommand(state,'save',payload,context);
  state=out.state;
  if(stage==='submit')state=adjustmentCommand(state,'submit',{id:out.result.id},context).state;
  else if(stage==='cancel')state=adjustmentCommand(state,'cancel',{id:out.result.id,reason:'Counted twice, the first sheet was withdrawn.'},context).state;
 }
 return state;
}

/* ------------------------------------------------------- manual journals ---- */

/* Every status and every transaction type is present in the journal register, and the
   reversal keeps its own reversal record beside it. */
function seedJournals(accounting){
 const records=sampleJournalRecords({accounts:accounting.accounts,organization:'Wayvida Learning',branch:'Kochi'});
 let state=accounting;
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
 return {accounting:state,records};
}

/* -------------------------------------------------------------- budgets ---- */

/* The scope every seeded budget carries: the demo organisation, all of its branches. A stored
   scope holds the organisation code the scope control writes, so the register resolves it for
   the working context instead of matching nothing. */
const DEMO_SCOPE={type:'Entire Organisation',name:'All branches',organisationId:'ABC01',organisationName:'Wayvida Learning',branchId:'',branchName:'All branches',companyIds:['ABC01'],branchIds:[]};

/* name, period, status, income or expense, account code, annual amount in paise */
const budgetRows=[
 ['Operating Expenses FY27','Yearly','Active','Expenses','5300',30000000],
 ['Marketing FY27','Quarterly','Active','Expenses','5600',15000000],
 ['Travel FY27','Yearly','Approved','Expenses','5400',2500000],
 ['Professional Fees FY27','Yearly','Active','Expenses','5600',18000000],
 ['Utilities FY27','Monthly','Active','Expenses','5300',12000000],
 ['Sales Revenue FY27','Yearly','Active','Income','4000',90000000],
 ['Service Income FY27','Half-Yearly','Pending Approval','Income','4100',45000000],
 ['Infrastructure FY27','Quarterly','Draft','Expenses','5900',22000000],
 ['Bank Charges FY27','Yearly','Completed','Expenses','5700',600000],
 ['Depreciation FY27','Yearly','Archived','Expenses','5800',9500000]
];

/* Ten budgets covering every status, written through the budget store so each carries the
   allocation shape and revision history the workspace expects. */
function seedBudgets(){
 let state=emptyBudgetState();
 for(const [name,period,status,type,code,amount] of budgetRows){
  const account=accounts.find(row=>row.code===code);
  state=createBudget(state,{name,financialYear:'FY 2026-27',period,status,type:'Profit & Loss Budget',description:`Seeded demo budget for ${account.name}.`,scope:DEMO_SCOPE,template:'Custom Budget',accounts:[{code:account.code,name:account.name,type:account.type}],allocations:{[code]:{p1:amount}}});
 }
 return state;
}

/* Stores the seed wrote in an earlier demo version; an upgrade replaces exactly these. */
const LEGACY_KEYS=['wayvida-customers','finance-erp-items','wayvida-vendors-v1','wayvida-operations-v1',SALES_ORDERS_KEY,PURCHASE_ORDER_KEY,PURCHASE_BILL_KEY,GOODS_RECEIPT_KEY,VENDOR_PAYMENT_KEY,DEBIT_NOTE_KEY,MANUAL_JOURNAL_KEY,BANKING_KEY,KEY];

export function bootstrapDemoData(storage=globalThis.localStorage){
 if(!storage)return {loaded:false};
 const version=Number(storage.getItem(DEMO_MARKER)||0);
 if(version>=DEMO_VERSION)return {loaded:false};
 /* A fresh install never overwrites a store that already holds records, so a workspace keeps
    its own data. An upgrade re-seeds the demo's own stores, which is how an existing demo
    profile receives the larger dataset. */
 const reseeding=version>0;
 const owned=new Set(reads(storage,DEMO_OWNED_KEY,[])||[]);
 const claimed=new Set();
 const seed=(key,value)=>{const current=reads(storage,key,null);const mine=owned.has(key)||(reseeding&&LEGACY_KEYS.includes(key));if(!hasRows(current)||mine){storage.setItem(key,JSON.stringify(value));claimed.add(key)}};
 /* The accounting period a posting resolves through is chosen by the working context, so the
    demo states its own company and branch before any journal is written. Without them a fresh
    install has no period to post against, so the seeded registers arrive empty. */
 if(!storage.getItem('wayvida-demo-company'))storage.setItem('wayvida-demo-company','abc');
 if(!storage.getItem('wayvida-demo-branch'))storage.setItem('wayvida-demo-branch','abc-kochi');
 seed('wayvida-customers',customerSeeds);
 seed('finance-erp-items',itemSeeds);
 seed(VENDOR_KEY,vendorSeeds);
 seed(OPERATIONS_KEY,seedOperations());
 seed(SALES_ORDERS_KEY,seedSalesOrders());
 seed(BUDGET_STORAGE,seedBudgets());
 /* The ledger is the demo's own record: the other stores read their balances from it, so it is
    regenerated whenever the dataset is rebuilt and kept as it stands when it is not. */
 const stored=reads(storage,KEY,null);
 const rebuild=reseeding||!stored?.invoices?.length||!stored?.journals?.length;
 let accounting=rebuild?{...initial(),accounts,config:demoConfig}:stored;
 let purchases={accounting,orders:[],receipts:[],debitNotes:[]};
 if(rebuild){
  accounting=seedSales(accounting);
  purchases=seedPurchases(accounting);
  accounting=purchases.accounting;
  accounting=seedCreditNotes(accounting);
  accounting=seedInventory(accounting);
 }
 const journals=seedJournals(accounting);
 accounting=journals.accounting;
 seed(MANUAL_JOURNAL_KEY,journals.records);
 seed(PURCHASE_ORDER_KEY,purchases.orders);
 seed(GOODS_RECEIPT_KEY,purchases.receipts);
 seed(PURCHASE_BILL_KEY,purchases.bills);
 seed(VENDOR_PAYMENT_KEY,accounting.vendorPayments||[]);
 seed(DEBIT_NOTE_KEY,purchases.debitNotes);
 const banking=createBankingDemo(reads(storage,BANKING_KEY,initialBanking()),accounting);
 accounting=banking.accounting;
 seed(BANKING_KEY,banking.banking);
 storage.setItem(KEY,JSON.stringify(accounting));
 claimed.add(KEY);
 storage.setItem(DEMO_OWNED_KEY,JSON.stringify([...new Set([...owned,...claimed])]));
 storage.setItem(DEMO_MARKER,String(DEMO_VERSION));
 return {loaded:true};
}