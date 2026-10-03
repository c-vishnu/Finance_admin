import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {IconDots} from '@tabler/icons-react';
/* The trigger and the panel are the register classes, so this menu looks and behaves like the ones
   on the invoices, sales orders and credit notes registers. */
import './sales-order-actions.css';

/* The row action menu both outstanding reports share. Customer Outstanding and Supplier Outstanding
   use ONE menu implementation, so the trigger, the keyboard behaviour, the placement and the look
   are identical on both reports and a row's actions can never be clipped by a narrow table. The
   trigger and the panel reuse the register classes (.soMoreButton / .soActionMenu) from
   src/sales-order-actions.css - the same menu the invoices, sales orders and credit notes registers
   open - so this report reads as the rest of the product. */
export default function OutstandingActions({label,items}){
  const [menu,setMenu]=useState(null);const trigger=useRef(null),root=useRef(null);
  useEffect(()=>{if(!menu)return;const close=event=>{if(!root.current?.contains(event.target)&&!trigger.current?.contains(event.target))setMenu(null)};const escape=event=>{if(event.key==='Escape'){setMenu(null);trigger.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);window.addEventListener('resize',close);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);window.removeEventListener('resize',close)}},[menu]);
  const open=()=>{const rect=trigger.current.getBoundingClientRect(),height=items.length*40+12;setMenu(menu?null:{top:Math.max(8,Math.min(rect.bottom+5,window.innerHeight-height-8)),left:Math.max(8,Math.min(rect.right-216,window.innerWidth-224))})};
  return <><button ref={trigger} type="button" className="soMoreButton" aria-label={label} aria-haspopup="menu" aria-expanded={!!menu} onClick={open}><IconDots size={18}/></button>{menu&&createPortal(<div ref={root} className="soActionMenu" role="menu" aria-label={label} style={menu}>{items.map((entry,index)=>{const Icon=entry.icon;return <button key={entry.key||index} type="button" role="menuitem" className={entry.danger?'soActionDanger':undefined} onClick={()=>{setMenu(null);entry.run()}}>{Icon?<Icon size={17} aria-hidden="true"/>:null}<span>{entry.label}</span></button>})}</div>,window.document.body)}</>;
}
