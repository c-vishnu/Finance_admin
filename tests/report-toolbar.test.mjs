import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DATE_RANGE_PRESETS,resolveDateRange,matchDateRange} from '../src/date-range-filter.js';
import {CUSTOM_SELECTION,CUSTOM_SELECTION_LABEL,applyAsOfPreset,applyRangePreset,asOfRangePresets,matchAsOfPreset} from '../src/report-toolbar.js';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const day=new Date(2026,8,29);

/* The toolbar is three components in one module: the preset control for a report that holds two
   dates, the same control for a report that reads as of one date, and the ONE Export button the
   report own exports hide behind. Every report page is listed here, so a page added later without
   the toolbar is a failing test rather than a page a reader has to learn twice. */
 const RANGE_PAGES=[
 ['src/TransactionRegister.jsx','filters.from','filters.to'],
 ['src/JournalReport.jsx','filters.from','filters.to'],
 ['src/ProfitLoss.jsx','from','to'],
 ['src/CashFlowStatement.jsx','from','to'],
 ['src/CashAndBankBook.jsx','filters.from','filters.to'],
 ['src/BankReconciliationReport.jsx','filters.from','filters.to'],
 ['src/GstTaxReports.jsx','filters.from','filters.to'],
 ['src/TdsReports.jsx','filters.from','filters.to'],
 ['src/SalesReport.jsx','filters.from','filters.to'],
 ['src/PurchaseReport.jsx','filters.from','filters.to'],
 ['src/ExpenseReport.jsx','filters.from','filters.to'],
 ];
 const AS_OF_PAGES=[
 ['src/TrialBalance.jsx','date'],
 ['src/BalanceSheet.jsx','date'],
 ['src/CustomerOutstanding.jsx','asOf'],
 ['src/SupplierOutstanding.jsx','asOf'],
 ['src/AgingReport.jsx','asOf'],
 ];
 const TOOLBAR_PAGES=[...RANGE_PAGES.map(([file])=>file),...AS_OF_PAGES.map(([file])=>file)];
 const COLLAPSED_EXPORTS=[
 'src/TransactionRegister.jsx','src/DayBook.jsx','src/JournalReport.jsx','src/ProfitLoss.jsx',
 'src/CashFlowStatement.jsx','src/CashAndBankBook.jsx','src/BankReconciliationReport.jsx','src/GstTaxReports.jsx',
 'src/TdsReports.jsx','src/SalesReport.jsx','src/PurchaseReport.jsx','src/ExpenseReport.jsx','src/TrialBalance.jsx',
 'src/CustomerOutstanding.jsx','src/SupplierOutstanding.jsx','src/AgingReport.jsx','src/BalanceSheet.jsx'
];
const SINGLE_EXPORT=[];

test('the toolbar reads its periods from the shared ranges, never its own',()=>{
 assert.deepEqual(asOfRangePresets(),[['day','Today'],['week','This week'],['month','This month'],['year','This year']],'an as-of report offers the four periods and never All dates, which would have to clear the one date it reads');
 assert.ok(DATE_RANGE_PRESETS.some(([key,label])=>key==='all'&&label==='All dates'),'a period report still offers All dates beside the named periods');
 assert.equal(CUSTOM_SELECTION,'custom','the word the control uses for a hand-edited range is the shared custom key');
 assert.equal(CUSTOM_SELECTION_LABEL,'Custom selection','and it is spelled out in the dropdown');
});

test('a preset writes the dates, and Custom selection never wipes them',()=>{
 assert.deepEqual(applyRangePreset('month','2026-01-01','2026-01-31',day),resolveDateRange('month',day),'a named period on a two-date report is exactly the shared range');
 assert.deepEqual(applyRangePreset('all','2026-01-01','2026-01-31',day),{from:'',to:''},'All dates clears both ends rather than inventing a period');
 assert.deepEqual(applyRangePreset(CUSTOM_SELECTION,'2026-01-01','2026-02-02',day),{from:'2026-01-01',to:'2026-02-02'},'choosing Custom selection keeps the dates the reader is already looking at');
 assert.equal(applyAsOfPreset('day','2026-01-01',day),'2026-09-29','Today writes today as the as-of date');
 assert.equal(applyAsOfPreset('week','2026-01-01',day),resolveDateRange('week',day).to,'This week writes the close of the week, because a report read as of a date states the position at the close of it');
 assert.equal(applyAsOfPreset('month','2026-01-01',day),'2026-09-30','This month writes the last day of the month');
 assert.equal(applyAsOfPreset('year','2026-01-01',day),'2026-12-31','and This year writes the last day of the year');
 assert.equal(applyAsOfPreset(CUSTOM_SELECTION,'2026-01-01',day),'2026-01-01','Custom selection never moves the date it was given');
});

