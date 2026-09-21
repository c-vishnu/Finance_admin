import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');
const auditCss=readFileSync(new URL('../src/audit-log.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('shared UI polish is loaded after existing feature styles',()=>{
  assert.match(main,/journal-form\.css";\s*import "\.\/ui-quality-polish\.css";/);
});

test('shared polish protects interaction, responsive and reduced-motion states',()=>{
  for(const contract of [':focus-visible','button:disabled','@media(max-width:1024px)','@media(max-width:760px)','prefers-reduced-motion']) assert.ok(css.includes(contract),contract);
});

test('the remaining dashboard portals share collision-safe geometry',()=>{
  assert.match(css,/\.auditPortal,.settingsPortal,.helpPortal,.pc/);
  assert.match(css,/left:270px;top:58px/);
  assert.match(css,/left:0;top:58px/);
});

test('audit log uses dashboard offsets and page-owned vertical scrolling',()=>{
  assert.match(auditCss,/inset:59px 0 0 270px/);
  assert.match(auditCss,/overflow-x:hidden;overflow-y:auto/);
  assert.match(auditCss,/\.auditTable\{[^}]*overflow-x:auto;overflow-y:visible/);
  assert.doesNotMatch(auditCss,/left:337px|top:86px/);
});

test('table and form safeguards are included without business selectors',()=>{
  assert.ok(css.includes('overscroll-behavior-inline:contain'));
  assert.ok(css.includes('--wvb-control-h:40px'));
  assert.doesNotMatch(css,/localStorage|journal|debit|credit|calculate|status\s*=/);
});
