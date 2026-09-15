import {useEffect,useMemo,useRef,useState} from 'react';
import {IconCheck,IconChevronDown,IconSearch} from '@tabler/icons-react';
import {accountGroupKey,accountGroupRows,selectedAccountGroup} from './account-group-search.js';
import './account-group-picker.css';

/* Account Group picker: the same control the Journal lines account cell uses
   (src/JournalAccountPicker.jsx). One combobox button opens a searchable listbox
   grouped by account type, so a group is found by typing instead of scrolling a
   native select with optgroups. Presentation only: the chosen group still flows
   through the same applyGroup(type,purpose) path in EnterpriseAccountForm.

   Two deliberate differences from the journal picker, both because the Create
   Account / Edit Account drawer renders this field inside `label.am-field`:
   1. The search wrapper is a <div>, not a <label>. A label cannot contain
      another label, and the input is already named by aria-label.
   2. The root swallows the default action of every click inside it. A label's
      activation behaviour fires a click on its labelled control - here the
      trigger button - for clicks that land on non-interactive descendants such
      as an option row, which would reopen the list right after a selection. The
      visible `Account Group *` text stays outside this root, so clicking it
      still opens the picker through that same label association. */
const optionId=key=>'agp-option-'+key.replace(/[^a-z0-9]+/gi,'-');

export default function AccountGroupPicker({groups=[],value,onChange,disabled=false,placeholder='Search and select account group'}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const rootRef=useRef(null),inputRef=useRef(null);
 const {rows,keys}=useMemo(()=>accountGroupRows(groups,query),[groups,query]);
 const selected=useMemo(()=>selectedAccountGroup(groups,value),[groups,value]);
 const isChosen=option=>accountGroupKey(option)===String(value||'');
 const focusRow=index=>{setActive(index);const row=rows[index];if(row?.option)document.getElementById(optionId(accountGroupKey(row.option)))?.scrollIntoView({block:'nearest'})};
 const openList=()=>{setOpen(true);setQuery('');const first=keys[0]??0;setActive(first);requestAnimationFrame(()=>{inputRef.current?.focus();focusRow(first)})};
 const closeList=()=>{setOpen(false);setQuery('')};
 const select=option=>{onChange?.(accountGroupKey(option));closeList()};
 const onKeyDown=event=>{
  if(event.key==='Escape'){event.preventDefault();closeList();return}
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'){if(event.key==='Enter'&&rows[active]?.option){event.preventDefault();select(rows[active].option)}return}
  event.preventDefault();
  const position=keys.indexOf(active),next=event.key==='ArrowDown'?Math.min(position+1,keys.length-1):Math.max(position-1,0);
  if(keys.length)focusRow(keys[next]);
 };
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(rootRef.current&&!rootRef.current.contains(event.target))closeList()};
  document.addEventListener('pointerdown',away);
  return ()=>document.removeEventListener('pointerdown',away);
 },[open]);
 const activeKey=rows[active]?.option?optionId(accountGroupKey(rows[active].option)):undefined;
 return <div className={'agp'+(open?' open':'')} ref={rootRef} onClick={event=>event.preventDefault()}>
  <button type="button" className="agp-field" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="agp-listbox" aria-label={selected?'Account group '+selected.label:placeholder} disabled={disabled} onClick={()=>open?closeList():openList()} onKeyDown={event=>{if(!open&&(event.key==='ArrowDown'||event.key==='Enter')){event.preventDefault();openList()}}}>
   {selected?<span className="agp-value"><b>{selected.label}</b><span className="agp-meta">{selected.type}</span></span>:<span className="agp-placeholder">{placeholder}</span>}
   <IconChevronDown size={15}/>
  </button>
  {open&&<div className="agp-pop">
   <div className="agp-search"><IconSearch size={15}/><input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="agp-listbox" aria-autocomplete="list" aria-activedescendant={activeKey} aria-label="Search account group" value={query} placeholder="Search account group" onChange={event=>{setQuery(event.target.value);setActive(keys[0]??0)}} onKeyDown={onKeyDown}/></div>
   <div className="agp-list" id="agp-listbox" role="listbox" aria-label="Account groups">
    {rows.map((row,index)=>{
     if(!row.option)return <p className="agp-section" key={'section-'+row.section+'-'+index}>{row.section}</p>;
     const option=row.option,chosen=isChosen(option);
     return <div key={accountGroupKey(option)} id={optionId(accountGroupKey(option))} role="option" aria-selected={chosen} className={'agp-option'+(index===active?' active':'')+(chosen?' selected':'')} onPointerDown={event=>{event.preventDefault();select(option)}} onMouseEnter={()=>setActive(index)}>
      <span className="agp-option-copy"><b>{option.label}</b><span className="agp-meta">{option.purpose}</span></span>
      {chosen&&<IconCheck size={15} className="agp-check"/>}
     </div>;
    })}
    {!rows.length&&<p className="agp-empty">{query?'No account group matches \u201c'+query+'\u201d.':'No account group is available.'}</p>}
   </div>
  </div>}
 </div>;
}
