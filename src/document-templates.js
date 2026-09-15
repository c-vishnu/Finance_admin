export const TEMPLATE_KEY='wayvida-print-templates-v1';
export const layouts=['Classic','Modern','Minimal'];
export const documentLabels={Invoice:{title:'Sales Invoice',section:'Invoices',amount:'Invoice total'},'Credit Note':{title:'Credit Note',section:'Credit Notes',amount:'Credit total'},'Sales Order':{title:'Sales Order',section:'Sales Orders',amount:'Order total'},'Purchase Order':{title:'Purchase Order',section:'Purchase Orders',amount:'Order total'},'Purchase Bill':{title:'Purchase Bill',section:'Purchase Bills',amount:'Bill total'},'Purchase Debit Note':{title:'Purchase Debit Note',section:'Debit Notes',amount:'Vendor credit total'},Receipt:{title:'Payment Receipt',section:'Receipts',amount:'Receipt amount'}};
export function amountInWords(paise){
 if(!Number.isSafeInteger(paise)||paise<0)return '';
 const small=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
 const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
 function words(n){if(n<20)return small[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+small[n%10]:'');for(const [value,label] of [[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand'],[100,'Hundred']])if(n>=value)return words(Math.floor(n/value))+' '+label+(n%value?' '+words(n%value):'');}
 return 'Indian Rupees '+words(Math.floor(paise/100))+(paise%100?' and '+words(paise%100)+' Paise':'')+' Only';
}
export const DEFAULT_LOGO='/wayvida-logo-transparent.png';
export const defaultTemplate={layout:'Classic',accent:'#2459a6',businessName:'',businessAddress:'',contact:'',logo:DEFAULT_LOGO,footer:'Thank you for your business.',terms:'',signature:'Authorized signatory',showShipping:true,showSignature:true};
export function loadTemplate(kind,id,storage=localStorage){
 const raw=storage.getItem(TEMPLATE_KEY);const data=raw?JSON.parse(raw):{};
 const value={...defaultTemplate,...data.defaults?.[kind],...data.documents?.[kind+':'+id]};
 return {...value,logo:value.logo||DEFAULT_LOGO};
}
export function saveTemplate(kind,id,value,asDefault=false,storage=localStorage){
 if(!layouts.includes(value.layout)||!/^#[\da-f]{6}$/i.test(value.accent))throw Error('Choose a valid template and colour.');
 if(value.logo&&value.logo!==DEFAULT_LOGO&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo))throw Error('Use a PNG, JPG or WebP logo.');
 const raw=storage.getItem(TEMPLATE_KEY),data=raw?JSON.parse(raw):{};
 data.documents||={};data.defaults||={};data.documents[kind+':'+id]={...value};
 if(asDefault)data.defaults[kind]={...value};storage.setItem(TEMPLATE_KEY,JSON.stringify(data));
}
// Display snapshots only: no recalculation, posting or changes to accounting records.
export function printModel(kind,doc,db={}){
 const receipt=kind==='Receipt',t=doc.totals;
 const allocations=doc.legacy?[{invoiceId:doc.invoiceId,amount:doc.amount,voided:doc.status==='Reversed'}]:(db.receiptAllocations||[]).filter(a=>a.receiptId===doc.id);
 return {kind,doc,receipt,lines:t?.lines||doc.lines||[],totals:t,total:receipt?doc.amount:t?.total??Math.round(Number(doc.total||0)*100),
 allocations:allocations.map(a=>({...a,number:db.invoices?.find(i=>i.id===a.invoiceId)?.number||'Invoice unavailable'})),
 original:db.invoices?.find(i=>i.id===doc.originalInvoiceId)?.number,
 bank:db.accounts?.find(a=>a.code===doc.bank)?.name||doc.bank||'',
 provisional:['Draft','Pending Approval','Submitted','Approved'].includes(doc.status)&&!doc.posted,
 voided:['Cancelled','Reversed'].includes(doc.status)};
}
