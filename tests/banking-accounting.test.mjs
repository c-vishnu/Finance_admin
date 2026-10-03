import test from 'node:test';
import assert from 'node:assert/strict';

import { initial, journal, seedAccounts } from '../src/invoice-engine.js';
import {
  initialBanking,
  bookBalance,
  saveBankAccount,
  transferMoney,
  recordManualTransaction,
  allBankTransfers,
  allBankTransactions,
  createBankingDemo,
  createReconciliation,
  matchStatement,
  importStatement,
  autoMatchReconciliation,
  reconciliationDetails,
  completeReconciliation
} from '../src/banking-service.js';

test('Banking Accounting Test Suite (Section 54)', async (t) => {
  const seed = {
    Assets: [
      ['1100', 'Accounts Receivable'],
      ['1010', 'HDFC Bank'],
      ['1020', 'ICICI Bank']
    ],
    Liabilities: [
      ['2000', 'Accounts Payable'],
      ['2100', 'GST Payable']
    ],
    Equity: [
      ['3000', 'Opening Balance Equity']
    ],
    Income: [
      ['4000', 'Sales Revenue'],
      ['4100', 'Service Income'],
      ['4200', 'Interest Income']
    ],
    Expenses: [
      ['5000', 'Cost of Goods Sold'],
      ['5900', 'Rounding'],
      ['6100', 'Bank Charges']
    ]
  };

  // Setup baseline accounting & banking state
  let accounting = seedAccounts(initial(), seed);
  let banking = initialBanking();

  // Create two bank accounts: HDFC (1010) and ICICI (1020)
  const hdfcRes = saveBankAccount(banking, accounting, {
    bankName: 'HDFC Bank',
    accountName: 'HDFC Current Account',
    accountNumber: '50100012345678',
    accountType: 'Current Account',
    branch: 'Kochi Branch',
    organisation: 'ABC Technologies Pvt Ltd',
    ifsc: 'HDFC0000123',
    currency: 'INR',
    status: 'Active',
    accountCode: '1010',
    openingBalance: '100000', // ₹1,00,000 opening balance
    openingBalanceDate: '2026-09-01'
  });
  banking = hdfcRes.banking;
  accounting = hdfcRes.accounting;
  const hdfcId = hdfcRes.record.id;

  const iciciRes = saveBankAccount(banking, accounting, {
    bankName: 'ICICI Bank',
    accountName: 'ICICI Current Account',
    accountNumber: '210501987654',
    accountType: 'Current Account',
    branch: 'Kochi Branch',
    organisation: 'ABC Technologies Pvt Ltd',
    ifsc: 'ICIC0000456',
    currency: 'INR',
    status: 'Active',
    accountCode: '1020',
    openingBalance: '50000', // ₹50,000 opening balance
    openingBalanceDate: '2026-09-01'
  });
  banking = iciciRes.banking;
  accounting = iciciRes.accounting;
  const iciciId = iciciRes.record.id;

  // Verify Opening Balances
  // Opening balance journal: Dr Bank, Cr 3000 Opening Balance Equity
  assert.equal(bookBalance(accounting, '1010'), 10000000, 'HDFC initial balance should be ₹1,00,000 (in cents)');
  assert.equal(bookBalance(accounting, '1020'), 5000000, 'ICICI initial balance should be ₹50,000 (in cents)');

  await t.test('TEST 1: Customer Invoice + Payment Received', () => {
    // 1. Post Customer Invoice ₹50,000 (Dr 1100 AR, Cr 4000 Sales)
    const invAmount = 5000000; // ₹50,000 in cents
    journal(accounting, { id: 'inv-test-1', number: 'INV-2026-001' }, 'Sales Invoice', [
      { account: '1100', debit: invAmount, credit: 0, description: 'Sales Invoice INV-2026-001' },
      { account: '4000', debit: 0, credit: invAmount, description: 'Sales Revenue' }
    ], '2026-09-05', 'token:inv-1');

    assert.equal(bookBalance(accounting, '1100'), invAmount, 'AR balance should reflect invoice ₹50,000');

    // 2. Post Payment Received ₹50,000 (Dr 1010 HDFC Bank, Cr 1100 AR)
    const prevHdfc = bookBalance(accounting, '1010');
    journal(accounting, { id: 'rcpt-test-1', number: 'PR-2026-001' }, 'Customer Receipt', [
      { account: '1010', debit: invAmount, credit: 0, description: 'Customer payment received for INV-2026-001' },
      { account: '1100', debit: 0, credit: invAmount, description: 'Customer receipt' }
    ], '2026-09-06', 'token:rcpt-1');

    // Verify: Accounts Receivable reduced to 0
    assert.equal(bookBalance(accounting, '1100'), 0, 'AR balance should be reduced to 0');
    // Verify: Bank balance increased by ₹50,000
    assert.equal(bookBalance(accounting, '1010'), prevHdfc + invAmount, 'HDFC bank balance should have increased by ₹50,000');
    
    // Verify allBankTransactions sees this without duplicate entry
    const txs = allBankTransactions(accounting, banking, { bankAccountId: hdfcId });
    const rcptTx = txs.filter(t => t.reference === 'PR-2026-001' || t.number === 'PR-2026-001');
    assert.equal(rcptTx.length, 1, 'Only 1 transaction for PR-2026-001 (no duplicate)');
    assert.equal(rcptTx[0].moneyIn, invAmount);
    assert.equal(rcptTx[0].type, 'Payment Received');
  });

  await t.test('TEST 2: Purchase Bill + Payment Made', () => {
    // 1. Post Purchase Bill ₹30,000 (Dr 5000 Expense, Cr 2000 AP)
    const billAmount = 3000000; // ₹30,000 in cents
    journal(accounting, { id: 'bill-test-1', number: 'BILL-2026-001' }, 'Purchase Bill', [
      { account: '5000', debit: billAmount, credit: 0, description: 'Purchase Bill BILL-2026-001' },
      { account: '2000', debit: 0, credit: billAmount, description: 'Accounts Payable' }
    ], '2026-09-07', 'token:bill-1');

    // 2. Post Payment Made ₹30,000 (Dr 2000 AP, Cr 1010 HDFC Bank)
    const prevHdfc = bookBalance(accounting, '1010');
    journal(accounting, { id: 'pay-test-1', number: 'VPAY-2026-001' }, 'Vendor Payment', [
      { account: '2000', debit: billAmount, credit: 0, description: 'Vendor payment for BILL-2026-001' },
      { account: '1010', debit: 0, credit: billAmount, description: 'Vendor payment' }
    ], '2026-09-08', 'token:pay-1');

    // Verify: Accounts Payable reduced to 0
    assert.equal(bookBalance(accounting, '2000'), 0, 'AP balance should be reduced to 0');
    // Verify: Bank balance decreased by ₹30,000
    assert.equal(bookBalance(accounting, '1010'), prevHdfc - billAmount, 'HDFC balance should have decreased by ₹30,000');

    // Verify allBankTransactions sees this without duplicate entry
    const txs = allBankTransactions(accounting, banking, { bankAccountId: hdfcId });
    const payTx = txs.filter(t => t.reference === 'VPAY-2026-001' || t.number === 'VPAY-2026-001');
    assert.equal(payTx.length, 1, 'Only 1 transaction for VPAY-2026-001 (no duplicate)');
    assert.equal(payTx[0].moneyOut, billAmount);
    assert.equal(payTx[0].type, 'Payment Made');
  });

  await t.test('TEST 3: Bank Transfer (HDFC -> ICICI)', () => {
    const prevHdfc = bookBalance(accounting, '1010');
    const prevIcici = bookBalance(accounting, '1020');
    const totalCashBefore = prevHdfc + prevIcici;
    const transferAmount = '20000'; // ₹20,000

    // Validate same-account transfer is rejected
    assert.throws(() => {
      transferMoney(banking, accounting, {
        fromAccountId: hdfcId,
        toAccountId: hdfcId,
        amount: transferAmount,
        date: '2026-09-09'
      });
    }, /different/i, 'Same account transfer should be rejected');

    // Execute transfer
    const res = transferMoney(banking, accounting, {
      fromAccountId: hdfcId,
      toAccountId: iciciId,
      amount: transferAmount,
      date: '2026-09-09',
      reference: 'TRF-TEST-001',
      notes: 'Transfer to ICICI for operations'
    });
    banking = res.banking;
    accounting = res.accounting;

    // Verify: HDFC decreases by ₹20,000
    assert.equal(bookBalance(accounting, '1010'), prevHdfc - 2000000, 'HDFC decreased by ₹20,000');
    // Verify: ICICI increases by ₹20,000
    assert.equal(bookBalance(accounting, '1020'), prevIcici + 2000000, 'ICICI increased by ₹20,000');
    // Verify: Total cash/bank position unchanged
    const totalCashAfter = bookBalance(accounting, '1010') + bookBalance(accounting, '1020');
    assert.equal(totalCashAfter, totalCashBefore, 'Total cash/bank position must remain unchanged');

    // Verify Bank Transfer is recorded
    const transfers = allBankTransfers(banking, accounting);
    assert.ok(transfers.some(t => t.number === 'TRF-TEST-001'), 'Transfer TRF-TEST-001 should be present in transfers list');
  });

  await t.test('TEST 4: Bank Charge', () => {
    const prevHdfc = bookBalance(accounting, '1010');
    const prevCharges = bookBalance(accounting, '6100');

    // Record manual transaction for bank charge ₹500
    const res = recordManualTransaction(banking, accounting, {
      bankAccountId: hdfcId,
      date: '2026-09-10',
      type: 'Bank Charge',
      amount: '500',
      counterAccount: '6100',
      description: 'Monthly account maintenance charge',
      reference: 'CHG-TEST-001'
    });
    banking = res.banking;
    accounting = res.accounting;

    // Verify: HDFC decreases by ₹500
    assert.equal(bookBalance(accounting, '1010'), prevHdfc - 50000, 'HDFC decreased by ₹500');
    // Verify: Bank charges expense increases by ₹500
    assert.equal(bookBalance(accounting, '6100'), prevCharges + 50000, 'Bank Charges expense increased by ₹500');

    // Double entry check: journal debits === credits
    const j = res.journal;
    const debits = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const credits = j.lines.reduce((s, l) => s + (l.credit || 0), 0);
    assert.equal(debits, credits, 'Debits and credits must be equal');
  });

  await t.test('TEST 5: Bank Reconciliation', () => {
    // Import bank statement for HDFC
    const hdfcBookBal = bookBalance(accounting, '1010');
    const reconDraft = createReconciliation(banking, accounting, {
      bankAccountId: hdfcId,
      periodFrom: '2026-09-01',
      periodTo: '2026-09-30',
      financialYear: 'FY 2026–27',
      statementClosingBalance: hdfcBookBal / 100 // exact statement balance matches book balance
    });
    banking = reconDraft.banking;
    const reconId = reconDraft.reconciliation.id;

    // Import statement rows corresponding to the book transactions
    const imported = importStatement(banking, hdfcId, [
      { date: '2026-09-06', reference: 'PR-2026-001', description: 'Customer Payment', debit: '', credit: '50000', balance: '150000' },
      { date: '2026-09-08', reference: 'VPAY-2026-001', description: 'Vendor Payment', debit: '30000', credit: '', balance: '120000' },
      { date: '2026-09-09', reference: 'TRF-TEST-001', description: 'Transfer to ICICI', debit: '20000', credit: '', balance: '100000' },
      { date: '2026-09-10', reference: 'CHG-TEST-001', description: 'Bank Charge', debit: '500', credit: '', balance: '99500' }
    ], { reconciliationId: reconId, fileName: 'hdfc-sep.csv' });
    banking = imported.banking;

    // Run auto-match
    const autoMatchRes = autoMatchReconciliation(banking, accounting, reconId);
    banking = autoMatchRes.banking;

    // Verify matching
    assert.ok(autoMatchRes.matched >= 4, 'All 4 transactions should match automatically');

    // Verify difference is 0 and complete reconciliation
    const details = reconciliationDetails(banking, accounting, reconId);
    assert.equal(details.difference, 0, 'Reconciliation difference should be 0');

    const completed = completeReconciliation(banking, accounting, reconId);
    banking = completed.banking;
    const lockedRecon = banking.reconciliations.find(r => r.id === reconId);
    assert.equal(lockedRecon.status, 'Locked', 'Reconciliation should be locked on completion');
  });
});
