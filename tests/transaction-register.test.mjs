import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('reports navigation exposes one central transaction register',()=>{
 const nav=readFileSync('src/Navigation.jsx','utf8');
 assert.match(nav,/leaf\('Transaction Register'\)/);
 assert.match(nav,/TransactionRegister onNavigate/);
});

test('transaction register separates business and accounting states',()=>{
 const page=readFileSync('src/TransactionRegister.jsx','utf8');
 for(const label of ['Transaction Register','Sales Invoice','Purchase Bill','Receipt','Payment','Credit Note','Debit Note','Expense','Journal Entries','Not Posted','Posted','Reversed','Accounting impact','Related documents and audit history'])assert.ok(page.includes(label),label);
});

test('duplicate posted-book panel is absent from the rendered banking experience',()=>{
 const css=readFileSync('src/transaction-register.css','utf8');
 assert.match(css,/\.bankBookRegister\{display:none!important\}/);
});

test('transaction register header stays inside its dashboard portal',()=>{
 const css=readFileSync('src/transaction-register.css','utf8');
 for(const token of ['.transactionRegister>header{position:static!important','inset:auto!important','width:100%!important','height:auto!important','margin:0!important'])assert.ok(css.includes(token),token);
});

test('transaction details are isolated from shell styles and open from the right',()=>{
 const css=readFileSync('src/transaction-register.css','utf8');
 for(const token of ['.trOverlay{justify-content:flex-end','.trOverlay>aside{position:relative!important','border-left:1px solid #dfe6ef','box-shadow:-16px 0 42px','.trOverlay>aside>header{position:relative!important'])assert.ok(css.includes(token),token);
});

test('side detail drawers use the project right-side convention',()=>{
 const files=['src/contextual-help.css','src/banking-shell.css','src/general-ledger.css','src/styles.css','src/operational-modules.css','src/document-preview.css'].map(path=>readFileSync(path,'utf8'));
 assert.ok(files[0].includes('.guideBackdrop{justify-content:flex-end!important'));
 assert.ok(files[1].includes('.bankDrawerBackdrop{justify-content:flex-end'));
 assert.ok(files[2].includes('.gl-drawer{left:auto;right:0'));
 assert.ok(files[3].includes('.drawer{left:auto;right:0'));
 assert.ok(files[4].includes('.opsOverlay{justify-content:flex-end'));
 assert.ok(files[5].includes('.dpPreviewBody .dpRightDrawer{order:initial'));
});

test('last-loaded quality layer prevents legacy styles moving drawers left',()=>{
 const css=readFileSync('src/ui-quality-polish.css','utf8');
 for(const token of [
  ':where(.trOverlay,.guideBackdrop,.bankDrawerBackdrop,.opsOverlay)',
  'justify-content:flex-end!important',
  ':where(.trOverlay>aside,.guideDrawer,.bankMatchDrawer,.opsDrawer)',
  'margin-left:auto!important',
  ':where(.gl-drawer,.drawer)',
  'right:0!important',
  '.dpPreviewBody .dpRightDrawer'
 ])assert.ok(css.includes(token),token);
});
