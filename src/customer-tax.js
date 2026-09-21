/* Pure customer tax, address, payment-term and GSTIN helpers.

   Customers.jsx renders these values and the unit tests exercise them directly, so
   nothing here touches React, storage or the DOM. The GSTIN decoder implements the
   standard GSTIN structure (2-digit state code + 10-character PAN + entity code +
   'Z' + mod-36 check digit) and is a local prototype: it validates and decodes the
   number the operator types. It does not call the GST portal, so the business legal
   name and trade name stay operator-editable fields rather than fabricated values. */

export const GST_STATE_CODES={
 '01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'};

/* `gstin` decides whether the GSTIN/UIN field renders at all: 'required' shows it and
   holds the form to a valid number, 'hidden' removes it for treatments that cannot
   carry one. `business` drives the legal/trade-name fields, `pan` the PAN requirement. */
export const GST_TREATMENTS=[
 {value:'Registered Business \u2013 Regular',short:'Regular business',gstin:'required',pan:'required',business:true,registered:true,placeOfSupply:true,countryRequired:false,note:'A regular dealer charges and claims GST on invoices.'},
 {value:'Registered Business \u2013 Composition',short:'Composition dealer',gstin:'required',pan:'required',business:true,registered:true,placeOfSupply:true,countryRequired:false,note:'A composition dealer pays a fixed rate and cannot collect GST on outward supplies. The tax treatment is applied on each transaction.'},
 {value:'Unregistered Business',short:'Unregistered business',gstin:'hidden',pan:'optional',business:true,registered:false,placeOfSupply:true,countryRequired:false,note:'The customer trades but is not registered for GST.'},
 {value:'Consumer',short:'Consumer',gstin:'hidden',pan:'optional',business:false,registered:false,placeOfSupply:true,countryRequired:false,note:'An end consumer with no GST registration.'},
 {value:'Overseas',short:'Overseas customer',gstin:'hidden',pan:'optional',business:false,registered:false,placeOfSupply:false,countryRequired:true,note:'The customer is outside India, so the Indian place of supply does not apply. Record the country and confirm the export or import treatment with your accountant.'},
 {value:'SEZ',short:'SEZ unit',gstin:'required',pan:'required',business:true,registered:true,placeOfSupply:true,countryRequired:false,note:'Supplies to an SEZ unit follow the SEZ and zero-rated rules.'},
 {value:'UIN Holder',short:'UIN holder',gstin:'required',pan:'optional',business:true,registered:true,uin:true,placeOfSupply:true,countryRequired:false,note:'A UIN holder is not GST-registered but holds a UIN for claiming refunds.'}];

export const GST_TREATMENT_VALUES=GST_TREATMENTS.map(row=>row.value);
/* The stored field is still `taxPreference`; the older constant name is kept as an alias so
   existing records and callers keep working. Country, place of supply and the customer's own
   registration do not change which of these four a transaction carries. */
export const TAXABILITY=['Taxable','Tax Exempt','Zero Rated','Non-GST / Out of Scope'];
export const TAX_PREFERENCES=TAXABILITY;
export const EXEMPTION_TAXABILITY='Tax Exempt';
export const CUSTOMER_TYPES=['Business','Individual'];
export const CUSTOMER_STATUSES=['Active','Inactive'];
export const DEFAULT_CURRENCY='INR';

export const CURRENCIES=[['INR','INR \u2013 Indian Rupee'],['USD','USD \u2013 US Dollar'],['AED','AED \u2013 UAE Dirham'],['GBP','GBP \u2013 Pound Sterling'],['EUR','EUR \u2013 Euro']];

/* Payment terms are stored on the record as credit days (`days`), which is the field
   the invoice and sales-order screens already read, plus the chosen term label
   (`paymentTerms`) so the operator sees the term they picked. Custom keeps `days`
   editable, so an existing customer with days: 21 reopens as Custom 21. */
export const PAYMENT_TERMS=['Due on Receipt','Net 15','Net 30','Net 45','Net 60','Custom'];
export const PAYMENT_TERM_DAYS={'Due on Receipt':0,'Net 15':15,'Net 30':30,'Net 45':45,'Net 60':60};

export const blankAddress=()=>({line1:'',line2:'',city:'',state:'',pin:'',country:'India'});
export const blankContact=()=>({id:'',firstName:'',lastName:'',email:'',phone:'',designation:'',primary:false});
export const blankCustomField=()=>({id:'',label:'',value:''});
export const blankDocument=()=>({id:'',name:'',size:0});

export function gstTreatmentMeta(value){return GST_TREATMENTS.find(row=>row.value===value)||GST_TREATMENTS[0]}
export function gstinApplicable(value){return gstTreatmentMeta(value).gstin==='required'}
export function gstinRequired(value){return gstTreatmentMeta(value).gstin==='required'}
export function panRequired(value){return gstTreatmentMeta(value).pan==='required'}
export function gstinLabel(value){return gstTreatmentMeta(value).uin?'UIN':'GSTIN'}
export function isBusinessTreatment(value){return gstTreatmentMeta(value).business}
/* Overseas customers sit outside the Indian place-of-supply rules, so that picker is replaced
   by a required billing country; every other treatment picks an Indian state. */
