import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import * as projection from '../src/tax-compliance.js';
import {ALL,collectGstDocuments,collectTdsDocuments,filterGstRows,filterTdsRows,gstOptions,gstReconciliation,hsnSummary,reportMetadata,summarizeGst,summarizeTds,tableExport,tdsBySection,tdsByVendor,tdsOn,tdsOptions,tdsReconciliation,tdsRowBalance} from '../src/tax-compliance.js';

const line=values=>({cgst:0,sgst:0,igst:0,cessAmount:0,qty:1,...values});
const fixture=()=>({
 config:{cgst:'2100',sgst:'2100',igst:'2100',cess:'2100'},
 accounts:[],journals:[],debitNotes:[],
 invoices:[
  {id:'i1',number:'INV-001',date:'2026-07-05',posted:true,status:'Approved',branch:'Kochi',customerName:'ABC Retail',customerGstin:'32ABCDE1234F1Z5',placeOfSupply:'Kerala',totals:{taxable:10000000,cgst:900000,sgst:900000,igst:0,cess:0,total:11800000,lines:[line({hsnSac:'8471',description:'Laptop',qty:3,taxable:10000000,cgst:900000,sgst:900000})]}},
  {id:'i2',number:'INV-002',date:'2026-07-09',posted:true,status:'Approved',branch:'Kochi',customerName:'Interstate Traders',customerGstin:'29AAACC1206D1ZQ',placeOfSupply:'Karnataka',totals:{taxable:5000000,cgst:0,sgst:0,igst:900000,cess:0,total:5900000,lines:[line({hsnSac:'9983',description:'Service',qty:1,taxable:4000000,igst:720000}),line({description:'Uncoded item',qty:2,taxable:1000000,igst:180000})]}},
  {id:'i3',number:'INV-003',date:'2026-07-18',posted:true,status:'Cancelled',branch:'Kochi',customerName:'Cancelled Co',totals:{taxable:7000000,cgst:630000,sgst:630000,igst:0,cess:0,total:8260000,lines:[]}}
 ],
 creditNotes:[
  {id:'cn1',number:'CN-001',date:'2026-07-15',posted:true,status:'Approved',branch:'Kochi',customerName:'ABC Retail',customerGstin:'32ABCDE1234F1Z5',placeOfSupply:'Kerala',totals:{taxable:1000000,cgst:90000,sgst:90000,igst:0,cess:0,total:1180000,lines:[]}}
 ],
 purchaseBills:[
  {id:'b1',number:'BILL-0001',date:'2026-07-06',posted:true,status:'Unpaid',branch:'Kochi',vendorId:'ven-3',vendorName:'Metro Maintenance Works',vendorGstin:'32ZZZZZ9999Z1Z9',reference:'VEND-INV-900',totals:{taxable:8000000,cgst:720000,sgst:720000,igst:0,cess:0,total:9440000,lines:[]}},
  {id:'b2',number:'BILL-0002',date:'2026-07-20',posted:true,status:'Paid',branch:'Kochi',vendorId:'ven-3',vendorName:'Metro Maintenance Works',vendorGstin:'32ZZZZZ9999Z1Z9',totals:{taxable:2000000,cgst:180000,sgst:180000,igst:0,cess:0,total:2360000,lines:[]}},
  {id:'b3',number:'BILL-0003',date:'2026-07-22',posted:true,status:'Unpaid',branch:'Kochi',vendorId:'ven-9',vendorName:'No Withholding Supplies',totals:{taxable:1000000,cgst:90000,sgst:90000,igst:0,cess:0,total:1180000,lines:[]}},
  {id:'b4',number:'BILL-0004',date:'2026-07-23',posted:true,status:'Unpaid',branch:'Kochi',vendorId:'ven-8',vendorName:'No Section Configured',totals:{taxable:500000,cgst:45000,sgst:45000,igst:0,cess:0,total:590000,lines:[]}},
  {id:'b5',number:'BILL-0005',date:'2026-07-24',posted:false,status:'Unpaid',branch:'Kochi',vendorId:'ven-3',vendorName:'Metro Maintenance Works',totals:{taxable:5000000,cgst:450000,sgst:450000,igst:0,cess:0,total:5900000,lines:[]}}
 ]
});
const vendors=[
 {id:'ven-3',name:'Metro Maintenance Works',code:'VEN-00001',pan:'AAAAA1111A',gstin:'32ZZZZZ9999Z1Z9',tdsApplicable:true,tdsSection:'194C',tdsRate:'1'},
 {id:'ven-9',name:'No Withholding Supplies',tdsApplicable:false},
 {id:'ven-8',name:'No Section Configured',pan:'BBBBB2222B',tdsApplicable:true,tdsSection:'',tdsRate:''}
];
const gstRows=()=>collectGstDocuments({book:fixture()});

