import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCE_SUPPLIES, GOODS_SUPPLY, GST_TREATMENTS, SERVICES_SUPPLY, TAXABLE_TREATMENT, TAX_MODES,
  UNKNOWN_SUPPLY, UNTAXED_TREATMENTS, additionalGst, advanceTax, configuredRates, directIncomeTax,
  gstRateOf, gstSplit, gstSummary, placeOfSupply, taxLabelOf, taxModeFromSettings
} from '../src/income-tax.js';

/* GST on the money Record Income records, checked as arithmetic rather than as claims. The three
   workflows the page offers ask three different questions - what an invoice settlement adds (nothing),
   how one direct receipt splits between income and the tax it carries, and whether a held remainder
   is chargeable when the money arrives - and every case below states the rupees that went in and the
   exact paise that must come out. Amounts handed in are rupee values read through `paise()`; every
   figure asserted is an integer number of paise, which is what makes "no floating-point arithmetic"
   checkable here rather than asserted in a comment. */

/* ---------------------------------------------------------------- the vocabulary */

test('the treatment vocabulary is the book\'s own, and Taxable is the one that charges tax', () => {
  assert.ok(GST_TREATMENTS.includes(TAXABLE_TREATMENT), 'Taxable is one of the book\'s treatments');
  assert.ok(UNTAXED_TREATMENTS.length > 0, 'and the treatments that charge nothing are the rest of them');
  assert.ok(!UNTAXED_TREATMENTS.includes(TAXABLE_TREATMENT), 'Taxable is never also an untaxed treatment');
  assert.deepEqual([...ADVANCE_SUPPLIES].sort(), [GOODS_SUPPLY, SERVICES_SUPPLY, UNKNOWN_SUPPLY].sort(), 'an advance can be for goods, services, or a supply nobody has classified yet');
  assert.deepEqual(TAX_MODES, ['inclusive', 'exclusive']);
});

test('the tax label and the rate it names are one number in two spellings', () => {
  assert.equal(gstRateOf('GST 18%'), 18);
  assert.equal(gstRateOf('GST 5%'), 5);
  assert.equal(gstRateOf('Non-GST / Exempt'), 0, 'a label that names no rate reads as none');
  assert.equal(gstRateOf(''), 0);
  assert.equal(gstRateOf('GST 180%'), 0, 'a rate outside 0-100 is not a rate');
  assert.equal(taxLabelOf(18), 'GST 18%');
  assert.equal(taxLabelOf(0), 'Non-GST / Exempt');
  assert.equal(gstRateOf(taxLabelOf(12)), 12, 'the round trip keeps the same number');
});

test('the organisation default decides the calculation mode, and nothing else does', () => {
  assert.equal(taxModeFromSettings({tax: {priceTreatment: 'Tax inclusive'}}), 'inclusive');
  assert.equal(taxModeFromSettings({tax: {priceTreatment: 'Tax exclusive'}}), 'exclusive');
  assert.equal(taxModeFromSettings(null), 'exclusive', 'a book that states nothing is read as exclusive');
});

test('the offered rates come from the book\'s own configuration, never from a hardcoded slab list', () => {
  const rates = configuredRates({
    categories: [{name: 'Interest', status: 'Active', tax: 'GST 18%'}, {name: 'Rent', status: 'Inactive', tax: 'GST 12%'}],
    settings: {tax: {defaultGstRate: 5}},
    accounts: [{gstRate: 18, taxMode: 'validate'}, {gstRate: 28}]
  });
  assert.deepEqual(rates, [5, 18], 'the active category rate, the default and the validating account rate, deduped and sorted - an inactive category contributes nothing and an account that does not validate contributes nothing');
  assert.deepEqual(configuredRates(), [], 'a book that names no rate is offered none');
  assert.deepEqual(configuredRates({categories: [{name: 'Fee', status: 'Active', tax: 'Non-GST / Exempt'}], settings: {tax: {defaultGstRate: 0}}}), [], 'and a book naming only exempt income is offered none either');
});

/* ---------------------------------------------------------------- place of supply */

