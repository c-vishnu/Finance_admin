import re

with open("src/JournalEntriesPro.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import if missing
if "OrganisationBranchScope" not in content:
    import_stmt = "import {OrganisationBranchScope} from './OrganisationBranchScope.jsx';\n"
    # Find the last import
    last_import_match = list(re.finditer(r'^import .*?;$', content, re.MULTILINE))[-1]
    insert_pos = last_import_match.end()
    content = content[:insert_pos] + "\n" + import_stmt + content[insert_pos:]

# Find SimpleTransactionForm and replace it
# We need to find `function SimpleTransactionForm({accounts,error,setError,onBack,onSave}){ ... }`
# and carefully replace the component block.

start_str = "function SimpleTransactionForm({accounts,error,setError,onBack,onSave}){"
start_idx = content.find(start_str)
if start_idx != -1:
    # Find the matching closing brace
    open_braces = 0
    end_idx = -1
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            open_braces += 1
        elif content[i] == '}':
            open_braces -= 1
            if open_braces == 0:
                end_idx = i + 1
                break
    
    if end_idx != -1:
        new_form = """function SimpleTransactionForm({accounts,error,setError,onBack,onSave}){
 const defaultContext=getCurrentOrganizationContext();
 const [form,setForm]=useState({transactionType:'expense',date:new Date().toISOString().slice(0,10),reference:'',categoryAccount:'',moneyAccount:'',counterpartyAccount:'',amount:'',notes:'',companyId:defaultContext.company.id,branchId:defaultContext.branch.id}),[,setScopeRevision]=useState(0);
 useEffect(()=>{const refresh=()=>setScopeRevision(value=>value+1);window.addEventListener('wayvida-working-context-change',refresh);window.addEventListener('wayvida-organization-change',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-working-context-change',refresh);window.removeEventListener('wayvida-organization-change',refresh);window.removeEventListener('storage',refresh)}},[]);
 const context=getCurrentOrganizationContext(),organisations=getAccessibleOrganizations(),cashAccounts=moneyAccounts(accounts),isExpense=form.transactionType==='expense',isIncome=form.transactionType==='income',isTransfer=form.transactionType==='transfer',isReceive=form.transactionType==='receive',isPayment=form.transactionType==='payment';
 const categoryAccounts=isExpense?accounts.filter(account=>account.type==='Expenses'):isIncome?accounts.filter(account=>account.type==='Income'):accounts.filter(account=>!cashAccounts.some(cash=>cash.code===account.code));
 const transaction=SIMPLE_TRANSACTION_TYPES.find(item=>item.value===form.transactionType),set=(key,value)=>setForm(current=>({...current,[key]:value}));
 const selectedOrg=organisations.find(o=>o.id===form.companyId)||context.company;
 const selectedBranch=selectedOrg.branches?.find(b=>b.id===form.branchId)||context.branch;
 let generated=null;try{generated=buildSimpleJournal({...form,accounts,organization:selectedOrg.name,branch:selectedBranch.name,description:form.notes})}catch{}
 const categoryValue=isExpense||isIncome?form.categoryAccount:form.counterpartyAccount;
 const categoryLabel=isExpense?'Expense Category':isIncome?'Income Category':isReceive?'Received From':isPayment?'Paid To':isTransfer?'To Account':'Debit Account';
 const moneyLabel=isExpense||isPayment?'Paid From':isIncome||isReceive?'Received Into':isTransfer?'From Account':'Credit Account';
 const save=()=>{setError('');try{const result=buildSimpleJournal({...form,accounts,organization:selectedOrg.name,branch:selectedBranch.name,description:form.notes}),now=new Date().toISOString();onSave({id:crypto.randomUUID(),number:'JV-2026-'+String(Date.now()).slice(-5),date:form.date,type:transaction.type,reference:form.reference,narration:form.notes,attachments:[],status:'Draft',createdBy:'Admin',createdAt:now,lines:result.lines,simpleTransaction:{transactionType:form.transactionType,label:transaction.label,categoryAccount:form.categoryAccount,moneyAccount:form.moneyAccount,counterpartyAccount:form.counterpartyAccount}})}catch(reason){setError(reason.message)}};
 return <section className="je-create je-create-compact je-simple-transaction"><header className="je-header-compact"><button onClick={onBack} aria-label="Back to journal entries"><IconArrowLeft size={19}/></button><div className="je-header-spacer"><span className="je-compact-title">Record Transaction</span><small className="je-header-hint">The accounting entry is generated automatically.</small></div></header><div className="je-form-card"><div className="je-form-grid"><label>Transaction Type *<select value={form.transactionType} onChange={event=>setForm(current=>({...current,transactionType:event.target.value,categoryAccount:'',moneyAccount:'',counterpartyAccount:''}))}>{SIMPLE_TRANSACTION_TYPES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Date *<input type="date" value={form.date} onChange={event=>set('date',event.target.value)}/></label><label>Reference number <span className="je-optional">Optional</span><input value={form.reference} onChange={event=>set('reference',event.target.value)} placeholder="Add an external reference"/></label><div className="wide je-scope-override"><OrganisationBranchScope organisations={organisations} companyIds={form.companyId?[form.companyId]:[]} branchIds={form.branchId?[form.branchId]:[]} onChange={next=>{set('companyId',next.companyId);set('branchId',next.branchId)}} showLine={false}/></div></div></div><div className="je-lines-card"><div className="je-lines-title"><div><h3>Transaction Details</h3><p>Choose what happened; Wayvida Books creates the balanced journal.</p></div></div><div className="je-form-grid"><label>{categoryLabel} *<JournalAccountPicker value={categoryValue} accounts={categoryAccounts} onChange={code=>isExpense||isIncome?set('categoryAccount',code):set('counterpartyAccount',code)}/></label><label>{moneyLabel} *<JournalAccountPicker value={form.moneyAccount} accounts={cashAccounts} onChange={code=>set('moneyAccount',code)}/></label><label>Amount *<input type="number" min="0.01" step="0.01" value={form.amount} onChange={event=>set('amount',event.target.value)} placeholder="0.00"/></label><label className="wide">Notes <span className="je-optional">Optional</span><input value={form.notes} onChange={event=>set('notes',event.target.value)} placeholder="Describe this transaction"/></label></div>{!cashAccounts.length&&<div className="je-error"><IconAlertTriangle size={18}/>Create an active Cash or Bank account in Charts of Accounts before recording this transaction.</div>}{generated&&<details className="je-details"><summary><span>Accounting Details</span><small>Generated journal</small><IconChevronDown size={16}/></summary><div className="je-details-body"><p>{generated.debit.name} <b>Dr {money(Math.round(Number(form.amount)*100))}</b></p><p>{generated.credit.name} <b>Cr {money(Math.round(Number(form.amount)*100))}</b></p><p className="je-balance-status ok"><IconCheck size={16}/>Debit equals credit</p></div></details>}{error&&<div className="je-error"><IconAlertTriangle size={18}/>{error}</div>}</div><footer><button type="button" onClick={onBack}>Cancel</button><button className="primary" type="button" onClick={save}>Record {transaction.label}</button></footer></section>;
}"""
        content = content[:start_idx] + new_form + content[end_idx:]

with open("src/JournalEntriesPro.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated JournalEntriesPro.jsx")
