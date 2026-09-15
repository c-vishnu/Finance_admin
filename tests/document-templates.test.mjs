import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultTemplate,loadTemplate,saveTemplate,printModel,TEMPLATE_KEY,amountInWords,documentLabels} from '../src/document-templates.js';
test('document identities and Indian amount words are explicit and accurate',()=>{
 assert.equal(documentLabels.Invoice.title,'Sales Invoice');
 assert.equal(documentLabels['Credit Note'].section,'Credit Notes');
 assert.equal(documentLabels['Sales Order'].amount,'Order total');
 assert.equal(amountInWords(450000),'Indian Rupees Four Thousand Five Hundred Only');
 assert.equal(amountInWords(11800000),'Indian Rupees One Lakh Eighteen Thousand Only');
 assert.equal(amountInWords(100000005),'Indian Rupees Ten Lakh and Five Paise Only');
 assert.equal(amountInWords(0),'Indian Rupees Zero Only');
 assert.equal(amountInWords(-1),'');
});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('missing legacy logos fall back to Wayvida while custom logos are preserved',()=>{
 const s=storage();saveTemplate('Receipt','r',{...defaultTemplate,logo:''},false,s);
 assert.equal(loadTemplate('Receipt','r',s).logo,'/wayvida-logo-transparent.png');
 const logo='data:image/png;base64,aGVsbG8=';saveTemplate('Receipt','r',{...defaultTemplate,logo},false,s);
 assert.equal(loadTemplate('Receipt','r',s).logo,logo);
});
test('type defaults and document selections persist without touching transaction storage',()=>{
 const s=storage();s.setItem('wayvida-accounting-v1','original');
 assert.equal(loadTemplate('Receipt','r',s).layout,'Classic');
 saveTemplate('Receipt','r',{...defaultTemplate,layout:'Modern'},true,s);
 assert.equal(loadTemplate('Receipt','new',s).layout,'Modern');assert.equal(loadTemplate('Invoice','i',s).layout,'Classic');
 saveTemplate('Receipt','new',{...defaultTemplate,layout:'Minimal'},true,s);
 assert.equal(loadTemplate('Receipt','r',s).layout,'Modern');assert.equal(s.getItem('wayvida-accounting-v1'),'original');
});
test('invalid template data fails without overwriting preferences',()=>{
 const s=storage();saveTemplate('Receipt','r',defaultTemplate,false,s);const before=s.getItem(TEMPLATE_KEY);
 assert.throws(()=>saveTemplate('Receipt','r',{...defaultTemplate,layout:'unknown'},false,s));
 assert.throws(()=>saveTemplate('Receipt','r',{...defaultTemplate,logo:'javascript:alert(1)'},false,s));
 assert.equal(s.getItem(TEMPLATE_KEY),before);
});
test('print projections retain exact totals, legacy order currency and receipt allocation amounts',()=>{
 const invoice={id:'i',number:'INV-1',status:'Draft',totals:{total:118000,lines:[]}};const before=JSON.stringify(invoice);
 assert.equal(printModel('Invoice',invoice).total,118000);assert.equal(printModel('Invoice',invoice).provisional,true);assert.equal(JSON.stringify(invoice),before);
 assert.equal(printModel('Sales Order',{total:1180,lines:[]}).total,118000);
 assert.equal(printModel('Credit Note',{status:'Cancelled',totals:{total:100}}).voided,true);
 const r={id:'r',amount:10000,status:'Posted',posted:true};const db={invoices:[invoice],receiptAllocations:[{receiptId:'r',invoiceId:'i',amount:5000}]};
 assert.equal(printModel('Receipt',r,db).allocations[0].number,'INV-1');assert.equal(printModel('Receipt',r,db).total,10000);
});