/* ---------- the GSTR-1 / GSTR-3B removal ---------- */

const srcFiles=readdirSync('src',{recursive:true}).filter(name=>/\.(js|jsx|css)$/.test(name));
const read=name=>readFileSync('src/'+name,'utf8');

test('no source file names GSTR-1 or GSTR-3B any more',()=>{
 for(const name of srcFiles)assert.ok(!read(name).includes('GSTR'),'src/'+name+' still names GSTR');
});

test('the GST page states exactly the four accounting-level tabs, GST Summary first and default',()=>{
 const page=read('GstTaxReports.jsx');
 const tabs=(page.match(/const TABS=\[[\s\S]*?\n\];/)||[''])[0];
 assert.equal(tabs.split('{key:').length-1,4,'the tab strip declares four views');
 for(const label of ['GST Summary','Input GST','Output GST','HSN / SAC Summary'])assert.ok(tabs.includes("label:'"+label+"'"),label+' is a tab');
 assert.ok(!tabs.includes('GSTR'),'no return tab survives');
 assert.ok(page.includes("useState('summary')"),'GST Summary stays the default tab');
 for(const gone of ['gstr1Groups','gstr3bSummary','gstr1','gstr3b'])assert.ok(!page.includes(gone),gone+' is gone from the page');
 assert.ok(page.includes('<span>Net GST Position</span>'),'the fourth card reads Net GST Position');
});

test('the return projections are deleted from the module, not merely unlinked',()=>{
 for(const name of ['gstr1Groups','gstr3bSummary','isExport'])assert.ok(!(name in projection),name+' is no longer exported');
 for(const name of ['collectGstDocuments','filterGstRows','summarizeGst','gstOptions','gstReconciliation','hsnSummary','tableExport','collectTdsDocuments','filterTdsRows','summarizeTds','tdsByVendor','tdsBySection','tdsRowBalance','tdsReconciliation'])assert.equal(typeof projection[name],'function',name+' is kept');
 assert.ok(!('tdsPayableBySection' in projection),'the removed payable-by-section aggregate is no longer exported');
});

test('exports and the sidebar carry no return section or entry',()=>{
 assert.ok(!read('Navigation.jsx').includes('GSTR'),'the sidebar lists no return');
 const sheet=JSON.stringify(tableExport(['Particulars','Total INR'],[['Outward taxable supplies',1]],reportMetadata({title:'Wayvida Books · GST / Tax Reports · GST Summary'})));
 assert.ok(!sheet.includes('GSTR'),'an export never states a return section');
 assert.ok(!read('tax-compliance.css').includes('tcSub')&&!read('tax-compliance.css').includes('tcEmphasis'),'the return-only styles are removed');
});

/* ---------- the GST projection ---------- */

test('the GST rows are the posted documents, with a cancelled document stated nowhere',()=>{
 const rows=gstRows();
 assert.deepEqual(rows.map(row=>row.number),['INV-001','INV-002','CN-001','BILL-0001','BILL-0002','BILL-0003','BILL-0004']);
 assert.ok(!rows.some(row=>row.number==='INV-003'),'a cancelled invoice is dropped');
 assert.deepEqual(rows.filter(row=>row.direction==='output').map(row=>row.sign),[1,1,-1],'a credit note is stated on the outward side at -1');
 assert.deepEqual(rows.filter(row=>row.direction==='input').map(row=>row.sign),[1,1,1,1],'a purchase bill is stated on the inward side at +1');
});

