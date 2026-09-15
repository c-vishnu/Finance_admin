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
test('receipt register renders existing payment history and independent creation action',()=>{const s=initial();s.accounts=[{code:'1010',name:'Bank',type:'Assets',active:true}];s.invoices=[{id:'i',customerName:'Customer'}];s.payments=[{id:'p',number:'PAY-OLD',invoiceId:'i',date:'2026-09-04',amount:10000,bank:'1010'}];globalThis.localStorage={getItem:k=>k===KEY?JSON.stringify(s):null};globalThis.sessionStorage={getItem:()=>null};const html=renderToString(React.createElement(mod.exports.default,{seed:{},onNavigate(){},notify(){}}));for(const label of ['Customer receipts','New receipt','PAY-OLD','Bank matching','local simulation','Allocation'])assert.ok(html.includes(label),label);delete globalThis.localStorage;delete globalThis.sessionStorage;});
test('receipt workspace defaults to the signed-in prototype administrator role',()=>{const source=readFileSync('src/Receipts.jsx','utf8');assert.ok(source.includes("[role,setRole]=useState('Admin')"));assert.ok(source.includes("r.status==='Approved'"));assert.ok(source.includes("disabled={!can('post')}"));});
test('receipt more actions use a vertical, non-scrolling menu',()=>{const css=readFileSync('src/receipts.css','utf8');assert.ok(css.includes('.receiptWorkspace .receiptMore>div{position:static'));assert.ok(css.includes('flex-direction:column'));assert.ok(css.includes('overflow:visible'));assert.ok(css.includes('justify-content:flex-start'))});