test('CGST/SGST against IGST is decided from the two states, and an answer nobody has is stated not guessed', () => {
  assert.deepEqual(placeOfSupply({buyerState: 'Kerala', registeredState: 'Kerala'}), {supply: 'Kerala', intra: true, derived: false});
  assert.deepEqual(placeOfSupply({buyerState: 'Karnataka', registeredState: 'Kerala'}), {supply: 'Karnataka', intra: false, derived: false});
  assert.deepEqual(placeOfSupply({buyerState: 'kerala', registeredState: 'Kerala'}), {supply: 'kerala', intra: true, derived: false}, 'case is not a different state');
  assert.deepEqual(placeOfSupply({buyerState: '', registeredState: 'Kerala'}), {supply: 'Kerala', intra: true, derived: true}, 'an unregistered payer is a supply inside the taxpayer\'s own state, and it says it derived that');
  assert.deepEqual(placeOfSupply({registeredState: ''}), {supply: '', intra: true, derived: true}, 'a book naming no state states nothing');
});

test('one tax, split as the ledgers that carry it - and the components always add back to it', () => {
  assert.deepEqual(gstSplit(1000000, 18, true), {gst: 180000, cgst: 90000, sgst: 90000, igst: 0});
  assert.deepEqual(gstSplit(1000000, 18, false), {gst: 180000, cgst: 0, sgst: 0, igst: 180000});
  const odd = gstSplit(3333, 5, true);
  assert.equal(odd.gst, 167, 'Rs 33.33 at 5% is Rs 1.67 of tax');
  assert.equal(odd.cgst + odd.sgst, odd.gst, 'the two halves add back to the tax exactly');
  assert.equal(odd.sgst, 84, 'and the odd paisa goes to the same half every time');
  assert.deepEqual(gstSplit(0, 18, true), {gst: 0, cgst: 0, sgst: 0, igst: 0});
});

test('an invoice settlement adds no tax of its own', () => {
  assert.deepEqual(additionalGst(), {gst: 0, cgst: 0, sgst: 0, igst: 0, taxable: 0});
  assert.deepEqual(gstSummary({workflow: 'invoice'}), {workflow: 'invoice', additional: true, gst: 0, cgst: 0, sgst: 0, igst: 0, taxable: 0, errors: []});
});

/* ---------------------------------------------------------------- direct income */

test('a tax-inclusive direct receipt of Rs 11,800 at 18% splits into Rs 10,000 of income and Rs 1,800 of tax', () => {
  const tax = directIncomeTax({amount: '11800', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'inclusive', intra: true, received: true});
  assert.deepEqual(tax.errors, []);
  assert.equal(tax.taxable, 1000000, 'the income credited is Rs 10,000');
  assert.equal(tax.gst, 180000, 'and the tax it carries is Rs 1,800');
  assert.equal(tax.cgst, 90000);
  assert.equal(tax.sgst, 90000);
  assert.equal(tax.igst, 0, 'an intra-state supply splits rather than going to IGST');
  assert.equal(tax.received, 1180000, 'and the money received is what it is');
  assert.equal(tax.receivable, 1180000);
  assert.equal(tax.derived, true, 'the base was derived out of the gross, and the page may say so');
});

test('a received income is always split out of the gross: the receipt is never enlarged to make room for tax', () => {
  const tax = directIncomeTax({amount: '11800', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'exclusive', intra: true, received: true});
  assert.equal(tax.received, 1180000, 'the bank is debited the money that arrived, not the money plus tax');
  assert.equal(tax.taxable, 1000000);
  assert.equal(tax.gst, 180000);
  assert.equal(tax.derived, true);
});

test('an exclusive tax on income still awaited is charged on top of the stated income', () => {
  const tax = directIncomeTax({amount: '10000', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'exclusive', intra: true, received: false});
  assert.equal(tax.received, 1000000, 'the income the operator stated');
  assert.equal(tax.receivable, 1180000, 'and Rs 1,800 of tax on top of it, which is what the customer will owe');
  assert.equal(tax.taxable, 1000000);
  assert.equal(tax.gst, 180000);
  assert.equal(tax.derived, false, 'nothing was derived: the stated income IS the taxable value');
});

test('an intra-state split and an inter-state one come out of the same receipt differently', () => {
  const intra = directIncomeTax({amount: '11800', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'inclusive', intra: true});
  const inter = directIncomeTax({amount: '11800', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'inclusive', intra: false});
  assert.equal(intra.gst, inter.gst, 'the tax is the same money either way');
  assert.deepEqual([inter.cgst, inter.sgst, inter.igst], [0, 0, 180000], 'an inter-state supply carries IGST alone');
});

