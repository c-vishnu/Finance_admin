import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconBan,IconCheck,IconDots,IconEdit,IconEye,IconFileInvoice,IconSend} from '@tabler/icons-react';
/* The trigger and the menu are the sales order register's own classes, so this menu behaves and
   looks like the ones on the invoices, credit notes and sales orders registers. Portalled for the
   same reason they are: the register is a scrolling box and an absolutely positioned menu would be
   clipped at the card edge. */
import './sales-order-actions.css';

export default function PurchaseRowActions({doc,isBill,onView,onEdit,onPost,onJournal,onSend,onConvert,onCancel}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const cancelled=doc.status==='Cancelled',closed=doc.posted||['Completed','Cancelled'].includes(doc.status);
 const items=isBill?[
  {key:'view',label:'View details',icon:IconEye,run:onView,disabled:false,reason:''},
  {key:'edit',label:'Edit bill',icon:IconEdit,run:onEdit,disabled:closed,reason:doc.posted?'A posted bill is corrected by a debit note or cancellation.':'This bill is closed.'},
  {key:'post',label:'Post bill',icon:IconCheck,run:onPost,disabled:doc.posted,reason:'This bill is already posted.'},
  {key:'journal',label:'View journal',icon:IconFileInvoice,run:onJournal,disabled:!doc.posted,reason:'Post the bill to create its journal.'},
  {key:'cancel',label:'Cancel bill',icon:IconBan,run:onCancel,danger:true,disabled:cancelled,reason:'This bill is already cancelled.'}
 ]:[
  {key:'view',label:'View details',icon:IconEye,run:onView,disabled:false,reason:''},
  {key:'edit',label:'Edit order',icon:IconEdit,run:onEdit,disabled:closed,reason:'This order is closed.'},
  {key:'send',label:'Send to vendor',icon:IconSend,run:onSend,disabled:cancelled,reason:'This order is cancelled.'},
  {key:'convert',label:'Convert to bill',icon:IconFileInvoice,run:onConvert,disabled:cancelled,reason:'This order is cancelled.'},
  {key:'cancel',label:'Cancel order',icon:IconBan,run:onCancel,danger:true,disabled:cancelled,reason:'This order is already cancelled.'}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-300)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+doc.number} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+doc.number} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
