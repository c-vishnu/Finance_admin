import {useId,useState} from 'react';
import {IconSearch,IconChevronDown} from '@tabler/icons-react';
import {lineTaxes} from './invoice-tax.js';

export function ItemSearch({items,line,onSelect,index}){
 const id=useId(),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const terms=(query.toLowerCase().match(/"[^"]+"|\S+/g)||[]).map(t=>t.replaceAll('"',''));
 const matches=items.filter(i=>i.sales&&terms.every(t=>`${i.name} ${i.code||''} ${i.unit||''}`.toLowerCase().includes(t)));
 function pick(item){onSelect(item);setOpen(false);setQuery('');setActive(0)}
 return <div className="ivItemSearch" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery('')}}}>
 <div className="ivSearchInput"><IconSearch size={16}/><input role="combobox" aria-label={'Search item '+(index+1)} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?id+'-'+active:undefined} placeholder="Search items…" value={open?query:line.description||''} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,matches.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])pick(matches[active])}if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('')}}}/></div>
 {open&&<div id={id} role="listbox" aria-label="Matching items" className="ivItemResults">{matches.map((item,n)=><button type="button" role="option" id={id+'-'+n} aria-selected={active===n} key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(item)}><span>{item.name}<small>{item.code||item.unit} · ₹{item.price||0}</small></span></button>)}{!matches.length&&<p>No items found. Add an item in Items first.</p>}</div>}
 </div>
}

export function TaxSelection({line,intra,onChange,index}){
 const rates=lineTaxes(line,intra),summary=Object.entries(rates).filter(([,v])=>Number(v)>0).map(([k,v])=>`${k==='cess'?'Cess':k.toUpperCase()} ${v}%`).join(' + ')||'No tax';
 function set(key,value){onChange({...rates,[key]:value,...(key==='cgst'?{sgst:value,igst:0}:key==='sgst'?{cgst:value,igst:0}:key==='igst'?{cgst:0,sgst:0}:{})})}
 return <details className="ivTaxSelect"><summary aria-label={'Tax selection '+(index+1)}>{summary}<IconChevronDown size={14}/></summary><div className="ivTaxOptions"><p>{intra?'Intra-state: CGST and SGST are paired.':'Inter-state: select IGST.'}</p>{['cgst','sgst','igst','cess'].map(k=><label key={k}>{k==='cess'?'Cess':k.toUpperCase()} (%)<input type="number" min="0" max="100" step="0.01" aria-label={`${k.toUpperCase()} rate ${index+1}`} disabled={k==='igst'?intra:k==='cess'?false:!intra} value={rates[k]} onChange={e=>set(k,e.target.value)}/></label>)}<button type="button" onClick={()=>onChange({cgst:0,sgst:0,igst:0,cess:0})}>No tax</button></div></details>
}
