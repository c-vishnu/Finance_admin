/* Client for the server-side GST taxpayer lookup (src/gst-lookup.js).

   The module is deliberately thin: it posts the GSTIN to our own backend route and turns
   every outcome into either a normalised taxpayer or a message the form can show. These
   tests also pin the security contract - the browser module must never carry a GST/GSP
   credential or call an external host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GST_LOOKUP_FAILED,GST_LOOKUP_PATH,lookupGstin,normaliseTaxpayer,stateNameFromCode} from '../src/gst-lookup.js';

const source=readFileSync('src/gst-lookup.js','utf8');

test('the client posts the GSTIN to our own backend route',async()=>{
 let captured=null;
 const result=await lookupGstin(' 27aapfu0939f1zv ',{
  fetchImpl:async(url,options)=>{
   captured={url,options};
   return {ok:true,json:async()=>({ok:true,status:'Active',fetchedAt:'2026-09-18T00:00:00.000Z',taxpayer:{legalName:'ABC Retail Private Limited'}})};
  },
 });
 assert.equal(GST_LOOKUP_PATH,'/api/gst/lookup','the route is our own');
 assert.equal(captured.url,GST_LOOKUP_PATH,'the browser calls nothing else');
 assert.equal(captured.options.method,'POST');
 assert.deepEqual(JSON.parse(captured.options.body),{gstin:'27AAPFU0939F1ZV'},'the GSTIN is normalised before it is sent');
 assert.equal(result.ok,true);
 assert.equal(result.taxpayer.legalName,'ABC Retail Private Limited');
 assert.equal(result.fetchedAt,'2026-09-18T00:00:00.000Z','the audit timestamp comes from the server');
 assert.equal(result.source,'server');
});

test('normaliseTaxpayer resolves the state code and upper-cases PAN',()=>{
 const taxpayer=normaliseTaxpayer({legalName:'ABC Retail',tradeName:'ABC',status:'Active',taxpayerType:'Regular',stateCode:'27',pan:'aapfu0939f',principalAddress:'12 MG Road'});
 assert.equal(taxpayer.state,'Maharashtra','the state code is resolved to a name');
 assert.equal(taxpayer.pan,'AAPFU0939F');
 assert.equal(taxpayer.status,'Active');
 assert.equal(taxpayer.taxpayerType,'Regular');
 assert.equal(taxpayer.principalAddress,'12 MG Road');
 assert.equal(stateNameFromCode('32'),'Kerala');
 assert.equal(stateNameFromCode(''),'');
 assert.deepEqual(normaliseTaxpayer(null),{legalName:'',tradeName:'',status:'',taxpayerType:'',state:'',pan:'',principalAddress:''});
});

test('a taxpayer state name wins over the code',()=>{
 assert.equal(normaliseTaxpayer({state:'Kerala',stateCode:'27'}).state,'Kerala');
});

test('every failure returns the requested message instead of throwing',async()=>{
 const unreachable=await lookupGstin('27AAPFU0939F1ZV',{fetchImpl:async()=>{throw new Error('offline')}});
 assert.equal(unreachable.ok,false);
 assert.equal(unreachable.code,'unreachable');
 assert.equal(unreachable.message,GST_LOOKUP_FAILED);
 assert.equal(GST_LOOKUP_FAILED,'Unable to fetch GST details. Please verify the GSTIN or enter the details manually.');

 const notConfigured=await lookupGstin('27AAPFU0939F1ZV',{fetchImpl:async()=>({ok:false,status:503,json:async()=>({ok:false,code:'not_configured',message:GST_LOOKUP_FAILED})})});
 assert.equal(notConfigured.ok,false);
 assert.equal(notConfigured.message,GST_LOOKUP_FAILED);

 const notFound=await lookupGstin('27AAPFU0939F1ZV',{fetchImpl:async()=>({ok:false,status:404,json:async()=>({ok:false,code:'not_found'})})});
 assert.equal(notFound.ok,false);
 assert.equal(notFound.message,GST_LOOKUP_FAILED,'a body without a message still returns the standard wording');

 const html=await lookupGstin('27AAPFU0939F1ZV',{fetchImpl:async()=>({ok:false,status:404,json:async()=>{throw new Error('not json')}})});
 assert.equal(html.ok,false);
 assert.equal(html.message,GST_LOOKUP_FAILED,'an HTML 404 from a dev server degrades to the same message');

 const noFetch=await lookupGstin('27AAPFU0939F1ZV',{fetchImpl:null});
 assert.equal(typeof noFetch.ok,'boolean');
});

test('the browser module never carries a credential or an external host',()=>{
 for(const leak of ['GST_API_KEY','GST_API_URL','client_secret','clientSecret','apiKey','api_key','Bearer '])
  assert.ok(!source.includes(leak),'no credential material: '+leak);
 assert.ok(!/https?:\/\//.test(source.replace(GST_LOOKUP_PATH,'')),'no external host is contacted');
 assert.ok(source.includes('export const GST_LOOKUP_PATH'),'the only address is the relative backend route');
});
