import re

with open('src/JournalEntriesPro.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace JournalRegister
old_register_pattern = r'const JournalRegister=\(\{terms,.*?</section>\};'
match = re.search(old_register_pattern, content, re.DOTALL)
if match:
    old_register = match.group(0)
    
    # We will replace the table headers and the table rows.
    # We'll use a string replace on old_register.
    
    new_register = old_register.replace(
        "['Voucher number','Date',viewMode==='business'?'Entry purpose':'Journal type','Source / reference','Debit total','Credit total','Status','Created by','Actions'].map(x=><th key={x}>{x}</th>)",
        "['Voucher number','Date','Transaction','Reference','Party','Category','Paid From/Into','Amount','Status','Actions'].map(x=><th key={x}>{x}</th>)"
    )
    
    row_old = "<td>{typeLabel(j.type,viewMode)}</td><td>{j.reference||'—'}</td><td>{money(t.debit)}</td><td>{money(t.credit)}</td><td><Status value={viewMode==='business'?businessStatus(j.status):j.status}/></td><td>{j.createdBy}</td><td><div className=\"je-row-actions\">"
    
    row_new = '''
    <td>{j.simpleTransaction?.label || typeLabel(j.type,viewMode)}</td>
    <td>{j.reference||'—'}</td>
    <td>{j.simpleTransaction?.counterpartyAccount || '—'}</td>
    <td>{j.simpleTransaction?.categoryAccount || '—'}</td>
    <td>{j.simpleTransaction?.moneyAccount || '—'}</td>
    <td>{money(Math.max(t.debit, t.credit))}</td>
    <td><Status value={viewMode==='business'?businessStatus(j.status):j.status}/></td>
    <td><div className="je-row-actions">
    '''
    # Wait, the row_old has createdBy, I should remove it.
    new_register = new_register.replace(row_old, row_new.replace("\\n", " ").strip())
    
    # Also adjust colSpan for empty state
    new_register = new_register.replace("colSpan={9}", "colSpan={10}")
    
    content = content[:match.start()] + new_register + content[match.end():]
    
    with open('src/JournalEntriesPro.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully.")
else:
    print("Pattern not found.")
