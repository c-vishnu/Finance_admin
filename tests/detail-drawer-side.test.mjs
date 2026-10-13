import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

/* The Income and Expense row-detail popups have been moved from side to side several times in one
   day. Their side is not stated per drawer: it comes from the shared `.opsOverlay` / `.opsDrawer`
   shell plus the `src/ui-quality-polish.css` placement block that loads last. This guard reads every
   stylesheet in `src/` and fails if any rule that selects the overlay or the drawer ITSELF (not one
   of its children) gives it anything other than the right-hand edge. */

const srcDir = new URL('../src/', import.meta.url);
const sheets = new Map(readdirSync(srcDir).filter(name => name.endsWith('.css')).sort().map(name => [name, readFileSync(new URL(name, srcDir), 'utf8')]));

const ruler = /([^{}]+)\{([^{}]*)\}/g;
function declarations(body) {
  return body.replace(/\s+/g, ' ').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const at = part.indexOf(':');
    return {property: part.slice(0, at).trim().toLowerCase(), value: part.slice(at + 1).replace(/!important/gi, '').trim()};
  });
}
/* A selector targets the drawer itself when its final compound is the overlay or the panel - so
   `.opsDrawer>header`, `.exOverlay .exFacts` and `.exOverlay .exDrawerBody` all fall outside. */
function selves(selector) {
  return selector.split(',').map(part => part.trim().split(/[\s>+~]+/).pop() || '').filter(compound => /^\.(ex|ir|ops)(Overlay|Drawer)(\b|$)/.test(compound));
}
const found = new Map();
for (const [file, text] of sheets) {
  for (const match of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(ruler)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    for (const self of selves(selector)) {
      if (!found.has(self)) found.set(self, {file, selector, declarations: declarations(match[2])});
    }
  }
}

test('the shared shell and the last-loaded stylesheet pin every detail drawer to the right edge', () => {
  assert.match(sheets.get('operational-modules.css'), /\.opsOverlay\{position:fixed;inset:0;z-index:1100;display:flex;justify-content:flex-end;/, 'the shell overlay packs its panel against the right edge');
  assert.match(sheets.get('ui-quality-polish.css'), /:where\(\.trOverlay,\.guideBackdrop,\.bankDrawerBackdrop,\.opsOverlay\)\{\s*justify-content:flex-end!important;/, 'the last-loaded stylesheet pins every overlay right, so no module rule can move one');
  assert.match(sheets.get('ui-quality-polish.css'), /:where\(\.trOverlay>aside,\.guideDrawer,\.bankMatchDrawer,\.opsDrawer\)\{\s*margin-left:auto!important;\s*margin-right:0!important;/, 'and pushes every panel onto that edge with margin-left:auto');
  assert.ok(found.has('.opsOverlay') && found.has('.opsDrawer'), 'the scan reached the shell');
  assert.equal(found.get('.exDrawer').file, 'expense-detail-drawer.css', 'the Expense drawer is styled only by its own sheet');
  assert.equal(found.get('.irDrawer').file, 'income-detail-drawer.css', 'the Income drawer is styled only by its own sheet');
  for (const self of ['.exDrawer', '.irDrawer', '.exOverlay', '.irOverlay']) {
    for (const {property} of (found.get(self)?.declarations || [])) assert.ok(!['left', 'right', 'justify-content', 'margin-left', 'margin-right', 'border-left', 'border-right'].includes(property), self + ' restates its side instead of taking the shell\'s');
  }
});

test('no stylesheet moves an Income or Expense detail drawer off the right edge', () => {
  for (const [self, {file, selector, declarations: decls}] of found) {
    const where = file + ' :: ' + selector + ' :: ' + self;
    for (const {property, value} of decls) {
      if (property === 'justify-content') assert.ok(value === 'flex-end' || value === 'end' || value === 'right', 'a drawer or overlay is not packed right: ' + where + ' { justify-content: ' + value + ' }');
      if (property === 'left') assert.ok(value === 'auto', 'a drawer or overlay states a left offset: ' + where + ' { left: ' + value + ' }');
      if (property === 'margin-right') assert.ok(value === '0', 'a drawer or overlay takes a right margin: ' + where + ' { margin-right: ' + value + ' }');
      if (property === 'right') assert.ok(value === 'auto' || value === '0' || value === '0px', 'a drawer or overlay states a right offset: ' + where + ' { right: ' + value + ' }');
      if (property === 'transform') assert.ok(!/translateX\(\s*-/.test(value), 'a drawer or overlay is transformed to the left: ' + where + ' { transform: ' + value + ' }');
    }
  }
});