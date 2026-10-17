import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DASH, INCOME_STATUSES, RECEIPT_AWAITING, RECEIPT_RECEIVED, incomeExportSheet, incomeReport
} from '../src/business-reports.js';
import {createIncome, reverseIncome, seedOperations, updateIncome} from '../src/operations-store.js';
import {initial} from '../src/invoice-engine.js';
import {getScopeVisibility} from '../src/organisation-scope.js';

/* The page is read with its line endings normalised: the register's own assertions are about the
   markup the operator sees, not about the checkout's CRLF setting. */
const strip = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const page = strip(new URL('../src/IncomeReport.jsx', import.meta.url));
const css = strip(new URL('../src/business-reports.css', import.meta.url));
const drawerCss = strip(new URL('../src/income-detail-drawer.css', import.meta.url));
const form = strip(new URL('../src/CreateIncomePage.jsx', import.meta.url));
const receipt = strip(new URL('../src/Receipts.jsx', import.meta.url));
const ledger = () => initial();
const context = extra => ({
  organisations: [{id: 'abc', code: 'ABC01', name: 'Wayvida Learning', branches: [{id: 'abc-kochi', name: 'Kochi'}]}],
  organisationName: 'Wayvida Learning', workingBranch: 'Kochi', ...extra
});

test('the register prints the nine columns the operator asks for, in that order', () => {
  const head = page.slice(page.indexOf('<thead>'), page.indexOf('</thead>'));
  const labels = [...head.matchAll(/<th>([^<]+)<\/th>/g)].map(match => match[1]);
  assert.deepEqual(labels, ['Date', 'Income No./Inv No.', 'Income From', 'Income Type', 'Received In', 'Amount', 'Reference Number', 'Status', 'Organisation', 'Branch', 'Actions'], 'the operator\'s order, with the two scope columns between Status and Actions');
  assert.ok(!head.includes('<th>Description</th>'), 'the old Description column left the register: the description survives in the search, the drawer and the export');
  for (const cell of ['<td>{dateText(entry.date)}</td>', '<td><strong>{entry.party}</strong></td>', '<td>{entry.category}</td>', '<td>{entry.receivedIn}</td>', '<td><b>{money(entry.amount)}</b></td>', '<td>{entry.reference}</td>'])
    assert.ok(page.includes(cell), cell + ' states the column');
  assert.ok(page.includes('{entry.documentNumber}'), 'the number cell prints the one document number the report resolved');
  assert.ok(page.includes('<th>Income No./Inv No.</th>\n                <th>Income From</th>'), 'Income No./Inv No. and Income From lead the row');
  assert.equal((page.match(/<StatusPill status={entry.status} tone={STATUS_TONES\[entry.status\] \|\| 'neutral'} \/>/g) || []).length, 1, 'Status prints through the shared pill');
});