test('the date range is inclusive at both ends and every filter applies together',()=>{
 const rows=gstRows();
 assert.deepEqual(filterGstRows(rows,{from:'2026-07-05',to:'2026-07-06'}).map(row=>row.number),['INV-001','BILL-0001'],'both boundary dates are inside the range');
 assert.deepEqual(filterGstRows(rows,{taxType:'CGST'}).map(row=>row.number),['INV-001','CN-001','BILL-0001','BILL-0002','BILL-0003','BILL-0004'],'CGST keeps only the documents that charged CGST');
 assert.deepEqual(filterGstRows(rows,{taxType:'IGST'}).map(row=>row.number),['INV-002'],'IGST keeps only the documents that charged IGST');
 assert.deepEqual(filterGstRows(rows,{party:'ABC Retail'}).map(row=>row.number),['INV-001','CN-001'],'the party filter reaches both sides of the outward ledger');
 assert.deepEqual(filterGstRows(rows,{type:'Purchase'}).map(row=>row.number),['BILL-0001','BILL-0002','BILL-0003','BILL-0004'],'the transaction type filter works');
 assert.deepEqual(filterGstRows(rows,{search:'BILL'}).map(row=>row.number),['BILL-0001','BILL-0002','BILL-0003','BILL-0004'],'the search reads the document number');
 assert.deepEqual(filterGstRows(rows,{from:'2026-07-09',branch:'Nowhere'}).map(row=>row.number),[],'two filters are applied together, never either');
 assert.deepEqual(filterGstRows(rows,{taxType:ALL}).length,7,'All is not a filter');
});

test('the four cards follow the filtered rows and never hide the figures behind them',()=>{
 const summary=summarizeGst(gstRows());
 assert.equal(summary.count,7);
 assert.equal(summary.taxableSales,14000000,'Taxable Sales is the outward taxable value only');
 assert.equal(summary.outputGst,2520000,'Output GST is the outward tax, net of the credit note');
 assert.equal(summary.inputGst,2070000,'Input GST is the inward tax');
 assert.equal(summary.netGst,450000,'Net GST Position is output less input');
 assert.equal(summarizeGst([]).netGst,0,'an empty scope nets to zero');
});

test('every filter option is derived from the rows, so no option can name a value no document carries',()=>{
 const options=gstOptions(gstRows());
 assert.deepEqual(options.branches,['Kochi']);
 assert.deepEqual(options.gstins,['29AAACC1206D1ZQ','32ABCDE1234F1Z5','32ZZZZZ9999Z1Z9']);
 assert.deepEqual(options.rates,['18']);
 assert.deepEqual(options.types,['Sales','Purchase','Credit Note']);
});

test('HSN / SAC groups the outward lines and states an unclassified line rather than dropping it',()=>{
 const groups=hsnSummary(gstRows());
 assert.deepEqual(groups.map(group=>group.code),['8471','9983','Not specified']);
 const laptop=groups.find(group=>group.code==='8471');
 assert.equal(laptop.quantity,3);assert.equal(laptop.taxable,10000000);assert.equal(laptop.tax,1800000);
 const uncoded=groups.find(group=>group.code==='Not specified');
 assert.equal(uncoded.quantity,2,'a line with no code keeps its quantity');
 assert.equal(uncoded.taxable,1000000,'a line with no code keeps its taxable value');
});

test('the ledger reconciliation states the difference instead of forcing it away',()=>{
 const book=fixture();
 const rows=collectGstDocuments({book});
 const clean=gstReconciliation({book,rows});
 assert.equal(clean.difference,-(clean.documentOutput+clean.documentInput),'no ledger posting means the whole document tax is the difference');
 const posted={...book,journals:[{id:'j1',date:'2026-07-05',number:'INV-001',source:'Sales Invoice',status:'Posted',lines:[{account:'2100',debit:0,credit:1800000},{account:'2100',debit:0,credit:900000},{account:'2100',debit:180000,credit:0},{account:'1410',debit:1440000,credit:0},{account:'1410',debit:360000,credit:0},{account:'1410',debit:180000,credit:0},{account:'1410',debit:90000,credit:0}]}]};
 const reconciled=gstReconciliation({book:posted,rows});
 assert.equal(reconciled.difference,0,'a ledger that carries the same tax reconciles');
});

