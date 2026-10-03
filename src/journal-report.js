/* Journal Report - the general journal listing of the posted ledger, one row per journal line.

   The report answers one question: what did the journal actually record in this period. It is the
   accountant's listing rather than the Day Book's voucher cards or the General Ledger's running
   balance - every posted journal line in date order with its account, debit and credit - so the two
   sides of the ledger can be read straight from the sheet. It never posts, edits, reverses or
   re-derives an entry: the lines are the ones the accounting engine already wrote, and a draft or
   unposted document has no journal at all and therefore contributes nothing.

   A reversed journal keeps its lines and is marked Reversal rather than being removed, so the debit
   and credit totals of the period always describe the ledger as it stands. The listing is
   deliberately line-level: the voucher totals are stated beside it rather than replacing it. */
import {normalizeAccounts} from './account-master.js';
import {transactionType} from './daybook-service.js';

export const ALL='All';
export const JOURNAL_STATUSES=['Posted','Reversal'];
const UNASSIGNED='Unassigned';

const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
const money=value=>Number(value)||0;
const posted=journal=>!journal.status||journal.status==='Posted';
const value=input=>input==null||input===''?UNASSIGNED:String(input);

export function journalReport(state,{from='',to='',branch=ALL,type=ALL,status=ALL,account=ALL,search=''}={}){
  const books=normalizeAccounts(state);
  const names=new Map((books.accounts||[]).map(row=>[String(row.code),row.name||'']));
  const journals=[];
  const lines=[];
  const branchSet=new Set(),typeSet=new Set();

  for(const journal of books.journals||[]){
    if(!posted(journal))continue;
    const date=String(journal.date||'');
    if(from&&date<from)continue;
    if(to&&date>to)continue;
    const type_=transactionType(journal.source);
    const status_=/Reversal/i.test(String(journal.source||''))?'Reversal':'Posted';
    if(type!==ALL&&type_!==type)continue;
    if(status!==ALL&&status_!==status)continue;
    const voucher={
      id:String(journal.id||''),
      number:journal.number||journal.reference||String(journal.id||''),
      date,
      createdAt:String(journal.createdAt||journal.id||''),
      type:type_,
      status:status_,
      source:journal.source||'Journal Entry',
      reference:journal.reference||'',
      narration:journal.narration||journal.description||'',
      lines:[],
      lineRows:[],
      debit:0,
      credit:0
    };
    for(const line of journal.lines||[]){
      const code=String(line.account||'');
      const lineBranch=value(line.branch||journal.branch||journal.branchId);
      const debit=money(line.debit),credit=money(line.credit);
      branchSet.add(lineBranch);
      typeSet.add(type_);
      voucher.lines.push(code);
      voucher.debit+=debit;
      voucher.credit+=credit;
      const row={
        date,
        createdAt:voucher.createdAt,
        journalId:voucher.id,
        number:voucher.number,
        reference:voucher.reference,
        type:type_,
        status:status_,
        source:voucher.source,
        account:code,
        accountName:names.get(code)||'Unknown account',
        particulars:line.description||voucher.narration||voucher.source,
        debit,
        credit,
        branch:lineBranch
      };
      voucher.lineRows.push(row);
      lines.push(row);
    }
    if(voucher.lines.length)journals.push(voucher);
  }

  journals.sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const order=new Map(journals.map((voucher,index)=>[voucher.id,index]));
  lines.sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||(order.get(a.journalId)-order.get(b.journalId))||a.account.localeCompare(b.account,undefined,{numeric:true}));

  const inScope=row=>account===ALL||row.account===account;
  const matches=(row,query)=>!query||[row.journalId,row.number,row.type,row.source,row.reference,row.account,row.accountName,row.particulars,row.branch].join(' ').toLowerCase().includes(query);
  const query=String(search||'').trim().toLowerCase();
  const scoped=lines.filter(inScope);
  const rows=scoped.filter(row=>matches(row,query));

  const debit=sum(rows,'debit'),credit=sum(rows,'credit');
  const vouchers=journals.filter(voucher=>voucher.lines.some(code=>account===ALL||code===account));
  const scopedDebit=sum(scoped,'debit'),scopedCredit=sum(scoped,'credit');
  const unbalanced=vouchers.filter(voucher=>voucher.debit!==voucher.credit);
  const checks=[
    {key:'debitsEqualCredits',ok:debit===credit},
    {key:'scopeBalanced',ok:scopedDebit===scopedCredit},
    {key:'everyVoucherBalanced',ok:unbalanced.length===0},
    {key:'voucherTotals',ok:vouchers.every(voucher=>voucher.debit===sum(voucher.lineRows,'debit')&&voucher.credit===sum(voucher.lineRows,'credit'))},
    {key:'noNegativeAmounts',ok:lines.every(row=>row.debit>=0&&row.credit>=0)}
  ];
  return {
    from,to,branch,type,status,account,search,
    branchOptions:[...branchSet].sort(),
    typeOptions:[...typeSet].sort(),
    accountOptions:[...new Set(lines.map(row=>row.account))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(code=>({code,name:names.get(code)||'Unknown account'})),
    journals:vouchers,
    rows,
    totals:{debit,credit,difference:debit-credit,movements:rows.length,scopedMovements:scoped.length,journals:vouchers.length,unbalanced:unbalanced.length},
    filtersActive:Boolean(from)||Boolean(to)||branch!==ALL||type!==ALL||status!==ALL||account!==ALL||Boolean(query),
    hasData:lines.length>0,
    empty:scoped.length?'':'No posted journal line matches these filters.',
    checks,valid:checks.every(check=>check.ok)
  };
}

/* The sheet the page and the export both walk: the scope the figures were produced for, the journal
   lines in date order with the period totals, then one line per journal voucher. Money leaves the
   engine in integer paise, as every other report export does, and is stated in rupees in the sheet. */
export function journalReportExportRows(report,context={}){
  const header=['Date','Journal ID','Voucher','Type','Status','Source','Reference','Account Code','Account','Particulars','Debit INR','Credit INR','Branch'];
  const row=entry=>[entry.date,entry.journalId,entry.number,entry.type,entry.status,entry.source,entry.reference,entry.account,entry.accountName,entry.particulars,entry.debit/100,entry.credit/100,entry.branch];
  const voucherHeader=['Date','Journal ID','Voucher','Type','Status','Source','Reference','Lines','Debit INR','Credit INR'];
  const voucherRow=voucher=>[voucher.date,voucher.id,voucher.number,voucher.type,voucher.status,voucher.source,voucher.reference,voucher.lines.length,voucher.debit/100,voucher.credit/100];
  return [
    ['Wayvida Books - Journal Report','Every posted journal line in the selected period.'],
    ['Organisation',context.organisation||'','Branch',report.branch===ALL?'All branches':report.branch],
    ['From',report.from||'The beginning','To',report.to||'The latest entry'],
    ['Type',report.type===ALL?'All types':report.type,'Status',report.status===ALL?'All statuses':report.status],
    ['Account',report.account===ALL?'All accounts':report.account,'Search',report.search||'None'],
    ['Generated by',context.generatedBy||'Local user','Generated at',context.generatedAt||''],
    [],
    header,
    ...report.rows.map(row),
    ['Total','','','','','','','','','',report.totals.debit/100,report.totals.credit/100,''],
    ['Difference','','','','','','','','','',report.totals.difference/100,'',''],
    [],
    voucherHeader,
    ...report.journals.map(voucherRow),
    ['Total','','','','','','',String(report.totals.journals),report.totals.debit/100,report.totals.credit/100]
  ];
}
