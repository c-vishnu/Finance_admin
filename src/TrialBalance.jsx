import {Fragment,useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconFileSpreadsheet,IconFileTypePdf,IconInfoCircle,IconRefresh,IconSearch,IconLayoutSidebar} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money,today} from './invoice-engine.js';
import {trialBalance,trialBalanceExportRows,TRIAL_BALANCE_TYPES} from './trial-balance.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {demoOrganizations} from './demo-organisations.js';
import {useExperienceMode} from './ExperienceModeContext.jsx';
import EmptyState from './EmptyState.jsx';
import './trial-balance.css';
import {AsOfDateSelect,ReportExportMenu} from './ReportToolbar.jsx';

const reportSeed={Assets:[['1000','Cash'],['1010','Bank'],['1100','Accounts Receivable'],['1200','Inventory'],['1300','Equipment'],['1310','Furniture']],Liabilities:[['2000','Accounts Payable'],['2100','GST Payable'],['2300','Loans']],Equity:[['3000','Capital'],['3200','Retained Earnings']],Income:[['4000','Sales'],['4100','Service Income']],Expenses:[['5000','Purchases'],['5100','Salary'],['5200','Rent']]};
const ALL='All';

export default function TrialBalance({seed,notify,onNavigate}){
  const {isEasy} = useExperienceMode();
  const [revision,setRevision]=useState(0);
  const [date,setDate]=useState(today());
  const [branch,setBranch]=useState(ALL);
  const [type,setType]=useState(ALL);
  const [account,setAccount]=useState(ALL);
  const [search,setSearch]=useState('');
  const [includeZero,setIncludeZero]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [stamp,setStamp]=useState(()=>new Date());

  const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
  const organization=demoOrganizations.find(x=>x.id===localStorage.getItem('wayvida-demo-company'))||demoOrganizations[0],branches=organization.branches||[];

  useEffect(()=>{
    const refresh=()=>setRevision(x=>x+1);
    window.addEventListener('wayvida-accounts-updated',refresh);
    window.addEventListener('storage',refresh);
    return()=>{
      window.removeEventListener('wayvida-accounts-updated',refresh);
      window.removeEventListener('storage',refresh);
    };
  },[]);

  const {book,error}=useMemo(()=>{
    try{return {book:readAccounts(seed||reportSeed),error:''}}
    catch(e){return {book:{accounts:[],journals:[]},error:e.message}}
  },[seed,revision]);

  const report=useMemo(()=>trialBalance(book,{date,branch,account,accountType:type,search:deferredSearch,includeZero}),[book,date,branch,account,type,deferredSearch,includeZero]);
  
  const analytics=useMemo(()=>{
    let assetsDebit=0, liabCredit=0, equityCredit=0, incomeCredit=0, expensesDebit=0;
    (report.sections||[]).forEach(sec=>{
      const t=(sec.label||'').toLowerCase();
      if(t==='assets') assetsDebit=sec.debit||0;
      else if(t==='liabilities') liabCredit=sec.credit||0;
      else if(t==='equity') equityCredit=sec.credit||0;
      else if(t==='income') incomeCredit=sec.credit||0;
      else if(t==='expenses') expensesDebit=sec.debit||0;
    });
    const totalVolume = (report.debit||0) + (report.credit||0);
    const assetsPct = totalVolume ? ((assetsDebit / totalVolume) * 100) : 0;
    const liabPct = totalVolume ? ((liabCredit / totalVolume) * 100) : 0;
    const equityPct = totalVolume ? ((equityCredit / totalVolume) * 100) : 0;
    const incomePct = totalVolume ? ((incomeCredit / totalVolume) * 100) : 0;
    const expensesPct = totalVolume ? ((expensesDebit / totalVolume) * 100) : 0;
    return {
      assetsDebit, liabCredit, equityCredit, incomeCredit, expensesDebit,
      assetsPct, liabPct, equityPct, incomePct, expensesPct, totalVolume
    };
  },[report]);

  const selected=(()=>{try{return sessionStorage.getItem('wayvida-open-account')||''}catch{return ''}})();

  function reset(){setDate(today());setBranch(ALL);setType(ALL);setAccount(ALL);setSearch('');setIncludeZero(false)}
  function refresh(){setRevision(x=>x+1);setStamp(new Date())}

  function openLedger(row){
    if(!row||!row.code)return;
    try{
      sessionStorage.setItem('wayvida-open-account',row.code);
      sessionStorage.setItem('wayvida-ledger-asof',date);
      sessionStorage.setItem('wayvida-ledger-to',date);
      sessionStorage.setItem('wayvida-ledger-branch',branch);
    }catch{}
    if(onNavigate)onNavigate('General Ledger');
  }

  function exportExcel(){
    const content=[...printMeta(),...trialBalanceExportRows(report,{date,branch,accountType:type,account,search:deferredSearch})];
    downloadReport(excelReport(content),'wayvida-trial-balance.xml','application/xml;charset=utf-8');
  }

  function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

  function printMeta(){
    return [
      ['Wayvida Books · Trial Balance','Posted accounting entries only'],
      ['Organisation',organization.name],
      ['Branch',branch===ALL?'All branches':branch],
      ['As of',date],
      ['Account type',type===ALL?'All account types':type],
      ['Account',account===ALL?'All accounts':account],
      ['Search',search||'None'],
      ['Include zero-balance accounts',includeZero?'Yes':'No'],
      ['Accounts shown',String(report.accounts)],
      ['Total debit',money(report.debit)],
      ['Total credit',money(report.credit)],
      ['Difference',money(Math.abs(report.difference))],
      ['Generated by Local user',stamp.toLocaleString()]
    ];
  }

  const activeFilters=[branch!==ALL,type!==ALL,account!==ALL,includeZero].filter(Boolean).length;

  const renderRow=(accountItem,index)=>(
    <tr key={accountItem.code||index} className={`tbAccountRow ${selected===accountItem.code?'selected':''}`}>
      <td className="tbAccountCell">
        <button type="button" className="tbAccountBtn" onClick={()=>openLedger(accountItem)} aria-label={`Open General Ledger for ${accountItem.code} ${accountItem.name}`}>
          <span className="tbCode">{accountItem.code}</span>
          <span className="tbSep"> · </span>
          <span className="tbAccountName">{accountItem.name}</span>
        </button>
      </td>
      <td className="tbMoney">{accountItem.debitBalance ? money(accountItem.debitBalance) : '—'}</td>
      <td className="tbMoney">{accountItem.creditBalance ? money(accountItem.creditBalance) : '—'}</td>
    </tr>
  );

  const renderGroup=item=>(
    <Fragment key={item.name}>
      {item.name!==item.sectionType && (
        <tr className="tbGroup">
          <th colSpan="3" scope="rowgroup">{item.name}</th>
        </tr>
      )}
      {item.rows.map(renderRow)}
      <tr className="tbGroupTotal">
        <td className="tbSubtotalLabel">{item.name} subtotal</td>
        <td className="tbMoney">{money(item.debit)}</td>
        <td className="tbMoney">{money(item.credit)}</td>
      </tr>
    </Fragment>
  );

  const renderSection=item=>(
    <Fragment key={item.type}>
      <tr className="tbSection">
        <th colSpan="3" scope="rowgroup">{item.label.toUpperCase()}</th>
      </tr>
      {item.groups.map(group=>({...group,sectionType:item.label})).map(renderGroup)}
      <tr className="tbTypeTotal">
        <td className="tbMajorTotalLabel">TOTAL {item.label.toUpperCase()}</td>
        <td className="tbMoney">{money(item.debit)}</td>
        <td className="tbMoney">{money(item.credit)}</td>
      </tr>
    </Fragment>
  );

  return (
    <section className="tbPage" aria-busy={busy}>
      {/* 1. Page Header */}
      <header className="tbHead">
        <div className="tbHeadTitle">
          <h1>Trial Balance</h1>
          <p>View debit and credit balances for all ledger accounts as of a selected date.</p>
        </div>
        <div className="tbHeadActions">
          <label className="tbSearch">
            <IconSearch size={18} aria-hidden="true"/>
            <input aria-label="Search accounts" placeholder="Search accounts..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          <AsOfDateSelect date={date} onChange={value=>setDate(value)} onCustom={()=>setFiltersOpen(true)}/>
          <details className="tbFiltersMore" open={filtersOpen} onToggle={e=>setFiltersOpen(e.currentTarget.open)}>
            <summary aria-label="Open filters">
              <IconAdjustments size={18} aria-hidden="true"/>Filters{activeFilters>0&&<span>{activeFilters}</span>}
            </summary>
            <div className="tbFilters">
              <label>As of<input type="date" aria-label="As of date" value={date} onChange={e=>setDate(e.target.value)}/></label>
              <label>Branch
                <select aria-label="Branch" value={branch} onChange={e=>setBranch(e.target.value)}>
                  <option value={ALL}>All branches</option>
                  {branches.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <label>Account
                <select aria-label="Account" value={account} onChange={e=>setAccount(e.target.value)}>
                  <option value={ALL}>All accounts</option>
                  {report.chart.map(item=><option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
                </select>
              </label>
              <label>Account type
                <select aria-label="Account type" value={type} onChange={e=>setType(e.target.value)}>
                  <option value={ALL}>All account types</option>
                  {TRIAL_BALANCE_TYPES.map(item=><option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="tbCheck">
                <input type="checkbox" checked={includeZero} onChange={e=>setIncludeZero(e.target.checked)}/>
                Include zero-balance accounts
              </label>
              <div className="tbFilterActions">
                <button type="button" onClick={refresh}><IconRefresh size={15} aria-hidden="true"/>Refresh</button>
                <button type="button" onClick={reset}>Clear filters</button>
              </div>
            </div>
          </details>
          <ReportExportMenu items={[
            {key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={18} aria-hidden="true"/>,onClick:exportExcel,disabled:!report.accounts},
            {key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={18} aria-hidden="true"/>,onClick:print,disabled:!report.accounts}
          ]}/>
        </div>
      </header>

      {error&&<div className="tbError" role="alert"><IconAlertTriangle size={18} aria-hidden="true"/><span>{error}</span></div>}
      <div className="tbPrintMeta">{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>

      {/* 2. Report Grid Layout (60% Left Table, 40% Right Insights) */}
      <div className="tbReportLayout withPanel">
        <div className="tbMainColumn">
          <div className="tbStatementCard">
            <div className="tbTableScroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="tbAccountHead">ACCOUNT</th>
                    <th
                      scope="col"
                      className="tbMoneyHead"
                      title={isEasy ? "Balances normally associated with assets and expenses." : undefined}
                    >
                      DEBIT {isEasy && <span style={{fontSize: '11px', fontWeight: 'normal', opacity: 0.75}}>ⓘ</span>}
                    </th>
                    <th
                      scope="col"
                      className="tbMoneyHead"
                      title={isEasy ? "Balances normally associated with liabilities, equity and income." : undefined}
                    >
                      CREDIT {isEasy && <span style={{fontSize: '11px', fontWeight: 'normal', opacity: 0.75}}>ⓘ</span>}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.map(renderSection)}
                  {!report.accounts && (
                    <tr className="emptyStateRow">
                      <td colSpan="3" className="emptyStateCell">
                        <EmptyState variant="journal" title="No ledger balances found" description="Try another date or change the selected filters." actionLabel="Reset filters" onAction={reset}/>
                      </td>
                    </tr>
                  )}
                </tbody>
                {report.accounts > 0 && (
                  <tfoot>
                    <tr className="tbGrandTotal">
                      <td className="tbGrandTotalLabel">GRAND TOTAL</td>
                      <td className="tbMoney">{money(report.debit)}</td>
                      <td className="tbMoney">{money(report.credit)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {!report.balanced && report.accounts > 0 && (
            <div className="tbMismatchWarning" role="alert">
              <IconAlertTriangle size={18} aria-hidden="true"/>
              <span>Trial Balance is out of balance by {money(Math.abs(report.difference))}</span>
            </div>
          )}
        </div>

        {/* Right Side Inline Insights Panel (40% width) */}
        <aside className="tbSidePanel" aria-label="Trial Balance Insights">
            <div className="tbDrawerHead">
              <div>
                <h3>Debit &amp; Credit Insights</h3>
                <p className="tbDrawerSub">Balance distribution across 5 account categories</p>
              </div>
            </div>

            <div className="tbCompBar" aria-hidden="true">
              {analytics.assetsPct > 0 && (
                <div className="tbCompSeg segAssets" style={{width:`${analytics.assetsPct}%`}} title={`Assets: ${analytics.assetsPct.toFixed(1)}%`}/>
              )}
              {analytics.liabPct > 0 && (
                <div className="tbCompSeg segLiab" style={{width:`${analytics.liabPct}%`}} title={`Liabilities: ${analytics.liabPct.toFixed(1)}%`}/>
              )}
              {analytics.equityPct > 0 && (
                <div className="tbCompSeg segEquity" style={{width:`${analytics.equityPct}%`}} title={`Equity: ${analytics.equityPct.toFixed(1)}%`}/>
              )}
              {analytics.incomePct > 0 && (
                <div className="tbCompSeg segIncome" style={{width:`${analytics.incomePct}%`}} title={`Income: ${analytics.incomePct.toFixed(1)}%`}/>
              )}
              {analytics.expensesPct > 0 && (
                <div className="tbCompSeg segExpenses" style={{width:`${analytics.expensesPct}%`}} title={`Expenses: ${analytics.expensesPct.toFixed(1)}%`}/>
              )}
            </div>

            <ul className="tbCompList">
              <li className="tbCompItem">
                <span className="tbCompLabel"><span className="tbCompDot dotAssets"/>Assets (Debit)</span>
                <strong className="tbCompVal">{money(analytics.assetsDebit)}</strong>
              </li>
              <li className="tbCompItem">
                <span className="tbCompLabel"><span className="tbCompDot dotLiab"/>Liabilities (Credit)</span>
                <strong className="tbCompVal">{money(analytics.liabCredit)}</strong>
              </li>
              <li className="tbCompItem">
                <span className="tbCompLabel"><span className="tbCompDot dotEquity"/>Equity (Credit)</span>
                <strong className="tbCompVal">{money(analytics.equityCredit)}</strong>
              </li>
              <li className="tbCompItem">
                <span className="tbCompLabel"><span className="tbCompDot dotIncome"/>Income (Credit)</span>
                <strong className="tbCompVal">{money(analytics.incomeCredit)}</strong>
              </li>
              <li className="tbCompItem">
                <span className="tbCompLabel"><span className="tbCompDot dotExpenses"/>Expenses (Debit)</span>
                <strong className="tbCompVal">{money(analytics.expensesDebit)}</strong>
              </li>
              <li className="tbCompItem highlight">
                <span className="tbCompLabel"><span className="tbCompDot dotTotal"/>Total Volume (Dr + Cr)</span>
                <strong className="tbCompVal">{money(analytics.totalVolume)}</strong>
              </li>
            </ul>

            <div className="tbContextDivider"/>

            <div className="tbMetricsBlock">
              <span className="tbNotesTitle">VERIFICATION STATUS</span>
              <div className="tbMetricItem">
                <span className="tbMetricLabel">Double-Entry Status</span>
                <strong className={`tbMetricVal ${report.balanced ? 'statusBalanced' : 'statusOut'}`}>
                  {report.balanced ? '✓ Balanced' : '⚠️ Out of Balance'}
                </strong>
              </div>
              <div className="tbMetricItem">
                <span className="tbMetricLabel">Imbalance Difference</span>
                <strong className="tbMetricVal">{money(Math.abs(report.difference))}</strong>
              </div>
              <div className="tbMetricItem">
                <span className="tbMetricLabel">Included Accounts</span>
                <strong className="tbMetricVal">{report.accounts}</strong>
              </div>
            </div>

            <div className="tbContextDivider"/>

            <div className="tbReportNotes">
              <span className="tbNotesTitle">REPORT NOTES</span>
              <ul>
                <li>• As of selected accounting date</li>
                <li>• Double-entry debit = credit verification</li>
                <li>• Unposted &amp; draft entries excluded</li>
                <li>• All ledger balances reconciled</li>
              </ul>
            </div>
          </aside>
        </div>

      {/* 4. Footer / About Report Section */}
      <details className="tbAboutReport">
        <summary>
          <IconInfoCircle size={16} aria-hidden="true"/>
          <span>About this report</span>
        </summary>
        <p>Trial Balance includes posted ledger balances as of the selected date. Draft, cancelled and unposted documents are excluded.</p>
      </details>
    </section>
  );
}
