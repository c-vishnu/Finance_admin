import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRandomUUID,installRandomUUID} from '../src/crypto-uuid.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('createRandomUUID falls back when randomUUID is missing',()=>{
  let n=0;
  const fake={getRandomValues(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=(n++)&255}};
  const first=createRandomUUID(fake)();
  const second=createRandomUUID(fake)();
  assert.match(first,uuid);
  assert.match(second,uuid);
  assert.notEqual(first,second);
});

test('installRandomUUID adds the method on an insecure-context crypto object',()=>{
  const fake={getRandomValues(bytes){crypto.getRandomValues(bytes)}};
  installRandomUUID(fake);
  assert.equal(typeof fake.randomUUID,'function');
  assert.match(fake.randomUUID(),uuid);
});

test('the HTML boot script installs randomUUID before the app module',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.match(html,/c\.randomUUID=function/);
  assert.match(html,/<script type="module" src="\/src\/main\.jsx">/);
  assert.ok(html.indexOf('c.randomUUID=function')<html.indexOf('src="/src/main.jsx"'));
  assert.match(main,/^import "\.\/crypto-uuid\.js";/m);
});
