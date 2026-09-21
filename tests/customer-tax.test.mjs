/* Pure helpers behind the simplified Create Customer form (src/customer-tax.js).

   Everything asserted here is a plain function: the GSTIN decoder, the GST treatment
   metadata that drives the conditional fields, the address composer that keeps the stored
   `billing` / `shipping` strings in step with the structured parts, and the payment-term,
   contact-person and document helpers the form calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES,EXEMPTION_TAXABILITY,GST_TREATMENT_VALUES,PAYMENT_TERMS,TAXABILITY,TAX_PREFERENCES,blankAddress,blankContact,composeAddress,contactFromName,contactName,countryRequired,customerTermDays,findStateInAddress,gstStateCode,placeOfSupplySuggestion,placeOfSupplySourceLabel,placeOfSupplyStatus,daysToPaymentTerm,decodeGstin,exemptionRequired,fileSize,gstTreatmentMeta,gstinApplicable,gstinChecksum,gstinLabel,isBusinessTreatment,normaliseContacts,panRequired,parseAddress,paymentTermDays,placeOfSupplyApplicable,treatmentNote} from '../src/customer-tax.js';

test('the GSTIN decoder accepts a correctly checked number and reads its parts',()=>{
 const result=decodeGstin('27AAPFU0939F1ZV');
 assert.equal(result.valid,true);
 assert.equal(result.stateCode,'27');
 assert.equal(result.state,'Maharashtra');
 assert.equal(result.pan,'AAPFU0939F');
});

test('the GSTIN decoder normalises case and surrounding space',()=>{
 assert.equal(decodeGstin(' 27aapfu0939f1zv ').valid,true);
});

test('the GSTIN decoder reports why a number cannot be accepted',()=>{
 assert.equal(decodeGstin('').valid,false);
 assert.match(decodeGstin('').reason,/Enter a GSTIN/);
 assert.match(decodeGstin('27AAPFU0939F1Z').reason,/15 characters/);
 assert.match(decodeGstin('27ABCDE1234F1X5').reason,/format/);
 assert.match(decodeGstin('27AAPFU0939F1ZA').reason,/check digit/);
 assert.match(decodeGstin('99AAPFU0939F1ZK').reason,/state code/,'a checked number whose state code is not a GST state is rejected');
});

test('the GSTIN checksum accepts exactly one check character per prefix',()=>{
 const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
 const accepted=chars.filter(char=>gstinChecksum('27AAPFU0939F1Z'+char));
 assert.deepEqual(accepted,['V']);
});

test('the GST treatment metadata decides which tax fields render',()=>{
 for(const value of ['Registered Business \u2013 Regular','Registered Business \u2013 Composition','SEZ','UIN Holder'])
  assert.equal(gstinApplicable(value),true,value+' carries a GSTIN/UIN');
 for(const value of ['Unregistered Business','Consumer','Overseas'])
  assert.equal(gstinApplicable(value),false,value+' carries no GSTIN');
 assert.equal(gstinLabel('UIN Holder'),'UIN');
 assert.equal(gstinLabel('Registered Business \u2013 Regular'),'GSTIN');
 assert.equal(isBusinessTreatment('Registered Business \u2013 Regular'),true);
 assert.equal(isBusinessTreatment('Consumer'),false);
 assert.equal(panRequired('Registered Business \u2013 Regular'),true);
 assert.equal(panRequired('Consumer'),false);
 assert.equal(gstTreatmentMeta('not-a-treatment').value,'Registered Business \u2013 Regular');
});

test('composeAddress joins the structured parts into the stored single string',()=>{
 assert.equal(composeAddress({line1:'12 MG Road',line2:'Flat 3B',city:'Kochi',state:'Kerala',pin:'682001',country:'India'}),'12 MG Road\nFlat 3B\nKochi\nKerala 682001\nIndia');
 assert.equal(composeAddress({line1:'12 MG Road',city:'Kochi',state:'Kerala',pin:'682001',country:'India'}),'12 MG Road\nKochi\nKerala 682001\nIndia','an empty Address 2 drops out');
 assert.equal(composeAddress({line1:'12 MG Road',line2:'   ',city:'',state:'',pin:'',country:''}),'12 MG Road');
 assert.equal(composeAddress(blankAddress()),'India');
});

test('blankAddress carries Address 1 and Address 2 and defaults to India',()=>{
 assert.deepEqual(blankAddress(),{line1:'',line2:'',city:'',state:'',pin:'',country:'India'});
});

test('parseAddress never loses a legacy address',()=>{
 assert.equal(parseAddress('MG Road, Kochi').line1,'MG Road, Kochi','a single-line legacy address lands in Address 1');
 assert.equal(parseAddress('MG Road, Kochi').line2,'');
 assert.equal(parseAddress('Plot 1\nSector 4\nKochi').line1,'Plot 1','the first line becomes Address 1');
 assert.equal(parseAddress('Plot 1\nSector 4\nKochi').line2,'Sector 4, Kochi','everything after it is preserved in Address 2');
 assert.equal(parseAddress('').line1,'');
 assert.equal(parseAddress('').country,'India');
 assert.equal(parseAddress('',{city:'Kochi'}).city,'Kochi','the fallback still seeds a missing value');
});

test('payment terms and stored credit days stay in step both ways',()=>{
 assert.equal(daysToPaymentTerm(0),'Due on Receipt');
 assert.equal(daysToPaymentTerm(15),'Net 15');
 assert.equal(daysToPaymentTerm(30),'Net 30');
 assert.equal(daysToPaymentTerm(60),'Net 60');
 assert.equal(daysToPaymentTerm(21),'Custom');
 assert.equal(daysToPaymentTerm(undefined),'Net 30');
 assert.equal(paymentTermDays('Net 45',0),45);
 assert.equal(paymentTermDays('Custom',21),21);
 assert.equal(paymentTermDays('Custom',''),0);
 for(const term of PAYMENT_TERMS.filter(term=>term!=='Custom'))
  assert.equal(daysToPaymentTerm(paymentTermDays(term,30)),term,term+' round trips');
 assert.equal(daysToPaymentTerm(paymentTermDays('Custom',21)),'Custom','a credit period matching no standard term stays Custom');
});

test('exactly one contact person is primary',()=>{
 const rows=normaliseContacts([{firstName:'A'},{firstName:'B',primary:true},{firstName:'C'}]);
 assert.deepEqual(rows.map(row=>row.primary),[false,true,false]);
 assert.equal(rows.every(row=>row.id),true,'every contact gets an id');
 const none=normaliseContacts([{firstName:'A'},{firstName:'B'}]);
 assert.deepEqual(none.map(row=>row.primary),[true,false],'the first contact is promoted when nothing is flagged');
 assert.deepEqual(normaliseContacts([]),[]);
});

test('a legacy free-text contact person becomes the first contact row',()=>{
 const contact=contactFromName('Anjali Menon');
 assert.equal(contact.firstName,'Anjali');
 assert.equal(contact.lastName,'Menon');
 assert.equal(contact.primary,true);
 assert.equal(contactFromName('   '),null);
 assert.equal(contactName({firstName:'Rahul',lastName:'Kumar'}),'Rahul Kumar');
 assert.equal(contactName({firstName:'Rahul',lastName:''}),'Rahul');
 assert.equal(contactName(blankContact()),'');
});

test('India is the default country and document sizes read in the right unit',()=>{
 assert.equal(COUNTRIES[0],'India');
 assert.equal(fileSize(0),'0 B');
 assert.equal(fileSize(2048),'2 KB');
 assert.equal(fileSize(15*1024*1024),'15.0 MB');
});

test('place of supply and country follow the treatment',()=>{
 assert.equal(placeOfSupplyApplicable('Overseas'),false,'an overseas customer has no Indian place of supply');
 assert.equal(countryRequired('Overseas'),true,'an overseas customer needs a country');
 for(const value of ['Registered Business – Regular','Registered Business – Composition','Unregistered Business','Consumer','SEZ','UIN Holder']){
  assert.equal(placeOfSupplyApplicable(value),true,value+' keeps the Indian place of supply');
  assert.equal(countryRequired(value),false,value+' does not require a country');
 }
 for(const value of GST_TREATMENT_VALUES)
  assert.ok(treatmentNote(value).length>10,'every treatment explains its tax behaviour: '+value);
 assert.match(treatmentNote('Registered Business – Composition'),/cannot collect GST/);
 assert.match(treatmentNote('Overseas'),/outside India/);
});

test('only Tax Exempt requires an exemption reason',()=>{
 assert.equal(exemptionRequired('Tax Exempt'),true);
 for(const value of ['Taxable','Zero Rated','Non-GST / Out of Scope'])
  assert.equal(exemptionRequired(value),false,value+' never asks for a reason');
 assert.deepEqual(TAXABILITY,['Taxable','Tax Exempt','Zero Rated','Non-GST / Out of Scope']);
 assert.equal(TAX_PREFERENCES,TAXABILITY,'the older constant name still points at the same list');
 assert.equal(EXEMPTION_TAXABILITY,'Tax Exempt');
});

test('the order term day count survives Due on Receipt and custom credit periods',()=>{
 assert.equal(customerTermDays({days:'0'}),0,'a Due on Receipt customer is not turned into Net 30 by a falsy zero');
 assert.equal(customerTermDays({days:'60'}),60,'Net 60 keeps its day count');
 assert.equal(customerTermDays({days:'90'}),90,'a Custom credit period keeps its day count');
 assert.equal(customerTermDays({}),30,'a customer with no stored terms falls back to Net 30');
 assert.equal(customerTermDays({days:''}),30,'and so does an empty one');
 assert.equal(customerTermDays({days:'-5'}),30,'and so does a negative one');
});

test('the place of supply is derived from the delivery address, then the customer',()=>{
 const states=['Kerala','Karnataka','Tamil Nadu'];
 const shipped=placeOfSupplySuggestion({billing:'MG Road\nKochi, Kerala',shipping:'9 Beach Road\nChennai, Tamil Nadu',state:'Kerala'},states);
 assert.deepEqual(shipped,{state:'Tamil Nadu',source:'shipping_address'},'a distinct shipping address wins, because that is where the goods are delivered');
 assert.deepEqual(placeOfSupplySuggestion({billing:'MG Road\nKochi, Kerala',shipping:'MG Road\nKochi, Kerala',state:'Kerala'},states),{state:'Kerala',source:'customer_address'},'a shipping address that only copies billing is not a delivery address of its own');
 assert.deepEqual(placeOfSupplySuggestion({billing:'MG Road\nKochi, Kerala',state:'Kerala'},states),{state:'Kerala',source:'customer_address'},'with no shipping address the customer record applies');
 assert.deepEqual(placeOfSupplySuggestion({billing:'MG Road\nKochi, Kerala'},states),{state:'Kerala',source:'customer_address'},'and with no stored place either, the state named in the billing text is read back out of it');
 assert.deepEqual(placeOfSupplySuggestion({billingAddress:{state:'Karnataka'},billing:'Karnataka'},states),{state:'Karnataka',source:'customer_address'},'a structured address is read before the composed text');
 assert.deepEqual(placeOfSupplySuggestion({billing:'12 Some Street',shipping:'12 Some Street'},states),{state:'',source:''},'an address that names no known state leaves the field unselected rather than guessing');
 assert.deepEqual(placeOfSupplySuggestion(null,states),{state:'',source:''},'and a missing customer cannot invent one');
});

test('a state is only recognised when the address actually names one',()=>{
 const states=['Kerala','Karnataka','Goa'];
 assert.equal(findStateInAddress('9 Beach Road\nChennai, Tamil Nadu',states),'','a state the list does not carry is not a match');
 assert.equal(findStateInAddress('MG Road, Kochi, Kerala 682016',states),'Kerala','a state inside a longer line is found');
 assert.equal(findStateInAddress('Kochi',states),'','a city is not a state');
 assert.equal(findStateInAddress('',states),'','an empty address matches nothing');
 assert.equal(findStateInAddress('Kerala',states),'Kerala','an exact name matches');
 assert.equal(findStateInAddress('Panaji, Goa and Islands',['Goa','Goa and Islands']),'Goa and Islands','the longest name wins, so a future name containing another cannot be shadowed');
});

test('the helper line states where the value came from, and offers the reset only when there is one',()=>{
 assert.equal(placeOfSupplySourceLabel('shipping_address'),'Based on shipping address');
 assert.equal(placeOfSupplySourceLabel('customer_address'),'Based on customer address');
 assert.equal(placeOfSupplySourceLabel('manual'),'Manually selected');
 assert.equal(placeOfSupplySourceLabel(''),'Select Place of Supply','an underived field asks for a value instead of claiming one');
 assert.deepEqual(placeOfSupplyStatus('customer_address',{state:'Kerala',source:'customer_address'}),{text:'Based on customer address',reset:''},'a derived value offers no reset, because nothing was overridden');
 assert.deepEqual(placeOfSupplyStatus('manual',{state:'Tamil Nadu',source:'shipping_address'}),{text:'Manually selected',reset:'Reset to shipping state'},'a manual value names the address it could be reset to');
 assert.deepEqual(placeOfSupplyStatus('manual',{state:'Kerala',source:'customer_address'}),{text:'Manually selected',reset:'Reset to customer state'},'and names the customer when that is the source');
 assert.deepEqual(placeOfSupplyStatus('manual',{state:'',source:''}),{text:'Manually selected',reset:''},'with no address to derive from there is nothing to reset to');
});

test('a place of supply carries the GST state code the e-invoice work needs',()=>{
 assert.equal(gstStateCode('Kerala'),'32');
 assert.equal(gstStateCode('Karnataka'),'29');
 assert.equal(gstStateCode(' Tamil Nadu '),'33','surrounding space is tolerated');
 assert.equal(gstStateCode('Atlantis'),'','an unknown state has no code, and none is invented');
 assert.equal(gstStateCode(''),'');
});
