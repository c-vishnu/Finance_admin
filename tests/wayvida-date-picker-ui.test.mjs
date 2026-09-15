import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const picker=readFileSync(new URL('../src/WayvidaDatePicker.jsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('shared date picker delegates all native date inputs without changing their data contract',()=>{
 assert.match(main,/<WayvidaDatePicker \/>/);
 assert.match(picker,/input\.type!=='date'/);
 assert.match(picker,/target\.dispatchEvent\(new Event\('input'/);
 assert.match(picker,/target\.dispatchEvent\(new Event\('change'/);
 assert.match(picker,/Previous month/);
 assert.match(picker,/Next month/);
 assert.match(picker,/className="wvdp-head"/);
 assert.match(picker,/className="wvdp-actions"/);
 assert.doesNotMatch(picker,/<header>/);
 assert.match(picker,/>Cancel<\/button>/);
 assert.match(picker,/>OK<\/button>/);
});
