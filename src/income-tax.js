/* GST on the money Record Income records.

   The page shows three different GST questions and this module is the one place that answers them,
   so the surface, the store that posts the entry and the tests all read the same arithmetic:

   1. Money against an EXISTING sales invoice recognises nothing new. The invoice already carried its
      own taxable value and its own output tax when it was raised, so the tax here is zero by
      construction (`additionalGst`) and the receipt engine's job is untouched.
   2. DIRECT income recognises revenue now, so the amount received has to be split between the income
      credited and the output tax the same money carries. The money received is what it is - this
      module NEVER raises it - so a tax-inclusive receipt derives the taxable base out of the gross
      (`gst = round(amount * rate / (100 + rate))`, `taxable = amount - gst`), and an exclusive
      receipt on money that has not arrived yet puts the tax on top of the stated income instead.
   3. A CUSTOMER ADVANCE is not income at all. Whether tax is payable when the money is received
      depends on the supply it is for: a qualifying goods advance is outside the charge under the
      notification the settings record, a services advance is taxable at receipt, and an advance
      nobody has classified is left UNANSWERED - `errors` - rather than quietly assumed to be free
      of tax.

   One convention, the same one `src/income-allocation.js` already keeps: an amount handed in comes
   from a control or a record, so it is a rupee value and is read through `paise()`; everything this
   module RETURNS is an integer number of paise. An amount nobody can read is reported in `errors`
   rather than thrown, because the page renders these figures while the control is still being typed
   into and a form must never blank itself over a half-written number. The rate is the one fact this module cannot
   invent: it is handed in from the book's own tax configuration (see `configuredRates`), and the
   CGST/SGST against IGST decision comes from the place of supply the caller passes, never from a
   hardcoded state or a hardcoded slab. */

import { TAXABILITY } from './customer-tax.js';
import { paise } from './income-allocation.js';

/* The taxability vocabulary the customers and items already use, so the GST Treatment picker offers
   the book's own words rather than a second set invented here. */
export const GST_TREATMENTS = TAXABILITY;
export const TAXABLE_TREATMENT = 'Taxable';
/* The treatments that charge no tax and, unlike an unanswered taxable supply, are a real answer:
   the supply is tax exempt, zero rated or outside GST altogether. */
export const UNTAXED_TREATMENTS = TAXABILITY.filter(value => value !== TAXABLE_TREATMENT);

/* What an advance can be for. "Unknown future supply" is deliberately one of the answers: it is the
   state the operator is in when they do not know yet, and it must not be read as "no tax". */
export const ADVANCE_SUPPLIES = ['Goods', 'Services', 'Unknown future supply'];
export const UNKNOWN_SUPPLY = 'Unknown future supply';
export const GOODS_SUPPLY = 'Goods';
export const SERVICES_SUPPLY = 'Services';

export const TAX_MODES = ['inclusive', 'exclusive'];
/* The organisation's own default, read from the settings record rather than assumed. */
export const taxModeFromSettings = settings => /inclusive/i.test(String(settings?.tax?.priceTreatment || '')) ? 'inclusive' : 'exclusive';

/* A tax label such as `GST 18%` or `Non-GST / Exempt` as the rate it names. Zero when it names none,
   which is exactly how the older income records already store their tax. */
export function gstRateOf(label) {
  const found = String(label ?? '').match(/\d+(?:\.\d+)?/);
  const rate = found ? Number(found[0]) : 0;
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0;
}

/* The label the register and the older records read back, written from the rate the operator chose
   so one number never has two spellings. */
export const taxLabelOf = rate => (Number(rate) > 0 ? `GST ${Number(rate)}%` : 'Non-GST / Exempt');

const isRate = value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;

/* The money a control or a record states, read as paise WITHOUT letting the shared parser's refusal
   escape. This module is called while the page renders, so a half-typed or malformed amount has to
   come back as a message the operator can read rather than as an exception that blanks the form: an
   amount nobody can read is reported as unreadable and counted as zero, which keeps every figure
   below a number even while the control holds something that is not one. Blank money is simply zero,
   because a blank control is a form waiting to be filled rather than bad money. */
function readAmount(value) {
  if (value === '' || value === null || value === undefined) return { paise: 0, unreadable: false };
  try {
    const parsed = paise(value);
    return parsed >= 0 ? { paise: parsed, unreadable: false } : { paise: 0, unreadable: true };
  } catch {
    return { paise: 0, unreadable: true };
  }
}

