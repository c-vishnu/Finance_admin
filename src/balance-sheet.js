import {normalizeAccounts} from './account-master.js';

const sectionFor=account=>{
  const nature=account.accountNature||'';
  if(account.type==='Assets')return /fixed|equipment|furniture/i.test(nature+' '+account.name)?'Fixed Assets':'Current Assets';
  if(account.type==='Liabilities')return /long|loan/i.test(nature+' '+account.name)?'Long-term Liabilities':'Current Liabilities';
  return 'Equity';
};

export function balanceSheet(state,{date='9999-12-31',branch='All'}={}){
  const books=normalizeAccounts(state),movement=new Map();
  for(const journal of books.journals||[]){
    if(journal.status&&journal.status!=='Posted'||journal.date>date)continue;
    for(const line of journal.lines||[]){
      if(branch!=='All'&&(line.branch||journal.branch||journal.branchId)!==branch)continue;
      movement.set(line.account,(movement.get(line.account)||0)+(line.debit||0)-(line.credit||0));
    }
  }
  const rows=books.accounts.filter(a=>['Assets','Liabilities','Equity'].includes(a.type)&&!a.isGroup&&a.active).map(a=>{
    const raw=movement.get(a.code)||0;
    return {...a,section:sectionFor(a),amount:a.type==='Assets'?raw:-raw};
  });
  const income=[...movement].reduce((sum,[code,value])=>books.accounts.find(a=>a.code===code)?.type==='Income'?sum-value:sum,0);
  const expenses=[...movement].reduce((sum,[code,value])=>books.accounts.find(a=>a.code===code)?.type==='Expenses'?sum+value:sum,0);
  const currentEarnings=income-expenses;
  const assets=rows.filter(a=>a.type==='Assets').reduce((sum,a)=>sum+a.amount,0);
  const liabilities=rows.filter(a=>a.type==='Liabilities').reduce((sum,a)=>sum+a.amount,0);
  const equityAccounts=rows.filter(a=>a.type==='Equity').reduce((sum,a)=>sum+a.amount,0);
  const equity=equityAccounts+currentEarnings,difference=assets-liabilities-equity;
  return {rows,currentEarnings,assets,liabilities,equity,equityAccounts,difference,balanced:Math.abs(difference)<=1};
}
