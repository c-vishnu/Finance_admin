import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DECIMAL_CHOICES,NUMBER_FORMATS,readNumberFormat,saveNumberFormat,formatRupees,formatMinor,formatQuantity,formatRate,numberSample,decimalChoiceOf,digitsOfChoice} from '../src/number-format.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('the number format is a setting, read and written through the settings store',()=>{
 const defaults=readNumberFormat();
 assert.equal(defaults.numberFormat,'en-IN','the workspace opens on the Indian grouping');
 assert.equal(defaults.decimalPlaces,2,'with the two decimals every amount already carried');
 assert.equal(defaults.currencySymbol,'₹');
 assert.equal(defaults.roundOffQuantity,false);
 assert.equal(defaults.roundOffRate,false);
 assert.ok(read('src/number-format.js').includes("import {readSettings,writeSettings,SETTINGS_EVENT} from './settings-store.js';"),'it is an organisation preference, not a second store');
 assert.ok(read('src/number-format.js').includes('export function saveNumberFormat(patch)'),'and saving runs through the settings writer, which validates, merges defaults and raises the shared event');
 const saved=saveNumberFormat({numberFormat:'en-US',decimalPlaces:4,currencySymbol:'$'});
 assert.equal(saved.organization.numberFormat,'en-US','the writer returns the stored settings');
 assert.ok(read('src/settings-store.js').includes("numberFormat:'en-IN',currencySymbol:'₹',roundOffQuantity:false,roundOffRate:false"),'the keys sit beside the other organisation preferences, so they survive a reload');
});

test('the grouping follows the chosen number system and the symbol follows the operator',()=>{
 assert.equal(numberSample('en-IN'),'1,23,45,679','the lakh grouping the dialog previews');
 assert.equal(numberSample('en-US'),'12,345,679','against the million grouping');
 assert.equal(formatRupees(1234567.89,{numberFormat:'en-IN',decimalPlaces:2,currencySymbol:'₹'}),'₹12,34,567.89');
 assert.equal(formatRupees(1234567.89,{numberFormat:'en-US',decimalPlaces:2,currencySymbol:'$'}),'$1,234,567.89');
 assert.equal(formatMinor(100300,{numberFormat:'en-IN',decimalPlaces:2,currencySymbol:'₹'}),'₹1,003.00','the engine stores paise, so the shared formatter halves the stored amount');
});

test('the decimal choice decides how many places every amount states',()=>{
 assert.equal(DECIMAL_CHOICES.length,6);
 assert.deepEqual(DECIMAL_CHOICES.map(entry=>entry.label),['Default','99','99.0','99.00','99.000','99.0000']);
 assert.equal(formatRupees(1003,{numberFormat:'en-IN',decimalPlaces:0,currencySymbol:'₹'}),'₹1,003');
 assert.equal(formatRupees(1003,{numberFormat:'en-IN',decimalPlaces:4,currencySymbol:'₹'}),'₹1,003.0000');
 assert.equal(decimalChoiceOf(2),'default','Default IS two decimals, so a stored 2 reads back as Default rather than its twin 99.00');
 assert.equal(decimalChoiceOf(4),'4','and any other precision maps to its own radio');
 assert.equal(decimalChoiceOf(9),'default','and an unrecognised one falls back to Default');
 assert.equal(digitsOfChoice('default'),2);
 assert.equal(digitsOfChoice('4'),4);
});

test('the round-off switches move quantities and rates and never a posted amount',()=>{
 const base={numberFormat:'en-IN',decimalPlaces:2,currencySymbol:'₹',roundOffQuantity:false,roundOffRate:false};
 assert.equal(formatQuantity(12.456,base),'12.46');
 assert.equal(formatQuantity(12.456,{...base,roundOffQuantity:true}),'12');
 assert.equal(formatRate(12.456,base),'12.46');
 assert.equal(formatRate(12.456,{...base,roundOffRate:true}),'12');
 assert.equal(formatMinor(100300,{...base,roundOffRate:true}),'₹1,003.00','a posted amount is not a rate and must not move');
});

test('every money helper in the app reads the one format',()=>{
 const files=['src/invoice-engine.js','src/Customers.jsx','src/GeneralLedgerPro.jsx','src/SalesOrderActions.jsx','src/SalesOrders.jsx','src/Vendors.jsx','src/simple-journal-transaction.js','src/journal-templates.js','src/inventory-adjustments.js'];
 for(const file of files) assert.ok(read(file).includes('number-format.js'),file+' reads the shared format rather than keeping its own en-IN literal');
 assert.ok(read('src/invoice-engine.js').includes('export const money=(n,format)=>formatMinor(n,format);'),'the engine money function delegates, which is what carries the setting into the create pages, the registers and every printout');
 assert.ok(read('src/DocumentPreview.jsx').includes('useNumberFormat();'),'and the printed sheet re-renders when the setting changes');
});

test('the create head carries the Number and Currency Format control',()=>{
 const control=read('src/NumberCurrencyFormatDialog.jsx'),styles=read('src/sales-orders.css');
 assert.ok(control.includes('className="soHeadSettings"'),'a settings button sits at the right of the create head');
 assert.ok(control.includes('aria-label="Number and currency format"'),'labelled for a screen reader');
 assert.ok(control.includes('<h3 id="nfTitle">Number and Currency Format</h3>'),'opening the dialog the user asked for');
 assert.ok(control.includes('role="dialog"')&&control.includes('aria-modal="true"'),'as a modal dialog');
 assert.ok(control.includes('>Change Number Systems</p>'),'with the number-system section, the decimal digits, the round-off switches and the custom symbol');
 assert.ok(control.includes('Save Changes'),'and one primary Save Changes action');
 assert.match(styles,/\.soCreatePage>\.soCreateHead\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/, 'the head has a second column for it');
 assert.match(styles,/\.soHeadSettings\{[^}]*border:1px solid #bcd0f5;border-radius:8px;background:#eef4ff;color:#245fd9/, 'styled as the light primary variant, so the one solid fill on the page stays with Save');
 assert.match(styles,/\.soHeadSettings:focus-visible\{outline:2px solid #84adff;outline-offset:2px\}/,'with a visible focus ring');
 for(const page of ['src/SalesOrders.jsx','src/InvoiceWorkspace.jsx']) assert.ok(read(page).includes('<NumberFormatControl/>'),page+' mounts the control');
});

test('the Items register formats through the setting and keeps every hook above its early return',()=>{
 const items=read('src/Items.jsx');
 assert.ok(items.includes("import {formatRupees,useNumberFormat} from './number-format.js';"),'the screen reads the one number-format module');
 assert.ok(items.includes(',money=value=>formatRupees(value,numberFormat);'),'and its own money helper - which was a hardcoded en-IN rupee literal and ignored every setting - now delegates to the shared formatter');
 assert.ok(items.includes('const numberFormat=useNumberFormat();'),'with the hook, so the register and the item detail re-render when the setting changes');
 const lines=items.split('\n');
 const hooks=lines.map((line,index)=>[index+1,line]).filter(([,line])=>/const \w*=use(State|Effect|Ref|Memo|Callback)\(/.test(line)).map(([number])=>number);
 const earlyReturn=lines.findIndex(line=>/^\s*return <section className="itemsPage itemDetailPage">/.test(line))+1;
 assert.ok(earlyReturn>0,'the detail page is one early return in the same component');
 assert.ok(hooks.every(number=>number<earlyReturn),'every hook sits above it: a hook below ran on the register and not on the detail, which is the "Rendered fewer hooks than expected" crash the item detail used to throw. Hooks at '+hooks.join(', ')+', return at '+earlyReturn);
});