test('the Organisation and Branch columns join the register only when the working context reaches past one', () => {
  assert.ok(page.includes('import { getScopeVisibility } from \'./organisation-scope.js\';'), 'the register reads the shared scope rule rather than its own count');
  assert.ok(page.includes("const visibility = getScopeVisibility({ organisations, label: 'Income' });"), 'one call decides both columns');
  assert.ok(page.includes('{showOrganisation && <th>Organisation</th>}') && page.includes('{showBranch && <th>Branch</th>}'), 'both headers are conditional');
  assert.ok(page.includes('{showOrganisation && <td>{entry.organisationName}</td>}') && page.includes('{showBranch && <td>{entry.branchName}</td>}'), 'and so is every cell');
  assert.ok(page.includes('const columnCount = 9 + (showOrganisation ? 1 : 0) + (showBranch ? 1 : 0);'), 'the printed column count follows the same two answers');
  assert.ok(page.includes('<td colSpan={columnCount} className="emptyStateCell">'), 'so the empty state spans exactly the columns on screen');

  const single = getScopeVisibility({organisations: [{id: 'abc', code: 'ABC01', name: 'Wayvida Learning', branches: [{id: 'abc-kochi', name: 'Kochi'}]}], label: 'Income'});
  assert.equal(single.showOrgColumn, false, 'one organisation keeps the Organisation column out');
  assert.equal(single.showBranchColumn, false, 'one branch keeps the Branch column out');
  const twoOrganisations = getScopeVisibility({organisations: [
    {id: 'abc', code: 'ABC01', name: 'Wayvida Learning', branches: [{id: 'abc-kochi', name: 'Kochi'}]},
    {id: 'nsr', code: 'NSR02', name: 'Northstar Traders', branches: [{id: 'nsr-tvm', name: 'Trivandrum'}]}
  ], label: 'Income'});
  assert.equal(twoOrganisations.showOrgColumn, true, 'two organisations print the Organisation column');
  assert.equal(twoOrganisations.showBranchColumn, true, 'and the Branch column with it');
  const twoBranches = getScopeVisibility({organisations: [{id: 'abc', code: 'ABC01', name: 'Wayvida Learning', branches: [{id: 'abc-kochi', name: 'Kochi'}, {id: 'abc-tvm', name: 'Trivandrum'}]}], label: 'Income'});
  assert.equal(twoBranches.showOrgColumn, false, 'one organisation still names no Organisation column');
  assert.equal(twoBranches.showBranchColumn, true, 'but two branches in scope print the Branch column');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th:nth-child(1){width:11%}'), 'the register pins its own leading column widths');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th:last-child{width:9%}'), 'and its trailing Actions column, so the extra columns cannot squeeze it to nothing');
  assert.ok(page.includes('<table className="incomeRegister">'), 'the widths are scoped to the Income register table alone');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th,\n.je-page .je-table-wrap table.incomeRegister td{overflow-wrap:normal!important;word-break:normal!important}'), 'the register takes ordinary word wrapping back from the global anywhere rule and from the journal sheet word-break, so a category name breaks at its own spaces and not inside a word');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister td:nth-child(1),\n.je-page .je-table-wrap table.incomeRegister td:nth-child(2),\n.je-page .je-table-wrap table.incomeRegister td:nth-child(6),\n.je-page .je-table-wrap table.incomeRegister td:nth-child(7){white-space:nowrap!important}'), 'while the date, the document number, the amount and the reference stay on one line, so a money figure is never split between its own digits');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister td:nth-child(6){font-variant-numeric:tabular-nums!important}'), 'and the amounts are set in figures that line up down the column');
});

test('every row ends in one shared menu carrying View, Edit, Duplicate and Cancel Income', () => {
  assert.ok(page.includes('<div className="je-row-actions">'), 'the cell is the shared register row-actions shell');
  assert.ok(!page.includes('customerKebab') && !page.includes('customerMoreMenu'), 'the register no longer carries a second, private menu implementation');
  assert.equal((page.match(/<div className="je-row-actions">/g) || []).length, 1, 'one menu per row, in one place');
  assert.ok(page.includes("aria-label={'More actions for ' + entry.number}"), 'the trigger is labelled for the income it belongs to');
  assert.ok(page.includes('{rowActions(entry).map(action => {'), 'the entries come from one list');
  assert.ok(page.includes('const ActionIcon = action.icon;') && page.includes('<ActionIcon size={17} />'), 'each entry binds its icon to a name before rendering it: a dotted JSX tag such as <action.icon/> reads as the string "action", which is what took the whole register down');
  for (const label of ["label: 'View'", "label: 'Edit'", "label: 'Duplicate'", "label: 'Cancel Income'"])
    assert.ok(page.includes(label), label + ' is one of the four');
  assert.ok(page.indexOf("label: 'View'") < page.indexOf("label: 'Edit'") && page.indexOf("label: 'Edit'") < page.indexOf("label: 'Duplicate'") && page.indexOf("label: 'Duplicate'") < page.indexOf("label: 'Cancel Income'"), 'and they read in the brief\'s order');
  assert.ok(page.includes("const editable = entry.status === 'Draft';") && page.includes('disabled: !editable'), 'Edit is offered for a draft only');
  assert.ok(page.includes("reason: editable ? '' : 'Only a draft income can be edited. Cancel this income and record a new one instead.'"), 'and says why a recorded income cannot be edited');
  assert.ok(page.includes("const cancelled = entry.status === 'Cancelled';") && page.includes('danger: true, disabled: cancelled'), 'Cancel Income is the destructive entry, offered until the income is cancelled');
  assert.ok(page.includes("run: () => openForm(entry, false)") && page.includes('run: () => openForm(entry, true)'), 'Edit replaces the draft while Duplicate borrows its values');
  assert.ok(page.includes("title={action.reason || undefined}"), 'a disabled entry says what has to happen first rather than disappearing');
});

