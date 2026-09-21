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
 for(const label of ['Payment Receipts','New receipt','PAY-OLD','Bank matching','local simulation','Receipt &amp; date','Mode &amp; amount'])assert.ok(html.includes(label),label);delete globalThis.localStorage;delete globalThis.sessionStorage;});
test('receipt workspace defaults to the signed-in prototype administrator role',()=>{const source=readFileSync('src/Receipts.jsx','utf8');assert.ok(source.includes("[role,setRole]=useState('Admin')"));assert.ok(source.includes("r.status==='Approved'"));assert.ok(source.includes("disabled={!can('post')}"));});
test('receipt more actions use a vertical, non-scrolling menu',()=>{const css=readFileSync('src/receipts.css','utf8');assert.ok(css.includes('.receiptWorkspace .receiptMore>div{position:static'));assert.ok(css.includes('flex-direction:column'));assert.ok(css.includes('overflow:visible'));assert.ok(css.includes('justify-content:flex-start'))});

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

test('the invoice column names what each receipt settles, and says when it settles nothing',()=>{
 const s=initial();
 s.accounts=[{code:'1010',name:'HDFC Bank',active:true,type:'Assets'},{code:'1100',name:'Receivables',active:true,type:'Assets'}];
 s.invoices=[{id:'i1',number:'INV-00001',customerId:'c1',customerName:'ABC Retail Pvt Ltd',arAccount:'1100'},{id:'i2',number:'INV-00002',customerId:'c1',customerName:'ABC Retail Pvt Ltd',arAccount:'1100'}];
 s.payments=[{id:'p1',number:'PAY-OLD',invoiceId:'i1',date:'2026-09-04',amount:50000,bank:'1010',mode:'Bank Transfer'}];
 s.receipts=[
  {id:'r2',number:'RCPT-00002',customerId:'c1',customerName:'ABC Retail Pvt Ltd',date:'2026-09-06',bank:'1010',arAccount:'1100',advanceAccount:'2100',amount:50000,status:'Posted',posted:true,kind:'Advance',mode:'Bank Transfer'},
  {id:'r3',number:'RCPT-00003',customerId:'c1',customerName:'ABC Retail Pvt Ltd',date:'2026-09-07',bank:'1010',arAccount:'1100',amount:100000,status:'Posted',posted:true,kind:'Normal',mode:'Bank Transfer'}
 ];
 s.receiptAllocations=[{id:'a1',receiptId:'r3',invoiceId:'i1',amount:40000,date:'2026-09-07'},{id:'a2',receiptId:'r3',invoiceId:'i2',amount:60000,date:'2026-09-07'}];
 globalThis.localStorage={getItem:k=>k===KEY?JSON.stringify(s):null};
 globalThis.sessionStorage={getItem:()=>null};
 const html=renderToString(React.createElement(mod.exports.default,{seed:{},onNavigate(){},notify(){}}));
 delete globalThis.localStorage;delete globalThis.sessionStorage;
 const source=readFileSync('src/Receipts.jsx','utf8');
 assert.ok(source.includes("<th key={h}>{h}</th>"),'the header row is still rendered from one label list');
 assert.ok(source.includes("['Receipt & date','Invoice','Branch & organisation','Payment & type','Reference','Customer & type','Mode & amount','Actions']"),'the Invoice column sits second, beside the receipt it settles');
 assert.ok(source.includes("const allocated=receiptAllocations(db,x).filter(a=>!a.voided);"),'the row reads its allocations once');
 assert.ok(source.includes("<td>{allocated.length?allocated.map(a=>db.invoices.find(i=>i.id===a.invoiceId)?.number||'Invoice').join(', '):'Unallocated'}"),'and prints every invoice it settles, or Unallocated when it settles none');
 assert.ok(source.includes('{allocated.length>1&&<small>{allocated.length} invoices</small>}'),'with the count beneath when a receipt settles more than one');
 assert.ok(!source.includes('{receiptAllocations(db,x).filter(a=>!a.voided).length>0&&<small>{receiptAllocations(db,x)'),'and the invoice is no longer stacked inside the receipt cell');
 assert.ok(html.includes('INV-00001'),'the legacy payment names its invoice in the row');
 assert.ok(html.includes('INV-00001, INV-00002'),'a receipt allocated across two invoices names both, in one cell');
 assert.match(html,/2(?:<!-- -->)? invoices/,'and states how many it settles - React splits the number and the word into two text nodes, so the marker is allowed for');
 assert.ok(html.includes('Unallocated'),'while a receipt that has settled nothing says so rather than showing an empty cell');
 const css=readFileSync('src/receipts.css','utf8');
 for(let n=1;n<=8;n++)assert.ok(css.includes('.receiptTable th:nth-child('+n+'){width:'),'column '+n+' declares its width, because the table is fixed-layout');
 assert.ok(!css.includes('.receiptTable th:nth-child(9)'),'and the width set stops at the eight columns the register now carries');
});

test('every receipt row carries one View details action, and no cell is cut off',()=>{
 const source=readFileSync('src/Receipts.jsx','utf8');
 const css=readFileSync('src/receipts.css','utf8');
 assert.ok(source.includes('<td><button type="button" className="receiptViewButton" onClick={()=>open(x)}>View details</button>{actionMenu(x)}</td>'),'the row carries the visible action beside the row menu, opening the receipt detail');
 assert.ok(!source.includes("[IconEye,'View',()=>open(x)]"),'and the menu no longer duplicates it');
 assert.ok(source.includes("[IconEye,'Preview & templates',()=>setPrintDoc(x)]"),'while every other menu entry stays');
 assert.ok(css.includes('.receiptWorkspace .receiptViewButton{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 9px;border:1px solid #d0d5dd;border-radius:7px;'),'the button is on the register row-button tokens the invoices and sales orders registers use');
 assert.ok(css.includes('.receiptWorkspace .receiptMore>summary{display:inline-grid;place-items:center;width:36px;height:36px;min-height:36px;padding:0;border:1px solid #d0d5dd;border-radius:7px;'),'and the trigger beside it is the same 36px square, so the pair reads as one control');
 assert.ok(css.includes('.receiptWorkspace .receiptMore{display:inline-block;vertical-align:top;margin-left:6px}'),'the menu is inline rather than a flex item, so its open 218px panel is never squeezed to the column width');
 assert.match(css,/\.receiptWorkspace table\.receiptTable td:nth-child\(2\),\n\.receiptWorkspace table\.receiptTable td:nth-child\(5\),\n\.receiptWorkspace table\.receiptTable td:nth-child\(7\) small\{white-space:normal;overflow-wrap:anywhere\}/,'the invoice, reference and mode cells wrap rather than being cut off, which is what the payment mode was reported for');
 const widths=[...css.matchAll(/table\.receiptTable th:nth-child\(\d\)\{width:(\d+)%\}/g)].map(m=>Number(m[1]));
 assert.equal(widths.length,8,'the register declares all eight column widths');
 assert.equal(widths.reduce((a,b)=>a+b,0),100,'and they total exactly 100%, so the browser never has to scale them');
 assert.ok(widths[4]>=14,'the reference column holds a full reference, not an ellipsis');
 assert.ok(widths[6]>=13,'the mode column holds a full mode line');
 assert.ok(widths[7]>=15,'and the actions column holds the button plus the trigger without a scrollbar');
});
