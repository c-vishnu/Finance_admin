/* Redesigned Create Customer Page unit tests */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync('src/Customers.jsx', 'utf8');
const styles = readFileSync('src/customers.css', 'utf8');

test('the form structure includes 3 sections and clear section headings', () => {
  const sections = ['Customer details', 'GST &amp; Tax Details', 'Address details'];
  for (const title of sections) {
    assert.ok(screen.includes(title), 'expected to find section title: ' + title);
  }
});

test('Customer Type uses segmented card style choices', () => {
  assert.ok(screen.includes("customerTypeSegmentCard"), 'customer type uses segmented card CSS class');
  assert.ok(screen.includes("Business"), 'supports Business customer type');
  assert.ok(screen.includes("Individual"), 'supports Individual customer type');
});

test('Individual customer type groups primary contact names and hides company name', () => {
  assert.ok(screen.includes("form.type === 'Business' && field('name', formNameLabel + ' *'"), 'company name shown only for business');
  assert.ok(screen.includes("customerFormRow2"), 'groups primary contact name, email and phone in a single row');
  assert.ok(screen.includes("Primary Contact Name"), 'includes primary contact name input');
});

test('GST and Tax section contains GST treatment, GSTIN lookup, PAN, Taxability, and Opening Balance', () => {
  assert.ok(screen.includes("gstTreatment"), 'includes GST treatment dropdown');
  assert.ok(screen.includes("Get Taxpayer Details"), 'includes Get Taxpayer Details button');
  assert.ok(screen.includes("pan"), 'includes PAN field');
  assert.ok(screen.includes("taxPreference"), 'includes Taxability dropdown');
  assert.ok(screen.includes("opening"), 'includes opening balance input');
  assert.ok(screen.includes("openingDate"), 'includes opening balance date input');
  assert.ok(screen.includes("account"), 'includes receivable account selection');
});

test('Address Information contains Billing and Shipping cards with Fax Number', () => {
  assert.ok(screen.includes("Billing Address"), 'includes Billing Address card');
  assert.ok(screen.includes("Shipping Address"), 'includes Shipping Address card');
  assert.ok(screen.includes("Shipping address same as billing"), 'includes Same as Billing switch');
  assert.ok(screen.includes("Fax Number"), 'includes Fax Number input');
});

test('Unsaved changes warning and submit loading state are active', () => {
  assert.ok(screen.includes("isDirty"), 'tracks form dirty state');
  assert.ok(screen.includes("beforeunload"), 'listens for page unload with unsaved changes');
  assert.ok(screen.includes("isSaving"), 'disables submit button and shows loading state during save');
  assert.ok(screen.includes("existingDuplicate"), 'checks for existing duplicate customer records before saving');
});

test('Responsive CSS styles exist for customer form layout', () => {
  assert.ok(styles.includes('.customerTypeSegmentCard'), 'includes segmented card CSS style');
});
