import {useEffect,useState} from 'react';
import {readSettings,writeSettings,SETTINGS_EVENT} from './settings-store.js';

/* ONE place decides how a number is written. Every money and quantity helper in the app reads the
   saved preference through this module, so the Number and Currency Format dialog changes what the
   whole system prints rather than one screen. The format lives in the settings store beside the
   other organisation preferences, which is what makes it survive a reload and reach the printouts. */
export const NUMBER_FORMAT_EVENT='wayvida-number-format-updated';
export const NUMBER_FORMATS=[
 {id:'en-IN',label:'India - English (Lakhs)'},
 {id:'en-US',label:'United States - English (Millions)'},
];
/* The countries offered under "Choose from other countries": the grouping differs by locale, which is
   the whole point of the setting, so each entry states its own sample rather than a shared one. */
export const OTHER_NUMBER_FORMATS=[
 {id:'en-GB',label:'United Kingdom - English'},
 {id:'en-AU',label:'Australia - English'},
 {id:'en-SG',label:'Singapore - English'},
 {id:'de-DE',label:'Germany - German'},
 {id:'fr-FR',label:'France - French'},
 {id:'nl-NL',label:'Netherlands - Dutch'},
 {id:'ja-JP',label:'Japan - Japanese'},
 {id:'zh-CN',label:"China - Chinese"},
 {id:'ar-AE',label:'United Arab Emirates - Arabic'},
];
export const ALL_NUMBER_FORMATS=[...NUMBER_FORMATS,...OTHER_NUMBER_FORMATS];
/* "Default" is the two decimals every amount already carried, so choosing it never changes a figure. */
export const DECIMAL_CHOICES=[
 {value:'default',label:'Default',digits:2},
 {value:'0',label:'99',digits:0},
 {value:'1',label:'99.0',digits:1},
 {value:'2',label:'99.00',digits:2},
 {value:'3',label:'99.000',digits:3},
 {value:'4',label:'99.0000',digits:4},
];
const FALLBACK={numberFormat:'en-IN',decimalPlaces:2,currencySymbol:'\u20b9',roundOffQuantity:false,roundOffRate:false};

export function readNumberFormat(){
 const organization=readSettings().organization||{};
 const chosen=String(organization.numberFormat||''),symbol=String(organization.currencySymbol||'').trim();
 const decimals=Number(organization.decimalPlaces);
 return {
  numberFormat:ALL_NUMBER_FORMATS.some(entry=>entry.id===chosen)?chosen:FALLBACK.numberFormat,
  decimalPlaces:Number.isInteger(decimals)&&decimals>=0&&decimals<=4?decimals:FALLBACK.decimalPlaces,
  currencySymbol:symbol||FALLBACK.currencySymbol,
  roundOffQuantity:!!organization.roundOffQuantity,
  roundOffRate:!!organization.roundOffRate,
 };
}
/* The dialog writes through the same store as every other preference, so validation, the merge with
   defaults and the cross-module settings event all come for free. */
export function saveNumberFormat(patch){
 const current=readSettings();
 const saved=writeSettings({...current,organization:{...current.organization,...patch}});
 if(typeof window!=='undefined')window.dispatchEvent(new Event(NUMBER_FORMAT_EVENT));
 return saved;
}
export function decimalChoiceOf(decimalPlaces){
 const found=DECIMAL_CHOICES.find(entry=>entry.digits===decimalPlaces);
 return found?found.value:'default';
}
export function digitsOfChoice(value){
 return (DECIMAL_CHOICES.find(entry=>entry.value===String(value))||DECIMAL_CHOICES[0]).digits;
}
/* The dialog previews the grouping alone; it prefixes the operator own currency symbol. */
export function numberSample(format){
 try{return (12345679).toLocaleString(format);}catch{return ''}
}
export function formatRupees(value,override){
 const {numberFormat,decimalPlaces,currencySymbol}=override||readNumberFormat();
 const number=Number(value);
 const safe=Number.isFinite(number)?number:0;
 return currencySymbol+safe.toLocaleString(numberFormat,{minimumFractionDigits:decimalPlaces,maximumFractionDigits:decimalPlaces});
}
/* Every stored amount in the accounting engine is an integer number of paise. */
export function formatMinor(minor,override){
 const number=Number(minor);
 return formatRupees((Number.isFinite(number)?number:0)/100,override);
}
export function formatQuantity(value,override){
 const {numberFormat,decimalPlaces,roundOffQuantity}=override||readNumberFormat();
 const number=Number(value);
 const safe=Number.isFinite(number)?number:0;
 const digits=roundOffQuantity?0:Math.min(3,Math.max(0,decimalPlaces));
 return safe.toLocaleString(numberFormat,{minimumFractionDigits:0,maximumFractionDigits:digits});
}
export function formatRate(value,override){
 const {numberFormat,decimalPlaces,roundOffRate}=override||readNumberFormat();
 const number=Number(value);
 const safe=Number.isFinite(number)?number:0;
 const digits=roundOffRate?0:decimalPlaces;
 return safe.toLocaleString(numberFormat,{minimumFractionDigits:0,maximumFractionDigits:digits});
}
export function useNumberFormat(){
 const [value,setValue]=useState(readNumberFormat);
 useEffect(()=>{
  const sync=()=>setValue(readNumberFormat());
  window.addEventListener(NUMBER_FORMAT_EVENT,sync);
  window.addEventListener(SETTINGS_EVENT,sync);
  return ()=>{window.removeEventListener(NUMBER_FORMAT_EVENT,sync);window.removeEventListener(SETTINGS_EVENT,sync)};
 },[]);
 return value;
}
