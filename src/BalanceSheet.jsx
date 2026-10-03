import {Fragment,useMemo,useState,useEffect} from 'react';
import {IconCheck,IconAlertTriangle,IconSearch,IconAdjustments,IconRefresh,IconInfoCircle,IconFileSpreadsheet,IconFileTypePdf,IconLayoutSidebar} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money,today} from './invoice-engine.js';
import {balanceSheet,balanceSheetExportRows} from './balance-sheet.js';
import {demoOrganizations} from './demo-organisations.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {useExperienceMode} from './ExperienceModeContext.jsx';
import './balance-sheet.css';
import {AsOfDateSelect,ReportExportMenu} from './ReportToolbar.jsx';

const reportSeed={Assets:[['1000','Cash'],['1010','Bank'],['1100','Accounts Receivable'],['1200','Inventory'],['1300','Equipment'],['1310','Furniture']],Liabilities:[['2000','Accounts Payable'],['2100','GST Payable'],['2300','Loans']],Equity:[['3000','Capital'],['3200','Retained Earnings']],Income:[['4000','Sales'],['4100','Service Income']],Expenses:[['5000','Purchases'],['5100','Salary'],['5200','Rent']]};
const ALL='All';

export default function BalanceSheet({seed,notify,onNavigate}){
  const {isEasy} = useExperienceMode();
  const [revision,setRevision]=useState(0);
  const [date,setDate]=useState(today());
  const [branch,setBranch]=useState(ALL);
  const [search,setSearch]=useState('');
  const [includeZero,setIncludeZero]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [panelOpen,setPanelOpen]=useState(true);
  
  /* View mode: 'vertical' (standard statement) | 'twosided' (horizontal T-Account) */
  const [viewMode,setViewMode]=useState('vertical');

  const organization=demoOrganizations.find(x=>x.id===localStorage.getItem('wayvida-demo-company'))||demoOrganizations[0];
  const branches=organization.branches||[];

  useEffect(()=>{
    const refresh=()=>setRevision(x=>x+1);
    window.addEventListener('wayvida-accounts-updated',refresh);
    window.addEventListener('storage',refresh);
    return()=>{
      window.removeEventListener('wayvida-accounts-updated',refresh);
      window.removeEventListener('storage',refresh);
    };
  },[]);

  const report=useMemo(()=>balanceSheet(readAccounts(seed||reportSeed),{date,branch}),[seed,date,branch,revision]);
  const selected=(()=>{try{return sessionStorage.getItem('wayvida-balance-sheet-account')||''}catch{return ''}})();
  
  useEffect(()=>()=>{try{sessionStorage.removeItem('wayvida-balance-sheet-account')}catch{}},[]);

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

  function reset(){
    setDate(today());
    setBranch(ALL);
    setSearch('');
    setIncludeZero(false);
  }

  function exportExcel(){
    const content=balanceSheetExportRows(report,{date,branch});
    downloadReport(excelReport(content),'wayvida-balance-sheet.xml','application/xml;charset=utf-8');
  }

  function print(){
    setTimeout(()=>window.print(),50);
  }

  const query=search.trim().toLowerCase();
  const visibleRows=report.rows.filter(row=>{
    if(!includeZero && !query && Math.abs(row.rawAmount||0)===0) return false;
    if(!query) return true;
    return [row.name,row.code,row.accountNature,row.section].join(' ').toLowerCase().includes(query);
  });

  const subgroup=row=>{
    const value=(row.name+' '+(row.accountNature||'')).toLowerCase();
    if(row.type==='Assets'){
      if(/depreciation/.test(value)) return 'Accumulated Depreciation';
      if(/cash|petty/.test(value)) return 'Cash & Cash Equivalents';
      if(/bank/.test(value)) return 'Bank Accounts';
      if(/receivable|debtor|customer/.test(value)) return 'Trade Receivables';
      if(/inventory|stock/.test(value)) return 'Inventory';
      return 'Other Current Assets';
    }
    if(row.type==='Liabilities'){
      if(/tax|gst|tds|vat|duty|duties|service tax|sales tax/.test(value)) return 'Taxes Payable';
      if(/payable|creditor|supplier|vendor|trade/.test(value)) return 'Trade Payables';
      if(/advance|unearned/.test(value)) return 'Customer Advances';
      return 'Other Current Liabilities';
    }
    return /capital|drawing/.test(value)?'Owner Capital':/retained/.test(value)?'Retained Earnings':'Owner Equity';
  };

  const sectionRows=(type,section)=>visibleRows.filter(row=>row.type===type&&row.section===section);

  const renderAccountRow=row=>(
    <tr key={row.code} className={'bsAccount '+(selected===row.code?'selected':'')}>
      <td className="bsAccountCell">
        <button type="button" className="bsAccountBtn" onClick={()=>openLedger(row)} aria-label={`Open General Ledger for ${row.name}`}>
          {!isEasy && row.code && (
            <>
              <span className="bsAccountCode">{row.code}</span>
              <span className="bsAccountDot">·</span>
            </>
          )}
          <span className="bsAccountName">{row.name}</span>
        </button>
      </td>
      <td className="bsMoney">{money(row.amount)}</td>
    </tr>
  );

  const renderGroup=(groupName,rows)=>{
    const groupTotal=rows.reduce((sum,r)=>sum+r.amount,0);
    const isSingleRow = rows.length===1 && rows[0].name.toLowerCase()===groupName.toLowerCase();

    return (
      <Fragment key={groupName}>
        {!isSingleRow && (
          <tr className="bsGroup">
            <th colSpan="2" scope="rowgroup">
              <span className="bsGroupTitle">{groupName}</span>
            </th>
          </tr>
        )}
        {rows.map(renderAccountRow)}
        {!isSingleRow && (
          <tr className="bsGroupTotal">
            <td className="bsSubtotalLabel">{groupName} subtotal</td>
            <td className="bsMoney">{money(groupTotal)}</td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderSectionBlock=(type,sectionName)=>{
    const rows=sectionRows(type,sectionName);
    const buckets=[...new Set(rows.map(subgroup))];
    if(!rows.length && !includeZero && !query) return null;
    const hideHeader = sectionName === 'Current Assets' || sectionName === 'Current Liabilities';

    return (
      <Fragment key={sectionName}>
        {!hideHeader && (
          <tr className="bsSubSection">
            <th colSpan="2" scope="rowgroup">{sectionName}</th>
          </tr>
        )}
        {buckets.length? (
          buckets.map(bName => renderGroup(bName, rows.filter(r => subgroup(r)===bName)))
        ) : (
          <tr className="bsEmpty"><td colSpan="2">No accounts to display in {sectionName}</td></tr>
        )}
      </Fragment>
    );
  };

  /* Helper data construction for Two-sided T-Account view */
  const twoSidedData = useMemo(() => {
    const leftBody = [];
    const rightBody = [];

    // 1. LEFT SIDE: ASSETS
    const currentAssetRows = visibleRows.filter(r => r.type === 'Assets' && r.section === 'Current Assets');
    if (currentAssetRows.length) {
      const buckets = [...new Set(currentAssetRows.map(subgroup))];
      buckets.forEach(bName => {
        const bRows = currentAssetRows.filter(r => subgroup(r) === bName);
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          leftBody.push({ kind: 'group', title: bName });
        }
        bRows.forEach(r => leftBody.push({ kind: 'account', data: r }));
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          leftBody.push({ kind: 'subtotal', title: `${bName} subtotal`, amount: bRows.reduce((s, x) => s + x.amount, 0) });
        }
      });
    }

    const fixedAssetRows = visibleRows.filter(r => r.type === 'Assets' && r.section === 'Fixed Assets');
    if (fixedAssetRows.length) {
      leftBody.push({ kind: 'subheader', title: 'Fixed Assets' });
      const buckets = [...new Set(fixedAssetRows.map(subgroup))];
      buckets.forEach(bName => {
        const bRows = fixedAssetRows.filter(r => subgroup(r) === bName);
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          leftBody.push({ kind: 'group', title: bName });
        }
        bRows.forEach(r => leftBody.push({ kind: 'account', data: r }));
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          leftBody.push({ kind: 'subtotal', title: `${bName} subtotal`, amount: bRows.reduce((s, x) => s + x.amount, 0) });
        }
      });
    }

    // 2. RIGHT SIDE: LIABILITIES & EQUITY
    const currentLiabRows = visibleRows.filter(r => r.type === 'Liabilities' && r.section === 'Current Liabilities');
    if (currentLiabRows.length) {
      const buckets = [...new Set(currentLiabRows.map(subgroup))];
      buckets.forEach(bName => {
        const bRows = currentLiabRows.filter(r => subgroup(r) === bName);
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          rightBody.push({ kind: 'group', title: bName });
        }
        bRows.forEach(r => rightBody.push({ kind: 'account', data: r }));
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          rightBody.push({ kind: 'subtotal', title: `${bName} subtotal`, amount: bRows.reduce((s, x) => s + x.amount, 0) });
        }
      });
    }

    const longLiabRows = visibleRows.filter(r => r.type === 'Liabilities' && r.section === 'Long-term Liabilities');
    if (longLiabRows.length) {
      rightBody.push({ kind: 'subheader', title: 'Long-term Liabilities' });
      const buckets = [...new Set(longLiabRows.map(subgroup))];
      buckets.forEach(bName => {
        const bRows = longLiabRows.filter(r => subgroup(r) === bName);
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          rightBody.push({ kind: 'group', title: bName });
        }
        bRows.forEach(r => rightBody.push({ kind: 'account', data: r }));
        if (bRows.length > 1 || bRows[0].name.toLowerCase() !== bName.toLowerCase()) {
          rightBody.push({ kind: 'subtotal', title: `${bName} subtotal`, amount: bRows.reduce((s, x) => s + x.amount, 0) });
        }
      });
    }

    rightBody.push({ kind: 'sectionTotal', title: 'TOTAL LIABILITIES', amount: report.liabilities });

    rightBody.push({ kind: 'subheader', title: 'EQUITY' });
    const equityRows = visibleRows.filter(r => r.type === 'Equity');
    equityRows.forEach(r => rightBody.push({ kind: 'account', data: r }));
    rightBody.push({ kind: 'earnings', title: 'Current Year Profit / Loss', amount: report.currentEarnings });
    rightBody.push({ kind: 'sectionTotal', title: 'TOTAL EQUITY', amount: report.equity });

    const maxRows = Math.max(leftBody.length, rightBody.length);

    return { leftBody, rightBody, maxRows };
  }, [visibleRows, report]);

  /* Analytics calculations for Insights Drawer */
  const analytics=useMemo(()=>{
    const totalAssets = report.assets || 0;
    const totalLiab = report.liabilities || 0;
    const totalEquity = report.equity || 0;
    const totalFunding = totalLiab + totalEquity;

    if (totalFunding <= 0) {
      return {
        liabilitiesPct: 0,
        equityAccountsPct: 0,
        earningsPct: 0,
        totalEquityPct: 0,
        debtToEquity: '0.00x',
        equityRatio: '0.0%',
        workingCapital: totalAssets - totalLiab
      };
    }

    const liabilitiesPct = Math.max(0, Math.min(100, (totalLiab / totalFunding) * 100));
    const totalEquityPct = Math.max(0, Math.min(100, (totalEquity / totalFunding) * 100));
    const equityAccountsPct = Math.max(0, Math.min(100, (report.equityAccounts / totalFunding) * 100));
    const earningsPct = (report.currentEarnings / totalFunding) * 100;

    const debtToEquity = totalEquity > 0 ? (totalLiab / totalEquity).toFixed(2) + 'x' : 'N/A';
    const equityRatio = ((totalEquity / totalFunding) * 100).toFixed(1) + '%';
    const workingCapital = totalAssets - totalLiab;

    return {
      liabilitiesPct,
      totalEquityPct,
      equityAccountsPct,
      earningsPct,
      debtToEquity,
      equityRatio,
      workingCapital
    };
  }, [report]);

  const activeFilters=[branch!==ALL, includeZero].filter(Boolean).length;

  return (
    <section className="bsPage">
      {/* 1. Page Header */}
      <header className="bsHead">
        <div className="bsHeadTitle">
          <h1>Balance Sheet</h1>
          <p>Track your business financial position as of a selected date.</p>
        </div>
        <div className="bsHeadActions">
          <label className="bsSearch">
            <IconSearch size={18} aria-hidden="true"/>
            <input aria-label="Search accounts..." placeholder="Search accounts..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          <AsOfDateSelect date={date} onChange={value=>setDate(value)} onCustom={()=>setFiltersOpen(true)}/>
          <details className="bsFiltersMore" open={filtersOpen} onToggle={e=>setFiltersOpen(e.currentTarget.open)}>
            <summary aria-label="Open filters">
              <IconAdjustments size={18} aria-hidden="true"/>Filters{activeFilters>0&&<span>{activeFilters}</span>}
            </summary>
            <div className="bsFilters">
              <label>As of date<input type="date" aria-label="As of date" value={date} onChange={e=>setDate(e.target.value)}/></label>
              <label>Branch
                <select aria-label="Branch" value={branch} onChange={e=>setBranch(e.target.value)}>
                  <option value={ALL}>All branches</option>
                  {branches.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <label className="bsCheck">
                <input type="checkbox" checked={includeZero} onChange={e=>setIncludeZero(e.target.checked)}/>
                Include zero-balance accounts
              </label>
              <div className="bsFilterActions">
                <button type="button" onClick={reset}><IconRefresh size={15} aria-hidden="true"/>Clear filters</button>
              </div>
            </div>
          </details>

          <ReportExportMenu items={[
            {key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={18} aria-hidden="true"/>,onClick:exportExcel},
            {key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={18} aria-hidden="true"/>,onClick:print}
          ]} disabled={!visibleRows.length}/>
        </div>
      </header>



      {/* 3. View Switch Bar (Vertical vs Two-sided) */}
      <div className="bsViewSwitchBar">
        <div className="bsSwitchControls">
          <div className="bsSegmented" role="tablist" aria-label="Report View">
            <button 
              type="button" 
              role="tab" 
              aria-selected={viewMode==='vertical'} 
              className={'bsSegmentBtn '+(viewMode==='vertical'?'active':'')} 
              onClick={()=>setViewMode('vertical')}
            >
              Vertical
            </button>
            <button 
              type="button" 
              role="tab" 
              aria-selected={viewMode==='twosided'} 
              className={'bsSegmentBtn '+(viewMode==='twosided'?'active':'')} 
              onClick={()=>setViewMode('twosided')}
            >
              Two-sided
            </button>
          </div>
          <button 
            type="button" 
            className={'bsControlBtn '+(panelOpen?'active':'')} 
            onClick={()=>setPanelOpen(!panelOpen)}
            aria-label="Toggle Insights Panel"
          >
            <IconLayoutSidebar size={15} aria-hidden="true"/>
            <span>{panelOpen ? 'Hide Insights' : 'Show Insights'}</span>
          </button>
        </div>
      </div>

      {/* 4. Report Grid Layout (60% Left Table, 40% Right Insights when open) */}
      <div className={'bsReportLayout '+(panelOpen?'withPanel':'')}>
        <div className="bsMainColumn">
          <div className="bsStatementCard">
            <div className="bsTableScroll">
              {viewMode === 'vertical' ? (
                /* VERTICAL STATEMENT VIEW */
                <table>
                  <thead>
                    <tr>
                      <th scope="col" className="bsAccountHead">ACCOUNT</th>
                      <th scope="col" className="bsBalanceHead">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ASSETS */}
                    <tr className="bsSection"><th colSpan="2" scope="rowgroup">ASSETS</th></tr>
                    {renderSectionBlock('Assets','Current Assets')}
                    {renderSectionBlock('Assets','Fixed Assets')}
                    <tr className="bsSectionTotal">
                      <td className="bsMajorTotalLabel">TOTAL ASSETS</td>
                      <td className="bsMoney">{money(report.assets)}</td>
                    </tr>

                    {/* LIABILITIES */}
                    <tr className="bsSection"><th colSpan="2" scope="rowgroup">LIABILITIES</th></tr>
                    {renderSectionBlock('Liabilities','Current Liabilities')}
                    {renderSectionBlock('Liabilities','Long-term Liabilities')}
                    <tr className="bsSectionTotal">
                      <td className="bsMajorTotalLabel">TOTAL LIABILITIES</td>
                      <td className="bsMoney">{money(report.liabilities)}</td>
                    </tr>

                    {/* EQUITY */}
                    <tr className="bsSection"><th colSpan="2" scope="rowgroup">EQUITY</th></tr>
                    {renderSectionBlock('Equity','Equity')}
                    <tr className="bsAccount bsEarningsRow">
                      <td className="bsAccountCell">
                        <span className="bsAccountName">Current Year Profit / Loss</span>
                      </td>
                      <td className="bsMoney">{money(report.currentEarnings)}</td>
                    </tr>
                    <tr className="bsSectionTotal">
                      <td className="bsMajorTotalLabel">TOTAL EQUITY</td>
                      <td className="bsMoney">{money(report.equity)}</td>
                    </tr>

                    {/* TOTAL LIABILITIES & EQUITY */}
                    <tr className="bsGrandTotal">
                      <td className="bsGrandTotalLabel">TOTAL LIABILITIES &amp; EQUITY</td>
                      <td className="bsMoney">{money(report.liabilities + report.equity)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                /* TWO-SIDED HORIZONTAL T-ACCOUNT VIEW */
                <table className="bsTwoSidedTable">
                  <thead>
                    <tr className="bsTwoSidedHeaderRow">
                      <th colSpan="2" className="bsAssetsHeader">ASSETS</th>
                      <th colSpan="2" className="bsLiabEquityHeader">LIABILITIES &amp; EQUITY</th>
                    </tr>
                    <tr className="bsSubHeaderRow">
                      <th scope="col" className="bsColParticulars">Particulars</th>
                      <th scope="col" className="bsColAmount">Amount (₹)</th>
                      <th scope="col" className="bsColParticulars">Particulars</th>
                      <th scope="col" className="bsColAmount">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: twoSidedData.maxRows }).map((_, idx) => {
                      const left = twoSidedData.leftBody[idx];
                      const right = twoSidedData.rightBody[idx];

                      return (
                        <tr key={'ts-' + idx} className="bsTAccRow">
                          {/* Left Side (Assets) */}
                          {left?.kind === 'subheader' ? (
                            <td colSpan="2" className="bsTSecHeader">{left.title}</td>
                          ) : (
                            <Fragment>
                              <td className={'bsColParticulars ' + (left?.kind || '')}>
                                {left?.kind === 'group' && <span className="bsGroupTitle">{left.title}</span>}
                                {left?.kind === 'account' && (
                                  <button type="button" className="bsAccountBtn" onClick={() => openLedger(left.data)}>
                                    {left.data.code && <span className="bsAccountCode">{left.data.code} · </span>}
                                    <span className="bsAccountName">{left.data.name}</span>
                                  </button>
                                )}
                                {left?.kind === 'subtotal' && <span className="bsSubtotalLabel">{left.title}</span>}
                              </td>
                              <td className={'bsColAmount ' + (left?.kind || '')}>
                                {left?.amount !== undefined ? money(left.amount) : ''}
                              </td>
                            </Fragment>
                          )}

                          {/* Right Side (Liabilities & Equity) */}
                          {right?.kind === 'subheader' ? (
                            <td colSpan="2" className="bsTSecHeader">{right.title}</td>
                          ) : (
                            <Fragment>
                              <td className={'bsColParticulars ' + (right?.kind || '')}>
                                {right?.kind === 'group' && <span className="bsGroupTitle">{right.title}</span>}
                                {right?.kind === 'account' && (
                                  <button type="button" className="bsAccountBtn" onClick={() => openLedger(right.data)}>
                                    {right.data.code && <span className="bsAccountCode">{right.data.code} · </span>}
                                    <span className="bsAccountName">{right.data.name}</span>
                                  </button>
                                )}
                                {right?.kind === 'earnings' && <span className="bsAccountName">{right.title}</span>}
                                {right?.kind === 'subtotal' && <span className="bsSubtotalLabel">{right.title}</span>}
                                {right?.kind === 'sectionTotal' && <strong className="bsMajorLabel">{right.title}</strong>}
                              </td>
                              <td className={'bsColAmount ' + (right?.kind || '')}>
                                {right?.amount !== undefined ? money(right.amount) : ''}
                              </td>
                            </Fragment>
                          )}
                        </tr>
                      );
                    })}

                    {/* Perfectly Aligned Grand Total Row */}
                    <tr className="bsGrandTotalRow">
                      <td className="bsColParticulars bsGrandLabel">TOTAL ASSETS</td>
                      <td className="bsColAmount bsGrandVal">{money(report.assets)}</td>
                      <td className="bsColParticulars bsGrandLabel">TOTAL LIABILITIES &amp; EQUITY</td>
                      <td className="bsColAmount bsGrandVal">{money(report.liabilities + report.equity)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Compact Single-Line Reconciliation Bar */}
          <div className={'bsEquation '+(report.balanced?'balanced':'mismatch')} role="status">
            {report.balanced ? <IconCheck size={16} aria-hidden="true"/> : <IconAlertTriangle size={16} aria-hidden="true"/>}
            <div className="bsEquationText">
              <span>
                <b>{report.balanced ? 'Balance Sheet balanced' : 'Balance sheet difference detected'}</b> · Assets {money(report.assets)} = Liabilities {money(report.liabilities)} + Equity {money(report.equity)} (Difference: {money(Math.abs(report.difference))})
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Inline Insights Panel (40% width when open) */}
        {panelOpen && (
          <aside className="bsSidePanel" aria-label="Capital Structure Insights">
            <div className="bsDrawerHead">
              <div>
                <h3>Capital Structure &amp; Ratios</h3>
                <p className="bsDrawerSub">Funding distribution for Total Assets ({money(report.assets)})</p>
              </div>
            </div>

            <div className="bsCompBar" aria-hidden="true">
              {analytics.liabilitiesPct > 0 && (
                <div className="bsCompSeg segLiab" style={{width:`${analytics.liabilitiesPct}%`}} title={`Liabilities: ${analytics.liabilitiesPct.toFixed(1)}%`}/>
              )}
              {analytics.equityAccountsPct > 0 && (
                <div className="bsCompSeg segEquity" style={{width:`${analytics.equityAccountsPct}%`}} title={`Capital & Reserves: ${analytics.equityAccountsPct.toFixed(1)}%`}/>
              )}
              {analytics.earningsPct > 0 && (
                <div className="bsCompSeg segEarnings" style={{width:`${analytics.earningsPct}%`}} title={`Current Earnings: ${analytics.earningsPct.toFixed(1)}%`}/>
              )}
            </div>

            <ul className="bsCompList">
              <li className="bsCompItem">
                <span className="bsCompLabel"><span className="bsCompDot dotLiab"/>Total Liabilities</span>
                <span className="bsCompPct">{analytics.liabilitiesPct.toFixed(2)}%</span>
                <strong className="bsCompVal">{money(report.liabilities)}</strong>
              </li>
              <li className="bsCompItem">
                <span className="bsCompLabel"><span className="bsCompDot dotEquity"/>Owner Capital &amp; Reserves</span>
                <span className="bsCompPct">{analytics.equityAccountsPct.toFixed(2)}%</span>
                <strong className="bsCompVal">{money(report.equityAccounts)}</strong>
              </li>
              <li className="bsCompItem">
                <span className="bsCompLabel"><span className="bsCompDot dotEarnings"/>Current Year Earnings</span>
                <span className="bsCompPct">{analytics.earningsPct.toFixed(2)}%</span>
                <strong className="bsCompVal">{money(report.currentEarnings)}</strong>
              </li>
              <li className="bsCompItem highlightEquity">
                <span className="bsCompLabel"><span className="bsCompDot dotTotalEquity"/>Total Equity</span>
                <span className="bsCompPct">{analytics.totalEquityPct.toFixed(2)}%</span>
                <strong className="bsCompVal">{money(report.equity)}</strong>
              </li>
              <li className="bsCompItem highlight">
                <span className="bsCompLabel"><span className="bsCompDot dotTotal"/>Total Liabilities &amp; Equity</span>
                <span className="bsCompPct">100.00%</span>
                <strong className="bsCompVal">{money(report.liabilities + report.equity)}</strong>
              </li>
            </ul>

            <div className="bsContextDivider"/>

            <div className="bsMetricsBlock">
              <span className="bsNotesTitle">KEY RATIOS</span>
              <div className="bsMetricItem">
                <span className="bsMetricLabel">Debt-to-Equity</span>
                <strong className="bsMetricVal">{analytics.debtToEquity}</strong>
              </div>
              <div className="bsMetricItem">
                <span className="bsMetricLabel">Equity Ratio</span>
                <strong className="bsMetricVal">{analytics.equityRatio}</strong>
              </div>
              <div className="bsMetricItem">
                <span className="bsMetricLabel">Working Capital (Net Assets)</span>
                <strong className="bsMetricVal">{money(analytics.workingCapital)}</strong>
              </div>
            </div>

            <div className="bsContextDivider"/>

            <div className="bsReportNotes">
              <span className="bsNotesTitle">REPORT NOTES</span>
              <ul>
                <li>• As of selected accounting date</li>
                <li>• Double-entry accounting verified</li>
                <li>• Includes retained &amp; current earnings</li>
                <li>• Assets = Liabilities + Equity</li>
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* 5. Footer About Section */}
      <details className="bsAboutReport">
        <summary>
          <IconInfoCircle size={16} aria-hidden="true"/>
          <span>About this report</span>
        </summary>
        <p>Balance Sheet presents the financial position of the organisation as of the selected date. Only posted accounting entries are included.</p>
      </details>
    </section>
  );
}
