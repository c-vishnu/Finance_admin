// Adapter boundary only. A server must verify webhook signatures before calling this function.
import {receiptCommand} from './receipt-engine.js';
import {outstanding} from './invoice-engine.js';
export function ingestReceiptEvent(state,event,context){
 if(!context?.verifiedPayment||event.status!=='succeeded'||event.currency!=='INR'||!event.id||!event.provider)throw Error('A verified successful INR payment event is required.');
 const key=event.provider+':'+event.id,signature=JSON.stringify([event.customerId,event.invoiceId||null,event.amount,event.date,event.bank,event.mode]);
 const previous=(state.receiptRequests||[]).find(x=>x.key===key);if(previous){if(previous.signature!==signature)throw Error('Payment event ID reused with different details.');return {state,result:state.receipts.find(r=>r.id===previous.receiptId)};}
 const i=state.invoices.find(i=>i.id===event.invoiceId);if(event.invoiceId&&(!i||i.customerId!==event.customerId||!i.posted||i.status==='Cancelled'))throw Error('Payment invoice must be posted and belong to the customer.');
 const amount=Math.round(Number(event.amount)*100),due=i?outstanding(state,i):0;
 let out=receiptCommand(state,'save',{date:event.date,customerId:event.customerId,amount:event.amount,bank:event.bank,mode:event.mode,reference:event.id,notes:'Verified integration event: '+event.provider,kind:!i||amount>due?'Advance':'Normal',allocations:i&&due>0?[{invoiceId:i.id,amount:String(Math.min(amount,due)/100)}]:[]},context);
 out=receiptCommand(out.state,'submit',{id:out.result.id},context);
 if(out.result.status==='Approved')out=receiptCommand(out.state,'post',{id:out.result.id},context);
 out.state.receiptRequests||=[];out.state.receiptRequests.push({key,signature,receiptId:out.result.id});return out;
}
export function parseBankCSV(text){
 let rows=[],row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value=''}else value+=c;}if(quoted)throw Error('CSV contains an unclosed quote.');row.push(value);if(row.some(v=>v.trim()))rows.push(row);const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').trim().toLowerCase());for(const key of ['id','date','amount','bank','reference'])if(!headers.includes(key))throw Error('CSV needs id,date,amount,bank,reference headers.');if(rows.length>1000)throw Error('Import up to 1,000 statement lines at a time.');if(!rows.length)throw Error('CSV contains no bank transactions.');return rows.map(r=>Object.fromEntries(headers.map((h,n)=>[h,(r[n]||'').trim()])));
}
