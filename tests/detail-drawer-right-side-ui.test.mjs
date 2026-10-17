import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const polish = readFileSync(new URL('../src/ui-quality-polish.css', import.meta.url), 'utf8');

test('the shared operation drawer escapes the page aside rule and stays in the flex flow', () => {
  const rule = polish.match(/\.opsOverlay>\.opsDrawer\{([^}]*)\}/);
  assert.ok(rule, 'the polish layer owns a targeted rule for portaled operation drawers');
  assert.match(rule[1], /position:relative/, 'fixed positioning from the base aside selector is neutralised');
  assert.match(rule[1], /inset:auto/, 'no viewport inset is left on the panel');
  assert.match(rule[1], /left:auto/, 'the drawer is not pinned to the left edge');
  assert.match(rule[1], /right:auto/, 'the overlay flex alignment decides the right edge');
});

test('the operation overlay keeps packing its drawer against the right edge', () => {
  assert.ok(polish.includes('.opsOverlay'), 'the rule names the shared operation overlay');
  assert.ok(polish.includes('justify-content:flex-end!important'), 'the overlay still aligns the panel to the right');
});
