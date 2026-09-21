import './status-pill.css';

/* The one status pill for the registers.

   Chart of Accounts (`.am-status`) and Journal Entries (`.je-status`) already draw a rounded
   tint with a 7px dot and a 12px label; this is that same shape as a shared component, so
   every other register can read the same way instead of growing its own badge. Presentation
   only: the caller keeps its own status vocabulary and maps it to a tone.

   Tones: ok (default, green), neutral, warn, info, violet, danger. An unknown tone falls back
   to the green default rather than rendering unstyled. */
const TONE_CLASS={ok:'',neutral:'neutral',warn:'warn',info:'info',violet:'violet',danger:'danger'};

export default function StatusPill({status,tone='ok',className=''}){
 if(status===undefined||status===null||status==='')return null;
 const variant=TONE_CLASS[tone]===undefined?'':TONE_CLASS[tone];
 return <span className={['statusPill',variant,className].filter(Boolean).join(' ')}><span aria-hidden="true"/>{status}</span>;
}
