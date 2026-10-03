import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const readSrc = file => fs.readFileSync(path.resolve('src', file), 'utf8');

test('Banking Navigation conforms to required 4-part structure', () => {
  const nav = readSrc('Navigation.jsx');
  assert.match(nav, /label:\s*'Banking'/);
  assert.match(nav, /leaf\('Bank Accounts'\)/);
  assert.match(nav, /leaf\('Bank Transactions'\)/);
  assert.match(nav, /leaf\('Bank Reconciliation'\)/);
  assert.match(nav, /leaf\('Bank Transfers'\)/);
});

test('App routing mounts all Banking views', () => {
  const app = readSrc('App.jsx');
  assert.match(app, /'Bank Accounts'/);
  assert.match(app, /'Bank Transactions'/);
  assert.match(app, /'Bank Reconciliation'/);
  assert.match(app, /'Bank Transfers'/);
  assert.match(app, /<Banking/);
});

test('Banking.jsx uses Sales & Purchases design system and components', () => {
  const banking = readSrc('Banking.jsx');
  assert.match(banking, /invoiceWorkspace purchaseWorkspace/);
  assert.match(banking, /ivHeading registerHead/);
  assert.match(banking, /ivCard ivRegisterCard/);
  assert.match(banking, /ivInvoiceTable/);
  assert.match(banking, /StatusPill/);
  assert.match(banking, /EmptyState/);
  assert.match(banking, /itemsPage vendorsPage/);
  assert.match(banking, /itemCreatePage/);
  assert.match(banking, /TransferDialog/);
  assert.match(banking, /RecordTransactionDialog/);
  assert.match(banking, /JournalModal/);
});

test('BankReconciliation.jsx adheres to Sales & Purchases layout and StatusPill', () => {
  const recon = readSrc('BankReconciliation.jsx');
  assert.match(recon, /invoiceWorkspace purchaseWorkspace/);
  assert.match(recon, /ivHeading registerHead/);
  assert.match(recon, /ivCard ivRegisterCard/);
  assert.match(recon, /ivInvoiceTable/);
  assert.match(recon, /StatusPill/);
  assert.match(recon, /EmptyState/);
  assert.match(recon, /autoMatchReconciliation/);
});

test('Bank Accounts table row renders eye icon and 3-dot dropdown with Edit, Transactions, and Reconcile', () => {
  const banking = readSrc('Banking.jsx');
  assert.match(banking, /BankAccountRowActions/);
  assert.match(banking, /ivIconButton/);
  assert.match(banking, /<IconEye/);

  const rowActions = readSrc('BankAccountRowActions.jsx');
  assert.match(rowActions, /IconDotsVertical/);
  assert.match(rowActions, /soMoreButton/);
  assert.match(rowActions, /soActionMenu/);
  assert.match(rowActions, /label:\s*'Edit'/);
  assert.match(rowActions, /label:\s*'Transactions'/);
  assert.match(rowActions, /label:\s*'Reconcile'/);
});

test('Bank Transactions table shows Date & Type, merged Description & Reference, unified Amount (In/Out), Running Balance, and eye icon', () => {
  const banking = readSrc('Banking.jsx');
  assert.match(banking, /<th[^>]*>Date &amp; Type<\/th>/);
  assert.match(banking, /<th[^>]*>Description &amp; Reference<\/th>/);
  assert.match(banking, /<th[^>]*>Amount \(In \/ Out\)<\/th>/);
  assert.match(banking, /<th[^>]*>Running Balance<\/th>/);
  assert.match(banking, /aria-label={'View journal for '\s*\+\s*\(row\.journalId \|\| row\.voucher\)}/);
  assert.match(banking, /title="View Journal"/);
  assert.match(banking, /<IconEye\s+size=\{17\}\s*\/>/);

  // Check register card padding 0
  assert.match(banking, /ivCard ivRegisterCard" style={{ padding: 0, overflow: 'hidden' }}/);

  const purchasesCss = readSrc('purchases.css');
  assert.match(purchasesCss, /\.purchaseWorkspace \.ivRegisterCard\{overflow:visible;padding:0/);
});

test('Bank Reconciliation and Bank Transfers tables use merged 2-row columns and eye icon', () => {
  const recon = readSrc('BankReconciliation.jsx');
  assert.match(recon, /<th>Period &amp; Created By<\/th>/);
  assert.match(recon, /<th[^>]*>Closing \/ Opening<\/th>/);
  assert.match(recon, /<th>Completed By &amp; Date<\/th>/);
  assert.match(recon, /aria-label={'View reconciliation '\s*\+\s*row\.id}/);
  assert.match(recon, /title="View Reconciliation"/);
  assert.match(recon, /<IconEye\s+size=\{17\}\s*\/>/);
  assert.match(recon, /ivCard ivRegisterCard"/);

  const banking = readSrc('Banking.jsx');
  assert.match(banking, /<th[^>]*>Transfer # &amp; Date<\/th>/);
  assert.match(banking, /<th[^>]*>Transfer Path<\/th>/);
  assert.match(banking, /aria-label={'View journal for '\s*\+\s*\(row\.journalId \|\| row\.number\)}/);
  assert.match(banking, /<IconEye\s+size=\{17\}\s*\/>/);
});