test('the register states the three lifecycle words and keeps a cancelled income on the page', () => {
  assert.deepEqual(INCOME_STATUSES, ['Draft', 'Recorded', 'Cancelled'], 'one vocabulary for the column and the filter');
  assert.ok(page.includes("const STATUS_TONES = { Draft: 'neutral', Recorded: 'ok', Cancelled: 'danger'"), 'each word carries its own tone');
  assert.ok(userStatus('Draft') === 'Draft' && userStatus('Posted') === 'Recorded' && userStatus('Pending') === 'Recorded' && userStatus('Reversed') === 'Cancelled', 'a stored word is reduced to the register\'s own three');
  const report = incomeReport({}, operations(), context());
  assert.equal(report.rows.length, 4, 'every income of the working organisation is stated, including the cancelled one');
  assert.deepEqual(report.rows.map(row => row.number), ['INC-00001', 'INC-00002', 'INC-00003', 'INC-00004'], 'the register is where an operator looks for the income they cancelled');
  assert.deepEqual(report.statusOptions, ['Draft', 'Recorded', 'Cancelled'], 'the filter offers only states a row is actually in');
  assert.equal(report.valid, true, 'and the register\'s own consistency checks pass, which is what lets the footer state them');
});

test('Received In states Cash or Bank, and the receivable ledger while the money is still owed', () => {
  const rows = incomeReport(book(), operations(), context()).rows;
  assert.equal(rows[0].receivedIn, 'Bank', 'the money landed in the bank, the second of the two answers the operator allows here');
  assert.equal(rows[1].receivedIn, 'Accounts Receivable', 'an income still owed states the ledger it is owed into, so the column is never left with a dash');
  assert.equal(rows[0].received, true, 'and the receipt itself is a fact of the row, which is what the Receipt filter reads');
  const named = incomeReport({...book(), accounts: [...book().accounts, {code: '1100', name: 'Trade Receivables'}]}, operations(), context()).rows;
  assert.equal(named[1].receivedIn, 'Trade Receivables', 'the book own receivable account name is stated when it resolves');
  const cash = incomeReport(book(), {incomes: [{id: 'c', number: 'INC-1', date: '2026-10-02', category: 'Other', receivedFrom: 'Walk-in customer', amount: 50000, received: true, paidThrough: '1000', method: 'Cash', status: 'Posted'}]}, context()).rows[0];
  assert.equal(cash.receivedIn, 'Cash', 'cash is the other answer, read off the account the money landed in');
  const elsewhere = incomeReport(book(), {incomes: [{id: 'o', number: 'INC-2', date: '2026-10-03', category: 'Other', receivedFrom: 'Someone', amount: 50000, received: true, paidThrough: '9999', status: 'Posted'}]}, context()).rows[0];
  assert.equal(elsewhere.receivedIn, 'Bank', 'and no third answer exists: another account is never printed as an account name');
  assert.ok(page.includes('<td>{entry.receivedIn}</td>'), 'the page prints the value the report stated rather than deriving it');
  assert.ok(!page.includes("'Accounts Receivable (1100)'"), 'the page still derives nothing: the report states the receivable ledger name');
});

