import {useState} from 'react';
import {IconSettings,IconX} from '@tabler/icons-react';
import {DECIMAL_CHOICES,NUMBER_FORMATS,OTHER_NUMBER_FORMATS,decimalChoiceOf,digitsOfChoice,numberSample,readNumberFormat,saveNumberFormat} from './number-format.js';
import './number-format-dialog.css';

/* The control sits in the create-page header, but what it writes is not the order: it is the
   organisation preference every money and quantity helper reads through src/number-format.js, which
   is why applying it changes the figures on the page behind the dialog and on every printout, and
   why it survives a reload. The icon is the light primary variant on purpose - the one solid primary
   fill on this page belongs to Save. */
export default function NumberFormatControl(){
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" className="soHeadSettings" aria-label="Number and currency format" title="Number and currency format" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><IconSettings size={19} stroke={1.8}/></button>
  {open&&<NumberCurrencyFormatDialog onClose={()=>setOpen(false)}/>}
 </>;
}

export function NumberCurrencyFormatDialog({onClose}){
 const current=readNumberFormat();
 const [form,setForm]=useState({numberFormat:current.numberFormat,decimalChoice:decimalChoiceOf(current.decimalPlaces),currencySymbol:current.currencySymbol,roundOffQuantity:current.roundOffQuantity,roundOffRate:current.roundOffRate});
 const [otherCountry,setOtherCountry]=useState(OTHER_NUMBER_FORMATS.some(entry=>entry.id===current.numberFormat)?current.numberFormat:'');
 const [error,setError]=useState('');
 const set=(key,value)=>setForm(row=>({...row,[key]:value}));
 const locale=otherCountry||form.numberFormat;
 const digits=digitsOfChoice(form.decimalChoice);
 const symbol=form.currencySymbol.trim()||'\u20b9';
 const preview=symbol+(1234567.89).toLocaleString(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits});
 function apply(){
  try{
   saveNumberFormat({numberFormat:locale,decimalPlaces:digits,currencySymbol:symbol,roundOffQuantity:form.roundOffQuantity,roundOffRate:form.roundOffRate});
   onClose();
  }catch(e){setError(e.message||'Unable to save the number format.')}
 }
 return <div className="nfLayer" role="dialog" aria-modal="true" aria-labelledby="nfTitle">
  <button type="button" className="nfBackdrop" aria-label="Close number and currency format" onClick={onClose}/>
  <section className="nfDialog">
   <div className="nfHead"><h3 id="nfTitle">Number and Currency Format</h3><button type="button" className="nfClose" aria-label="Close number and currency format" onClick={onClose}><IconX size={18}/></button></div>
   <div className="nfBody">
    <p className="nfGroupTitle">Change Number Systems</p>
    <h4 className="nfLabel">Select Number Format</h4>
    <div className="nfFormats">{NUMBER_FORMATS.map(entry=><label key={entry.id} className={'nfFormat'+(locale===entry.id?' isActive':'')}><input type="radio" name="nf-format" value={entry.id} checked={locale===entry.id} onChange={()=>{set('numberFormat',entry.id);setOtherCountry('')}}/><span><strong>{symbol+numberSample(entry.id)}</strong><small>{entry.label}</small></span></label>)}</div>
    <label className="nfCountry"><span>Choose From Other Countries</span><select value={otherCountry} onChange={e=>setOtherCountry(e.target.value)}><option value="">Choose From Other Countries</option>{OTHER_NUMBER_FORMATS.map(entry=><option key={entry.id} value={entry.id}>{entry.label} · {numberSample(entry.id)}</option>)}</select></label>
    <h4 className="nfLabel">Select Decimal Digits</h4>
    <div className="nfDigits">{DECIMAL_CHOICES.map(entry=><label key={entry.value}><input type="radio" name="nf-digits" value={entry.value} checked={String(form.decimalChoice)===String(entry.value)} onChange={()=>set('decimalChoice',entry.value)}/><span>{entry.label}</span></label>)}</div>
    <div className="nfSwitches">
     <label><input type="checkbox" checked={form.roundOffQuantity} onChange={e=>set('roundOffQuantity',e.target.checked)}/><span>Apply Round-off to Quantity</span></label>
     <label><input type="checkbox" checked={form.roundOffRate} onChange={e=>set('roundOffRate',e.target.checked)}/><span>Apply Round-off to Rate</span></label>
    </div>
    <h4 className="nfLabel">Add Custom Currency Symbol</h4>
    <input className="nfSymbol" value={form.currencySymbol} maxLength={4} onChange={e=>set('currencySymbol',e.target.value)} aria-label="Custom currency symbol" placeholder="\u20b9"/>
    <p className="nfPreview"><span>Preview</span><strong>{preview}</strong></p>
    <p className="nfNote">Applies to every amount the system writes, including the documents printed from this page. Round-off affects quantities and rates only, never a posted amount.</p>
    {error&&<p className="nfError" role="alert">{error}</p>}
   </div>
   <div className="nfActions"><button type="button" onClick={onClose}>Cancel</button><button type="button" className="primary" onClick={apply}>Save Changes</button></div>
  </section>
 </div>;
}