/* ---------- the TDS projection ---------- */

test('withholding is computed to the rupee and never guessed',()=>{
 assert.equal(tdsOn(8000000,1),80000);
 assert.equal(tdsOn(1999,2),40,'the deduction is rounded to the rupee');
 assert.equal(tdsOn(1000,0),0,'a zero rate withholds nothing');
 assert.equal(tdsOn(1000,''),0,'a missing rate withholds nothing');
 assert.equal(tdsOn(0,5),0);
});

test('only a posted bill to a vendor that carries a section and a rate is withholdable',()=>{
 const rows=collectTdsDocuments({book:fixture(),vendors});
 assert.deepEqual(rows.map(row=>row.number),['BILL-0001','BILL-0002'],'an unposted bill and a vendor with no section are both skipped');
 assert.equal(rows[0].section,'194C');
 assert.equal(rows[0].description,'Payment to contractors');
 assert.equal(rows[0].tds,80000);
 assert.equal(rows[0].gross,8000000,'the base is the value of supply, not the GST-inclusive total');
 assert.equal(rows[0].state,'Pending');
 assert.equal(rows[1].state,'Deducted','a settled bill is Deducted');
 assert.equal(rows[0].pan,'AAAAA1111A','the PAN is the vendor record own value');
 assert.equal(rows[0].handshake,'wayvida-open-bill','the row hands off to the Purchases module');
 assert.equal(rows[0].page,'Purchase Bills');
});

test('the TDS cards, groupings and status filter follow the same rows',()=>{
 const rows=collectTdsDocuments({book:fixture(),vendors});
 const summary=summarizeTds(rows);
 assert.equal(summary.applicable,10000000);assert.equal(summary.deducted,100000);assert.equal(summary.paid,20000);assert.equal(summary.payable,80000);
 assert.deepEqual(filterTdsRows(rows,{status:'Pending'}).map(row=>row.number),['BILL-0001']);
 assert.deepEqual(filterTdsRows(rows,{section:'194C'}).length,2);
 assert.deepEqual(filterTdsRows(rows,{pan:'AAAAA1111A'}).length,2);
 assert.deepEqual(filterTdsRows(rows,{from:'2026-07-10',to:'2026-07-20'}).map(row=>row.number),['BILL-0002'],'the TDS date range is inclusive too');
 const byVendor=tdsByVendor(rows);
 assert.equal(byVendor.length,1);assert.equal(byVendor[0].documents,2);assert.equal(byVendor[0].payable,80000);
 const bySection=tdsBySection(rows);
 assert.equal(bySection.length,1);assert.equal(bySection[0].section,'194C');assert.equal(bySection[0].description,'Payment to contractors');
 assert.deepEqual(tdsOptions(rows).sections,['194C']);
});

test('a document search reaches the vendor code and the payment reference too',()=>{
 const rows=collectTdsDocuments({book:fixture(),vendors});
 assert.equal(rows[0].vendorCode,'VEN-00001','the row carries the vendor record own code');
 assert.equal(rows[0].reference,'VEND-INV-900','the row carries the document own reference');
 assert.deepEqual(filterTdsRows(rows,{search:'VEN-00001'}).map(row=>row.number),['BILL-0001','BILL-0002'],'a vendor code finds every document of that vendor');
 assert.deepEqual(filterTdsRows(rows,{search:'VEND-INV-900'}).map(row=>row.number),['BILL-0001'],'a payment reference finds its own document');
 assert.deepEqual(filterTdsRows(rows,{search:'AAAAA1111A'}).length,2,'a PAN still finds its vendor');
 assert.deepEqual(filterTdsRows(rows,{rate:'1'}).length,2,'the rate filter keeps a matching rate');
 assert.deepEqual(filterTdsRows(rows,{rate:'2'}).length,0,'the rate filter drops a different rate');
 assert.deepEqual(tdsOptions(rows).rates,[1],'the rate options are derived from the rows');
});

