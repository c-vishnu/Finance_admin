import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/vendors.css',import.meta.url),'utf8');
test('vendor editor renders as an in-workspace page rather than a modal popup',()=>{
  assert.match(css,/\.vendorOverlay\{position:fixed;z-index:45;left:270px/);
  assert.match(css,/background:#f7f9fc/);
  assert.match(css,/\.vendorDialog\{width:min\(1120px,100%\);height:auto/);
  assert.match(css,/box-shadow:none/);
  assert.match(css,/Back to Vendors/);
});
