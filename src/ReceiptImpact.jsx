import {useState} from 'react';
import {money} from './invoice-engine.js';
import {receiptJournals,receiptLedger,receiptPreview} from './receipt-insights.js';

export function JournalTables({db,journals,preview=false,receipt}){
 const name=code=>db.accounts.find(a=>a.code===code)?.name||code;
 if(!journals.length)return <p>No posted journal entries for this receipt.</p>;
 return journals.map((j,index)=><div className="receiptJournal" key={j.id}>
  <h3>{preview?`Proposed entry ${index+1}`:j.number} <small>{j.source} · {j.date}</small></h3>
  {!preview&&<p>Source document: Receipt · Voucher: {receipt?.number||j.reference} · Created by: {j.createdBy||'Not recorded'}</p>}
  <div className="ivScroll"><table><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{j.lines.map((l,i)=><tr key={i}><td>{l.account} · {name(l.account)}</td><td>{money(l.debit)}</td><td>{money(l.credit)}</td></tr>)}</tbody><tfoot><tr><th>Total</th><th>{money(j.lines.reduce((n,l)=>n+l.debit,0))}</th><th>{money(j.lines.reduce((n,l)=>n+l.credit,0))}</th></tr></tfoot></table></div>
 </div>);
}

export function AccountingImpact({db,receipt,context}){
 const result=receiptPreview(db,receipt,context);
 return <><h3>{result.preview?'Before posting':'Accounting impact'}</h3>
  {result.preview&&<p>Preview only. Nothing is posted until approval and Post receipt.</p>}
  {result.error?<p role="alert" className="ivError">{result.error}</p>:<><JournalTables db={db} journals={result.journals} preview={result.preview} receipt={receipt}/>
  <p>{receipt.kind==='Advance'?'Money received credits Customer Advance Liability. Only the allocated amount transfers to receivables.':'Money received credits customer receivables once. Allocating it to an invoice later does not post another receipt.'}</p>
  <p>Posting updates the bank/cash account and General Ledger. Drafts and previews are excluded from report balances.</p></>}
 </>;
}

export default function ReceiptImpact({db,receipt,initialTab='Customer Ledger',onNavigate}){
 const [tab,setTab]=useState(initialTab);
 const rows=receiptLedger(db,receipt,tab);
 return <><div className="itemDetailTabs ivDetailTabs receiptLedgerTabs" role="tablist" aria-label="Ledger impact views">{['Customer Ledger','Bank/Cash Ledger','Journal Entry View'].map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
 {tab==='Journal Entry View'?<JournalTables db={db} journals={receiptJournals(db,receipt)} receipt={receipt}/>:<>
 <h3>{tab==='Customer Ledger'?'Customer trade receivables':db.accounts.find(a=>a.code===receipt.bank)?.name||receipt.bank}</h3>
 <p>{tab==='Customer Ledger'?'Posted receivable movements for this customer. Advances remain in liability until allocated. Normal receipt allocation does not duplicate the credit.':'All posted movements in this bank/cash account, including other transactions.'} Balance is debit less credit; only recorded journal history is included.</p>
 <div className="ivScroll"><table><thead><tr>{['Date','Transaction Type','Voucher Number','Source Document','Reference','Account','Debit','Credit','Balance'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(l=><tr key={l.id} className={l.receiptId===receipt.id||l.journalId===receipt.journalId?'receiptCurrentRow':''}><td>{l.date}</td><td>{l.transactionType}</td><td>{l.voucherNumber}<small>{l.journalNumber}</small></td><td>{l.sourceDocument}</td><td>{l.externalReference||'—'}</td><td>{l.account}</td><td>{money(l.debit)}</td><td>{money(l.credit)}</td><td>{money(l.balance)}</td></tr>)}</tbody></table>{!rows.length&&<p>No posted movements found.</p>}</div></>}
 <div className="ivActions receiptNoPrint"><button onClick={()=>{sessionStorage.setItem('wayvida-credit-customer',receipt.customerId);onNavigate('Customer Statement')}}>Customer statement</button><button onClick={()=>onNavigate('General Ledger')}>Open General Ledger</button><button onClick={()=>onNavigate('Day Book')}>Open Day Book</button><button onClick={()=>onNavigate('Trial Balance')}>Open Trial Balance</button></div>
 </>;
}
