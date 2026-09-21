import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconBan,IconBook2,IconDots,IconEdit,IconEye,IconReceipt} from '@tabler/icons-react';
/* The trigger and the menu are the sales order register's own classes, so this menu behaves and
   looks like the ones on the invoices, credit notes, debit notes and purchase registers. */
import './sales-order-actions.css';

export default function VendorRowActions({vendor,onView,onEdit,onTransactions,onLedger,onToggle}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const inactive=vendor.status==='Inactive';
 const items=[
  {key:'view',label:'View',icon:IconEye,run:onView,disabled:false,reason:''},
  {key:'edit',label:'Edit',icon:IconEdit,run:onEdit,disabled:false,reason:''},
  {key:'transactions',label:'View transactions',icon:IconReceipt,run:onTransactions,disabled:false,reason:''},
  {key:'ledger',label:'View ledger',icon:IconBook2,run:onLedger,disabled:false,reason:''},
  {key:'toggle',label:inactive?'Activate':'Deactivate',icon:IconBan,run:onToggle,danger:!inactive,disabled:false,reason:''}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-260)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 const label=vendor.displayName||vendor.name;
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+label} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+label} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
