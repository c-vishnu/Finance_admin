import StatusPill from './StatusPill.jsx';
import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {IconArrowBackUp,IconBan,IconCopy,IconDots,IconDownload,IconEdit,IconEye,IconFileInvoice,IconPrinter} from '@tabler/icons-react';
import './sales-order-actions.css';

/* The debit notes register row menu. Portalled for the same reason the invoices, credit notes and
   sales orders menus are: the register is a scrolling box and an absolutely positioned menu would
   be clipped at the card edge. Every entry stays in the menu and is disabled with the sentence that
   says what has to happen first. */
export default function DebitNoteRowActions({note,onView,onEdit,onDuplicate,onPrint,onDownload,onJournal,onLedger,onCancel,onReverse}){
 const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
 useEffect(()=>{if(!menu)return;const close=e=>{if(!root.current?.contains(e.target)&&!trigger.current?.contains(e.target))setMenu(null)};const escape=e=>{if(e.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
 const reversed=['Reversed','Voided'].includes(note.status),cancelled=note.status==='Cancelled',posted=!!note.posted;
 const items=[
  {key:'view',label:'View',icon:IconEye,run:onView,disabled:false,reason:''},
  {key:'edit',label:'Edit',icon:IconEdit,run:onEdit,disabled:posted,reason:'A posted debit note is corrected by reversal, not by editing.'},
  {key:'duplicate',label:'Duplicate',icon:IconCopy,run:onDuplicate,disabled:false,reason:''},
  {key:'print',label:'Print',icon:IconPrinter,run:onPrint,disabled:false,reason:''},
  {key:'download',label:'Download PDF',icon:IconDownload,run:onDownload,disabled:false,reason:''},
  {key:'journal',label:'View journal',icon:IconFileInvoice,run:onJournal,disabled:!posted,reason:'Post the debit note to create its journal.'},
  {key:'ledger',label:'View ledger',icon:IconFileInvoice,run:onLedger,disabled:!posted,reason:'Post the debit note to see its ledger entries.'},
  {key:'cancel',label:'Cancel',icon:IconBan,run:onCancel,danger:true,disabled:posted||cancelled,reason:posted?'A posted debit note is reversed instead of cancelled.':'This debit note is already cancelled.'},
  {key:'reverse',label:'Reverse',icon:IconArrowBackUp,run:onReverse,danger:true,disabled:!posted||reversed,reason:reversed?'This debit note is already reversed.':'Only a posted debit note can be reversed.'}
 ];
 const open=()=>{const r=trigger.current.getBoundingClientRect();setMenu(menu?null:{top:Math.max(8,Math.min(r.bottom+5,window.innerHeight-420)),left:Math.max(8,Math.min(r.right-216,window.innerWidth-224))})};
 return <><button ref={trigger} type="button" className="soMoreButton" aria-label={'More actions for '+note.number} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={'More actions for '+note.number} style={menu}>{items.map(entry=>{const Icon=entry.icon;return <button key={entry.key} role="menuitem" className={entry.danger?'soActionDanger':undefined} disabled={entry.disabled} title={entry.disabled?entry.reason:undefined} onClick={()=>{setMenu(null);entry.run()}}><Icon size={17} aria-hidden="true"/><span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
