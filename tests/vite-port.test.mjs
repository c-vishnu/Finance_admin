import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const vite=readFileSync(new URL('../vite.config.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('local Vite defaults to port 4001 and does not silently move',()=>{
  assert.match(vite,/port:\s*4001/);
  assert.match(vite,/strictPort:\s*true/);
  assert.match(vite,/preview:\s*\{/);
  assert.equal(pkg.scripts.dev,'vite --port 4001 --strictPort');
  assert.equal(pkg.scripts.preview,'vite preview --port 4001 --strictPort');
});
