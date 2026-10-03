import {createContext,useContext,useMemo,useState} from 'react';
import {useExperienceMode} from './ExperienceModeContext.jsx';

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
  const value=useMemo(()=>({mode:modeState,setMode,t:TERMINOLOGY[modeState]||TERMINOLOGY.business}),[modeState]);
  return <TerminologyContext.Provider value={value}>{children}</TerminologyContext.Provider>;
}

export function useTerminology(){
  const expContext = useExperienceMode();
  const termContext = useContext(TerminologyContext);

  if (expContext && expContext.mode) {
    const termKey = expContext.mode === 'easy' ? 'business' : 'accountant';
    return {
      mode: termKey,
      experienceMode: expContext.mode,
      setMode: (next) => {
        const nextExp = next === 'business' ? 'easy' : next === 'accountant' ? 'accounting' : next;
        expContext.setMode(nextExp);
      },
      t: TERMINOLOGY[termKey]
    };
  }

  if (termContext) return termContext;

  const mode = initialMode();
  return { mode, setMode: () => {}, t: TERMINOLOGY[mode] };
}

export const pageLabel=(page,t)=>({'Chart of Accounts':t.chartOfAccounts,'Journal Entries':t.journalEntries,'General Ledger':t.generalLedger,'Period Lock':t.periodClosing}[page]||page);
