import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');
const auditCss=readFileSync(new URL('../src/audit-log.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const registerHeadCss=readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');

test('every register, table and list toolbar measures its search the same 300px',()=>{
  const start=registerHeadCss.indexOf('One search width in every register');
  assert.ok(start>-1,'the shared search width rule exists in the last-loaded stylesheet');
  const block=registerHeadCss.slice(start);
  assert.match(block,/@media\(min-width:761px\)\{/,'the width applies above the narrow-screen breakpoint, so the full-width search under it survives');
  for(const selector of [
    '.registerHead .ivTools>label,.registerHead .itemsTools>label',
    '.je-page .registerHead .je-tools>label',
    '.budgetV3Head.registerHead .budgetFilterSearch',
    '.pc-register-tabs>.pc-filters>.pc-filter-search',
    '.iaHeading.registerHead>.iaRegisterBar .iaSearch',
    '.am-coa-page>.am-filter-toolbar .am-search',
    '.gl-filter-toolbar .gl-search',
    '.pc .pc-filters>.pc-filter-search',
    '.auditTools>label,.trTools>label,.tabletools>label,.bankTools>label,.bankTools .bankSearch',
    '.day-filter-row .day-search'
  ]) assert.ok(block.includes(selector),'the 300px search covers '+selector);
  const widths=[...block.matchAll(/width:300px(!important)?/g)].length;
  assert.ok(widths>=8,'every toolbar states the 300px width, found '+widths);
  assert.ok(!/width:2[0-9]0px/.test(block),'no narrower width is left in the shared rule');
});

test('shared UI polish is loaded after existing feature styles',()=>{
  assert.match(main,/journal-form\.css";\s*import "\.\/ui-quality-polish\.css";/);
});

test('shared polish protects interaction, responsive and reduced-motion states',()=>{
  for(const contract of [':focus-visible','button:disabled','@media(max-width:1024px)','@media(max-width:760px)','prefers-reduced-motion']) assert.ok(css.includes(contract),contract);
});

test('the remaining dashboard portals share collision-safe geometry',()=>{
  assert.match(css,/\.auditPortal,.settingsPortal,.helpPortal,.pc/);
  assert.match(css,/left:250px;top:58px/);
  assert.match(css,/left:0;top:58px/);
});

test('audit log uses dashboard offsets and page-owned vertical scrolling',()=>{
  assert.match(auditCss,/inset:59px 0 0 250px/);
  assert.match(auditCss,/overflow-x:hidden;overflow-y:auto/);
  assert.match(auditCss,/\.auditTable\{[^}]*overflow-x:auto;overflow-y:visible/);
  assert.doesNotMatch(auditCss,/left:337px|top:86px/);
});

test('table and form safeguards are included without business selectors',()=>{
  assert.ok(css.includes('overscroll-behavior-inline:contain'));
  assert.ok(css.includes('--wvb-control-h:40px'));
  assert.doesNotMatch(css,/localStorage|journal|debit|credit|calculate|status\s*=/);
});
