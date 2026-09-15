import test from 'node:test';
import assert from 'node:assert/strict';
import {nextVendorCode,validateVendor,vendorDefaults} from '../src/vendor-store.js';

test('vendor codes increment using the standard sequence',()=>assert.equal(nextVendorCode([{code:'VEN-00009'},{code:'LEGACY'}]),'VEN-00010'));
test('valid vendor can be linked to Accounts Payable without a vendor GL account',()=>{
  const vendor={...vendorDefaults,name:'ABC Technologies Pvt Ltd',phone:'9876543210',payableAccountId:'2100'};
  assert.deepEqual(validateVendor(vendor,[]),{});
});
test('GST and duplicate vendor validation protects the master',()=>{
  const vendor={...vendorDefaults,name:'ABC Technologies Pvt Ltd',phone:'9876543210',gstRegistered:true,gstin:'INVALID',payableAccountId:'2100'};
  const errors=validateVendor(vendor,[{id:'other',name:'abc technologies pvt ltd'}]);
  assert.ok(errors.name);assert.ok(errors.gstin);
});
