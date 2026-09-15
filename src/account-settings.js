import {journal,minor} from './invoice-engine.js';
export const GST_KEYS=['cgst','sgst','igst','cess'];
export function applyAccountSettings(s,old,record,p){
  const mode=p.taxMode??old?.taxMode??'transaction';
  if(!['transaction','none','validate'].includes(mode))throw Error('Choose a valid tax configuration.');
  const rate=p.gstRate??old?.gstRate??'';
  if(mode==='validate'&&(rate===''||!Number.isFinite(Number(rate))||Number(rate)<0||Number(rate)>100))throw Error('Enter a GST rate between 0 and 100.');
  const tds=p.tds??old?.tds??{enabled:false,section:'',rate:'',account:''};
  if(tds.enabled){
    if(!tds.section?.trim()||tds.rate===''||!Number.isFinite(Number(tds.rate))||Number(tds.rate)<0||Number(tds.rate)>100)throw Error('TDS needs a section and a valid configured rate.');
    if(!s.accounts.some(a=>a.code===tds.account&&a.active&&!a.isGroup&&['Assets','Liabilities'].includes(a.type)))throw Error('Choose an active TDS receivable/payable ledger.');
  }
  const control=p.controlAccount??old?.controlAccount??false;
  if(old?.controlAccount&&!control&&s.journals.some(j=>j.lines.some(l=>l.account===old.code)))throw Error('A used control account cannot be changed to an ordinary account.');
  if(record.isGroup&&(control||tds.enabled||mode!=='transaction'))throw Error('Configure tax and control rules on posting accounts, not summary groups.');
  Object.assign(record,{taxMode:mode,gstRate:mode==='validate'?String(rate):'',tds:{enabled:!!tds.enabled,section:String(tds.section||'').trim(),rate:String(tds.rate??''),account:tds.account||''},controlAccount:!!control});
  if(p.gstMappings){
    for(const k of GST_KEYS){
      const next=p.gstMappings[k],baseline=p.mappingBaseline?.[k];
      if(next===baseline)continue;
      if(s.config[k]!==baseline)throw Error('GST mappings changed elsewhere. Reopen this account.');
      const target=next===record.code?record:s.accounts.find(a=>a.code===next);
      if(!target?.active||target.isGroup||target.type!=='Liabilities')throw Error('Output '+k.toUpperCase()+' needs an active liability posting account.');
      s.config[k]=next;
    }
  }
}
export function postOpening(state,p,external=[]){
  const s=JSON.parse(JSON.stringify(state));
  if(!p.token)throw Error('Opening request ID is required.');
  const previous=(s.openings||[]).find(o=>o.token===p.token);if(previous)return {state:s,record:previous};
  const a=s.accounts.find(a=>a.id===p.id),offset=s.accounts.find(a=>a.code===p.offset);
  if(!a?.active||a.isGroup)throw Error('Choose an active posting account.');
  if(a.revision!==p.revision)throw Error('Account changed elsewhere. Reopen it first.');
  if(!offset?.active||offset.isGroup||offset.code===a.code||offset.type!=='Equity'||offset.controlAccount)throw Error('Choose a different, active equity offset account.');
  if(a.code===s.config.ar||/receivable|payable/i.test(a.name)&&!/gst|tds|tax/i.test(a.name)||external.some(r=>r.code===a.code&&/^Customer|^Vendor/.test(r.label)))throw Error('Customer/vendor openings need subledger allocation; they cannot be posted through this general opening form.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||Number.isNaN(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date)throw Error('Choose a valid opening date.');
  if((s.openings||[]).some(o=>o.account===a.code))throw Error('An opening has already been posted for this account. Use a reviewed adjustment, not another opening.');
  if(s.journals.some(j=>j.date<p.date&&j.lines.some(l=>l.account===a.code)))throw Error('Opening date must not be after existing account activity.');
  const amount=minor(p.amount);if(!amount)throw Error('Opening balance must be greater than zero.');
  if(!['Debit','Credit'].includes(p.side))throw Error('Choose Debit or Credit.');
  if(p.side!==a.nature)throw Error(`${a.type} account ${a.code} normally requires a ${a.nature} opening balance. Use a reviewed journal for an exceptional contra balance.`);
  if(!p.reference?.trim())throw Error('Enter a reference or migration reason.');
  const debit=p.side==='Debit'?amount:0,credit=p.side==='Credit'?amount:0;
  const number='OB-'+String((s.openings||[]).length+1).padStart(4,'0');
  const j=journal(s,{number,branch:p.branch,costCentre:p.costCentre},'Opening Balance',[{account:a.code,debit,credit,description:p.reference},{account:offset.code,debit:credit,credit:debit,description:p.reference}],p.date,'opening:'+p.token);
  const record={id:crypto.randomUUID(),account:a.code,offset:offset.code,amount,side:p.side,date:p.date,reference:p.reference,token:p.token,journalId:j.id,number};
  (s.openings??=[]).push(record);(s.accountAudit??=[]).push({id:crypto.randomUUID(),accountId:a.id,action:'Opening balance posted',at:new Date().toISOString(),by:'Local user',after:record});
  return {state:s,record};
}
