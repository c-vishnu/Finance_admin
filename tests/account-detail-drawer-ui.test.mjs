import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');

test('account details open as a right-side popup instead of a second column',()=>{
  assert.ok(workspace.includes('<div className="am-create-drawer-layer am-detail-layer">'),'the details layer is the shared right-edge drawer layer');
  assert.ok(workspace.includes('<aside className="am-create-drawer am-detail-drawer" role="dialog" aria-modal="true" aria-label="Account details">'),'the panel is a named modal drawer');
  assert.ok(workspace.includes('<button type="button" className="am-create-drawer-backdrop" aria-label="Close account details" onClick={()=>setSelected(null)}/>'),'a backdrop closes the popup');
  assert.ok(workspace.includes('<button type="button" className="am-create-drawer-close" aria-label="Close account details" onClick={()=>setSelected(null)}>'),'the header close button closes the popup');
  assert.ok(workspace.includes('<h2>Account details</h2>'),'the drawer header names the popup');
  assert.ok(workspace.includes('{account.name} · {account.code}'),'the header states which account is open');
  assert.ok(workspace.includes('</aside></div>}'),'the drawer closes after the footer');
});

test('the inline detail column is gone from the Chart of Accounts page',()=>{
  assert.ok(workspace.includes('<div className="am-layout">'),'the account list keeps the full page width');
  assert.ok(!workspace.includes('has-detail'),'the layout no longer reserves a detail column');
  assert.ok(!workspace.includes('className="am-detail"'),'no inline detail panel is rendered');
  assert.ok(!workspace.includes('am-detail-top'),'the old inline detail header is gone');
  assert.ok(!css.includes('has-detail'),'the two-column layout rules are removed');
  assert.ok(!css.includes('.am-detail{'),'the old inline panel rule is removed');
});

test('the popup keeps every account detail fact and action',()=>{
  for(const token of ['className="am-detail-body" role="tabpanel"','<div className="am-detail-footer">','Current Balance','AccountConfiguration','AccountLedger',"['Transactions','Audit Trail']",'Edit Account','{t.viewLedger}',"{account.active?'Mark Inactive':'Mark Active'}"])assert.ok(workspace.includes(token),token);
  assert.ok(workspace.includes("const onKey=event=>{if(event.key==='Escape')setSelected(null)};"),'Escape closes the popup');
  assert.ok(workspace.includes("document.body.style.overflow='hidden';"),'the page behind the popup stops scrolling');
  assert.ok(workspace.includes('},[account]);'),'the scroll lock is released when the popup closes');
});

test('the popup reuses the account drawer shell and the existing detail text scale',()=>{
  assert.ok(css.includes('.am-detail-layer .am-detail-drawer{width:min(560px,100vw)}'),'the panel matches the Create Account drawer width');
  assert.ok(css.includes('.am-detail-drawer .am-detail-body{flex:1;min-height:0;overflow-y:auto;padding:16px;background:#f6f8fb}'),'the body is the drawer scroll container');
  assert.ok(css.includes('.am-detail-drawer .am-detail-footer{flex:0 0 auto;justify-content:flex-start;padding:13px 16px;background:#fff;'),'the footer is pinned under the body');
  assert.ok(css.includes('.am-detail-top{'),'the Day Book transaction detail header keeps its rule');
  const block=css.slice(css.indexOf('/* Account details right-side popup.'));
  assert.ok(!/font-size:/.test(block),'the popup adds no new type scale, so nothing renders below the 12px floor');
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(Math.min(...[...rules.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1])))>=11,'the page keeps its existing text scale');
});
