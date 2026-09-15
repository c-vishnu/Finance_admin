import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleQuickActions} from '../src/quick-create.js';

test('sales users only receive permitted quick-create actions',()=>{const actions=visibleQuickActions('Sales Executive');assert.ok(actions.some(row=>row.id==='invoice'));assert.ok(actions.some(row=>row.id==='sales-order'));assert.equal(actions.some(row=>row.id==='debit-note'),false);assert.equal(actions.some(row=>row.id==='journal-entry'),false)});
test('invoice search returns invoice creation immediately',()=>{const actions=visibleQuickActions('Admin','invoice');assert.equal(actions[0].id,'invoice')});
test('purchase context prioritizes purchase actions',()=>{const actions=visibleQuickActions('Admin','', 'Purchase Bills');assert.equal(actions[0].category,'Purchases')});
test('core quick-create actions point to creation-capable modules',()=>{for(const id of ['invoice','purchase-order','purchase-bill','debit-note','credit-note'])assert.ok(visibleQuickActions('Admin').some(action=>action.id===id&&action.page))});
