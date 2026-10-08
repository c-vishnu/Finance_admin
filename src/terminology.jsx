import React, {createContext,useContext,useMemo,useState} from 'react';
import {useExperienceMode} from './ExperienceModeContext.jsx';
import {formatRupees} from './number-format.js';

export const TERMINOLOGY={
  accountant:{chartOfAccounts:'Charts of Accounts',chartSubtitle:'Manage the account hierarchy used by ledgers and financial statements.',accountName:'Account Name',accountCode:'Account Code',accountType:'Account Type',accountGroup:'Account Group',balance:'Balance',status:'Status',journalEntries:'Journal Entries',generalLedger:'General Ledger',periodClosing:'Period Lock',trialBalance:'Trial Balance',balanceSheet:'Balance Sheet',profitAndLoss:'Profit & Loss',cashFlowStatement:'Cash Flow Statement',addAccount:'Add Account',viewLedger:'View Ledger',asset:'Asset',liability:'Liability',equity:'Equity',income:'Income',expense:'Expense'},
  business:{chartOfAccounts:'Money Categories',chartSubtitle:'Manage your business money categories and balances.',accountName:'Category Name',accountCode:'Reference Code',accountType:'Money Type',accountGroup:'Category Group',balance:'Balance',status:'Status',journalEntries:'Accounting Entries',generalLedger:'Account Activity',periodClosing:'Lock Accounts',trialBalance:'Account Balance Check',balanceSheet:'Financial Position',profitAndLoss:'Profit & Loss',cashFlowStatement:'Cash Movement',addAccount:'Add Category',viewLedger:'View Money History',asset:'What You Own',liability:'What You Owe',equity:'Owner Investment',income:'Money Earned',expense:'Money Spent'}
};

