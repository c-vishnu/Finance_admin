import {IconDownload,IconPrinter,IconX} from '@tabler/icons-react';
import {money} from './invoice-engine.js';
import {ADJUSTMENT_TYPES,entryModeLabel,formatQuantity,storedLines} from './inventory-adjustments.js';
import './journal-preview.css';

/* The Inventory Adjustment preview.

   An inventory adjustment is an internal voucher, not a customer document, so it reuses the
   internal-document preview shell JournalPreview established (`.jp-*` from journal-preview.css
   over the shared `.dpPaper` paper) instead of the customer-facing DocumentPreview, whose
   Bill-to block and GST columns do not describe an adjustment. Nothing here recalculates the
   document: every figure is the value the engine already stored on the line. */
const date=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not recorded';
const signed=value=>{const amount=Number(value)||0;return (amount<0?'-':'+')+money(Math.abs(amount))};

export default function AdjustmentPreview({row,accountNameOf=code=>code||'Not mapped',branchNameOf=id=>id||'Not recorded',onClose=()=>{}}){
 const lines=storedLines(row),valueType=row.type===ADJUSTMENT_TYPES[1],total=lines.reduce((sum,line)=>sum+(Number(line.valueImpact)||0),0);
 const columns=valueType?['Quantity','Previous value','Value adjustment','New value']:['Previous quantity','Adjustment','New quantity','Value impact'];
 function download(){
  const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  const rows=[['Wayvida Books','Inventory Adjustment'],['Reference',row.number],['Date',row.date],['Mode of adjustment',row.type],['Entry mode',entryModeLabel(row.entryMode)],['Status',row.status],['Organisation',row.companyName||row.companyId||''],['Branch / location',row.branchName||branchNameOf(row.branchId)],['Adjustment account',accountNameOf(row.account)],['Reason',row.reason||''],['Notes',String(row.notes||'').replace(/[\r\n]+/g,' ')],[],['Item','Location',...columns],...lines.map(line=>[line.name||'',branchNameOf(line.locationId),...valueType?[formatQuantity(line.currentQty),money(line.currentValue),(Number(line.valueDelta)||0)/100,money(line.newValue)]:[formatQuantity(line.currentQty),Number(line.qtyDelta)||0,formatQuantity(line.newQty),(Number(line.valueImpact)||0)/100]]),[],['Total items',lines.length],['Value impact',total/100]];
  const url=URL.createObjectURL(new Blob([rows.map(entry=>entry.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');
  anchor.href=url;anchor.download=(row.number||'inventory-adjustment')+'.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="jp-overlay dpOverlay dpPreviewShell dpEmbedded" role="dialog" aria-modal="true" aria-labelledby="adjustment-preview-title" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
  <section className="jp-shell">
   <header className="jp-toolbar dpPreviewBar">
    <div><strong id="adjustment-preview-title">Inventory Adjustment</strong><span>{row.number}</span></div>
    <nav><button onClick={()=>window.print()}><IconPrinter size={17}/>Print</button><button onClick={download}><IconDownload size={17}/>Download</button><button onClick={onClose}><IconX size={18}/>Close</button></nav>
   </header>
   <div className="jp-preview-body dpPreviewBody"><div className="jp-canvas dpCleanCanvas">
    <article className="jp-paper dpPaper dpModern jp-modern">
     <header>
      <div><img className="jp-logo" src="/wayvida-logo-transparent.png" alt="Wayvida Books"/><h2>Business name not configured</h2><p>Inventory adjustment document</p></div>
      <div><span>INVENTORY ADJUSTMENT</span><h1>{row.number}</h1><em className={'jp-status '+String(row.status||'').toLowerCase().replaceAll(' ','-')}>{row.status}</em></div>
     </header>
     <dl className="jp-meta">
      <div><dt>Date</dt><dd>{date(row.date)}</dd></div>
      <div><dt>Mode of adjustment</dt><dd>{row.type}</dd></div>
      <div><dt>Entry mode</dt><dd>{entryModeLabel(row.entryMode)}</dd></div>
      <div><dt>Organisation</dt><dd>{row.companyName||row.companyId||'Not recorded'}</dd></div>
      <div><dt>Branch / location</dt><dd>{row.branchName||branchNameOf(row.branchId)}</dd></div>
      <div><dt>Adjustment account</dt><dd>{accountNameOf(row.account)}{row.account?<small>{row.account}</small>:null}</dd></div>
      <div><dt>Reason</dt><dd>{row.reason||'Not recorded'}</dd></div>
      <div><dt>Raised by</dt><dd>{row.createdBy||'Not recorded'}</dd></div>
     </dl>
     {row.notes&&<section className="jp-notes"><h3>Notes</h3><p>{row.notes}</p></section>}
     <table>
      <thead><tr><th>#</th><th>Item</th><th>Location</th>{columns.map(column=><th key={column}>{column}</th>)}</tr></thead>
      <tbody>{lines.map((line,index)=><tr key={line.id||index}><td>{index+1}</td><td><strong>{line.name||'Unknown item'}</strong><small>{line.sku||'No SKU'}{line.unit?' · '+line.unit:''}</small></td><td>{branchNameOf(line.locationId)}</td>{valueType?<><td>{formatQuantity(line.currentQty)}</td><td>{money(line.currentValue)}</td><td>{signed(line.valueDelta)}</td><td>{money(line.newValue)}</td></>:<><td>{formatQuantity(line.currentQty)}</td><td>{signed(line.qtyDelta)}</td><td>{formatQuantity(line.newQty)}</td><td>{signed(line.valueImpact)}</td></>}</tr>)}</tbody>
      <tfoot><tr><th colSpan="3">Totals</th><th colSpan="3">{lines.length} {lines.length===1?'item':'items'} adjusted</th><th>{signed(total)}</th></tr></tfoot>
     </table>
     <footer><span>Generated from Wayvida Books</span><strong>{row.posted?'Posted'+(row.journalId?' · journal entry created':''):'Not posted'}{' · '+row.status}</strong></footer>
    </article>
   </div></div>
  </section>
 </div>;
}