test('income that carries no GST credits the whole receipt to income', () => {
  for (const treatment of UNTAXED_TREATMENTS) {
    const tax = directIncomeTax({amount: '11800', treatment, rate: 0, mode: 'inclusive', intra: true, received: true});
    assert.deepEqual(tax.errors, [], treatment + ' is a complete answer');
    assert.equal(tax.taxable, 1180000, treatment + ' leaves the whole amount as income');
    assert.equal(tax.gst, 0);
    assert.equal(tax.derived, false, treatment + ' derives nothing');
  }
});

test('direct income refuses the answers it cannot post: no treatment, no rate, or a rate of zero behind a taxable supply', () => {
  assert.deepEqual(directIncomeTax({amount: '1000', treatment: 'Something else', rate: 18}).errors, ['Choose whether this income is taxable, exempt, zero rated or outside GST.']);
  assert.deepEqual(directIncomeTax({amount: '1000', treatment: TAXABLE_TREATMENT, rate: ''}).errors, ['Choose the GST rate for this taxable income.']);
  assert.match(directIncomeTax({amount: '1000', treatment: TAXABLE_TREATMENT, rate: 0}).errors[0], /needs a GST rate above zero/, 'a taxable supply pinned to zero is a supply that should have been called exempt');
  assert.deepEqual(directIncomeTax({amount: '1000', treatment: 'Non-GST / Out of Scope', rate: 0}).errors, [], 'while calling it exempt is exactly the right answer');
});

test('money that cannot be read is a message rather than an exception, because the page renders these figures', () => {
  const negative = directIncomeTax({amount: '-100', treatment: TAXABLE_TREATMENT, rate: 18});
  assert.deepEqual(negative.errors, ['The amount received must be a number of rupees, zero or more.']);
  assert.deepEqual([negative.received, negative.taxable, negative.gst], [0, 0, 0], 'and every figure is still a number');
  const blank = directIncomeTax({amount: '', treatment: TAXABLE_TREATMENT, rate: 18});
  assert.deepEqual(blank.errors, [], 'a blank amount is a form waiting to be filled, not bad money');
  assert.equal(blank.received, 0);
  assert.equal(blank.taxable, 0);
  assert.equal(blank.gst, 0);
  const malformed = directIncomeTax({amount: 'garbage', treatment: TAXABLE_TREATMENT, rate: 18});
  assert.equal(malformed.errors.length, 1);
  assert.equal(malformed.gst, 0, 'and a half-typed amount never posts a tax');
});

/* ---------------------------------------------------------------- customer advances */

test('an advance nobody has classified is not assumed to be free of tax - it is left unanswered', () => {
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: '', intra: true});
  assert.equal(advance.errors.length, 1, 'the operator is asked what the money is for');
  assert.match(advance.errors[0], /Classify what this advance is for/);
  assert.equal(advance.gst, 0, 'and no tax is posted on a question nobody has answered');
  assert.equal(advance.net, 300000, 'the whole remainder stays in the liability meanwhile');
  assert.equal(advance.reason, 'unclassified');
  assert.equal(advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: UNKNOWN_SUPPLY, intra: true}).reason, 'unclassified', 'saying you do not know yet is the same unanswered question');
});

test('a goods advance is outside the charge when the money is received, and says so rather than implying it', () => {
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: GOODS_SUPPLY, intra: true});
  assert.deepEqual(advance.errors, []);
  assert.equal(advance.payable, false);
  assert.equal(advance.gst, 0, 'no tax is charged at receipt');
  assert.equal(advance.net, 300000, 'so the whole advance is held as a liability');
  assert.equal(advance.reason, 'goods-at-receipt-exempt', 'and the reason is stated, not left to be inferred');
});

test('a goods advance that is not taxable says that instead', () => {
  const advance = advanceTax({amount: '3000', treatment: 'Non-GST / Out of Scope', rate: 0, supply: GOODS_SUPPLY, intra: true});
  assert.equal(advance.reason, 'goods-not-taxable');
  assert.equal(advance.gst, 0);
});