test('the control only names the as-of period a date actually closes',()=>{
 assert.equal(matchAsOfPreset('2026-09-29',day),'day','the date itself reads as Today');
 assert.equal(matchAsOfPreset('2026-09-30',day),'month','the close of this month reads as This month');
 assert.equal(matchAsOfPreset(resolveDateRange('year',day).to,day),'year','and the close of the year reads as This year');
 assert.equal(matchAsOfPreset('2026-09-15',day),CUSTOM_SELECTION,'a date a reader moved by hand reads as Custom selection rather than borrowing a period name');
 assert.equal(matchAsOfPreset('',day),CUSTOM_SELECTION,'and so does a date the report does not hold');
 assert.equal(matchDateRange(resolveDateRange('week',day).from,resolveDateRange('week',day).to,day),'week','while a two-date report still names the exact week it holds');
});

test('every report page carries the preset control beside its search box',()=>{
 for(const [file,from,to] of RANGE_PAGES){
  const source=read(file);
  assert.ok(source.includes("from './ReportToolbar.jsx'"),file+' takes the shared toolbar rather than its own controls');
  assert.ok(source.includes('<DateRangeSelect from={'+from+'} to={'+to+'} onChange={'),file+' offers the preset dropdown over the two dates it already filters on');
  assert.ok(source.includes("onChange={(start,end)=>{set"),file+' writes the range through a handler of its own rather than restating the periods');
  assert.ok(source.includes('onCustom={()=>setFiltersOpen(true)}'),file+' opens the panel that holds the dates when Custom selection is chosen');
 }
 for(const [file,date] of AS_OF_PAGES){
  const source=read(file);
  assert.ok(source.includes("from './ReportToolbar.jsx'"),file+' takes the shared toolbar rather than its own controls');
  assert.ok(source.includes('<AsOfDateSelect date={'+date+'} onChange={value=>set'+date[0].toUpperCase()+date.slice(1)+'(value)}'),file+' offers the preset dropdown over the one date it reads');
  assert.ok(source.includes('onCustom={()=>setFiltersOpen(true)}'),file+' opens the panel that holds the date when Custom selection is chosen');
 }
 for(const file of TOOLBAR_PAGES){
  const source=read(file);
  const search=source.match(/className="[a-z][a-z-]*[Ss]earch"/);
  assert.ok(search,file+' still has a search box for the control to sit beside');
  const control=source.includes('<DateRangeSelect')?'<DateRangeSelect':'<AsOfDateSelect';
  assert.ok(source.indexOf(control)>source.indexOf(search[0]),file+' places the control beside that search box, after it in the heading row');
 }
});

test('the two export buttons are one Export button holding the same actions',()=>{
 for(const file of COLLAPSED_EXPORTS){
  const source=read(file);
  assert.ok(source.includes('<ReportExportMenu items={['),file+' renders one Export button');
  assert.ok(source.includes("Export Excel")&&source.includes("Export PDF"),file+' keeps both exports reachable behind it');
  assert.ok((source.includes('onClick:exportExcel')||source.includes('exportReport'))&&(source.includes('onClick:print')||source.includes('print')),file+' still calls the page own export handlers rather than reimplementing them');
  assert.ok(source.includes('disabled:')||source.includes('disabled={'),file+' keeps the export guard the page already had');
  assert.ok(!source.includes('>Export Excel</button>')&&!source.includes('>Export PDF</button>'),file+' no longer prints Export Excel and Export PDF as two buttons');
  assert.ok(!/onClick=\{exportExcel\}>/.test(source)&&!/onClick=\{print\}>/.test(source),file+' leaves no second copy of the old export button markup');
 }
 for(const [file,label] of SINGLE_EXPORT){
  const source=read(file);
  assert.ok(source.includes('>'+label+'</button>'),file+' keeps its single export button as a single button');
  assert.ok(!source.includes('<ReportExportMenu'),file+' does not open a dropdown of one item on a report with one export');
 }
 for(const file of TOOLBAR_PAGES){
  assert.ok(read(file).includes("from './ReportToolbar.jsx'"),file+' takes at least the preset control from the shared toolbar');
 }
});

test('the toolbar module offers the three controls and keeps them out of printouts',()=>{
 const module=read('src/ReportToolbar.jsx');
 for(const name of ['export function DateRangeSelect','export function AsOfDateSelect','export function ReportExportMenu'])assert.ok(module.includes(name),name+' is exported');
 assert.ok(module.includes("import './report-toolbar.css';"),'the control carries its own styling so twenty report pages cannot drift apart');
 assert.ok(module.includes('aria-label="Filter by date range"'),'the preset control keeps the accessible name the register filters already use');
 assert.ok(module.includes('CUSTOM_SELECTION'),'Custom selection is offered in the dropdown itself');
 assert.ok(module.includes('details.removeAttribute'),'an export action closes the menu before it runs, so the printout never contains the open menu');
 assert.ok(module.includes('matchDateRange(from,to)'),'a two-date report shows the preset it holds');
 assert.ok(module.includes('matchAsOfPreset'),'and an as-of report does the same for its one date');
 const css=read('src/report-toolbar.css');
 assert.match(css,/@media print\{[^}]*\.rptExportMenu[^}]*display:none/,'neither control prints');
 assert.match(css,/\.rptDateRange\s*\{[^}]*height:40px/,'the preset control matches the 40px report heading controls');
});
