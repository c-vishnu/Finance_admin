/* The two controls every report toolbar shows, in one place so twenty report pages cannot drift.

   DateRangeSelect sits beside the search box and the Filters button on a report that holds two dates
   - From and To - and writes them through the shared presets. AsOfDateSelect is the same control for
   the reports that read as of a single date. ReportExportMenu turns the export buttons a report used
   to print side by side into ONE button that opens the same actions, so the action row keeps its
   length however many exports a report grows.

   All three write only through the props they are given, so every page keeps its own filter state,
   its own count badge, its own Clear filters row and its own disabled logic untouched. */
import {useState} from 'react';
import {IconCalendar,IconChevronDown,IconDownload} from '@tabler/icons-react';
import {DATE_RANGE_PRESETS,matchDateRange} from './date-range-filter.js';
import {CUSTOM_SELECTION,CUSTOM_SELECTION_LABEL,applyAsOfPreset,applyRangePreset,asOfRangePresets,matchAsOfPreset} from './report-toolbar.js';
import './report-toolbar.css';

/* The preset a reader picked is shown exactly while the dates still describe it. Custom selection is
   remembered against the dates that were held when it was picked, so the control never snaps back to
   a named period the moment the reader chooses to edit the dates by hand - and it forgets that
   choice as soon as the dates move, or as soon as a named period is picked again. */
function formatShortDate(val) {
 if (!val) return '';
 return new Date(val + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DateRangeSelect({from,to,onChange,onCustom}){
 const [showPopover,setShowPopover]=useState(false);
 const matchedKey=matchDateRange(from,to);
 const preset=showPopover?CUSTOM_SELECTION:matchedKey;

 const pick=event=>{
  const key=event.target.value;
  if(key===CUSTOM_SELECTION){
   setShowPopover(true);
   if(onCustom)onCustom();
   return;
  }
  setShowPopover(false);
  const range=applyRangePreset(key,from,to);
  onChange(range.from,range.to);
 };

 const customLabel = (from && to) ? `${formatShortDate(from)} – ${formatShortDate(to)}` : CUSTOM_SELECTION_LABEL;

 return <div className="rptDateRangeGroup">
  <div className="rptDateRange">
   <IconCalendar size={19} style={{cursor:preset===CUSTOM_SELECTION?'pointer':'default'}} onClick={()=>{if(preset===CUSTOM_SELECTION)setShowPopover(s=>!s)}}/>
   <select aria-label="Filter by date range" value={preset} onChange={pick}>
    {DATE_RANGE_PRESETS.map(([value,text])=><option key={value} value={value}>{text}</option>)}
    <option value={CUSTOM_SELECTION}>{customLabel}</option>
   </select>
  </div>
  {showPopover&&<div className="rptCustomDatePopover">
   <label>Date from<input type="date" aria-label="Date from" value={from||''} onChange={e=>onChange(e.target.value,to)}/></label>
   <label>Date to<input type="date" aria-label="Date to" value={to||''} onChange={e=>onChange(from,e.target.value)}/></label>
   <div className="rptCustomDateActions"><button type="button" onClick={()=>setShowPopover(false)}>Done</button></div>
  </div>}
 </div>;
}

export function AsOfDateSelect({date,onChange,onCustom}){
 const [held,setHeld]=useState(null);
 const pick=event=>{
  const key=event.target.value;
  if(key===CUSTOM_SELECTION){setHeld(date);if(onCustom)onCustom();return}
  setHeld(null);
  onChange(applyAsOfPreset(key,date));
 };
 const customLabel = date ? `As of ${formatShortDate(date)}` : CUSTOM_SELECTION_LABEL;
 return <div className="rptDateRange"><IconCalendar size={19}/><select aria-label="Filter as of date" value={held===date?CUSTOM_SELECTION:matchAsOfPreset(date)} onChange={pick}>{asOfRangePresets().map(([value,text])=><option key={value} value={value}>{text}</option>)}<option value={CUSTOM_SELECTION}>{customLabel}</option></select></div>;
}

/* One Export button with the report own exports behind it. A report with a single export keeps the
   single button, because a dropdown of one item is a control the reader has to open to learn
   nothing. Every action closes the menu before it runs, so the printout a PDF or Print export
   produces never contains the open menu. */
export function ReportExportMenu({items,label:caption,ariaLabel='Export options'}){
 const run=item=>event=>{
  const details=event.currentTarget.closest('details');
  if(details)details.removeAttribute('open');
  item.onClick();
 };
 if(items.length===1)return <button type="button" className="rptExportSingle" disabled={items[0].disabled} onClick={items[0].onClick}>{items[0].icon}{items[0].label}</button>;
 return <details className="rptExportMenu"><summary aria-label={ariaLabel}><IconDownload size={19}/>{caption||'Export'}<IconChevronDown size={16}/></summary><div className="rptExportList" role="menu">{items.map(item=><button key={item.key} type="button" role="menuitem" disabled={item.disabled} onClick={run(item)}>{item.icon}{item.label}</button>)}</div></details>;
}