export const ACCOUNTING_DICTIONARY = {
  // Core Accounting Terms
  chartOfAccounts: {
    accounting: 'Chart of Accounts',
    easy: 'Account List',
    tooltip: 'Accounting term: Chart of Accounts — the complete list of financial accounts used by your business.'
  },
  account: { accounting: 'Account', easy: 'Account' },
  ledgerAccount: { accounting: 'Ledger Account', easy: 'Account' },
  accountCode: { accounting: 'Account Code', easy: 'Account Code' },
  accountType: { accounting: 'Account Type', easy: 'Account Category' },
  accountGroup: { accounting: 'Account Group', easy: 'Account Group' },

  // Assets
  assets: {
    accounting: 'Assets',
    easy: 'What the Business Owns',
    tooltip: 'Accounting term: Assets — everything of value owned by your business.'
  },
  asset: { accounting: 'Asset', easy: 'Business Asset' },
  currentAssets: { accounting: 'Current Assets', easy: 'Short-term Assets' },
  fixedAssets: { accounting: 'Fixed Assets', easy: 'Long-term Assets' },
  cashAndCashEquivalents: { accounting: 'Cash & Cash Equivalents', easy: 'Cash & Bank' },
  bankAccounts: { accounting: 'Bank Accounts', easy: 'Bank Accounts' },
  accountsReceivable: {
    accounting: 'Accounts Receivable',
    easy: 'Customer Money to Receive',
    tooltip: 'Accounting term: Accounts Receivable — money customers still owe your business.'
  },
  tradeReceivables: {
    accounting: 'Trade Receivables',
    easy: 'Customer Money to Receive',
    tooltip: 'Accounting term: Trade Receivables — unpaid invoice balances due from customers.'
  },
  inventory: { accounting: 'Inventory', easy: 'Stock / Inventory' },
  inputGst: {
    accounting: 'Input GST',
    easy: 'GST Paid / GST Credit',
    tooltip: 'GST already paid on business purchases available as tax credit.'
  },
  accumulatedDepreciation: { accounting: 'Accumulated Depreciation', easy: 'Value Reduced Over Time' },

  // Liabilities
  liabilities: {
    accounting: 'Liabilities',
    easy: 'What the Business Owes',
    tooltip: 'Accounting term: Liabilities — total debts and financial obligations owed by your business.'
  },
  liability: { accounting: 'Liability', easy: 'Amount Owed' },
  currentLiabilities: { accounting: 'Current Liabilities', easy: 'Amounts to Pay Soon' },
  longTermLiabilities: { accounting: 'Long-term Liabilities', easy: 'Long-term Amounts Owed' },
  accountsPayable: {
    accounting: 'Accounts Payable',
    easy: 'Supplier Money to Pay',
    tooltip: 'Accounting term: Accounts Payable — money your business still owes suppliers.'
  },
  tradePayables: {
    accounting: 'Trade Payables',
    easy: 'Supplier Money to Pay',
    tooltip: 'Accounting term: Trade Payables — unpaid bill balances owed to vendors and suppliers.'
  },
  gstPayable: {
    accounting: 'GST Payable',
    easy: 'GST to Pay',
    tooltip: 'GST collected from customers minus GST credit to be remitted to tax authorities.'
  },
  tdsPayable: {
    accounting: 'TDS Payable',
    easy: 'TDS to Pay',
    tooltip: 'Tax Deducted at Source on vendor payments to be deposited with the government.'
  },
  customerAdvances: { accounting: 'Customer Advances', easy: 'Customer Advance Payments' },

  // Equity
  equity: {
    accounting: 'Equity',
    easy: "Owner's Value",
    tooltip: "Accounting term: Equity — remaining value belonging to the owners after deducting liabilities."
  },
  ownersEquity: { accounting: "Owner's Equity", easy: "Owner's Value" },
  ownerCapital: { accounting: 'Owner Capital', easy: "Owner's Investment" },
  retainedEarnings: {
    accounting: 'Retained Earnings',
    easy: 'Accumulated Business Profit',
    tooltip: 'Accounting term: Retained Earnings — cumulative profits retained in the business over time.'
  },

  // Income & Expenses
  income: { accounting: 'Income', easy: 'Money Earned' },
  revenue: { accounting: 'Revenue', easy: 'Money Earned' },
  expenses: { accounting: 'Expenses', easy: 'Money Spent' },
  expense: { accounting: 'Expense', easy: 'Business Cost' },
  costOfGoodsSold: {
    accounting: 'Cost of Goods Sold',
    easy: 'Direct Cost of Sales',
    tooltip: 'Accounting term: Cost of Goods Sold (COGS) — direct cost of materials and labor used to produce sold goods.'
  },
  cogs: { accounting: 'COGS', easy: 'Direct Cost of Sales' },
  operatingExpenses: { accounting: 'Operating Expenses', easy: 'Running Costs' },

  // Balances & Actions
  openingBalance: { accounting: 'Opening Balance', easy: 'Starting Balance' },
  closingBalance: { accounting: 'Closing Balance', easy: 'Ending Balance' },
  runningBalance: { accounting: 'Running Balance', easy: 'Balance After Transaction' },
  journalEntry: { accounting: 'Journal Entry', easy: 'Accounting Entry' },
  journalEntries: { accounting: 'Journal Entries', easy: 'Accounting Entries' },
  posting: { accounting: 'Posting', easy: 'Record in Accounts' },
  posted: { accounting: 'Posted', easy: 'Recorded' },
  unposted: { accounting: 'Unposted', easy: 'Not Recorded Yet' },
  reconciliation: { accounting: 'Reconciliation', easy: 'Match Records' },
  bankReconciliation: { accounting: 'Bank Reconciliation', easy: 'Match Bank Transactions' },

  // Reports & Sections
  generalLedger: {
    accounting: 'General Ledger',
    easy: 'Account Activity',
    tooltip: 'Accounting term: General Ledger — all movements recorded against an account.'
  },
  trialBalance: {
    accounting: 'Trial Balance',
    easy: 'Account Balance Check',
    tooltip: 'Accounting term: Trial Balance — checks whether total debits and credits are balanced.'
  },
  profitAndLoss: { accounting: 'Profit & Loss', easy: 'Profit & Loss' },
  balanceSheet: {
    accounting: 'Balance Sheet',
    easy: 'Financial Position',
    tooltip: 'See what your business owns, owes, and the owner\'s value as of the selected date.'
  },
  cashFlowStatement: { accounting: 'Cash Flow Statement', easy: 'Cash Flow' },
  transactionRegister: { accounting: 'Transaction Register', easy: 'All Transactions' },
  journalReport: { accounting: 'Journal Report', easy: 'Accounting Entries' },
  customerOutstanding: { accounting: 'Customer Outstanding', easy: 'Customer Money to Receive' },
  supplierOutstanding: { accounting: 'Supplier Outstanding', easy: 'Supplier Money to Pay' },

  // Report Groups
  transactionReports: { accounting: 'TRANSACTION REPORTS', easy: 'TRANSACTIONS' },
  accountingReports: { accounting: 'ACCOUNTING REPORTS', easy: 'ACCOUNT ACTIVITY' },
  financialStatements: { accounting: 'FINANCIAL STATEMENTS', easy: 'BUSINESS FINANCES' },
  receivablesAndPayables: { accounting: 'RECEIVABLES & PAYABLES', easy: 'MONEY TO RECEIVE & PAY' },
  cashAndBankingGroup: { accounting: 'CASH & BANKING', easy: 'CASH & BANKING' }
};

