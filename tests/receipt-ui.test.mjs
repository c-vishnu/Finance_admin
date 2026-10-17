import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initial,KEY} from '../src/invoice-engine.js';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
const output=await build({entryPoints:['src/Receipts.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const mod={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(require,mod,mod.exports);
const impactOutput=await build({entryPoints:['src/ReceiptImpact.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',logLevel:'silent'});
const impact={exports:{}};new Function('require','module','exports',impactOutput.outputFiles[0].text)(require,impact,impact.exports);
test('ledger impact renders all three views with distinct source identifiers',()=>{
 const db=initial();db.accounts=[{code:'1010',name:'HDFC Bank',active:true,type:'Assets'},{code:'1100',name:'Receivables',active:true,type:'Assets'}];
 const receipt={id:'r',number:'RCPT-00001',customerId:'c',date:'2026-09-04',bank:'1010',arAccount:'1100',amount:10000,status:'Posted',posted:true,journalId:'j',kind:'Normal',reference:'UTR-1'};
 db.receipts=[receipt];db.journals=[{id:'j',number:'JE-00001',receiptId:'r',customerId:'c',date:receipt.date,createdAt:'2026-09-04',status:'Posted',source:'Customer Receipt',reference:receipt.number,lines:[{account:'1010',debit:10000,credit:0},{account:'1100',debit:0,credit:10000}]}];
 for(const initialTab of ['Customer Ledger','Bank/Cash Ledger','Journal Entry View']){
  const html=renderToString(React.createElement(impact.exports.default,{db,receipt,initialTab,onNavigate(){}}));
  for(const label of ['Customer Ledger','Bank/Cash Ledger','Journal Entry View','RCPT-00001','JE-00001','Open General Ledger'])assert.ok(html.includes(label),initialTab+': '+label);
  if(initialTab!=='Journal Entry View')for(const label of ['Transaction Type','Voucher Number','Source Document','Reference','UTR-1'])assert.ok(html.includes(label));
 }
});
test('receipt register renders existing payment history and independent creation action',()=>{const s=initial();s.accounts=[{code:'1010',name:'Bank',type:'Assets',active:true}];s.invoices=[{id:'i',customerName:'Customer'}];s.payments=[{id:'p',number:'PAY-OLD',invoiceId:'i',date:'2026-09-04',amount:10000,bank:'1010'}];globalThis.localStorage={getItem:k=>k===KEY?JSON.stringify(s):null};globalThis.sessionStorage={getItem:()=>null};const html=renderToString(React.createElement(mod.exports.default,{seed:{},onNavigate(){},notify(){}}));/* the register prints the receipt, its date and the invoice it settles in one cell, so the columns are the seven the register asks for rather than a separate Allocation column */
 for(const label of ['Payment Receipts','New receipt','PAY-OLD','Bank matching','<th>Receipt</th><th>Date</th>','Mode &amp; amount'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('Receipt role'),'the local-simulation receipt role panel is hidden: permissions stay the prototype default');delete globalThis.localStorage;delete globalThis.sessionStorage;});
test('receipt workspace defaults to the signed-in prototype administrator role',()=>{const source=readFileSync('src/Receipts.jsx','utf8');assert.ok(source.includes("[role,setRole]=useState('Admin')"));assert.ok(source.includes("r.status==='Approved'"));assert.ok(source.includes("disabled={!can('post')}"));});
test('receipt more actions open as the canonical portalled menu instead of pushing the page',()=>{
 const page=readFileSync('src/Receipts.jsx','utf8'),css=readFileSync('src/receipts.css','utf8');
 assert.ok(page.includes("import {createPortal} from 'react-dom';"),'the menu is portalled, as the invoice, sales order and credit note registers are');
 assert.ok(page.includes("className=\"soMoreButton\"")&&page.includes("className=\"soActionMenu\" role=\"menu\""),'with the canonical trigger and panel classes');
 assert.ok(page.includes('window.document.body)}</>'),'rendered on the body, so it cannot displace the detail header or the tabs');
 assert.ok(!page.includes('receiptMore'),'and the old in-flow details menu is gone');
 assert.ok(!css.includes('.receiptWorkspace .receiptMore>div{position:static'),'so the rules that forced it into normal flow are gone too');
});

test('the receipt detail page is the shared document shell, not the old inline heading',()=>{
 const s=initial();s.accounts=[{code:'1010',name:'HDFC Bank',active:true,type:'Assets'},{code:'1100',name:'Receivables',active:true,type:'Assets'}];
 const receipt={id:'r',number:'RCPT-00001',customerId:'c',customerName:'ABC Retail Pvt Ltd',date:'2026-09-04',bank:'1010',arAccount:'1100',amount:118000,status:'Approved',posted:false,kind:'Normal',reference:'UTR-1',mode:'Bank Transfer'};
 s.receipts=[receipt];
 globalThis.localStorage={getItem:k=>k===KEY?JSON.stringify(s):null};
 globalThis.sessionStorage={getItem:k=>k==='wayvida-open-receipt'?'r':null,removeItem(){},setItem(){}};
 const html=renderToString(React.createElement(mod.exports.default,{seed:{},onNavigate(){},notify(){}}));
 delete globalThis.localStorage;delete globalThis.sessionStorage;
 for(const label of ['ivDetailHead','ivDetailBack','ivDetailBody','ivDetailSheet','ivDetailIdentityRow','ivDetailStats','itemDetailTabs ivDetailTabs','Receipt details','RCPT-00001','Receipt date','Available to allocate','Received into','Accounting details'])assert.ok(html.includes(label),label);
 const source=readFileSync('src/Receipts.jsx','utf8');
 assert.ok(source.includes("const detailOpen=!!r&&!form&&!bankView;"),'the shell opens only with a record and no other page active');
 assert.ok(!source.includes('{header(r.number,r.customerName,'),'the old inline heading is gone from the detail branch');
 assert.ok(!source.includes('receiptContext'),'the hand-rolled context strip is replaced by the shared stats row');
});

test('the receipt detail tab rows reuse the Item Details row on both levels',()=>{
 const page=readFileSync('src/Receipts.jsx','utf8'),impact=readFileSync('src/ReceiptImpact.jsx','utf8'),css=readFileSync('src/receipts.css','utf8');
 assert.ok(page.includes('<nav className="itemDetailTabs ivDetailTabs" aria-label="Receipt sections">'),'the detail row is the shared Item Details row');
 assert.ok(impact.includes('className="itemDetailTabs ivDetailTabs receiptLedgerTabs"'),'and the ledger sub-tabs use the same row');
 assert.ok(!page.includes('className="ivTabs receiptNoPrint"'),'the legacy pill row is gone');
 assert.ok(css.includes('.receiptWorkspace .ivDetailSheet>.receiptTabsRow{'),'the row owns the divider so the accounting toggle sits inside it');
 assert.ok(css.includes('.receiptWorkspace.ivDetailOpen .ivDetailSheet>.receiptDetailBody{padding:18px;min-width:0}'),'every tab body takes the sheet gutter');
 assert.ok(!css.includes('.receiptContext')&&!css.includes('.receiptWorkspace .ivSummary'),'the dead rules for the removed blocks are deleted');
});

test('the receipt register is the merged one register row',()=>{
 const source=readFileSync('src/Receipts.jsx','utf8');
 const css=readFileSync('src/register-head.css','utf8');
 assert.ok(source.includes('<div className="ivHeading receiptNoPrint registerHead"><div className="registerHeadText"><h2>Payment Receipts <span className="registerHeadCount">({rows.length})</span></h2><p>Record, allocate and reconcile customer payments.</p></div><div className="ivTools">'),'the renamed page title and its description lead the shared merged row, which holds the register toolbar - and the heading keeps its print-hiding class');
 assert.ok(source.indexOf('<div className="ivActions"><div className="registerSplit">')>source.indexOf('ivHeading receiptNoPrint registerHead'),'the split action closes the heading row');
 assert.ok(source.includes('<div className="ivCard ivRegisterCard"><div className="ivScroll"><table className="ivInvoiceTable receiptTable">'),'and the register card opens after that row rather than between the title and the toolbar');
 assert.ok(source.includes('<div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick={()=>create()}><IconPlus size={17}/>New receipt</button><details className="registerSplitMore">'),'the add action is the shared split button over the page create');
 assert.ok(source.includes('<button type="button" onClick={menuRun(()=>setBankView(true))}><IconArrowsExchange size={16}/>Bank matching</button><button type="button" onClick={menuRun(()=>setSettings({'),'whose caret holds both of the page own secondary actions');
 assert.ok(source.includes("const menuRun=handler=>event=>{event.currentTarget.closest('details')?.removeAttribute('open');handler()};"),'and the caret closes itself through the shared menuRun helper');
 assert.ok(!source.includes('<div className="ivTools"><label className="ivToolSearch">')||source.indexOf('ivHeading receiptNoPrint registerHead')<source.indexOf('<div className="ivTools"><label className="ivToolSearch">'),'the toolbar is a child of the heading, not a sibling inside the card');
 assert.ok(source.includes('<label>Status<select aria-label="Receipt status"'),'the Status select is the first field of the advanced filter panel');
 assert.ok(!source.includes('</label><select aria-label="Receipt status"'),'and no longer sits on the toolbar row');
 assert.ok(source.includes('const activeReceiptFilters=Object.values(receiptFilters).filter(value=>value&&!value.startsWith(\'All \')).length+(status===\'All\'?0:1);'),'the badge counts the status with the panel fields, and ignores the two empty receipt dates the panel now holds');
 assert.ok(source.includes("onClick={()=>{setReceiptFilters(RECEIPT_FILTER_DEFAULTS);setStatus('All')}}>Clear filters</button>"),'and Clear filters resets it with them');
 assert.ok(source.includes('aria-label="Back to payment receipts"'),'the renamed detail back label follows the page');
 assert.ok(!source.includes('Customer receipts'),'no user-visible Customer receipts string survives the rename');
 assert.match(css,/\.registerHead\.ivHeading \.registerHeadText h2\{margin:0;font-size:24px;font-weight:700/,'the row carries the Journal Entries title size');
 assert.match(css,/\.registerHead details:has\(>summary\[aria-label="Open filters"\]\)\{flex:0 0 auto\}/,'and the funnel cannot be squashed by the toolbar');
});

test('the Invoice column is gone from the receipts register',()=>{
 const source=readFileSync('src/Receipts.jsx','utf8'),css=readFileSync('src/receipts.css','utf8');
 assert.ok(!source.includes("'Invoice',"),'the header list no longer names an Invoice column');
 assert.ok(!source.includes('allocated.length?allocated.map('),'and the row no longer renders the cell that named the settled invoices');
 assert.match(source,/import \{useWorkingScopeVisibility,visibleScopeColumns\} from '\.\/working-scope\.js';/,'the register reads the shared scope helper');
 assert.match(source,/const registerColumns=visibleScopeColumns\(\[/,'the columns are filtered and renormalised from the working scope');
 assert.match(source,/\{key:'number',label:'Receipt',weight:13\.5\},\s*\{key:'date',label:'Date',weight:12\}/,'the receipt and its date are separate columns');
 assert.match(source,/\{key:'organisation',label:'Organisation',weight:11,scope:'organisation'\},\s*\{key:'branch',label:'Branch',weight:8,scope:'branch'\}/,'Organisation and Branch are optional scope columns');
 assert.match(source,/<td><button className="ivLink" onClick=\{\(\)=>open\(x\)\}>\{x\.number\}<\/button><\/td><td>\{x\.date\}<\/td>/,'the receipt number and its date are separate cells');
});
test('every receipt row carries one view icon and the shared row menu, and no cell is cut off',()=>{
 const source=readFileSync('src/Receipts.jsx','utf8');
 const css=readFileSync('src/receipts.css','utf8');
 assert.ok(source.includes('<td><div className="ivRowActions"><button type="button" className="ivIconButton" aria-label={'+"'View '+x.number"+'} title={'+"'View '+x.number"+'} onClick={()=>open(x)}><IconEye size={17}/></button>{actionMenu(x)}</div></td>'),'the row carries the shared eye icon beside the shared row menu, exactly as the invoices and sales orders registers state it');
 assert.ok(!source.includes('>View details</button>'),'and the old text button is gone');
 assert.ok(!source.includes("[IconEye,'View',()=>open(x)]"),'and the menu no longer duplicates it');
 assert.ok(source.includes("[IconEye,'Preview & templates',()=>setPrintDoc(x)]"),'while every other menu entry stays');
 assert.ok(css.includes('.receiptWorkspace .soMoreButton{width:38px;height:38px;border-radius:8px'),'the row menu wears the shared trigger, stated a little larger on this page so the icon reads beside the figures');
 assert.ok(source.includes('<IconDots size={22}/>'),'with the enlarged dots the operator asked for');
 assert.ok(css.includes('.receiptWorkspace .receiptMore>summary{display:inline-grid;place-items:center;width:36px;height:36px;min-height:36px;padding:0;border:1px solid #d0d5dd;border-radius:7px;'),'and the trigger beside it is the same 36px square, so the pair reads as one control');
 assert.ok(css.includes('.receiptWorkspace .receiptMore{display:inline-block;vertical-align:top;margin-left:6px}'),'the menu is inline rather than a flex item, so its open 218px panel is never squeezed to the column width');
 assert.ok(css.includes('.receiptWorkspace table.receiptTable td small{display:block;margin-top:3px;white-space:normal;overflow-wrap:anywhere;'),'every sub-line in the register wraps rather than being cut off, so the payment mode and the customer type are never trimmed');
 assert.equal([...css.matchAll(/table\.receiptTable th:nth-child\(\d\)\{width:\d+%\}/g)].length,0,'the sheet no longer restates positional widths that would disagree with the selected scope');
 assert.match(source,/\{key:'actions',label:'Actions',weight:10\.5,className:'receiptRegisterActions'\}/,'the Actions header carries an alignment class that does not shift with the scope columns');
 assert.ok(css.includes('.receiptWorkspace table.receiptTable td.receiptRegisterActions{white-space:nowrap;text-align:right;overflow:visible}'),'the actions cell stays right-aligned and releases the row menu');
 assert.ok(css.includes('.receiptWorkspace table.receiptTable td.scopeCell{white-space:normal;overflow-wrap:anywhere}'),'scope names wrap inside their narrow conditional columns');
});

/* The Create Receipt page spreads an entered amount over the payer's outstanding invoices itself, in the
   FIFO order `src/income-allocation.js` defines, so the table always shows where the money goes. That
   suggestion is `receiptFifoSplit`, exported beside the page and pure over (book, customerId, amount,
   kind), so it is tested here as a function rather than through a browser: the amounts below are the
   spec's own example, and every expectation is a rupee string in the form the page stores. */
const fifoBook=invoices=>({invoices,payments:[],receiptAllocations:[],creditApplications:[]});
const fifoInvoice=(id,number,dueDate,total,extra={})=>({id,number,customerId:'c',customerName:'Customer',date:extra.date||dueDate,dueDate,posted:true,status:'Recorded',totals:{total},...extra});
const suggestion=(invoices,amount,kind='Normal',customerId='c')=>mod.exports.receiptFifoSplit(fifoBook(invoices),customerId,amount,kind);
const threeOwed=()=>[fifoInvoice('inv-2','INV-00002','2026-03-31',1000000,{date:'2026-03-01'}),fifoInvoice('inv-1','INV-00001','2026-02-28',500000,{date:'2026-02-01'}),fifoInvoice('inv-3','INV-00003','2026-04-30',800000,{date:'2026-04-01'})];

test('an entered amount is spread over the payer oldest debt first, and a newer invoice receives nothing',()=>{
 assert.deepEqual(suggestion(threeOwed(),'13000'),[{invoiceId:'inv-1',amount:'5000.00'},{invoiceId:'inv-2',amount:'8000.00'}],'Rs 13,000 clears INV-00001 and part of INV-00002; INV-00003 is offered nothing');
 assert.deepEqual(suggestion(threeOwed(),'1500'),[{invoiceId:'inv-1',amount:'1500.00'}],'an amount smaller than the first debt is offered to that invoice alone');
});

test('the FIFO order is the due date, then the invoice date, then the invoice id, and a missing due date reads as the invoice date',()=>{
 const shuffled=[fifoInvoice('c','INV-C','2026-05-01',100000),fifoInvoice('a','INV-A',undefined,100000,{date:'2026-01-05'}),fifoInvoice('b','INV-B','2026-01-05',100000,{date:'2025-12-01'})];
 assert.deepEqual(suggestion(shuffled,'3000').map(row=>row.invoiceId),['b','a','c'],'the invoice with no due date is due on its own date, and ties break on the id');
});

test('an amount larger than the book never overpays an invoice: every debt is cleared and the remainder is not invented as a row',()=>{
 const rows=suggestion(threeOwed(),'25000');
 assert.deepEqual(rows,[{invoiceId:'inv-1',amount:'5000.00'},{invoiceId:'inv-2',amount:'10000.00'},{invoiceId:'inv-3',amount:'8000.00'}],'each invoice is given exactly what it is owed');
 assert.deepEqual(suggestion(threeOwed(),'23000').map(row=>row.amount),rows.map(row=>row.amount),'an amount equal to the book settles it the same way');
 assert.deepEqual(suggestion(threeOwed(),'0'),[],'and no money offers nothing against anything');
});

test('a half-typed or negative amount leaves the split the operator is looking at alone; no payer or an advance settles nothing',()=>{
 for(const broken of ['1.','-5','1.234','abc'])assert.equal(suggestion(threeOwed(),broken),null,`${broken} is a form waiting to be filled, not a licence to wipe the allocations`);
 assert.deepEqual(suggestion(threeOwed(),null),[],'and no amount at all allocates nothing');
 assert.deepEqual(suggestion(threeOwed(),''),[],'an empty amount allocates nothing');
 assert.deepEqual(suggestion(threeOwed(),'13000','Advance'),[],'a customer advance settles no invoice');
 assert.deepEqual(suggestion(threeOwed(),'13000','Normal',''),[],'and money with no payer has no invoice to settle');
});

test('only the payer own open, posted, unblocked invoices are offered to the split',()=>{
 const invoices=[fifoInvoice('mine','INV-00001','2026-02-28',500000),fifoInvoice('later','INV-00002','2026-03-31',200000),fifoInvoice('theirs','INV-00003','2026-02-28',900000,{customerId:'other'}),fifoInvoice('cancelled','INV-00004','2026-02-28',700000,{status:'Cancelled'}),fifoInvoice('voided','INV-00005','2026-02-28',600000,{voided:true}),fifoInvoice('blocked','INV-00006','2026-02-28',400000,{blockedFromPayment:true}),fifoInvoice('draft','INV-00007','2026-02-28',300000,{posted:false})];
 assert.deepEqual(suggestion(invoices,'90000'),[{invoiceId:'mine',amount:'5000.00'},{invoiceId:'later',amount:'2000.00'}],'the payer own two open debts are offered and nothing else is reachable, however much money arrives');
 const paid=fifoBook(invoices);paid.payments=[{id:'p',invoiceId:'mine',amount:500000,reversed:false}];
 assert.deepEqual(mod.exports.receiptFifoSplit(paid,'c','13000','Normal').map(row=>row.invoiceId),['later'],'an invoice already settled by a payment is not offered again');
});

test('the create page drives the split from the payer and the amount it is showing',()=>{
 const page=readFileSync('src/Receipts.jsx','utf8');
 assert.ok(page.includes("import {fifoAllocation,outstandingInvoices,rupeeString} from './income-allocation.js';"),'the arithmetic is imported, never copied into the page');
 assert.ok(page.includes('const openInvoices=id=>outstandingInvoices(db,{customerId:id});'),'the table a receipt is allocated against is the allocation module own eligibility list, in its own FIFO order');
 assert.ok(page.includes("{field('amount','Amount received ₹','number',setAmount)}"),'the amount control is the one that re-runs the split');
 assert.ok(page.includes('allocations:receiptFifoSplit(db,current.customerId,value,current.kind)??current.allocations'),'and an amount that is not a number yet keeps the allocation the operator already has');
 assert.ok(page.includes("function chooseCustomer(id){const customerId=id||'';setForm({...form,customerId,allocations:receiptFifoSplit(db,customerId,form.amount,form.kind)||[]})"),'choosing a payer re-runs the suggestion against that payer invoices and clears someone else split');
 assert.ok(page.includes('<td>{money(i.outstanding)}</td>')&&page.includes('<td>{money(i.total)}</td>'),'the table prints the balance the allocation module resolved rather than an invoice cached total');
 assert.ok(page.includes('Unpaid invoices <small>Optional · leave blank to allocate later</small>'),'the section and its hint are unchanged');
});