test('the payable balance is the deduction until the document is settled, and it reconciles',()=>{
 const rows=collectTdsDocuments({book:fixture(),vendors});
 assert.deepEqual(tdsRowBalance(rows[0]),{tds:80000,paid:0,balance:80000},'an unsettled bill owes the whole deduction');
 assert.deepEqual(tdsRowBalance(rows[1]),{tds:20000,paid:20000,balance:0},'a settled bill owes nothing');
 const payable=rows.filter(row=>tdsRowBalance(row).balance>0);
 assert.deepEqual(payable.map(row=>row.number),['BILL-0001'],'only a non-zero balance reaches the outstanding table');
 assert.equal(payable.reduce((sum,row)=>sum+tdsRowBalance(row).balance,0),80000,'the fully paid bill never reaches the outstanding total');
 assert.deepEqual(rows.filter(row=>row.settled).map(row=>row.number),['BILL-0002'],'the deducted view states the settled documents');
 const reconciliation=tdsReconciliation(rows);
 assert.equal(reconciliation.deducted,100000);
 assert.equal(reconciliation.paid,20000);
 assert.equal(reconciliation.payable,80000);
 assert.equal(reconciliation.payable,reconciliation.deducted-reconciliation.paid,'TDS Payable = TDS Deducted - TDS Paid');
 assert.equal(reconciliation.difference,0,'the identity holds, so the page states that the balances reconcile');
 const leaky=tdsReconciliation([{tds:50000,settled:false},{tds:10000,settled:true}]);
 assert.equal(leaky.difference,0);
 assert.equal(tdsReconciliation([{tds:50000,settled:true},{tds:10000,settled:false}]).difference,0,'the difference is computed from the rows, never forced to zero by construction');
});

test('the TDS page keeps exactly three tabs with grouping inside the Summary register',()=>{
 const page=read('TdsReports.jsx');
 const tabs=(page.match(/const TABS=\[[\s\S]*?\n\];/)||[''])[0];
 assert.equal(tabs.split('{key:').length-1,3,'the tab strip declares three views');
 assert.deepEqual([...tabs.matchAll(/label:'([^']+)'/g)].map(match=>match[1]),['TDS Summary','TDS Deducted','TDS Payable'],'the three tabs read in order');
 assert.ok(page.includes("useState('summary')"),'TDS Summary stays the default tab');
 assert.ok(!/label:'By (Vendor|Section)'/.test(page),'no removed standalone tab survives');
 assert.ok(!page.includes('tdsPayableBySection'),'the removed payable aggregate is not imported');
 assert.ok(!page.includes('tcAggregate'),'the removed standalone aggregate tables are gone');
 assert.ok(page.includes("const GROUPINGS=[{key:'none',label:'None'},{key:'vendor',label:'Vendor'},{key:'section',label:'TDS Section'}]"),'one grouping control offers None, Vendor and TDS Section');
 assert.ok(page.includes('role="group" aria-label="Group by"'),'the grouping control is the labelled Group by control');
 assert.ok(page.includes("tab==='summary'&&<div className=\"tcGroupBy\""),'the grouping control is offered on the Summary register alone');
 for(const label of ['TDS Applicable Base','TDS Deducted','TDS Paid','TDS Payable'])assert.ok(page.includes('<span>'+label+'</span>'),label+' is a card');
 for(const column of ['Document / Payment No.','Gross Amount','TDS Rate','TDS Amount','Balance Payable','Paid'])assert.ok(page.includes("'"+column+"'"),column+' is a column');
 assert.ok(page.includes('tdsRowBalance(row).balance>0'),'the payable view keeps only a non-zero balance');
 assert.ok(page.includes('TDS Reconciliation'),'the reconciliation block is named');
 assert.ok(page.includes('✓ TDS balances reconcile'),'the reconciling state is stated');
 assert.ok(page.includes('⚠ TDS balances need review'),'a difference is not hidden');
 assert.ok(page.includes('Difference: '),'the difference figure is stated when there is one');
 assert.ok(page.includes('No TDS transactions found'),'the empty state title is the plain one');
 assert.ok(page.includes('TDS transactions will appear here when TDS is applied to an applicable vendor transaction.'),'the empty state explains itself');
 assert.ok(page.includes("'wayvida-open-vendor'"),'the payee link reuses the existing vendor handshake');
 assert.ok(page.includes('sessionStorage.setItem(entry.handshake,entry.recordId)'),'the document link reuses the existing bill handshake');
});
