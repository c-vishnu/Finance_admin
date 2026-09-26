import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconCopy,IconDots,IconEye,IconPencil,IconTrash} from '@tabler/icons-react';
/* The trigger and the menu are the sales order register's own classes, so this menu looks and
   behaves like the ones on the invoices and sales orders registers. */
import './sales-order-actions.css';

/* The credit notes register row menu: the four document actions. The lifecycle steps - submit,
   approve, issue - and the allocation and refund stay on the detail page and the Applications tab,
   where the customer's other invoices are available. Delete is this module's cancellation: a posted
   credit note is reversed rather than erased, and the audit trail keeps the reason. */
export default function CreditNoteRowActions({note,onEdit,onPreview,onDuplicate,onDelete}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const cancelled=note.status==='Cancelled',draft=note.status==='Draft';
 const items=[
  {key:'edit',label:'Edit',icon:IconPencil,run:onEdit,disabled:!draft,reason:'Only the latest draft can be edited.'},
  {key:'preview',label:'Preview',icon:IconEye,run:onPreview,disabled:false,reason:''},
  {key:'duplicate',label:'Duplicate',icon:IconCopy,run:onDuplicate,disabled:cancelled,reason:'A cancelled credit note cannot be duplicated.'},
  {key:'delete',label:'Delete',icon:IconTrash,run:onDelete,disabled:cancelled,danger:true,reason:'This credit note is already cancelled.'}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-330)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+note.number} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+note.number} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}