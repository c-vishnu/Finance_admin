/* Customer Aging and Supplier Aging - ONE read-only aging grid over the receivables and payables
   subledgers the accounting engine already writes.

   Aging is a RESTATEMENT of Customer Outstanding and Supplier Outstanding, never a second
   subledger. Every figure comes from src/customer-outstanding.js and src/supplier-outstanding.js,
   which own the aging vocabulary and assign each document its bucket from that document's own due
   date; this module only turns the party list into the grid an accountant reads - one row per party,
   one column per bucket - so the bucket columns of a party always add up to exactly the balance the
   outstanding report states for it. Nothing here posts, edits, reverses or re-derives a balance, and
   a bucket is a range of DAYS PAST DUE, never a range of document age. */
import {AGING_BUCKETS,AGING_KEYS,customerOutstanding} from './customer-outstanding.js';
import {AGING_KEYS as PAYABLE_AGING_KEYS,supplierOutstanding} from './supplier-outstanding.js';

/* The two subledgers must age on the same vocabulary, or a customer and a supplier could be counted
   in different buckets. The keys are compared once here rather than assumed. */
const SAME_AGING_VOCABULARY=AGING_KEYS.join('|')===PAYABLE_AGING_KEYS.join('|');

export {AGING_BUCKETS,AGING_KEYS};
export const ALL='All';
/* The buckets that are actually overdue. Not Yet Due and Due Today are still inside the terms, so
   they are stated in the grid but never in the overdue figure. */
export const OVERDUE_KEYS=AGING_KEYS.filter(key=>key!=='notDue'&&key!=='dueToday');

const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
const money=value=>Number(value)||0;

function bucketTotals(rows,keys){return Object.fromEntries(keys.map(key=>[key,rows.reduce((total,row)=>total+money(row.buckets[key]),0)]))}

/* One grid, two subledgers. The party list, the bucket amounts and the aging filter all come from the
   outstanding projection; the only new arithmetic is the column totals and the invariants that prove
   the grid and the subledger are the same money. */
function agingGrid(source,{kind,partyLabel,documentLabel,partyKey,documentKey,optionKey}){
  const entries=source[partyKey]||[];
  const rows=entries.map(entry=>({
    id:String(entry.id),
    code:entry.code||'',
    name:entry.name||'',
    documents:Number(entry[documentKey])||0,
    total:money(entry.outstanding),
    overdue:money(entry.overdue),
    dueToday:money(entry.dueToday),
    notYetDue:money(entry.notYetDue),
    buckets:Object.fromEntries(AGING_KEYS.map(key=>[key,money(entry.buckets?.[key])])),
    agingAmount:money(entry.agingAmount),
    documents_:entry.rows||[]
  }));
  const totals={
    parties:rows.length,
    documents:sum(rows,'documents'),
    total:sum(rows,'total'),
    overdue:sum(rows,'overdue'),
    dueToday:sum(rows,'dueToday'),
    notYetDue:sum(rows,'notYetDue'),
    buckets:bucketTotals(rows,AGING_KEYS)
  };
  totals.overdueAmount=OVERDUE_KEYS.reduce((total,key)=>total+totals.buckets[key],0);
  const buckets=AGING_BUCKETS.map(bucket=>({...bucket,amount:totals.buckets[bucket.key],parties:rows.filter(row=>row.buckets[bucket.key]>0).length}));
  const largest=buckets.reduce((best,bucket)=>bucket.amount>best.amount?bucket:best,buckets[0]);
  const checks=[
    {key:'sameAgingVocabulary',ok:SAME_AGING_VOCABULARY},
    {key:'gridTotal',ok:totals.total===money(source.totals?.outstanding)},
    {key:'bucketColumns',ok:AGING_KEYS.reduce((total,key)=>total+totals.buckets[key],0)===totals.total},
    {key:'rowBucketColumns',ok:rows.every(row=>AGING_KEYS.reduce((total,key)=>total+row.buckets[key],0)===row.total)},
    {key:'overdueIsPastDue',ok:totals.overdueAmount===AGING_KEYS.filter(key=>key!=='notDue'&&key!=='dueToday').reduce((total,key)=>total+totals.buckets[key],0)},
    {key:'noNegative',ok:rows.every(row=>row.total>=0&&AGING_KEYS.every(key=>row.buckets[key]>=0))},
    {key:'subledgerValid',ok:source.valid!==false}
  ];
  return {
    kind,partyLabel,documentLabel,
    buckets,keys:AGING_KEYS,
    asOf:source.asOf,branch:source.branch,search:source.search,aging:source.aging,
    branchOptions:source.branchOptions||[],
    partyOptions:source[optionKey]||[],
    rows,
    totals:{...totals,largestBucket:largest?largest.key:'',largestAmount:largest?largest.amount:0,largestLabel:largest?largest.label:''},
    source,
    hasData:rows.length>0,
    checks,valid:checks.every(check=>check.ok)
  };
}