test('the Receipt control narrows on the receipt without inventing a fourth status', () => {
  assert.equal(RECEIPT_RECEIVED, 'Received');
  assert.equal(RECEIPT_AWAITING, 'Awaiting receipt');
  const received = incomeReport(book(), operations(), context({receipt: RECEIPT_RECEIVED}));
  assert.deepEqual(received.rows.map(row => row.number), ['INC-00001', 'INC-00004'], 'the money that has arrived, cancelled or not');
  const awaiting = incomeReport(book(), operations(), context({receipt: RECEIPT_AWAITING}));
  assert.deepEqual(awaiting.rows.map(row => row.number), ['INC-00002', 'INC-00003'], 'and the money still owed');
  assert.ok(page.includes('<option value={RECEIPT_RECEIVED}>Received</option>') && page.includes('<option value={RECEIPT_AWAITING}>Awaiting receipt</option>'), 'the register offers exactly those two answers');
  assert.ok(!page.includes("const RECEIVED") && !page.includes("const AWAITING"), 'the page defines no receipt vocabulary of its own');
  assert.ok(page.includes('RECEIPT_AWAITING, RECEIPT_RECEIVED') || page.includes('RECEIPT_RECEIVED, RECEIPT_AWAITING'), 'it imports both words from the report that owns them');
});

test('the Excel sheet is the table it was exported from, scope columns included', () => {
  const plain = incomeExportSheet(incomeReport(book(), operations(), context()));
  assert.deepEqual(plain.header, ['Date', 'Income No./Inv No.', 'Income From', 'Income Type', 'Received In', 'Reference Number', 'Amount INR', 'Status'], 'the eight columns a single-organisation, single-branch context prints');
  assert.deepEqual(plain.rows[0], ['2026-10-01', 'INC-00001', 'Acme Corporation', 'Service Income', 'Bank', 'TXN-984321', 35000, 'Recorded'], 'with the row\'s own values, in rupees');
  assert.equal(plain.rows[1][5], 'AGR-2026-09', 'the reference the record filed under Ref / Agreement Number is the same column');
  assert.equal(plain.rows[2][5], DASH, 'and an income that recorded no reference states the dash rather than an empty cell');
  const scoped = incomeExportSheet(incomeReport(book(), operations(), context({showOrganisation: true, showBranch: true})));
  assert.deepEqual(scoped.header, ['Date', 'Income No./Inv No.', 'Income From', 'Income Type', 'Received In', 'Reference Number', 'Amount INR', 'Status', 'Organisation', 'Branch'], 'and the two scope columns join it exactly when the page printed them');
  assert.deepEqual(scoped.rows[0].slice(-2), ['Wayvida Learning', 'Kochi'], 'stating the organisation and branch per row');
});

test('a row is known by the invoice it was recorded against, and by its own number when there is none', () => {
  const linked = incomeReport(
    {...book(), invoices: [{id: 'inv-1', number: 'INV-0007', status: 'Posted'}]},
    {incomes: [{id: 'inc-1', number: 'INC-00001', date: '2026-10-01', category: 'Service Income', receivedFrom: 'Acme Corporation', amount: 3500000, received: true, paidThrough: '1010', salesInvoiceId: 'inv-1', status: 'Posted'}]},
    context()
  ).rows[0];
  assert.equal(linked.invoiceNumber, 'INV-0007', 'the linked invoice is resolved out of the book the register already reads');
  assert.equal(linked.documentNumber, 'INV-0007', 'and that is the number the column prints');
  assert.equal(linked.number, 'INC-00001', 'the income keeps its own number underneath, which the drawer and the row menu still name it by');
  const direct = incomeReport(book(), operations(), context()).rows[0];
  assert.equal(direct.invoiceNumber, '', 'an income recorded against no invoice has no invoice number');
  assert.equal(direct.documentNumber, 'INC-00001', 'so it is known by the number it was given when it was recorded');
  const dangling = incomeReport(
    book(),
    {incomes: [{id: 'inc-9', number: 'INC-00009', date: '2026-10-01', category: 'Service Income', receivedFrom: 'Acme Corporation', amount: 100, received: true, paidThrough: '1010', salesInvoiceId: 'gone', status: 'Posted'}]},
    context()
  ).rows[0];
  assert.equal(dangling.documentNumber, 'INC-00009', 'and so is one whose invoice has since left the book, which is never a blank cell');
});

