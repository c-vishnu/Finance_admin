import re

with open('src/JournalEntriesPro.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add missing imports if not present
if 'import {command as invoiceCommand' not in content:
    imports_to_add = "import {command as invoiceCommand, outstanding} from './invoice-engine.js';\nimport {recordPurchasePayment} from './purchase-service.js';\n"
    content = content.replace("import {businessStatus", imports_to_add + "import {businessStatus")

start_str = 'function JournalForm({form,setForm,accounts,error,setError,totals,onBack,onCommit,onNavigate,viewMode,editing}){'
start_idx = content.find(start_str)

if start_idx != -1:
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
        new_form = \"\"\"function JournalForm({form,setForm,accounts,error,setError,totals,onBack,onCommit,onNavigate,viewMode,editing}){
   const [referenceType, setReferenceType] = useState('manual');
   const [selectedDoc, setSelectedDoc] = useState('');
   const [invoicesState] = useState(() => { try { return JSON.parse(localStorage.getItem('wayvida-accounting-v1') || '{}') } catch { return {} } });
   const [billsState] = useState(() => { try { return JSON.parse(localStorage.getItem('wayvida-purchase-bills-v1') || '{}') } catch { return {} } });
   
   const invoices = invoicesState.invoices || [];
   const bills = billsState.bills || [];

   const update=(id,key,value)=>{if(key==='account'&&value){recordRecentAccount(value);setHints(current=>current.length?[]:current)}setForm({...form,lines:form.lines.map(l=>l.id===id?{...l,[key]:value,...(key==='debit'&&value?{credit:''}:{}),...(key==='credit'&&value?{debit:''}:{})}:l)})};
   const difference=Math.abs(totals.debit-totals.credit),periodCheck=checkPeriod(form.date),missing=periodCheck.code==='PERIOD_NOT_CONFIGURED',typeField=viewMode==='business'?'Adjustment type':'Journal type',dateLocked=['PERIOD_HARD_LOCKED','PERIOD_APPROVAL_REQUIRED','PERIOD_CLOSING'].includes(periodCheck.code);
   const contextOrganizations=getAccessibleOrganizations();
   const lineScope=getScopeVisibility({organisations:contextOrganizations,label:'Journal lines'});
   const showOrganizationColumn=lineScope.showOrgColumn;
   const showBranchColumn=lineScope.showBranchColumn;
   const branchNamesFor=organization=>getBranchesForOrganisation(organization,contextOrganizations).map(branch=>branch.name);
   const alignLine=line=>{const fallbackOrganization=contextOrganizations[0]?.name||'',organization=showOrganizationColumn&&getBranchesForOrganisation(line.organization,contextOrganizations).length?line.organization:fallbackOrganization,branchNames=branchNamesFor(organization);if(!branchNames.length)return{...line,organization,branch:''};return{...line,organization,branch:showBranchColumn&&branchNames.includes(line.branch)?line.branch:branchNames[0]}};
   useEffect(()=>{const aligned=form.lines.map(alignLine);if(aligned.some((line,index)=>line.organization!==form.lines[index].organization||line.branch!==form.lines[index].branch))setForm(current=>({...current,lines:current.lines.map(alignLine)}))});
   const [templateList,setTemplateList]=useState(allTemplates),[templateName,setTemplateName]=useState(''),[frequency,setFrequency]=useState('None'),[hints,setHints]=useState([]);
   const isBlankLine=line=>!line.account&&!line.debit&&!line.credit&&!line.description,emptyCount=form.lines.filter(isBlankLine).length;
   const checks=postingChecks({form,totals,accounts,difference,periodOk:periodCheck.allowed,periodDetail:missing?'Accounting period is not configured':'Posting is unavailable for this period'});
   const blocking=checks.find(check=>!check.ok);
   const canPost=difference===0&&totals.debit>0&&periodCheck.allowed;
   const typeOptions=CREATE_JOURNAL_TYPES.includes(form.type)?CREATE_JOURNAL_TYPES:[...CREATE_JOURNAL_TYPES,form.type];
   const applyTemplate=(template,event)=>{const resolved=resolveTemplate(template,accounts);event.currentTarget.closest('details')?.removeAttribute('open');setForm({...form,type:resolved.type||form.type,narration:form.narration||resolved.narration,lines:resolved.rows.map(row=>({...emptyLine(),account:row.account,debit:row.debit,credit:row.credit,description:row.description}))});setFrequency(resolved.frequency||'None');setHints(resolved.rows.map((row,index)=>row.unresolved?Line  needs an account before it can post.:'').filter(Boolean));setError('')};
   const addLine=()=>{const next=[...form.lines,emptyLine()];setForm({...form,lines:next});requestAnimationFrame(()=>{const rows=document.querySelectorAll('.je-create .je-line:not(.head)');rows[rows.length-1]&&rows[rows.length-1].scrollIntoView({behavior:'smooth',block:'nearest'})})};
   const removeLine=id=>setForm({...form,lines:form.lines.filter(line=>line.id!==id)});
   const lineBranchOptions=line=>branchNamesFor(line.organization);
   const updateLineOrganization=(id,name)=>{const branches=getBranchesForOrganisation(name,contextOrganizations),branchName=branches.length?branches[0].name:'';setForm({...form,lines:form.lines.map(line=>line.id===id?{...line,organization:name,branch:branchName}:line)})};
   const removeEmptyLines=()=>{const kept=form.lines.filter(line=>!isBlankLine(line));while(kept.length<2)kept.push(emptyLine());setForm({...form,lines:kept});setHints([])};
   const saveAsTemplate=()=>{if(!templateName.trim())return;setTemplateList(saveCustomTemplate({name:templateName.trim(),type:form.type,narration:form.narration,frequency,lines:form.lines}));setTemplateName('');setError('')};
   
   const submit=targetStatus=>{
      setError('');
      if(referenceType === 'invoice' && selectedDoc) {
          const inv = invoices.find(i => i.id === selectedDoc);
          if(inv) {
              const payAmount = totals.debit;
              invoiceCommand(invoicesState, 'pay', {id: inv.id, amount: payAmount, date: form.date, bank: form.lines[0].account, reference: form.reference});
              localStorage.setItem('wayvida-accounting-v1', JSON.stringify(invoicesState));
          }
      } else if (referenceType === 'bill' && selectedDoc) {
          const bill = bills.find(b => b.id === selectedDoc);
          if(bill) {
              const payAmount = totals.credit;
              recordPurchasePayment(billsState, bill, {amount: payAmount, date: form.date, account: form.lines[0].account, reference: form.reference, type: 'Payment'});
              localStorage.setItem('wayvida-purchase-bills-v1', JSON.stringify(billsState));
          }
      }
      onCommit(targetStatus);
   };

   useEffect(() => {
       if (referenceType === 'invoice' && selectedDoc) {
           const inv = invoices.find(i => i.id === selectedDoc);
           if (inv) {
               const amt = outstanding(invoicesState, inv);
               setForm(f => ({...f, type: 'Payment Received', reference: inv.id, narration: Payment for invoice , lines: [{...emptyLine(), account: '1010', debit: amt, credit: ''}, {...emptyLine(), account: '1200', debit: '', credit: amt}]}));
           }
       } else if (referenceType === 'bill' && selectedDoc) {
           const bill = bills.find(b => b.id === selectedDoc);
           if (bill) {
               const amt = bill.total - (bill.payments?.reduce((s,p)=>s+p.amount,0) || 0);
               setForm(f => ({...f, type: 'Payment Made', reference: bill.id, narration: Payment for bill , lines: [{...emptyLine(), account: '2000', debit: amt, credit: ''}, {...emptyLine(), account: '1010', debit: '', credit: amt}]}));
           }
       }
   }, [referenceType, selectedDoc]);

   return <section className="je-create je-create-compact">
 <header className="je-header-compact">
  <button onClick={onBack} aria-label={viewMode==='business'?'Back to Financial Adjustments':'Back to journal entries'}><IconArrowLeft size={19}/></button>
  <div className="je-header-spacer">
   <span className="je-compact-title">{viewMode==='business'?JOURNAL_VIEW_LABELS.business.newEntry:'Create Journal Entry'}</span>
   {editing&&<small className="je-header-hint">Editing <b>{form.number}</b></small>}
  </div>
  <Status value={viewMode==='business'?businessStatus(form.status):form.status}/>
 </header>
 <div className="je-form-card">
  <div className="je-form-grid">
   <label>Transaction Workflow *<select value={referenceType} onChange={e => {setReferenceType(e.target.value); setSelectedDoc('')}}><option value="manual">Manual Journal Entry</option><option value="invoice">Customer Payment (against Invoice)</option><option value="bill">Vendor Payment (against Bill)</option></select></label>
   {referenceType === 'invoice' && <label>Select Invoice *<select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}><option value="">Choose an Invoice...</option>{invoices.map(i => <option key={i.id} value={i.id}>{i.id} - {i.customer}</option>)}</select></label>}
   {referenceType === 'bill' && <label>Select Bill *<select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}><option value="">Choose a Bill...</option>{bills.map(i => <option key={i.id} value={i.id}>{i.id} - {i.vendor}</option>)}</select></label>}
   <label className="je-date-field">Date *<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/><small className={dateLocked?'je-date-locked':''}>{dateLocked?<><IconLock size={12}/>{periodName(form.date)} is locked  posting unavailable{periodCheck.lock?<b>{periodCheck.lock.name}</b>:null}{onNavigate&&<button type="button" className="je-inline-action" onClick={()=>onNavigate('Period Lock')}>Request unlock</button>}</>:<>Accounting period: <strong>{periodName(form.date)}</strong></>}</small></label>
   <label>{typeField} *<select value={form.type} onChange={event=>setForm({...form,type:event.target.value})}>{typeOptions.map(value=><option key={value} value={value}>{viewMode==='business'?typeLabel(value,viewMode):value}</option>)}</select></label>
   <label>Reference number <span className="je-optional">Optional</span><input value={form.reference} onChange={event=>setForm({...form,reference:event.target.value})} placeholder="Add an external reference"/></label>
   <label>Reason *<input type="text" value={form.narration} onChange={event=>setForm({...form,narration:event.target.value})} placeholder={viewMode==='business'?'Example: Corrected wrong expense category':'Explain why this entry is created'}/></label>
  </div>
 </div>
 <div className="je-lines-card">
  <div className="je-lines-title">
   <div><h3>{viewMode==='business'?'Transaction Details':'Journal lines'}</h3><p>Enter one debit or credit per line. Totals must match before posting.{!showOrganizationColumn&&<> Posting to <b>{contextOrganizations[0]?.name||'?"'}</b>{!showBranchColumn&&<>  <b>{branchNamesFor(contextOrganizations[0]?.name)[0]||'?"'}</b></>}.</>}</p></div>
   <div className="je-lines-actions">
    <details className="je-template-menu"><summary><IconTemplate size={16}/>Use Template</summary><div><p>Start from a saved pattern, then adjust the amounts.</p>{templateList.map(template=><button type="button" key={template.id} onClick={event=>applyTemplate(template,event)}><b>{template.name}</b><small>{(viewMode==='business'?typeLabel(template.type,viewMode):template.type)||'General Journal'}{template.frequency&&template.frequency!=='None'?'  '+template.frequency:''}</small></button>)}<div className="je-template-save"><input value={templateName} onChange={event=>setTemplateName(event.target.value)} placeholder="Template name" aria-label="Template name"/><select value={frequency} onChange={event=>setFrequency(event.target.value)} aria-label="Repeat this entry">{RECURRENCE_OPTIONS.map(option=><option key={option} value={option}>{option}</option>)}</select><button type="button" onClick={saveAsTemplate}>Save template</button></div><small className="je-template-note">Templates and their repeat setting are stored separately from journal entries.</small></div></details>
   <button type="button" className="je-add-line" onClick={addLine}><IconPlus size={16}/>Add Journal Line</button>
   </div>
  </div>
  <div className="je-lines">
   <div className="head">
    <span className="je-account-col">Account *</span>
    <span className="je-notes-col">Description</span>
    {showOrganizationColumn&&<span className="je-scope-col">Organisation</span>}
    {showBranchColumn&&<span className="je-scope-col">Branch</span>}
    <span>Debit (INR)</span>
    <span>Credit (INR)</span>
    <span/>
   </div>
   {form.lines.map((line,index)=><div key={line.id} className="je-line">
    <div className="je-account-col">
     <JournalAccountPicker value={line.account} accounts={accounts} onChange={code=>update(line.id,'account',code)}/>
    </div>
    <div className="je-notes-col"><input aria-label="Description" value={line.description} onChange={event=>update(line.id,'description',event.target.value)} placeholder="Line description"/></div>
    {showOrganizationColumn&&<div className="je-scope-col"><select aria-label="Organisation" value={line.organization} onChange={event=>updateLineOrganization(line.id,event.target.value)}><option value="">None</option>{contextOrganizations.map(organization=><option key={organization.id} value={organization.name}>{organization.name}</option>)}</select></div>}
    {showBranchColumn&&<div className="je-scope-col"><select aria-label="Branch" value={line.branch} onChange={event=>update(line.id,'branch',event.target.value)}><option value="">None</option>{lineBranchOptions(line).map(name=><option key={name} value={name}>{name}</option>)}</select></div>}
    <div><input aria-label="Debit amount" type="number" min="0" step="0.01" value={line.debit} onChange={event=>update(line.id,'debit',event.target.value)} onBlur={removeEmptyLines} placeholder="0.00"/></div>
    <div><input aria-label="Credit amount" type="number" min="0" step="0.01" value={line.credit} onChange={event=>update(line.id,'credit',event.target.value)} onBlur={removeEmptyLines} placeholder="0.00"/></div>
    <div><button aria-label="Remove line" disabled={form.lines.length<=2} onClick={()=>removeLine(line.id)}><IconTrash size={16}/></button></div>
   </div>)}
  </div>
  <div className="je-totals">
   <span>Total</span>
   {showOrganizationColumn&&<span/>}
   {showBranchColumn&&<span/>}
   <b>{money(totals.debit)}</b>
   <b>{money(totals.credit)}</b>
   <em className={difference===0&&totals.debit>0?'balanced':'unbalanced'} aria-live="polite">
    {difference===0&&totals.debit>0?<><IconCheck size={16}/>Balanced</>:<><IconAlertTriangle size={16}/>Difference: {money(difference)}</>}
   </em>
  </div>
  {hints.map((hint,index)=><div key={index} className="je-hint" role="status"><IconInfoCircle size={16}/>{hint}</div>)}
  {error&&<div className="je-error" role="alert"><IconAlertTriangle size={18}/>{error}</div>}
  {blocking&&<div className="je-error je-blocking-error" role="alert"><IconAlertTriangle size={18}/><div><b>Cannot Post Journal</b><p>{blocking.reason}</p></div></div>}
 </div>
 <footer>
  <button onClick={onBack}>Cancel</button>
  <button onClick={()=>submit('Draft')}>Save as Draft</button>
  <button className="primary" disabled={!canPost} onClick={()=>submit(periodCheck.code==='PERIOD_APPROVAL_REQUIRED'?'Pending Approval':'Posted')}>
   {periodCheck.code==='PERIOD_APPROVAL_REQUIRED'?'Submit for Approval':'Post Journal'}
  </button>
 </footer>
 </section>;
}\"\"\"
        content = content[:start_idx] + new_form + content[end_idx:]
        with open('src/JournalEntriesPro.jsx', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Successfully updated JournalForm!')
    else:
        print('End index not found.')
else:
    print('Start string not found.')