/* Customer aging: what each customer owes, split by how far past its due date each invoice is. */
export function customerAging(books,customers=[],filters={}){
  return agingGrid(customerOutstanding(books,customers,filters),{kind:'customer',partyLabel:'Customer',documentLabel:'Invoice',partyKey:'customers',documentKey:'invoices',optionKey:'customerOptions'});
}

/* Supplier aging: the same grid on the payable side. */
export function supplierAging(books,vendors=[],filters={}){
  return agingGrid(supplierOutstanding(books,vendors,filters),{kind:'supplier',partyLabel:'Supplier',documentLabel:'Bill',partyKey:'suppliers',documentKey:'bills',optionKey:'supplierOptions'});
}

/* The sheet the page and the export both walk: the scope the figures were produced for, then one line
   per party with the money it holds in each bucket and its whole open balance, then the column totals
   and the document detail each bucket was built from. Money leaves the engine in integer paise, as
   every other report export does, and is stated in rupees in the sheet. */
export function agingExportRows(report,context={}){
  const header=[report.partyLabel,report.partyLabel+' ID',report.documentLabel+'s',...AGING_BUCKETS.map(bucket=>bucket.label+' INR'),'Total INR'];
  const partyRow=row=>[row.name,row.code,row.documents,...AGING_KEYS.map(key=>row.buckets[key]/100),row.total/100];
  const detailHeader=[report.partyLabel,report.documentLabel+' Number','Date','Due Date','Amount INR','Outstanding INR','Status','Days Overdue','Aging Bucket'];
  const detailRow=(row,document)=>[row.name,document.number,document.date,document.dueDate,document.total/100,document.outstanding/100,document.status,document.daysOverdue,(AGING_BUCKETS.find(bucket=>bucket.key===document.bucket)||{}).label||document.bucket];
  return [
    ['Wayvida Books - '+report.partyLabel+' Aging','How long the money has been outstanding, by due date.'],
    ['Organisation',context.organisation||'','Branch',report.branch===ALL?'All branches':report.branch],
    ['As of',report.asOf,report.partyLabel,context.party&&context.party!==ALL?context.party:'All'],
    ['Aging filter',report.aging===ALL?'All aging buckets':((AGING_BUCKETS.find(bucket=>bucket.key===report.aging)||{}).label||report.aging),'Parties',String(report.totals.parties)],
    ['Generated by',context.generatedBy||'Local user','Generated at',context.generatedAt||''],
    [],
    header,
    ...report.rows.map(partyRow),
    ['Total','',report.totals.documents,...AGING_KEYS.map(key=>report.totals.buckets[key]/100),report.totals.total/100],
    [],
    ['Largest bucket',report.totals.largestLabel,'Overdue (past due date)',report.totals.overdueAmount/100],
    ['Not Yet Due',report.totals.buckets.notDue/100,'Due Today',report.totals.buckets.dueToday/100],
    [],
    detailHeader,
    ...report.rows.flatMap(row=>row.documents_.map(document=>detailRow(row,document)))
  ];
}
