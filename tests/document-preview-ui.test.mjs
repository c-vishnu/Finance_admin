import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {defaultTemplate,layouts} from '../src/document-templates.js';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
const out=await build({entryPoints:['src/DocumentPreview.jsx','src/Receipts.jsx','src/InvoiceWorkspace.jsx','src/CreditNotes.jsx','src/SalesOrders.jsx'],outdir:'unused',bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const mod={exports:{}};new Function('require','module','exports',out.outputFiles.find(f=>f.path.endsWith('DocumentPreview.js')).text)(require,mod,mod.exports);
test('preview has Print Share Customize Close, logo and no initial builder panel',()=>{
 const html=renderToString(React.createElement(mod.exports.PreviewOnly,{kind:'Invoice',doc:{id:'i',number:'INV-1',status:'Draft',totals:{total:100,lines:[]}},db:{},template:defaultTemplate,onClose(){}}));
 assert.equal((html.match(/<button/g)||[]).length,4);assert.ok(html.includes('Close print preview'));
 assert.ok(html.includes('dpEmbedded'));assert.ok(html.includes('role="region"'));assert.ok(!html.includes('aria-modal="true"'));
 for(const label of ['Print','Share','Customize','wayvida-logo-transparent.png'])assert.ok(html.includes(label),label);
 for(const text of ['dpSettings','dpToolbar','dpPreviewSummary','Appearance','Save template','Zoom'])assert.ok(!html.includes(text),text);
 assert.ok(html.includes('INV-1'));assert.ok(html.includes('Sales Invoice'));
});
test('all document kinds render all layouts with saved totals and escaped customer content',()=>{
 const doc={id:'d',number:'DOC-001',date:'2026-09-04',status:'Draft',customerName:'Customer <script>test</script>',billing:'Customer address',amount:118000,mode:'UPI',bank:'1010',lines:[],totals:{subtotal:100000,discount:0,taxable:100000,cgst:9000,sgst:9000,igst:0,cess:0,roundOff:0,total:118000,lines:[{description:'Consulting',qty:1,unit:'service',rate:1000,off:0,cgst:9000,sgst:9000,igst:0,cessAmount:0,total:118000}]}};
 for(const kind of ['Receipt','Invoice','Credit Note','Sales Order'])for(const layout of layouts){
  const html=renderToString(React.createElement(mod.exports.DocumentSheet,{kind,doc,db:{},template:{...defaultTemplate,layout,businessName:'My Business'}}));
  for(const expected of ['My Business','DOC-001','1,180.00','DRAFT / NOT POSTED','&lt;script&gt;'])assert.ok(html.includes(expected),kind+' '+layout+' '+expected);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('Accounts Receivable'));
  assert.ok(html.includes('Total in words'));assert.ok(html.includes('Indian Rupees One Thousand One Hundred Eighty Only'));
  assert.ok(html.includes({Invoice:'Sales Invoice',Receipt:'Payment Receipt','Credit Note':'Credit Note','Sales Order':'Sales Order'}[kind]));
 }
});
test('preview isolates semantic elements from legacy fixed shell styles',()=>{
 const css=readFileSync('src/document-preview-fix.css','utf8');
 for(const rule of ['.dpOverlay header','.dpOverlay nav','.dpOverlay aside','.dpOverlay main'])assert.ok(css.includes(rule),rule);
 assert.ok(css.includes('position:static'));
 assert.ok(css.includes('.dpEmbedded .dpPaper'));
});

/* A preview is mounted INSIDE a register page, so the host's table rules reach the printed
   sheet: `src/items.css` declares `.itemsPage table{min-width:800px}` and `src/ui-system.css`
   pads every th/td with 16px 20px (plus a 24px first-child inset and a 24px last-child inset)
   under !important. Measured live, that printed the eight-column items table 800px wide inside
   a 620px paper, so it broke 150px past the right page edge and squeezed the headers onto two
   lines. The sheet must restate its own table geometry, because a host page may never reshape
   a printed document. */
test('preview keeps host register and shell table geometry out of the printed sheet',()=>{
 const css=readFileSync('src/document-preview-fix.css','utf8');
 for(const rule of ['.dpPaper table{min-width:0!important}','.dpPaper th{padding:10px 6px!important;white-space:normal!important}','.dpPaper td{padding:12px 6px!important;white-space:normal!important}','.dpPaper th:first-child,.dpPaper td:first-child{padding-left:6px!important}','.dpPaper th:last-child,.dpPaper td:last-child{padding-right:6px!important}','.dpPaper .dpItemsTable th{padding:12px 6px!important}','.dpPaper .dpItemsTable td{padding:14px 6px!important}'])assert.ok(css.includes(rule),rule);
});

test('the eight item columns add up to the sheet width and keep the quantity header on one line',()=>{
 const css=readFileSync('src/document-preview.css','utf8');
 const columns=['.dpPaper .dpItemsTable th:first-child,.dpPaper .dpItemsTable td:first-child{width:4%;color:#76869c}','.dpItemsTable th:nth-child(2){width:21%}','.dpItemsTable th:nth-child(3){width:13%}','.dpItemsTable th:nth-child(4){width:12%}','.dpItemsTable th:nth-child(5){width:12%}','.dpItemsTable th:nth-child(6){width:12%}','.dpItemsTable th:nth-child(7){width:10%}','.dpItemsTable th:last-child{width:16%}'];
 for(const rule of columns)assert.ok(css.includes(rule),rule);
 assert.equal(columns.reduce((total,rule)=>total+Number(rule.match(/width:(\d+)%/)[1]),0),100,'the eight columns share the sheet width exactly');
 assert.ok(Number(columns[3].match(/width:(\d+)%/)[1])>=12,'Qty / Unit needs 12% so its two-word header stays on one line');
 assert.ok(Number(columns[2].match(/width:(\d+)%/)[1])>=13,'HSN / SAC needs 13% so its three-word header stays on one line');
});
