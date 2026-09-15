import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');
const form=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');

test('Create account uses the standard back-navigation header card',()=>{
  assert.match(form,/className="am-create-header"/);
  assert.match(form,/aria-label="Back to Chart of Accounts"/);
  assert.match(css,/\.app>main \.am-create-header\{[^}]*margin:16px 32px 0[^}]*border:1px solid[^}]*border-radius:10px/s);
  assert.match(css,/\.app>main \.am-create-header>button\.am-back\{[^}]*width:40px[^}]*height:40px/s);
});
