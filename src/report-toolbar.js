/* The report toolbars read their ranges from the same place the registers do, so "This week" cannot
   mean one period on the Transaction Register and another on the Sales Report.

   Two shapes of report exist and they need two different answers from a range:

   - A period report holds two dates, so a preset simply writes both of them.
   - An as-of report holds one date, so a preset writes the END of the period. A report read as of a
     date states the position at the close of it, which is why Today writes today and This month
     writes the last day of the month.

   Custom selection is offered in both shapes and never writes anything by itself: it leaves the dates
   exactly where they are and the caller opens the panel that holds them, so choosing it cannot wipe
   the range a reader is already looking at. */
import {DATE_RANGE_PRESETS,resolveDateRange} from './date-range-filter.js';

/* The word the dropdown uses for a range the reader edits by hand. */
export const CUSTOM_SELECTION='custom';
export const CUSTOM_SELECTION_LABEL='Custom selection';

/* The ranges an as-of report can offer. All dates would have to clear the one date the report reads,
   which is not a range a report can be read as of, so it is left out. */
export const asOfRangePresets=()=>DATE_RANGE_PRESETS.filter(([key])=>key!=='all');

/* The two dates a preset writes. Custom selection keeps both ends unchanged. */
export function applyRangePreset(key,from,to,today=new Date()){
 if(key===CUSTOM_SELECTION)return {from,to};
 const range=resolveDateRange(key,today);
 return {from:range.from,to:range.to};
}

/* The one date a preset writes for an as-of report. Custom selection keeps the date unchanged. */
export function applyAsOfPreset(key,date,today=new Date()){
 if(key===CUSTOM_SELECTION)return date;
 return resolveDateRange(key,today).to;
}

/* Which preset an as-of date describes, matched on the period END so a date a reader moved by hand
   reads as Custom selection rather than borrowing the name of a period it no longer closes. */
export function matchAsOfPreset(date,today=new Date()){
 for(const [key] of DATE_RANGE_PRESETS){
  if(key==='all')continue;
  if(resolveDateRange(key,today).to===date)return key;
 }
 return CUSTOM_SELECTION;
}
