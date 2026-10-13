import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* The purchase order form is the document-details row of PurchaseDocumentFields. It was asked to stop
   showing the place of supply, because that value is not something the operator answers: the engine
   derives it from the vendor's billing location for GST, and the read-only control only ever restated
   what choosing the vendor already set. The derivation itself must survive - the tax split, the
   preview and the saved document all read `form.place` - so these tests pin the guard AND the
   derivation, not just the disappeared field. */
const fields = readFileSync(new URL('../src/PurchaseDocumentFields.jsx', import.meta.url), 'utf8');

test('a purchase order never asks the operator for the place of supply', () => {
  assert.ok(fields.includes("{kind!=='order'&&<Field label=\"Place of supply\" icon={IconMapPin}"), 'the form renders the field only for the kind that still shows it');
  assert.equal((fields.match(/aria-label="Place of supply"/g) || []).length, 1, 'the form holds one place-of-supply control, and it sits behind that guard');
  assert.ok(!fields.includes('\n    <Field label="Place of supply"'), 'so nothing renders it unguarded in the document-details row');
  assert.ok(!fields.includes('    </Field>\n    <Field label="Expected delivery date"'), 'the guarded field is the one that now precedes the delivery fields');
});

test('the purchase bill still states where its place of supply comes from', () => {
  assert.ok(fields.includes('>Set automatically from the vendor'), 'the bill keeps the hint');
  assert.ok(fields.includes('billing location for GST.</small>}'), 'which names the vendor billing location and the tax it decides');
});

test('the order keeps deriving the place of supply from the vendor billing state', () => {
  assert.ok(fields.includes('place:suggestionState,'), 'choosing a vendor seeds the place from that vendor\'s billing state');
  assert.ok(fields.includes('placeSource:PLACE_OF_SUPPLY_SOURCE.SUGGESTED,'), 'and records that the engine derived it rather than the operator');
  assert.ok(fields.includes('placeCode:gstStateCode(suggestionState),'), 'with the GST state code the tax split reads');
  assert.ok(fields.includes("const applyPlace=(next,force=false)=>applyPlaceFor(next,selectedVendor?.billing?.state||selectedVendor?.state||'',force);"), 'editing an address re-derives it from the same vendor billing state');
  assert.ok(fields.includes("placeOfSupply:form.place||'Kerala'"), 'and every previewed tax figure reads the derived value, not a control on screen');
});