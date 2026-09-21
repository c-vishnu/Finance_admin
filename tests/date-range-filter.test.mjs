import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DATE_RANGE_PRESETS,resolveDateRange,matchDateRange,dateRangeLabel} from '../src/date-range-filter.js';

const day=new Date(2026,8,21);
const iso=date=>date.toLocaleDateString('en-CA');
const pages={
 'src/SalesOrders.jsx':[/(from,to)/],
 'src/InvoiceWorkspace.jsx':[/invFilters\.from/],
 'src/CreditNotes.jsx':[/(from,to)/],
 'src/Receipts.jsx':[/receiptFilters\.from/],
 'src/JournalEntriesPro.jsx':[/fromDate,toDate/],
};

test('the four ranges every register offers, resolved in one place',()=>{
 assert.deepEqual(DATE_RANGE_PRESETS,[['all','All dates'],['day','Today'],['week','This week'],['month','This month'],['year','This year']],'one list of ranges, so five pages cannot disagree about the words');
 assert.deepEqual(resolveDateRange('day',day),{from:'2026-09-21',to:'2026-09-21'},'a day is that date at both ends');
 assert.deepEqual(resolveDateRange('month',day),{from:'2026-09-01',to:'2026-09-30'},'a month is the whole calendar month, not the part of it that has happened');
 assert.deepEqual(resolveDateRange('year',day),{from:'2026-01-01',to:'2026-12-31'},'and a year is the whole calendar year');
 const week=resolveDateRange('week',day);
 assert.equal(week.from<='2026-09-21'&&week.to>='2026-09-21',true,'the week contains the date');
 assert.equal(Math.round((new Date(week.to)-new Date(week.from))/86400000),6,'and runs seven days, Monday to Sunday');
 assert.equal(new Date(week.from+'T00:00:00').getDay(),1,'starting on a Monday');
 assert.deepEqual(resolveDateRange('all',day),{from:'',to:''},'and All dates clears both ends rather than inventing a range');
});

test('the control only claims a range the dates actually describe',()=>{
 assert.equal(matchDateRange('','',day),'all','two empty dates are All dates');
 assert.equal(matchDateRange('2026-09-01','2026-09-30',day),'month','the exact month reads as This month');
 assert.equal(matchDateRange('2026-09-01','2026-09-15',day),'custom','a hand-edited range reads as custom instead of naming a period it is not');
 assert.equal(matchDateRange('2026-09-21','2026-09-21',day),'day','and an exact day reads as Today');
 assert.equal(dateRangeLabel('2026-09-01','2026-09-15',day),'Custom range','with a label for the custom case');
});

test('every panel carries the control and writes the page own dates',()=>{
 for(const [file,patterns] of Object.entries(pages)){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(source.includes("from './date-range-filter.js'"),file+' takes the shared ranges rather than its own');
  assert.ok(source.includes('<label>Date range<select aria-label="Filter by date range" value={matchDateRange('),file+' offers the control in its filter panel');
  assert.ok(source.includes("{DATE_RANGE_PRESETS.map(([value,label])=><option key={value} value={value}>{label}</option>)}{matchDateRange("),file+' lists every range, plus the custom entry only while the dates are custom');
  assert.ok(source.includes('const range=resolveDateRange(e.target.value);'),file+' resolves the range before writing it');
  for(const p of patterns)assert.match(source,p,file+' writes the dates it already filters on');
  assert.ok(!/journal\(|calculate\(/.test(source)||file!=='src/Receipts.jsx','and no page starts calculating or posting from a filter');
 }
});

test('the receipts register gained real date filtering rather than only a control',()=>{
 const source=fs.readFileSync(new URL('../src/Receipts.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("branch:'All branches',from:'',to:''}"),'both dates live in the one defaults object, so the count badge and Clear filters already cover them');
 assert.ok(source.includes("&&(!receiptFilters.from||x.date>=receiptFilters.from)&&(!receiptFilters.to||x.date<=receiptFilters.to)"),'and the register filters on them');
 assert.ok(source.includes("Object.values(receiptFilters).filter(value=>value&&!value.startsWith('All '))"),'the badge ignores the two empty dates it now holds');
 assert.ok(source.includes('<label>From<input type="date" aria-label="Filter receipts from"'),'the panel keeps explicit dates beside the ranges, as the other four panels do');
});
