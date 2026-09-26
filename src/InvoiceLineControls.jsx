import {useId,useState} from 'react';
import {IconSearch,IconChevronDown,IconPlus} from '@tabler/icons-react';
import {lineTaxes} from './invoice-tax.js';

export function ItemSearch({items,line,onSelect,onAdHoc,onType,index}){
 const id=useId(),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const terms=(query.toLowerCase().match(/"[^"]+"|\S+/g)||[]).map(t=>t.replaceAll('"',''));
 const matches=items.filter(i=>i.sales&&terms.every(t=>`${i.name} ${i.code||''} ${i.unit||''}`.toLowerCase().includes(t)));
 /* ONE input answers both questions a line asks: which master item is this, and what is it called when
    there is no master record. The typed text is offered as an ad hoc line BESIDE the master matches, so
    an operator never has to know that a line without an Item master record is a different kind of row.
    onType is wired only for a line already marked ad hoc, where the box edits the name it stores. */
 const typed=query.trim();
 const rows=[...matches.map(item=>({kind:'item',item})),...(onAdHoc&&typed?[{kind:'adHoc',text:typed}]:[])];
 function pick(row){if(!row)return;if(row.kind==='adHoc')onAdHoc(row.text);else onSelect(row.item);setOpen(false);setQuery('');setActive(0)}
 const move=d=>setActive(a=>Math.max(0,Math.min(a+d,rows.length-1)));
 return <div className="ivItemSearch" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery('')}}}>
 <div className="ivSearchInput"><IconSearch size={16}/><input role="combobox" aria-label={'Search item '+(index+1)} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&rows[active]?id+'-'+active:undefined} placeholder="Search or type an item…" value={open?query:line.description||''} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);onType&&onType(e.target.value)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);move(1)}if(e.key==='ArrowUp'){e.preventDefault();move(-1)}if(e.key==='Enter'&&open){e.preventDefault();pick(rows[active])}if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('')}}}/></div>
 {open&&<div id={id} role="listbox" aria-label="Matching items" className="ivItemResults">{rows.map((row,n)=>row.kind==='adHoc'?<button type="button" role="option" id={id+'-'+n} aria-selected={active===n} key="so-ad-hoc" onMouseDown={e=>e.preventDefault()} onClick={()=>pick(row)}><span className="ivAdHocOption"><IconPlus size={15}/>{'Use "'+row.text+'" as an ad hoc item'}</span></button>:<button type="button" role="option" id={id+'-'+n} aria-selected={active===n} key={row.item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(row)}><span>{row.item.name}<small>{row.item.code||row.item.unit} · ₹{row.item.price||0}</small></span></button>)}{!rows.length&&<p>No items found. Add an item in Items first.</p>}</div>}
 </div>
}

export function TaxSelection({line,intra,onChange,index}){
 const rates=lineTaxes(line,intra),percent=k=>Number(rates[k]||0),total=percent('cgst')+percent('sgst')+percent('igst');
 /* The line states the tax it carries as one rate, the way the operator sets it; the CGST/SGST/IGST
    split is the detail inside the menu, and the intra-state pair is already equal by the engine rule. */
 const summary=[total?`GST ${total}%`:'',percent('cess')?`Cess ${percent('cess')}%`:''].filter(Boolean).join(' + ')||'No tax';
 function set(key,value){onChange({...rates,[key]:value,...(key==='cgst'?{sgst:value,igst:0}:key==='sgst'?{cgst:value,igst:0}:key==='igst'?{cgst:0,sgst:0}:{})})}
 return <details className="ivTaxSelect"><summary aria-label={'Tax selection '+(index+1)}>{summary}<IconChevronDown size={14}/></summary><div className="ivTaxOptions"><p>{intra?'Intra-state: CGST and SGST are paired.':'Inter-state: select IGST.'}</p>{['cgst','sgst','igst','cess'].map(k=><label key={k}>{k==='cess'?'Cess':k.toUpperCase()} (%)<input type="number" min="0" max="100" step="0.01" aria-label={`${k.toUpperCase()} rate ${index+1}`} disabled={k==='igst'?intra:k==='cess'?false:!intra} value={rates[k]} onChange={e=>set(k,e.target.value)}/></label>)}<button type="button" onClick={()=>onChange({cgst:0,sgst:0,igst:0,cess:0})}>No tax</button></div></details>
}
