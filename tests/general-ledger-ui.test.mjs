import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToString} from 'react-dom/server';

const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite'))('esbuild');
const output=await build({entryPoints:['src/GeneralLedgerPro.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const module={exports:{}};
new Function('require','module','exports',output.outputFiles[0].text)(require,module,module.exports);

test('professional ledger keeps the register simple and exposes report controls',()=>{
  globalThis.sessionStorage={getItem(){return '1010'}};
  const html=renderToString(React.createElement(module.exports.default,{accounts:[],notify(){},onNavigate(){}})).replace(/<!--.*?-->/g,'');
  for(const label of ['Selected account','Normal Debit','Opening balance','Debit movement','Credit movement','Closing balance','Date','Voucher','Debit','Credit','Balance','Status','View details','Export Excel','Export PDF','Print ledger','Email report'])assert.ok(html.includes(label),label);
  const table=html.match(/<table class="gl-ledger-table gl-ledger-simple gl-ledger-compact">([\s\S]*?)<\/table>/)?.[1]||'';
  for(const hiddenDetail of ['Description','Branch','Cost centre','Reconciliation'])assert.ok(!table.includes(`>${hiddenDetail}<`),hiddenDetail);
  assert.ok(table.includes('title="Payment received from ABC Retail Ltd"'));
  assert.ok(table.includes('Date &amp; time'));
  assert.ok(table.includes('gl-date-time'));
  assert.ok(html.includes('RCPT-00041'));
  assert.ok(html.includes('class="gl-account-picker"'));
  assert.ok(html.includes('aria-label="Select ledger account"'));
  assert.ok(!html.includes('Save view'));
  assert.ok(!html.includes('Saved view:'));
  assert.ok(!html.includes('Account history at a glance'));
  const drawer=html.match(/<aside class="gl-filter-panel"[\s\S]*?<\/aside>/)?.[0]||'';
  assert.ok(!drawer.includes('Select ledger account'));
  delete globalThis.sessionStorage;
});

test('ledger grid uses the page width without an internal scrollbar',async()=>{
  const css=await readFile(new URL('../src/general-ledger.css',import.meta.url),'utf8');
  assert.match(css,/Full-page ledger grid: no nested horizontal or vertical scroller/);
  assert.match(css,/\.gl-table-scroll\{overflow:visible!important/);
  assert.match(css,/\.gl-ledger-table\{width:100%!important;min-width:0!important;table-layout:fixed/);
  assert.match(css,/@media\(max-width:1450px\)/);
  assert.match(css,/Seven-column ledger register; descriptions are disclosed on hover and in details/);
});
