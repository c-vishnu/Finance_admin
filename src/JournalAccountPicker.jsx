import {useEffect,useMemo,useRef,useState} from 'react';
import {IconChevronDown,IconSearch,IconStar,IconStarFilled,IconX} from '@tabler/icons-react';
import {matchesAccountQuery,readAccountPrefs,toggleFavouriteAccount} from './journal-templates.js';

const TYPE_ORDER=['Assets','Liabilities','Equity','Income','Expenses'];
const optionId=code=>'je-account-option-'+code;

export default function JournalAccountPicker({value,accounts,onChange,onCommit}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[prefs,setPrefs]=useState(readAccountPrefs);
 const rootRef=useRef(null),inputRef=useRef(null),list=accounts||[],selected=list.find(account=>account.code===value)||null;
 const {rows,keys}=useMemo(()=>{
  const matches=account=>matchesAccountQuery(account,query),byCode=code=>list.find(account=>account.code===code);
  const recents=(prefs.recents||[]).map(byCode).filter(account=>account&&matches(account));
  const favourites=(prefs.favourites||[]).map(byCode).filter(account=>account&&matches(account));
  const pinned=new Set([...recents,...favourites].map(account=>account.code));
  const out=[];
  if(recents.length){out.push({section:'Recent accounts'});recents.forEach(account=>out.push({account}))}
  if(favourites.length){out.push({section:'Favourite accounts'});favourites.forEach(account=>out.push({account}))}
  TYPE_ORDER.forEach(type=>{
   const group=list.filter(account=>account.type===type&&!pinned.has(account.code)&&matches(account));
   if(!group.length)return;
   out.push({section:type});
   group.forEach(account=>out.push({account}));
  });
  return {rows:out,keys:out.map((row,index)=>row.account?index:-1).filter(index=>index>=0)};
 },[list,query,prefs]);
 const focusRow=index=>{setActive(index);const row=rows[index];if(row?.account)document.getElementById(optionId(row.account.code))?.scrollIntoView({block:'nearest'})};
 const openList=()=>{setOpen(true);setQuery('');const first=keys[0]??0;setActive(first);requestAnimationFrame(()=>{inputRef.current?.focus();focusRow(first)})};
 const closeList=()=>{setOpen(false);setQuery('')};
 const select=code=>{onChange(code);onCommit?.(code);closeList()};
 const toggleStar=(event,code)=>{event.stopPropagation();event.preventDefault();setPrefs(toggleFavouriteAccount(code))};
 const onKeyDown=event=>{
  if(event.key==='Escape'){event.preventDefault();closeList();return}
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'){if(event.key==='Enter'&&rows[active]?.account){event.preventDefault();select(rows[active].account.code)}return}
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
 const activeCode=rows[active]?.account?.code;
 return <div className={'je-account-picker'+(open?' open':'')} ref={rootRef}>
  <button type="button" className="je-account-field" role="combobox" aria-expanded={open} aria-controls="je-account-listbox" aria-haspopup="listbox" aria-label={value?'Account '+selected?.name:'Search and select account'} onClick={()=>open?closeList():openList()} onKeyDown={event=>{if(!open&&(event.key==='ArrowDown'||event.key==='Enter')){event.preventDefault();openList()}}}>
   {selected?<span className="je-account-value"><b>{selected.name}</b><small>{selected.code} · {selected.type}</small></span>:<span className="je-account-placeholder">Search and select account</span>}
   <IconChevronDown size={15}/>
  </button>
  {value&&<button type="button" className="je-account-clear-button" aria-label="Clear account" onClick={()=>{onChange('');onCommit?.('')}}><IconX size={13}/></button>}
  {open&&<div className="je-account-pop">
   <label className="je-account-search"><IconSearch size={15}/><input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="je-account-listbox" aria-autocomplete="list" aria-activedescendant={activeCode?optionId(activeCode):undefined} value={query} placeholder="Search account by name, code or type" onChange={event=>{setQuery(event.target.value);setActive(keys[0]??0)}} onKeyDown={onKeyDown}/></label>
   <div className="je-account-list" id="je-account-listbox" role="listbox" aria-label="Accounts">
    {rows.map((row,index)=>{
     if(!row.account)return <p className="je-account-section" key={'section-'+row.section+'-'+index}>{row.section}</p>;
     const account=row.account,favourite=(prefs.favourites||[]).includes(account.code);
     return <div key={account.code} id={optionId(account.code)} role="option" aria-selected={account.code===value} className={'je-account-option'+(index===active?' active':'')+(account.code===value?' selected':'')} onPointerDown={event=>{event.preventDefault();select(account.code)}} onMouseEnter={()=>setActive(index)}>
      <span className="je-account-option-copy"><b>{account.name}</b><small>{account.code} · {account.type}</small></span>
      <button type="button" className={'je-account-star'+(favourite?' on':'')} aria-label={(favourite?'Remove ':'Add ')+account.name+(favourite?' from favourites':' to favourites')} onClick={event=>toggleStar(event,account.code)}>{favourite?<IconStarFilled size={14}/>:<IconStar size={14}/>}</button>
     </div>;
    })}
    {!rows.length&&<p className="je-account-empty">No account matches “{query}”.</p>}
   </div>
  </div>}
 </div>;
}
