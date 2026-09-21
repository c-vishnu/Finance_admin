/* Client for the server-side GST taxpayer lookup.

   The browser never calls the GST/GSP service and never holds a credential. It posts the
   GSTIN to our own backend route (`/api/gst/lookup`), which keeps the API key as a server
   secret, calls the provider, and answers with a normalised taxpayer record or a
   machine-readable failure. Any failure is returned as `{ok:false, message}` so the form can
   show the message and still let the operator type the details by hand. */
import {GST_STATE_CODES} from './customer-tax.js';

export const GST_LOOKUP_PATH = '/api/gst/lookup';
export const GST_LOOKUP_FAILED = 'Unable to fetch GST details. Please verify the GSTIN or enter the details manually.';

export function stateNameFromCode(code){return GST_STATE_CODES[String(code||'').trim()]||''}

/* One taxpayer shape for the form, whatever the provider called its fields. */
export function normaliseTaxpayer(source){
 const taxpayer=source||{};
 const state=String(taxpayer.state||'').trim()||stateNameFromCode(taxpayer.stateCode);
 return {
  legalName:String(taxpayer.legalName||'').trim(),
  tradeName:String(taxpayer.tradeName||'').trim(),
  status:String(taxpayer.status||'').trim(),
  taxpayerType:String(taxpayer.taxpayerType||'').trim(),
  state,
  pan:String(taxpayer.pan||'').trim().toUpperCase(),
  principalAddress:String(taxpayer.principalAddress||'').trim()
 };
}

export async function lookupGstin(gstin,{fetchImpl}={}){
 const send=fetchImpl||(typeof fetch==='function'?fetch:null);
 if(!send)return {ok:false,code:'unsupported',message:GST_LOOKUP_FAILED};
 let response;
 try{
  response=await send(GST_LOOKUP_PATH,{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({gstin:String(gstin||'').trim().toUpperCase()})});
 }catch{
  return {ok:false,code:'unreachable',message:GST_LOOKUP_FAILED};
 }
 let payload=null;
 try{ payload=await response.json() }catch{ payload=null }
 if(!response.ok||!payload||payload.ok!==true)
  return {ok:false,code:String(payload?.code||'failed'),message:String(payload?.message||'').trim()||GST_LOOKUP_FAILED};
 return {ok:true,taxpayer:normaliseTaxpayer(payload.taxpayer),status:String(payload.status||'').trim(),fetchedAt:String(payload.fetchedAt||'').trim()||new Date().toISOString(),source:'server'};
}
