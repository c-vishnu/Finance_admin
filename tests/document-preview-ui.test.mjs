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
