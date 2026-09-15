import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/journal-entries.css',import.meta.url),'utf8');

test('journal register uses a voucher detail link and floating vertical menu',()=>{
  assert.ok(source.includes('className="je-link"'));
  assert.doesNotMatch(source,/className="je-view-details"/);
  assert.match(source,/aria-label=\{'More actions for '/);
  assert.match(styles,/\.je-row-actions details>div\{position:absolute/);
  assert.match(styles,/flex-direction:column/);
});

test('journal register fits its container without an internal grid scrollbar',()=>{
  assert.match(styles,/\.je-page \.je-table-wrap\{overflow:visible!important\}/);
  assert.match(styles,/min-width:0!important;table-layout:fixed!important/);
});

const coaSource=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
const coaStyles=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');
const closingSource=readFileSync(new URL('../src/PeriodClosing.jsx',import.meta.url),'utf8');
const closingStyles=readFileSync(new URL('../src/period-closing.css',import.meta.url),'utf8');

test('period closing, journal entries and chart of accounts share one 3 dot row action menu',()=>{
  assert.ok(source.includes("<summary aria-label={'More actions for '+j.number}><IconDots size={17}/></summary>"),'the journal row menu uses the horizontal 3 dot trigger');
  assert.ok(coaSource.includes("<summary aria-label={'More actions for '+a.name}><IconDots size={17}/></summary>"),'the account row menu uses the same trigger');
  assert.ok(closingSource.includes("<summary aria-label={'More actions for '+period.name}><IconDots size={17}/></summary>"),'period closing stays the reference trigger');
  assert.ok(!source.includes('IconDotsVertical'),'no vertical 3 dot survives in journal entries');
  assert.ok(!coaSource.includes('IconDotsVertical'),'no vertical 3 dot survives in the chart of accounts');
});

test('the shared row action menu keeps identical trigger, menu box and row geometry',()=>{
  assert.match(styles,/\.je-row-actions summary\{display:grid;place-items:center;width:32px;height:32px;border:1px solid #d9e1ec;border-radius:7px/);
  assert.match(coaStyles,/\.am-table \.am-more>summary\{[^}]*border:1px solid #d9e1ec!important;border-radius:7px/);
  assert.match(closingStyles,/\.pc-kebab>summary\{display:grid;place-items:center;width:32px;height:32px;border:1px solid #d9e1ec;border-radius:7px/);
  for(const [name,sheet] of [['journal entries',styles],['chart of accounts',coaStyles],['period closing',closingStyles]]){
    assert.ok(sheet.includes('border-color:#3478f6')&&sheet.includes('color:#245fd9'),name+' keeps the open state');
    assert.ok(sheet.includes('min-width:196px'),name+' keeps the menu width');
    assert.ok(sheet.includes('border:1px solid #e1e6ed'),name+' keeps the menu border');
    assert.ok(sheet.includes('border-radius:9px'),name+' keeps the menu radius');
    assert.ok(sheet.includes('box-shadow:0 12px 30px #1018281f'),name+' keeps the menu shadow');
    assert.ok(sheet.includes('gap:9px'),name+' keeps the menu row gap');
    assert.ok(sheet.includes('min-height:36px'),name+' keeps the menu row height');
    assert.ok(sheet.includes('#f4f7ff')&&sheet.includes('color:#245fd9'),name+' keeps the menu row hover');
  }
});

test('row menus dismiss on selection and on an outside pointer or Escape',()=>{
  assert.ok(source.includes('const menuRun=handler=>event=>{event.currentTarget.closest(\'details\')?.removeAttribute(\'open\');handler()};'),'journal rows close the menu when the action runs');
  assert.ok(coaSource.includes('const menuRun=handler=>event=>{event.currentTarget.closest(\'details\')?.removeAttribute(\'open\');handler()};'),'account rows close the menu when the action runs');
  assert.ok(source.includes("document.querySelectorAll('.je-row-actions details[open],.je-detail-more[open]')"),'journal entries registers one page level dismissal');
  assert.ok(coaSource.includes("document.querySelectorAll('.am-table .am-more[open]')"),'the chart of accounts registers one page level dismissal');
  assert.ok(closingSource.includes("document.querySelectorAll('.pc-more[open],.pc-kebab[open],.pc-filters-more[open],.pc-attention-pop[open]')"),'period closing keeps its dismissal');
  assert.ok(!styles.includes('details>div:before')&&!coaStyles.includes('.am-more>div:before'),'the old caret arrows are gone');
});