test('the invoice a row is known by is chosen on the Record Income surface, out of the book it posts into', () => {
  const liveStart = form.indexOf('inc-reference-page');
  const liveEnd = form.indexOf('<section className="rt-page itemCreatePage je-create inc-create-page"');
  const live = form.slice(liveStart, liveEnd);
  assert.ok(liveStart >= 0 && liveEnd > liveStart, 'the surface the operator reaches is the one read here');
  assert.ok(live.includes('<label className="inc-invoice-field"><span>Invoice</span><select'), 'the link is offered on that surface, not only on the design it replaced: one labelled field holding the payer own unpaid invoices');
  assert.ok(live.includes('{(payerInvoices.length > 0 || linkedInvoice) && ('), 'and only while it has an invoice to offer: the book holds one and either the payer owes on it or the record already names it');
  assert.ok(live.includes("onChange={e => setField('salesInvoiceId', e.target.value)}"), 'the invoice chosen writes the field the record already stored');
  assert.ok(live.includes('payerInvoices.map(inv =>') && live.includes('<option key={inv.id} value={inv.id}>'), 'one option per invoice of the payer chosen, keyed and valued by its id');
  assert.ok(!live.includes('salesInvoices.map(inv =>'), 'and never every invoice in the book, which was the whole-book list this replaces');
  assert.ok(live.includes('{invoiceFieldPlaceholder}'), 'and the field may be left blank: no invoice has to be named for the money to be recorded');
  assert.ok(form.includes('const filed = readAccounts()?.invoices;'), 'the list is read out of the book the income is posted into, which is the book the register reads it back from');
  assert.ok(form.includes("if (Array.isArray(filed) && filed.length) return filed.filter(inv => inv.status !== 'Cancelled');"), 'a cancelled invoice is never offered');
  assert.ok(form.includes('salesInvoiceId: form.salesInvoiceId,'), 'and the link is saved with the record');
});

test('the Invoice link offers the payer’s unpaid invoices, read the way the receipt’s Unpaid invoices section reads them', () => {
  assert.ok(form.includes('const payerInvoices = form.customerId'), 'the list is built from the payer the operator chose, not from the book');
  assert.ok(form.includes("eligibleInvoices(accounts, { customerId: form.customerId, branchId: branch?.id || '', organisationId: company?.id || '' })"), 'through the same eligibility rule the allocation table uses - the customer, the permitted branch and the organisation');
  assert.ok(form.includes('const openInvoices = !isInvoicePayment'), 'so the table and the link read ONE list, the table only while this is a settlement');
  assert.ok(form.includes('? sampleOutstandingInvoices(form.customerId, form.receivedFrom)'), 'with the samples standing in on that table alone while the payer owes nothing, so the link is never offered one');
  assert.ok(form.includes('const linkedInvoice = form.salesInvoiceId ? salesInvoices.find(invoice => invoice.id === form.salesInvoiceId) : null;'), 'while the invoice an existing record already names is looked up separately');
  assert.ok(form.includes("      salesInvoiceId: '',"), 'and choosing a new payer clears the old link with the old allocations, so one customer’s invoice is never linked to another’s money');
  assert.ok(form.includes('already settled'), 'a link whose invoice has since been paid stays readable on the record it was saved with');
  assert.ok(!form.includes('-- Select who paid you to see their invoices --'), 'the two empty answers a hidden field could never read - nobody chosen yet, and a payer who owes nothing - are gone with the states that reached them');
  assert.ok(!form.includes('-- No unpaid invoices for this customer --'), 'so no sentence on this page promises a list the field is not drawing');
  assert.ok(form.includes('The allocation below decides which invoices this money settles.'), 'and on a settlement the link stands down, because the table below is what chooses the invoices');
  assert.ok(receipt.includes('<h3>Unpaid invoices <small>Optional · leave blank to allocate later</small></h3>'), 'which is where those words were read: the receipt files its invoices under them, and this page reads the same payer-scoped list');
});