/* The rates this book may offer: the ones its own records name - the tax on each active income
   category, the organisation default, and any rate configured on a posting account - highest and
   lowest kept, duplicates dropped, zero left out because `Non-GST / Exempt` is a treatment rather
   than a slab. Nothing here is a hardcoded list of Indian slabs: a book that names no rate is
   offered none, and the page asks for one. */
export function configuredRates({ categories = [], settings = null, accounts = [] } = {}) {
  const rates = new Set();
  for (const category of categories || []) {
    if (category?.status && String(category.status).toLowerCase() !== 'active') continue;
    const rate = gstRateOf(category?.tax);
    if (rate > 0) rates.add(rate);
  }
  const fallback = Number(settings?.tax?.defaultGstRate);
  if (Number.isFinite(fallback) && fallback > 0) rates.add(fallback);
  for (const account of accounts || []) {
    const rate = Number(account?.gstRate);
    if (account?.taxMode === 'validate' && Number.isFinite(rate) && rate > 0) rates.add(rate);
  }
  return [...rates].sort((left, right) => left - right);
}

/* Intra-state or inter-state, decided from the two states the caller knows: the taxpayer's own
   registered state and the place of supply. An answer nobody can give - an unregistered payer, or a
   book that names no state - is NOT guessed: it falls back to the taxpayer's own state, which is the
   place of supply the law gives a supply to an unregistered person, and says so in `derived` so the
   page can state that it did. */
export function placeOfSupply({ buyerState = '', registeredState = '' } = {}) {
  const seller = String(registeredState || '').trim();
  const buyer = String(buyerState || '').trim();
  if (!seller) return { supply: '', intra: true, derived: true };
  if (!buyer) return { supply: seller, intra: true, derived: true };
  return { supply: buyer, intra: buyer.toLowerCase() === seller.toLowerCase(), derived: false };
}

/* One tax as the ledgers that carry it: IGST for an inter-state supply, CGST and SGST for an
   intra-state one. The half-and-half split gives the odd paisa to SGST, so the two components always
   add back to the tax that was calculated - a journal that balances by construction rather than by
   a second rounding. */
export function gstSplit(taxable, rate, intra = true) {
  const base = Number(taxable) || 0;
  const gst = isRate(rate) ? Math.round(base * Number(rate) / 100) : 0;
  if (!intra) return { gst, cgst: 0, sgst: 0, igst: gst };
  const cgst = Math.floor(gst / 2);
  return { gst, cgst, sgst: gst - cgst, igst: 0 };
}

/* What an invoice settlement adds to the tax already recorded: nothing. Kept as a named answer so the
   page, the store and the tests state the zero the same way instead of each writing its own. */
export const additionalGst = () => ({ gst: 0, cgst: 0, sgst: 0, igst: 0, taxable: 0 });

/* The split of one direct income receipt.

   `amount` is the money received, in paise. A tax-inclusive receipt derives the base from the gross
   and never changes `received`. An exclusive receipt charges the tax on top of the stated income -
   which is only ever the money itself when the money has NOT arrived yet (`received === false`), so
   a received income is always split out of the gross and says so through `derived`, because a
   receipt may not be quietly enlarged to make room for tax. */
export function directIncomeTax({ amount, treatment = TAXABLE_TREATMENT, rate = 0, mode = 'exclusive', intra = true, received = true } = {}) {
  const errors = [];
  const read = readAmount(amount);
  const gross = read.paise;
  if (read.unreadable) errors.push('The amount received must be a number of rupees, zero or more.');
  const taxableIncome = String(treatment) === TAXABLE_TREATMENT;
  if (!GST_TREATMENTS.includes(String(treatment))) errors.push('Choose whether this income is taxable, exempt, zero rated or outside GST.');
  /* One rate question, asked once: a taxable income with no rate at all is unstated, and a taxable
     income pinned to zero is a supply the operator should have called Non-GST / Exempt instead. */
  if (taxableIncome && rate === '' ) errors.push('Choose the GST rate for this taxable income.');
  else if (taxableIncome && (!isRate(rate) || Number(rate) <= 0)) errors.push('A taxable income needs a GST rate above zero. Choose Non-GST / Exempt for income that carries no GST.');
  const charged = taxableIncome && Number(rate) > 0 ? Number(rate) : 0;
  const exclusive = mode === 'exclusive' && received !== true && charged > 0;
  const taxable = exclusive ? gross : gross - (charged > 0 ? Math.round(gross * charged / (100 + charged)) : 0);
  const split = gstSplit(taxable, charged, intra);
  return {
    treatment: String(treatment),
    rate: charged,
    mode: exclusive ? 'exclusive' : (charged > 0 ? 'inclusive' : mode),
    taxable,
    ...split,
    received: gross,
    /* The money the customer owes or paid: the gross of a received income, or the income with the
       tax charged on top while it is still awaited. */
    receivable: exclusive ? gross + split.gst : gross,
    derived: charged > 0 && !exclusive,
    errors
  };
}