export function getAccountingLabel(key, mode = 'easy', context = {}) {
  if (!key) return '';
  const normalizedMode = (mode === 'easy' || mode === 'business') ? 'easy' : 'accounting';
  const entry = ACCOUNTING_DICTIONARY[key];
  if (entry) {
    return entry[normalizedMode] || entry.accounting || key;
  }
  // Check legacy map
  const legacyKey = normalizedMode === 'easy' ? 'business' : 'accountant';
  if (TERMINOLOGY[legacyKey]?.[key]) {
    return TERMINOLOGY[legacyKey][key];
  }
  return key;
}

export function getAccountingTooltip(key, mode = 'easy') {
  const normalizedMode = (mode === 'easy' || mode === 'business') ? 'easy' : 'accounting';
  if (normalizedMode !== 'easy') return '';
  const entry = ACCOUNTING_DICTIONARY[key];
  return entry?.tooltip || '';
}

const ACCOUNT_TYPE_TERM={Assets:'asset',Liabilities:'liability',Equity:'equity',Income:'income',Expenses:'expense'};
export const ACCOUNT_TYPE_ORDER=['Assets','Liabilities','Equity','Income','Expenses'];

export const accountTypeLabel = (type, modeOrBusiness = false) => {
  const isEasy = modeOrBusiness === true || modeOrBusiness === 'easy' || modeOrBusiness === 'business';
  if (isEasy) {
    const keyMap = {
      Assets: 'What the Business Owns',
      Liabilities: 'What the Business Owes',
      Equity: "Owner's Value",
      Income: 'Money Earned',
      Expenses: 'Money Spent'
    };
    return keyMap[type] || TERMINOLOGY.business[ACCOUNT_TYPE_TERM[type]] || type;
  }
  return type;
};

export const JOURNAL_VIEW_LABELS={
  accountant:{create:'Create manual journal',newEntry:'New manual journal',title:'Journal Entries',subtitle:'Manage manual entries. Daily transactions are recorded automatically.'},
  business:{create:'Create Adjustment',newEntry:'New Financial Adjustment',title:'Financial Adjustments',subtitle:'Review and manage corrections or special financial changes. Regular transactions are recorded automatically.'}
};

/**
 * Single Account View helper for Debit/Credit transformation to Increase (+)/Decrease (-)
 * For Assets & Expenses: Debit is Increase (+), Credit is Decrease (-)
 * For Liabilities, Equity & Income: Credit is Increase (+), Debit is Decrease (-)
 */
export function formatAccountChange(debit = 0, credit = 0, accountType = 'Assets', isEasy = false) {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  const isDebitNormal = ['Assets', 'Expenses'].includes(accountType);

  let netChange = 0;
  let isIncrease = true;
  let entryType = 'Debit';
  let entryAmount = 0;

  if (d > 0) {
    entryType = 'Debit';
    entryAmount = d;
    netChange = isDebitNormal ? d : -d;
    isIncrease = isDebitNormal;
  } else if (c > 0) {
    entryType = 'Credit';
    entryAmount = c;
    netChange = isDebitNormal ? -c : c;
    isIncrease = !isDebitNormal;
  }

  const sign = isIncrease ? '+' : '−';
  const label = `${sign} ${formatRupees(Math.abs(entryAmount || d || c))}`;
  const tooltip = `Accounting entry: ${entryType} ${formatRupees(entryAmount || d || c)}`;

  return {
    netChange,
    isIncrease,
    sign,
    label,
    tooltip,
    debitAmount: d,
    creditAmount: c,
    entryType
  };
}