export function placeOfSupplyApplicable(value){return gstTreatmentMeta(value).placeOfSupply!==false}
export function countryRequired(value){return gstTreatmentMeta(value).countryRequired===true}
export function treatmentNote(value){return gstTreatmentMeta(value).note||''}
/* Only Tax Exempt needs a reason. Taxable, Zero Rated and Non-GST / Out of Scope never ask for one. */
export function exemptionRequired(value){return value===EXEMPTION_TAXABILITY}

const GSTIN_CHARS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const GSTIN_PATTERN=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN=/^[A-Z]{5}[0-9]{4}[A-Z]$/;

/* The published GSTIN check-digit rule: weight each of the first 14 characters
   alternately by 1 and 2, fold each product back through base 36, then take the
   complement of the total modulo 36. */
export function gstinChecksum(value){
 const gstin=String(value||'').trim().toUpperCase();
 if(gstin.length!==15)return false;
 let sum=0;
 for(let index=0;index<14;index+=1){
  const digit=GSTIN_CHARS.indexOf(gstin[index]);
  if(digit<0)return false;
  const product=digit*(index%2===0?1:2);
  sum+=Math.floor(product/36)+(product%36);
 }
 return GSTIN_CHARS[(36-(sum%36))%36]===gstin[14];
}

/* Decodes everything a GSTIN legitimately carries. The result is presentation-neutral:
   `valid` is the only gate the form uses, and `reason` is the operator-facing sentence
   when the number cannot be accepted. */
export function decodeGstin(value){
 const gstin=String(value||'').trim().toUpperCase();
 if(!gstin)return {valid:false,gstin,reason:'Enter a GSTIN to fetch taxpayer details.'};
 if(gstin.length!==15)return {valid:false,gstin,reason:'A GSTIN is 15 characters.'};
 if(!GSTIN_PATTERN.test(gstin))return {valid:false,gstin,reason:'Use the GSTIN format 27ABCDE1234F1Z5.'};
 if(!gstinChecksum(gstin))return {valid:false,gstin,reason:'The GSTIN check digit does not match. Verify the number.'};
 const stateCode=gstin.slice(0,2),state=GST_STATE_CODES[stateCode];
 if(!state)return {valid:false,gstin,reason:'State code '+stateCode+' is not a recognised GST state code.'};
 return {valid:true,gstin,stateCode,state,pan:gstin.slice(2,12)};
}

/* Addresses are stored twice on purpose: the structured parts (`billingAddress`,
   `shippingAddress`) so the form reopens exactly what was entered, and the composed
   multi-line text (`billing`, `shipping`) because the invoice and sales-order screens
   already read that string. composeAddress is the only place the two are kept in step. */
export function composeAddress(address){
 const value=address||{};
 const region=[String(value.state||'').trim(),String(value.pin||'').trim()].filter(Boolean).join(' ');
 return [value.line1,value.line2,value.city,region,value.country].map(part=>String(part||'').trim()).filter(Boolean).join('\n');
}

/* A stored customer written before the structured address existed carries only the
   composed string, so the first line becomes Address 1 and everything after it Address 2.
   Nothing is dropped and nothing is silently relabelled. */
export function parseAddress(text,fallback){
 const value=String(text||'').trim();
 if(!value)return fallback?{...blankAddress(),...fallback}:blankAddress();
 const lines=value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(!lines.length)return blankAddress();
 if(lines.length===1)return {...blankAddress(),line1:lines[0]};
return {...blankAddress(),line1:lines[0],line2:lines.slice(1).join(', ')};
}

/* The place of supply is derived, not typed. GST treats the delivery of goods as supplied where they
   are delivered, so a distinct shipping address wins; otherwise the customer's own registered place
   of supply (the `state` the customer form keeps) applies, and a customer that predates the
   structured address falls back to the state named anywhere in its billing text.

   `source` is what the operator is shown and what decides whether a later address edit may rewrite
   the value: only a derived value is ever recalculated. A shipping address that is merely a copy of
   the billing address is not a delivery address of its own, so it is never reported as the source -
   that would mislabel the ordinary case as "based on shipping". */
export const PLACE_OF_SUPPLY_SOURCE={CUSTOMER:'customer_address',SHIPPING:'shipping_address',MANUAL:'manual'};

/* The codes in GST_STATE_CODES are keyed by code, so the reverse lookup is built once here rather
   than kept as a second table that could drift. */
export const STATE_GST_CODES=Object.fromEntries(Object.entries(GST_STATE_CODES).map(([code,name])=>[name,code]));

export function gstStateCode(state){return STATE_GST_CODES[String(state||'').trim()]||''}

/* Only a name the app already recognises counts. A free-text address line that happens to contain a
   city or a country never becomes a place of supply by accident, and the longest match wins so a
   future name that contains another cannot shadow it. */
export function findStateInAddress(text,states=[]){
 const haystack=String(text||'').toLowerCase();
 if(!haystack.trim())return '';
 const matches=(states||[]).filter(state=>state&&haystack.includes(String(state).toLowerCase()));
 return matches.sort((left,right)=>String(right).length-String(left).length)[0]||'';
}