test('an income that names no organisation or branch is read as the one the operator is working in', () => {
  const rows = incomeReport(book(), operations(), context({showOrganisation: true, showBranch: true})).rows;
  assert.ok(rows.every(row => row.organisationName === 'Wayvida Learning'), 'the working organisation, never a blank cell');
  assert.ok(rows.every(row => row.branchName === 'Kochi'), 'and the working branch');
  const foreign = incomeReport(book(), {incomes: [{id: 'x', number: 'INC-9', date: '2026-10-01', category: 'Other', receivedFrom: 'Elsewhere', amount: 100, status: 'Posted', companyId: 'zzz'}]}, context());
  assert.deepEqual(foreign.rows, [], 'an income of another organisation stays out of the register');
  assert.equal(foreign.excludedOtherOrganisation, 1, 'and is counted as excluded rather than silently dropped');
});

test('editing is the draft-only write the register offers', () => {
  const draft = createIncome(seedOperations(), ledger(), {date: '2026-10-16', name: 'Draft retainer', category: 'Service Income', receivedFrom: 'Beta', account: '4100', amount: 1000, received: false, status: 'Draft'});
  assert.equal(draft.record.status, 'Draft', 'a saved draft is a draft');
  assert.equal(draft.record.journalId, undefined, 'and has posted nothing to the ledger');
  const edited = updateIncome(draft.store, ledger(), draft.record.id, {date: '2026-10-17', name: 'Draft retainer v2', category: 'Service Income', receivedFrom: 'Beta', account: '4100', amount: 2500, received: true, paidThrough: '1000', tax: 'No tax', taxMode: 'exclusive'});
  assert.equal(edited.record.number, draft.record.number, 'the income keeps the number it was given');
  assert.equal(edited.record.status, 'Posted', 'and the edit is what recorded it');
  assert.ok(edited.record.journalId, 'which is the moment it reaches the ledger');
  const recorded = createIncome(edited.store, ledger(), {date: '2026-10-16', name: 'Recorded income', category: 'Service Income', receivedFrom: 'Acme', account: '4100', amount: 5000, received: true});
  assert.throws(() => updateIncome(recorded.store, ledger(), recorded.record.id, {date: '2026-10-16', amount: 1, received: true}), /Only a draft income can be edited/, 'a recorded income is corrected by cancelling it and recording a new one, never rewritten under the operator');
  assert.equal(reverseIncome(recorded.store, ledger(), recorded.record.id).record.status, 'Cancelled', 'and cancelling it is the route the register offers');
});

test('the receipt action lives on the drawer, where the record\'s own facts are', () => {
  assert.ok(page.includes('>Mark as received</button>'), 'the drawer footer carries it');
  assert.ok(page.includes("className=\"irReceive\""), 'as the drawer\'s one affirmative action');
  assert.ok(page.includes("activeDrawerIncome.status === 'Recorded' && !activeDrawerIncome.received"), 'offered for a recorded income whose money has not arrived, which a draft is not');
  assert.ok(page.includes('onClick={() => setMarkPaidModal(activeDrawerIncome)}'), 'and it reuses the receipt dialog the register already owned');
  assert.ok(drawerCss.includes('.irOverlay .irDrawer>footer button.irReceive{border-color:#a7dcbd;background:#f0fdf4;color:#047857}'), 'styled with every rule scoped above the shared shell');
});

