import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconBan,IconCashBanknote,IconCircleCheck,IconDots,IconEye,IconFileInvoice,IconPrinter,IconSend} from '@tabler/icons-react';
/* The trigger and the menu are the sales order register's own classes, so this menu looks and
   behaves like the ones on the invoices and sales orders registers. */
import './sales-order-actions.css';

/* The credit notes register row menu. Portalled for the same reason the others are: the register is
   a scrolling box and an absolutely positioned menu would be clipped at the card edge. Every entry
   stays in the menu and is disabled with the sentence that says what has to happen first. Applying
   the credit stays on the detail page, because the allocation needs the customer's other invoices
   and that list is built there. */
export default function CreditNoteRowActions({note,available=0,onView,onSubmit,onApprove,onIssue,onRefund,onPrint,onCancel}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const cancelled=note.status==='Cancelled',draft=note.status==='Draft',pending=note.status==='Pending Approval',approved=note.status==='Approved',issued=note.posted&&!cancelled,credit=issued&&available>0;
 const items=[
  {key:'view',label:'View credit note',icon:IconEye,run:onView,disabled:false,reason:''},
  {key:'submit',label:'Submit for approval',icon:IconSend,run:onSubmit,disabled:!draft,reason:draft?'':'Only a draft can be submitted.'},
  {key:'approve',label:'Approve',icon:IconCircleCheck,run:onApprove,disabled:!pending,reason:pending?'':'Submit it for approval first.'},
  {key:'issue',label:'Issue credit note',icon:IconFileInvoice,run:onIssue,disabled:!approved,reason:approved?'':'Approve the credit note before issuing it.'},
  {key:'refund',label:'Refund',icon:IconCashBanknote,run:onRefund,disabled:!credit,reason:!issued?'Issue the credit note before refunding it.':credit?'':'Nothing is left to refund on this credit note.'},
  {key:'print',label:'Print preview',icon:IconPrinter,run:onPrint,disabled:false,reason:''},
  {key:'cancel',label:'Cancel credit note',icon:IconBan,run:onCancel,disabled:cancelled,danger:true,reason:'This credit note is already cancelled.'}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-330)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+note.number} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+note.number} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
