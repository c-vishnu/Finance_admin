/* The shared status pill (src/StatusPill.jsx + src/status-pill.css).

   The registers used to each invent their own status badge: Customers had .customerStatus,
   Period Closing had .pc-badge.pc-status.<state>, Inventory Adjustments had .opsBadge.iaBadge
   and Items had a .itemDisabledBadge chip. Chart of Accounts (.am-status) and Journal Entries
   (.je-status) already drew the reference shape - a rounded tint, a 7px dot and a 12px label -
   so this one component replaces the four bespoke ones. These tests pin the shape, that it
   still agrees with the Chart of Accounts tokens, and that each register now uses it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component=readFileSync('src/StatusPill.jsx','utf8');
const sheet=readFileSync('src/status-pill.css','utf8');
const coa=readFileSync('src/account-workspace.css','utf8');
const je=readFileSync('src/journal-form.css','utf8');
const customers=readFileSync('src/Customers.jsx','utf8');
const customerCss=readFileSync('src/customers.css','utf8');
const closing=readFileSync('src/PeriodClosing.jsx','utf8');
const closingCss=readFileSync('src/period-closing.css','utf8');
const inventory=readFileSync('src/InventoryAdjustments.jsx','utf8');
const inventoryCss=readFileSync('src/inventory-adjustments.css','utf8');
const items=readFileSync('src/Items.jsx','utf8');
const itemsCss=readFileSync('src/items.css','utf8');

test('the pill renders one dot plus the status label',()=>{
 assert.ok(component.includes("import './status-pill.css';"),'the component owns its stylesheet');
 assert.ok(component.includes("return <span className={['statusPill',variant,className].filter(Boolean).join(' ')}><span aria-hidden=\"true\"/>{status}</span>;"),'one span holds a decorative dot and the label');
 assert.ok(component.includes('if(status===undefined||status===null||status===\'\')return null;'),'an absent status renders nothing rather than an empty pill');
 assert.ok(component.includes("const TONE_CLASS={ok:'',neutral:'neutral',warn:'warn',info:'info',violet:'violet',danger:'danger'};"),'six tones are mapped');
 assert.ok(component.includes("const variant=TONE_CLASS[tone]===undefined?'':TONE_CLASS[tone];"),'an unknown tone falls back to the green default');
});

test('the pill geometry is the Chart of Accounts pill',()=>{
 assert.ok(sheet.includes('.statusPill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:14px;background:#e8f6ee;color:#287a51;font-size:12px;font-weight:550;white-space:nowrap}'),'the base pill matches the reference geometry');
 assert.ok(sheet.includes('.statusPill>span{flex:none;width:7px;height:7px;border-radius:50%;background:#28a26b}'),'the dot is the reference 7px circle');
 for(const token of ['padding:4px 9px','border-radius:14px','background:#e8f6ee','color:#287a51','font-weight:550'])
  assert.ok(coa.includes(token),'the Chart of Accounts pill still declares '+token);
 for(const token of ['width:7px;height:7px','border-radius:50%','background:#28a26b'])
  assert.ok(coa.includes(token),'the Chart of Accounts dot still declares '+token);
 assert.ok(sheet.includes('.statusPill.neutral{background:#f1f3f6;color:#667085}')&&sheet.includes('.statusPill.neutral>span{background:#98a2b3}'),'the neutral tone matches .am-status.off');
 assert.ok(sheet.includes('.statusPill.warn{background:#fff4df;color:#8a5d08}'),'the warn tone is the Journal Entries pending tone');
 assert.ok(sheet.includes('.statusPill.danger{background:#fff0f1;color:#ad3542}'),'the danger tone is the Journal Entries rejected tone');
 const sizes=[...sheet.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length&&sizes.every(size=>size>=12),'the twelve pixel floor holds');
});

test('the Customers register and detail use the pill',()=>{
 assert.ok(customers.includes("import StatusPill from './StatusPill.jsx';"),'Customers imports the pill');
 assert.ok(customers.includes("<StatusPill status={x.status||'Active'} tone={x.status==='Inactive'?'neutral':'ok'}/>"),'the register row renders the pill');
 assert.ok(customers.includes("<StatusPill status={selected.status||'Active'} tone={selected.status==='Inactive'?'neutral':'ok'}/>"),'the detail header renders the same pill');
 assert.ok(!customers.includes('customerStatus'),'the bespoke span is gone');
 assert.ok(!customerCss.includes('customerStatus'),'its stylesheet rule is gone');
});

test('the Period Closing register uses the pill for its four statuses',()=>{
 assert.ok(closing.includes("import StatusPill from './StatusPill.jsx';"),'Period Closing imports the pill');
 assert.ok(closing.includes("const CLOSING_TONES={Open:'info',Closing:'warn',Closed:'neutral',Reopened:'violet'};"),'the four closing statuses keep their colours through tones');
 assert.ok(closing.includes("<StatusPill status={status} tone={CLOSING_TONES[status]||'neutral'}/>"),'the register cell renders the pill');
 assert.ok(!closing.includes('pc-badge pc-status'),'the bespoke status badge is gone');
 for(const gone of ['.pc-badge.pc-status.open','.pc-badge.pc-status.closing','.pc-badge.pc-status.closed','.pc-badge.pc-status.reopened'])
  assert.ok(!closingCss.includes(gone),'the dead rule is gone: '+gone);
 assert.ok(closingCss.includes('.pc-status-cell{'),'the status cell wrapper stays');
});

test('the Inventory Adjustments status uses the pill everywhere it shows a status',()=>{
 assert.ok(inventory.includes("import StatusPill from './StatusPill.jsx';"),'Inventory Adjustments imports the pill');
 assert.ok(inventory.includes("const STATUS_TONES={'draft':'neutral','pending-approval':'warn','adjusted':'ok','cancelled':'danger'};"),'the four adjustment statuses keep their colours through tones');
 assert.ok(inventory.includes("<StatusPill status={status} tone={STATUS_TONES[statusClass(status)]||'neutral'}/>"),'the shared Badge renders the pill');
 assert.ok(inventory.includes("const status=value||'Draft';"),'a missing status still reads Draft');
 assert.ok(!inventory.includes('opsBadge iaBadge'),'the bespoke badge span is gone');
 assert.ok(!inventoryCss.includes('iaBadge'),'its stylesheet rules are gone');
 assert.ok(inventory.includes('<Badge value={row.status}/>')&&inventory.includes("<Badge value={form.status||'Draft'}/>"),'the register cell and the create head share one renderer');
});

test('the Items register gained a Status column',()=>{
 assert.ok(items.includes("import StatusPill from './StatusPill.jsx';"),'Items imports the pill');
 assert.ok(items.includes('<th>Default tax</th><th>Status</th><th>Actions</th>'),'the Status column sits between Default tax and Actions');
 assert.ok(items.includes("<StatusPill status={item.active===false?'Disabled':'Active'} tone={item.active===false?'neutral':'ok'}/>"),'the row cell renders the item status');
 assert.ok(!items.includes('itemDisabledBadge'),'the chip that hung under the Type cell is gone');
 assert.ok(!itemsCss.includes('itemDisabledBadge'),'its stylesheet rule is gone');
});

test('no register keeps a bespoke status badge',()=>{
 const bespoke=[['src/customers.css','customerStatus'],['src/period-closing.css','pc-badge.pc-status'],['src/inventory-adjustments.css','iaBadge'],['src/items.css','itemDisabledBadge']];
 for(const [file,cls] of bespoke)
  assert.ok(!readFileSync(file,'utf8').includes(cls),'the retired badge class stays deleted: '+cls+' in '+file);
 assert.ok(je.includes('.je-status.posted, .je-status.approved'),'the Journal Entries pill is untouched');
 assert.ok(coa.includes('.am-status{padding:4px 9px;border-radius:14px'),'the Chart of Accounts pill is untouched');
});
