import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconBan,IconCashBanknote,IconCircleCheck,IconCopy,IconDots,IconReceiptRefund,IconRepeat} from '@tabler/icons-react';
/* The trigger, the menu and the danger row are the sales order register's own classes
   (src/sales-order-actions.css), so one register row menu looks and behaves like the other. */
import './sales-order-actions.css';

/* The invoices register row menu. It is portalled for the same reason the sales order menu is: the
   register is a `.ivScroll` (overflow:auto) box, and an absolutely positioned menu inside it would be
   clipped at the card edge. Every entry stays in the menu and is disabled with the reason the engine
   would give, rather than hidden, so the operator can see that the action exists and what has to
   happen first. Each handler is owned by the page, which is where the engine write and the shared
   dialogs live. */
export default function InvoiceRowActions({invoice,outstanding=0,onPost,onPayment,onCreditNote,onRecurring,onDuplicate,onCancel}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const cancelled=invoice.status==='Cancelled',posted=!!invoice.posted,unpaid=outstanding>0;
 /* One description of each entry: whether it applies to this invoice, and the sentence that says why
    not. The reasons mirror the engine's own refusals, so the menu never promises what the write
    would reject. */
 const items=[
  {key:'post',label:'Approve and post',icon:IconCircleCheck,run:onPost,disabled:posted||cancelled,reason:posted?'This invoice is already posted.':'Cancelled invoices cannot be posted.'},
  {key:'payment',label:'Record payment',icon:IconCashBanknote,run:onPayment,disabled:!posted||cancelled||!unpaid,reason:!posted?'Post the invoice before recording a payment.':cancelled?'Cancelled invoices cannot receive payments.':'Nothing is outstanding on this invoice.'},
  {key:'recurring',label:'Make Recurring',icon:IconRepeat,run:onRecurring,disabled:!posted||cancelled,reason:!posted?'Post the invoice before making it recurring.':'A cancelled invoice cannot be made recurring.'},
  {key:'credit',label:'Create Credit Note',icon:IconReceiptRefund,run:onCreditNote,disabled:!posted||cancelled||!unpaid,reason:!posted?'Post the invoice before raising a credit note.':cancelled?'Cancelled invoices cannot be credited.':'Nothing is left outstanding to credit.'},
  {key:'duplicate',label:'Duplicate',icon:IconCopy,run:onDuplicate,disabled:false,reason:''},
  {key:'cancel',label:'Cancel Invoice',icon:IconBan,run:onCancel,disabled:cancelled,danger:true,reason:'This invoice is already cancelled.'}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-286)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+invoice.number} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+invoice.number} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
