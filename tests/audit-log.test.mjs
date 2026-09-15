import test from 'node:test';
import assert from 'node:assert/strict';
import {auditChanges} from '../src/audit-log.js';

test('central audit detects new records',()=>{
  const events=auditChanges('wayvida-accounting-v1',{receipts:[]},{receipts:[{id:'R-1',receiptNumber:'RCPT-1',status:'Draft'}]});
  assert.deepEqual(events.map(({module,action,record})=>({module,action,record})),[{module:'Receipts',action:'Created',record:'RCPT-1'}]);
});

test('central audit distinguishes status changes from ordinary updates',()=>{
  const before={invoices:[{id:'I-1',invoiceNumber:'INV-1',status:'Draft',notes:''}]};
  const posted=auditChanges('wayvida-accounting-v1',before,{invoices:[{id:'I-1',invoiceNumber:'INV-1',status:'Posted',notes:''}]});
  const edited=auditChanges('wayvida-accounting-v1',before,{invoices:[{id:'I-1',invoiceNumber:'INV-1',status:'Draft',notes:'Updated'}]});
  assert.equal(posted[0].action,'Status changed');
  assert.equal(posted[0].fromStatus,'Draft');
  assert.equal(posted[0].toStatus,'Posted');
  assert.equal(edited[0].action,'Updated');
  assert.deepEqual(edited[0].changedFields,['notes']);
});

test('central audit detects removed records and configuration changes',()=>{
  const removed=auditChanges('wayvida-vendors-v1',[{id:'V-1',name:'Vendor'}],[]);
  const configured=auditChanges('wayvida-settings-v1',{currency:'INR'},{currency:'USD'});
  assert.equal(removed[0].action,'Removed');
  assert.equal(configured[0].action,'Configuration updated');
});