export function placeOfSupplySuggestion(customer,states=[]){
 const record=customer||{},list=states||[];
 const billing=String(record.billing||'').trim(),shipping=String(record.shipping||'').trim();
 const hasOwnShipping=!!shipping&&shipping!==billing;
 if(hasOwnShipping){
  const delivered=findStateInAddress(record.shippingAddress?.state,list)||findStateInAddress(shipping,list);
  if(delivered)return {state:delivered,source:PLACE_OF_SUPPLY_SOURCE.SHIPPING};
 }
 const registered=String(record.state||'').trim();
 if(registered)return {state:registered,source:PLACE_OF_SUPPLY_SOURCE.CUSTOMER};
 const billed=findStateInAddress(record.billingAddress?.state,list)||findStateInAddress(billing,list);
 return billed?{state:billed,source:PLACE_OF_SUPPLY_SOURCE.CUSTOMER}:{state:'',source:''};
}

export function placeOfSupplySourceLabel(source){
 if(source===PLACE_OF_SUPPLY_SOURCE.SHIPPING)return 'Based on shipping address';
 if(source===PLACE_OF_SUPPLY_SOURCE.CUSTOMER)return 'Based on customer address';
 if(source===PLACE_OF_SUPPLY_SOURCE.MANUAL)return 'Manually selected';
 return 'Select Place of Supply';
}

/* The one sentence under the field, and the name of the address a manual value could be reset to. */
export function placeOfSupplyStatus(source,derived){
 if(source!==PLACE_OF_SUPPLY_SOURCE.MANUAL)return {text:placeOfSupplySourceLabel(source),reset:''};
 const state=String(derived?.state||'').trim();
 const reset=state?(derived.source===PLACE_OF_SUPPLY_SOURCE.SHIPPING?'Reset to shipping state':'Reset to customer state'):'';
 return {text:'Manually selected',reset};
}

export function contactName(contact){
 return [contact?.firstName,contact?.lastName].map(part=>String(part||'').trim()).filter(Boolean).join(' ');
}

export function primaryContact(contacts){
 const list=Array.isArray(contacts)?contacts:[];
 return list.find(row=>row.primary)||list[0]||null;
}

/* One contact is always primary once any contact exists: clearing the flag on the
   current primary promotes the first remaining row. */
export function setPrimaryContact(contacts,id){
 const list=Array.isArray(contacts)?contacts:[];
 if(!list.length)return list;
 return list.map(row=>({...row,primary:row.id===id}));
}

export function paymentTermDays(term,customDays){
 if(Object.prototype.hasOwnProperty.call(PAYMENT_TERM_DAYS,term))return PAYMENT_TERM_DAYS[term];
 const value=Number(customDays);
 return Number.isFinite(value)&&value>=0?value:0;
}

/* The day count a customer's terms mean, for the document screens that store a day count rather
   than the term label. `0 || 30` is 30, so a Due-on-Receipt customer used to arrive on an invoice
   or a sales order as Net 30. */
export function customerTermDays(customer,fallback=30){
 const raw=customer?.days;
 if(raw===undefined||raw===null||raw==='')return fallback;
 const value=Number(raw);
 return Number.isFinite(value)&&value>=0?value:fallback;
}

export function daysToPaymentTerm(days){
 const value=Number(days);
 if(!Number.isFinite(value)||value<0)return 'Net 30';
 const match=PAYMENT_TERMS.find(term=>PAYMENT_TERM_DAYS[term]===value);
 return match||'Custom';
}

export const PENDING_GSTIN_REASON='Enter a GSTIN to fetch taxpayer details.';

export const COUNTRIES=['India','United Arab Emirates','United Kingdom','United States','Singapore','Australia','Germany','Netherlands','Saudi Arabia','Canada','Other'];

/* Exactly one contact is primary once any contact exists, and the first contact is
   promoted when nothing is flagged, so the register and the stored single `contact`
   field always have a name to show. */
export function normaliseContacts(list){
 const rows=(Array.isArray(list)?list:[]).map(row=>({...blankContact(),...row,id:row.id||crypto.randomUUID()}));
 if(!rows.length)return rows;
 const primary=Math.max(0,rows.findIndex(row=>row.primary));
 return rows.map((row,index)=>({...row,primary:index===primary}));
}

/* Legacy customers stored one free-text contact person, so it is carried into the
   first contact row instead of being dropped when the record is reopened. */
export function contactFromName(name){
 const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return null;
 return {...blankContact(),id:crypto.randomUUID(),firstName:parts[0],lastName:parts.slice(1).join(' '),primary:true};
}

export function fileSize(bytes){
 const value=Number(bytes)||0;
 if(value<1024)return value+' B';
 if(value<1024*1024)return Math.round(value/1024)+' KB';
 return (value/(1024*1024)).toFixed(1)+' MB';
}

export const MAX_DOCUMENTS=10;
export const MAX_DOCUMENT_BYTES=10*1024*1024;