/* The tax on the part of a receipt that is NOT settling an invoice - the customer advance.

   Nothing is assumed: an advance nobody has classified comes back with an error and no tax, a goods
   advance is outside the charge under the notification, and a services advance is taxable at receipt
   on the money actually received, so its tax is derived from the gross exactly as a direct income is.
   `net` is what belongs to the advance liability: the money less the tax the same money carries. */
export function advanceTax({ amount = 0, treatment = TAXABLE_TREATMENT, rate = 0, supply = '', intra = true } = {}) {
  const errors = [];
  const read = readAmount(amount);
  const held = read.paise;
  if (read.unreadable) errors.push('The advance must be a number of rupees, zero or more.');
  if (held > 0 && !ADVANCE_SUPPLIES.includes(String(supply))) {
    errors.push('Classify what this advance is for - goods, services, or an unknown future supply - before it can be held. Whether GST is payable when money is received depends on that supply.');
  }
  if (held > 0 && !GST_TREATMENTS.includes(String(treatment))) errors.push('Choose the GST treatment of the supply this advance is for.');
  /* A service advance is taxable when the money is received, so a service advance the operator has
     called taxable without naming a rate is an unstated supply rather than a tax-free one. */
  if (held > 0 && String(supply) === SERVICES_SUPPLY && String(treatment) === TAXABLE_TREATMENT && !(Number(rate) > 0)) {
    errors.push('Choose the GST rate that applies to this taxable service advance, or record the supply as exempt, zero rated or outside GST.');
  }
  const taxableSupply = String(treatment) === TAXABLE_TREATMENT && Number(rate) > 0;
  const payable = held > 0 && taxableSupply && String(supply) === SERVICES_SUPPLY;
  const split = payable ? gstSplit(held - Math.round(held * Number(rate) / (100 + Number(rate))), rate, intra) : additionalGst();
  return {
    supply: String(supply),
    payable,
    rate: payable || (taxableSupply && String(supply) === GOODS_SUPPLY) ? Number(rate) : 0,
    taxable: payable ? held - split.gst : 0,
    ...split,
    held,
    net: held - split.gst,
    /* Stated, not implied: the goods answer is the notification's, and a classified advance that is
       exempt or outside GST says so in the same sentence. */
    reason: held <= 0 ? ''
      : String(supply) === UNKNOWN_SUPPLY || !ADVANCE_SUPPLIES.includes(String(supply)) ? 'unclassified'
      : String(supply) === GOODS_SUPPLY ? (taxableSupply ? 'goods-at-receipt-exempt' : 'goods-not-taxable')
      : payable ? 'services-at-receipt'
      : 'services-not-taxable',
    errors
  };
}

/* The figures the page's own GST block and summary print for whichever workflow is chosen. One shape
   for all three keeps the summary honest: an invoice settlement says `additional: true` and carries a
   zero tax, a direct income carries what the split found, and an advance carries only its own tax. */
export function gstSummary({ workflow = 'direct', direct = null, advance = null } = {}) {
  if (workflow === 'invoice') return { workflow, additional: true, gst: 0, cgst: 0, sgst: 0, igst: 0, taxable: 0, errors: [] };
  if (workflow === 'advance') return { workflow, additional: false, gst: advance?.gst || 0, cgst: advance?.cgst || 0, sgst: advance?.sgst || 0, igst: advance?.igst || 0, taxable: advance?.taxable || 0, errors: advance?.errors || [] };
  return { workflow: 'direct', additional: false, gst: direct?.gst || 0, cgst: direct?.cgst || 0, sgst: direct?.sgst || 0, igst: direct?.igst || 0, taxable: direct?.taxable || 0, errors: direct?.errors || [] };
}