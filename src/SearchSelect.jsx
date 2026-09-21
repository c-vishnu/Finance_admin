import {useEffect,useMemo,useRef,useState} from 'react';
import {IconCheck,IconChevronDown,IconSearch} from '@tabler/icons-react';
import './search-select.css';

/* The one searchable picker: a `role="combobox"` trigger over a `role="listbox"` popover with a
   search field, ArrowUp / ArrowDown, Enter, Escape and an outside `pointerdown` that closes it.

   It was extracted from the Create / Edit Customer form so a screen that picks a VALUE (place of
   supply) and a screen that picks a RECORD (the customer on a sales order) share one control
   instead of a second hand-rolled dropdown. `options` therefore accepts plain strings or
   `{value,label,hint}` objects; `onChange` always receives the `value`.

   The root is a div, never a label, so a click on an option row cannot re-fire the trigger through
   label activation - keep it that way on every page that mounts it. */
export default function SearchSelect({value,options,onChange,placeholder='Search and select',error,listLabel='Options',searchLabel='Search options'}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const rootRef=useRef(null),inputRef=useRef(null);
 const items=useMemo(()=>options.map(option=>typeof option==='string'?{value:option,label:option}:option),[options]);
 const selected=items.find(item=>item.value===value)||null;
 const matches=useMemo(()=>{const needle=query.trim().toLowerCase();return needle?items.filter(item=>(item.label+' '+(item.hint||'')).toLowerCase().includes(needle)):items},[items,query]);
 const close=()=>{setOpen(false);setQuery('')};
 const openList=()=>{setOpen(true);setQuery('');setActive(0);requestAnimationFrame(()=>inputRef.current?.focus())};
 const commit=item=>{onChange(item.value);close()};
 const onKeyDown=event=>{
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key==='Enter'){event.preventDefault();if(matches[active])commit(matches[active]);return}
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
  event.preventDefault();
  setActive(index=>event.key==='ArrowDown'?Math.min(index+1,Math.max(matches.length-1,0)):Math.max(index-1,0));
 };
 useEffect(()=>{if(!open)return undefined;const away=event=>{if(rootRef.current&&!rootRef.current.contains(event.target))close()};document.addEventListener('pointerdown',away);return()=>document.removeEventListener('pointerdown',away)},[open]);
 return <div className={'customerSelect'+(open?' open':'')} ref={rootRef}>
  <button type="button" className="customerSelectTrigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="customer-select-listbox" aria-label={selected?selected.label:placeholder} aria-invalid={!!error} onClick={()=>open?close():openList()}>{selected?<span className="customerSelectValue">{selected.label}</span>:<span className="customerSelectPrompt"><IconSearch size={15}/><span className="customerSelectPlaceholder">{placeholder}</span></span>}<IconChevronDown size={15}/></button>
  {open&&<div className="customerSelectPop">
   <div className="customerSelectSearch"><IconSearch size={15}/><input ref={inputRef} aria-label={searchLabel} placeholder="Type to search" value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={onKeyDown}/></div>
   <div className="customerSelectList" id="customer-select-listbox" role="listbox" aria-label={listLabel}>
    {matches.map((item,index)=><div key={item.value} id={'customer-select-'+index} role="option" aria-selected={item.value===value} className={'customerSelectOption'+(index===active?' active':'')+(item.value===value?' selected':'')} onPointerDown={event=>{event.preventDefault();commit(item)}} onMouseEnter={()=>setActive(index)}><span className="customerSelectOptionLabel">{item.label}{item.hint&&<small>{item.hint}</small>}</span>{item.value===value&&<IconCheck size={15}/>}</div>)}
    {!matches.length&&<p className="customerSelectEmpty">{'No match for \u201c'+query+'\u201d.'}</p>}
   </div>
  </div>}
 </div>;
}
