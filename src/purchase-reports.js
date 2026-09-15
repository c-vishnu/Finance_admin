const number=value=>Number.isFinite(Number(value))?Number(value):0;

export function purchaseReportRows(bills,{from='',to='',vendor='All vendors',status='All statuses',query=''}={}){
 const needle=query.trim().toLowerCase();
 return (bills||[]).filter(bill=>{
  const matchesDate=(!from||bill.date>=from)&&(!to||bill.date<=to);
  const matchesVendor=vendor==='All vendors'||bill.vendorId===vendor;
  const matchesStatus=status==='All statuses'||bill.status===status;
  const matchesQuery=!needle||[bill.number,bill.vendorInvoice,bill.vendorName,bill.referenceOrder].join(' ').toLowerCase().includes(needle);
  return matchesDate&&matchesVendor&&matchesStatus&&matchesQuery;
 }).map(bill=>{
  const total=number(bill.total),paid=Math.min(total,number(bill.paidAmount));
  return {...bill,total,paidAmount:paid,balance:bill.status==='Cancelled'?0:Math.max(0,total-paid),inputTax:number(bill.totals?.tax)+number(bill.totals?.cess)};
 }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.number).localeCompare(String(a.number)));
}

export function purchaseReportSummary(rows){
 const active=rows.filter(row=>row.status!=='Cancelled');
 const sum=key=>active.reduce((value,row)=>value+number(row[key]),0);
 const vendors=new Map();
 for(const row of active){const id=row.vendorId||row.vendorName||'unknown',current=vendors.get(id)||{vendorId:id,vendorName:row.vendorName||'Unknown vendor',bills:0,total:0,paid:0,balance:0,inputTax:0};current.bills++;current.total+=row.total;current.paid+=row.paidAmount;current.balance+=row.balance;current.inputTax+=row.inputTax;vendors.set(id,current)}
 return {billCount:active.length,total:sum('total'),paid:sum('paidAmount'),outstanding:sum('balance'),inputTax:sum('inputTax'),vendors:[...vendors.values()].sort((a,b)=>b.total-a.total)};
}

const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
export function purchaseReportCsv(rows){return [['Bill number','Bill date','Vendor','Vendor invoice','Status','Total','Paid','Balance due','Input tax'],...rows.map(row=>[row.number,row.date,row.vendorName,row.vendorInvoice,row.status,(row.total/100).toFixed(2),(row.paidAmount/100).toFixed(2),(row.balance/100).toFixed(2),(row.inputTax/100).toFixed(2)])].map(row=>row.map(quote).join(',')).join('\n')}