test('every column of the register takes one inset, so the gap between any two of them is the same number', () => {
  const base = '.je-page .je-table-wrap table.incomeRegister th,\n.je-page .je-table-wrap table.incomeRegister td{padding-left:12px!important;padding-right:12px!important}';
  assert.ok(css.includes(base), 'one inset for every column, header cell and body cell alike');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th:first-child,\n.je-page .je-table-wrap table.incomeRegister td:first-child{padding-left:16px!important}'), 'the first cell keeps the card\'s own left gutter');
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th:last-child,\n.je-page .je-table-wrap table.incomeRegister td:last-child{padding-right:16px!important}'), 'and the Actions cell the right one, so the row still lines up with the heading above it');
  const narrow = '@media(max-width:1050px){\n .je-page .je-table-wrap table.incomeRegister th,';
  assert.ok(css.indexOf(narrow) > css.indexOf(base), 'the narrow step is declared after the base rule, so it is the one that wins below 1050px');
  assert.ok(css.includes(' .je-page .je-table-wrap table.incomeRegister th,\n .je-page .je-table-wrap table.incomeRegister td{padding-left:6px!important;padding-right:6px!important}'), 'and there every column tightens by the same amount');
  assert.ok(css.includes(' .je-page .je-table-wrap table.incomeRegister td:first-child{padding-left:10px!important}') && css.includes(' .je-page .je-table-wrap table.incomeRegister td:last-child{padding-right:10px!important}'), 'the outer gutters tightening with them');
  assert.ok(css.includes('THE COLUMN GAP') && css.includes('24px on the right of') && css.includes('18px on the right of'), 'the rule names the Journal paddings it replaces: the Journal ID cell\'s 24px and the Particulars cell\'s 18px');
  assert.ok(!css.includes('.je-page .je-table-wrap table.incomeRegister td:nth-child(2){padding-right'), 'and no column carries a one-sided inset of its own again');
});

function book() {
  return {accounts: [{code: '4100', name: 'Service Income'}, {code: '1010', name: 'Bank Account'}], journals: []};
}

function operations() {
  return {incomes: [
    {id: 'inc-1', number: 'INC-00001', date: '2026-10-01', name: 'Website design', category: 'Service Income', receivedFrom: 'Acme Corporation', amount: 3500000, account: '4100', received: true, paidThrough: '1010', reference: 'TXN-984321', status: 'Posted', journalId: 'JE-DEMO-INC-01'},
    {id: 'inc-2', number: 'INC-00002', date: '2026-10-05', name: 'Advisory retainer', category: 'Consultancy Income', receivedFrom: 'Apex Systems', amount: 2000000, account: '4400', received: false, accountReceivable: '1100', referenceNo: 'AGR-2026-09', status: 'Pending'},
    {id: 'inc-3', number: 'INC-00003', date: '2026-10-08', name: 'Commission draft', category: 'Commission Income', receivedFrom: 'Cloudstack Services', amount: 450000, account: '4300', received: false, status: 'Draft'},
    {id: 'inc-4', number: 'INC-00004', date: '2026-10-10', name: 'Reversed interest', category: 'Interest Income', receivedFrom: 'HDFC Bank', amount: 125000, account: '4200', received: true, paidThrough: '1010', status: 'Reversed'}
  ]};
}

function userStatus(status) {
  return incomeReport(book(), {incomes: [{id: 's', number: 'INC-1', date: '2026-10-01', category: 'Other', receivedFrom: 'Someone', amount: 100, status}]}, context()).rows[0].status;
}

/* The figures in this register were printed left, while the Sales and Purchases registers print
   theirs through .brMoney, which sets them right. A money column that starts at a different place
   on every row cannot be read down, which is the one thing a register is for. */
test('the register prints its money the way every other register does', () => {
  assert.ok(css.includes('.je-page .je-table-wrap table.incomeRegister th:nth-child(6),\n.je-page .je-table-wrap table.incomeRegister td:nth-child(6){text-align:right!important}'), 'the Amount column is set right, header and figure together');
  assert.ok(css.includes('.brMoney{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}'), 'which is the house rule the Sales and Purchases registers print their money through');
  assert.ok(page.includes('<td><b>{money(entry.amount)}</b></td>'), 'and the figure the report resolved is still the one the row states');
});