test('a taxable services advance is chargeable when the money arrives: Rs 3,000 becomes Rs 2,542.37 held and Rs 457.63 of tax', () => {
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: SERVICES_SUPPLY, intra: true});
  assert.deepEqual(advance.errors, []);
  assert.equal(advance.payable, true);
  assert.equal(advance.gst, 45763, 'the tax is derived out of the money received');
  assert.equal(advance.cgst, 22881);
  assert.equal(advance.sgst, 22882, 'and the odd paisa lands in one half, so the three add back exactly');
  assert.equal(advance.taxable, 254237);
  assert.equal(advance.net, 254237, 'only the net belongs in the advance liability');
  assert.equal(advance.reason, 'services-at-receipt');
});

test('an inter-state services advance carries IGST', () => {
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: SERVICES_SUPPLY, intra: false});
  assert.deepEqual([advance.cgst, advance.sgst, advance.igst], [0, 0, 45763]);
});

test('a services advance called taxable with no rate is an unstated supply, not a tax-free one', () => {
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 0, supply: SERVICES_SUPPLY, intra: true});
  assert.match(advance.errors.join(' '), /Choose the GST rate that applies to this taxable service advance/);
  assert.equal(advance.payable, false);
  assert.equal(advance.gst, 0);
});

test('a services advance that is exempt is chargeable to nothing, and is not confused with an unanswered one', () => {
  const advance = advanceTax({amount: '3000', treatment: 'Non-GST / Out of Scope', rate: 0, supply: SERVICES_SUPPLY, intra: true});
  assert.deepEqual(advance.errors, []);
  assert.equal(advance.gst, 0);
  assert.equal(advance.net, 300000);
  assert.equal(advance.reason, 'services-not-taxable');
});

test('an advance is refused a treatment the book does not use, and refused money it cannot read', () => {
  assert.equal(advanceTax({amount: '3000', treatment: 'Guess', rate: 18, supply: SERVICES_SUPPLY}).errors.length, 1);
  assert.deepEqual(advanceTax({amount: '-3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: SERVICES_SUPPLY}).errors, ['The advance must be a number of rupees, zero or more.']);
  const nothing = advanceTax({amount: '', supply: '', treatment: ''});
  assert.deepEqual(nothing.errors, [], 'no advance at all is not an unanswered question');
  assert.equal(nothing.reason, '');
});

test('applying an advance to a later invoice does not charge the same supply twice', () => {
  /* The tax recognised when Rs 3,000 arrived for a taxable service, and the tax the invoice raised for
     that same supply carries on its net value - the same money, so the advance tax is adjusted
     against the invoice rather than charged again. */
  const atReceipt = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: SERVICES_SUPPLY, intra: true});
  const onInvoice = gstSplit(atReceipt.taxable, 18, true);
  assert.equal(onInvoice.gst, atReceipt.gst, 'the tax already recognised at receipt is exactly the tax the supply carries');
  assert.equal(onInvoice.cgst, atReceipt.cgst);
  assert.equal(onInvoice.sgst, atReceipt.sgst);
});

/* ---------------------------------------------------------------- the one summary shape */

test('the summary the page prints carries the figures of whichever workflow is chosen', () => {
  const direct = directIncomeTax({amount: '11800', treatment: TAXABLE_TREATMENT, rate: 18, mode: 'inclusive', intra: true, received: true});
  const advance = advanceTax({amount: '3000', treatment: TAXABLE_TREATMENT, rate: 18, supply: SERVICES_SUPPLY, intra: true});
  const directSummary = gstSummary({workflow: 'direct', direct, advance});
  assert.equal(directSummary.additional, false);
  assert.equal(directSummary.gst, 180000);
  assert.equal(directSummary.taxable, 1000000);
  const advanceSummary = gstSummary({workflow: 'advance', direct, advance});
  assert.equal(advanceSummary.gst, 45763, 'an advance summary carries the advance\'s tax alone');
  assert.equal(advanceSummary.taxable, 254237);
  assert.deepEqual(gstSummary({workflow: 'advance', advance: {errors: ['Classify the supply.']}}).errors, ['Classify the supply.'], 'and an unanswered advance keeps its message');
  assert.deepEqual(gstSummary({}).errors, [], 'a summary with nothing behind it is quiet rather than wrong');
});
