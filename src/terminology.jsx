import {createContext,useContext,useMemo,useState} from 'react';

export const TERMINOLOGY={
  accountant:{chartOfAccounts:'Charts of Accounts',chartSubtitle:'Manage the account hierarchy used by ledgers and financial statements.',accountName:'Account Name',accountCode:'Account Code',accountType:'Account Type',accountGroup:'Account Group',balance:'Balance',status:'Status',journalEntries:'Journal Entries',generalLedger:'General Ledger',periodClosing:'Period Lock',addAccount:'Add Account',viewLedger:'View Ledger',asset:'Asset',liability:'Liability',equity:'Equity',income:'Income',expense:'Expense'},
  business:{chartOfAccounts:'Money Categories',chartSubtitle:'Manage your business money categories and balances.',accountName:'Category Name',accountCode:'Reference Code',accountType:'Money Type',accountGroup:'Category Group',balance:'Balance',status:'Status',journalEntries:'Financial Adjustments',generalLedger:'Account History',periodClosing:'Financial Lock',addAccount:'Add Category',viewLedger:'View Money History',asset:'What You Own',liability:'What You Owe',equity:'Owner Investment',income:'Money Earned',expense:'Money Spent'}
};

const ACCOUNT_TYPE_TERM={Assets:'asset',Liabilities:'liability',Equity:'equity',Income:'income',Expenses:'expense'};
export const ACCOUNT_TYPE_ORDER=['Assets','Liabilities','Equity','Income','Expenses'];
export const accountTypeLabel=(type,business=false)=>business?(TERMINOLOGY.business[ACCOUNT_TYPE_TERM[type]]||type):type;

export const JOURNAL_VIEW_LABELS={
  accountant:{title:'Journal Entries',create:'Create manual journal',newEntry:'New manual journal',subtitle:'Manage manual entries. Daily transactions are recorded automatically.'},
  business:{title:'Financial Adjustments',create:'Create Adjustment',newEntry:'New Financial Adjustment',subtitle:'Review and manage corrections or special financial changes. Regular transactions are recorded automatically.'}
};
const KEY='wayvida-terminology-view';
const initialMode=()=>{try{const saved=localStorage.getItem(KEY);if(saved==='business'||saved==='accountant')return saved;const legacy=String(JSON.parse(localStorage.getItem('wayvida-coa-view'))||'').toLowerCase();return legacy==='business'?'business':'accountant'}catch{return 'accountant'}};
const TerminologyContext=createContext(null);
export function TerminologyProvider({children}){const [mode,setModeState]=useState(initialMode),setMode=next=>{setModeState(next);try{localStorage.setItem(KEY,next);localStorage.setItem('wayvida-coa-view',JSON.stringify(next==='business'?'business':'accounting'))}catch{/* Presentation preference remains usable without storage. */}};const value=useMemo(()=>({mode,setMode,t:TERMINOLOGY[mode]}),[mode]);return <TerminologyContext.Provider value={value}>{children}</TerminologyContext.Provider>}
export function useTerminology(){const value=useContext(TerminologyContext);if(value)return value;const mode=initialMode();return{mode,setMode:()=>{},t:TERMINOLOGY[mode]}}
export const pageLabel=(page,t)=>({'Chart of Accounts':t.chartOfAccounts,'Journal Entries':t.journalEntries,'General Ledger':t.generalLedger,'Period Lock':t.periodClosing}[page]||page);