const KEY='wayvida-terminology-view';
const initialMode=()=>{
  try{
    const exp = localStorage.getItem('wayvida-experience-mode');
    if(exp === 'easy') return 'business';
    if(exp === 'accounting') return 'accountant';
    const saved=localStorage.getItem(KEY);
    if(saved==='business'||saved==='accountant')return saved;
    return 'business';
  }catch{return 'business'}
};

const TerminologyContext=createContext(null);

export function TerminologyProvider({children}){
  const [modeState,setModeState]=useState(initialMode);
  const setMode=next=>{
    const target = next === 'easy' ? 'business' : next === 'accounting' ? 'accountant' : next;
    setModeState(target);
    try{
      localStorage.setItem(KEY,target);
      localStorage.setItem('wayvida-experience-mode', target === 'business' ? 'easy' : 'accounting');
    }catch{}
  };
  const value=useMemo(()=>({
    mode: modeState === 'business' ? 'easy' : 'accounting',
    legacyMode: modeState,
    setMode,
    isEasy: modeState === 'business',
    isAccounting: modeState === 'accountant',
    t: TERMINOLOGY[modeState] || TERMINOLOGY.business,
    getAccountingLabel: (key, ctx) => getAccountingLabel(key, modeState === 'business' ? 'easy' : 'accounting', ctx),
    getAccountingTooltip: (key) => getAccountingTooltip(key, modeState === 'business' ? 'easy' : 'accounting')
  }),[modeState]);
  return <TerminologyContext.Provider value={value}>{children}</TerminologyContext.Provider>;
}

export function useTerminology(){
  const expContext = useExperienceMode();
  const termContext = useContext(TerminologyContext);

  if (expContext && expContext.mode) {
    const isEasy = expContext.mode === 'easy';
    const termKey = isEasy ? 'business' : 'accountant';
    return {
      mode: expContext.mode,
      legacyMode: termKey,
      isEasy,
      isAccounting: !isEasy,
      experienceMode: expContext.mode,
      setMode: (next) => {
        const nextExp = (next === 'business' || next === 'easy') ? 'easy' : 'accounting';
        expContext.setMode(nextExp);
      },
      t: TERMINOLOGY[termKey],
      getAccountingLabel: (key, ctx) => getAccountingLabel(key, expContext.mode, ctx),
      getAccountingTooltip: (key) => getAccountingTooltip(key, expContext.mode)
    };
  }

  if (termContext) return termContext;

  const mode = initialMode();
  const isEasy = mode === 'business';
  return {
    mode: isEasy ? 'easy' : 'accounting',
    legacyMode: mode,
    isEasy,
    isAccounting: !isEasy,
    setMode: () => {},
    t: TERMINOLOGY[mode],
    getAccountingLabel: (key, ctx) => getAccountingLabel(key, isEasy ? 'easy' : 'accounting', ctx),
    getAccountingTooltip: (key) => getAccountingTooltip(key, isEasy ? 'easy' : 'accounting')
  };
}

export const pageLabel=(page,t)=>({'Chart of Accounts':t.chartOfAccounts,'Journal Entries':t.journalEntries,'Journal':t.journalEntries,'General Ledger':t.generalLedger,'Period Lock':t.periodClosing,'Trial Balance':t.trialBalance,'Balance Sheet':t.balanceSheet,'Profit & Loss':t.profitAndLoss,'Cash Flow Statement':t.cashFlowStatement}[page]||page);

export function TermTooltip({ termKey, label, children }) {
  const { isEasy, getAccountingLabel, getAccountingTooltip } = useTerminology();
  const textLabel = label || getAccountingLabel(termKey);
  const tooltipText = getAccountingTooltip(termKey);

  if (!isEasy || !tooltipText) {
    return children ? <>{children}</> : <span>{textLabel}</span>;
  }

  return (
    <span className="termTooltipWrapper" title={tooltipText} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {children || <span>{textLabel}</span>}
      <span className="termInfoBadge" aria-label={tooltipText} style={{ fontSize: '11px', color: '#64748b', cursor: 'help', fontWeight: 'normal' }}>ⓘ</span>
    </span>
  );
}
