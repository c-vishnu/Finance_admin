import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* The register count opens every migrated page heading, in the parentheses the Journal Entries, Items,
   Budgets and Period Lock headings already use. One table here, so a future register inherits it. */
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages={
 'src/Customers.jsx':['Customers','rows.length'],
 'src/SalesOrders.jsx':['Sales orders','orders.length'],
 'src/InvoiceWorkspace.jsx':['Sales invoices','db.invoices.length'],
 'src/CreditNotes.jsx':['Credit Notes','notes.length'],
 'src/Receipts.jsx':['Payment Receipts','rows.length'],
};

test('every migrated register names its record count in the page heading',()=>{
 for(const [file,[title,count]] of Object.entries(pages)){
  const source=read(file);
  assert.ok(source.includes('registerHeadText"><h2>'+title+' <span className="registerHeadCount">({'+count+'})</span></h2>'),file+' opens its heading with '+title+' and its count');
 }
});

test('the count is the register total, so it does not move while the reader filters',()=>{
 for(const [file] of Object.entries(pages)){
  const source=read(file);
  assert.ok(!source.includes('registerHeadCount">({visible.length})')&&!source.includes('registerHeadCount">({filtered.length})')&&!source.includes('registerHeadCount">({rows.filter'),file+' counts the register rather than the rows on screen');
 }
});

test('the count is styled once, on the page title tokens the other register counts use',()=>{
 const css=read('src/register-head.css');
 assert.match(css,/\.registerHead \.registerHeadText \.registerHeadCount\{font-size:24px;font-weight:700;line-height:1\.25;letter-spacing:-\.4px;color:#172033\}/,'one shared rule at the 24px/700 #172033 the journal, items, budgets and period lock counts already read at');
 assert.ok(!css.includes('.registerHeadCount{font-size:16px'),'and not the retired 16px helper treatment');
});
