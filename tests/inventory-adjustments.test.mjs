/* Inventory Adjustments - the engine behind Inventory > Inventory Adjustments.

   The module is held to one promise: a draft or a cancelled document changes
   nothing, and only an Adjusted document moves the inventory position and posts
   one balanced entry that never touches cash or bank. These tests exercise that
   promise through the pure engine, and read the screen sources for the labels,
   the wiring and the sticky table styles the specification requires. The journal
   itself is the shared engine in src/invoice-engine.js, so period locking,
   balance enforcement and account validation are inherited rather than rebuilt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountingPreview,accountCodeOf,adjustmentActivity,adjustmentCommand,adjustmentCsv,adjustmentImpact,adjustmentRows,blankAdjustment,blankLine,canonicalItems,configuredAdjustmentAccount,duplicateAdjustment,formatQuantity,inventoryPosition,nextAdjustmentNumber,storedLines,validateAdjustment} from '../src/inventory-adjustments.js';

const engine=readFileSync(new URL('../src/inventory-adjustments.js',import.meta.url),'utf8');
const screen=readFileSync(new URL('../src/InventoryAdjustments.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/inventory-adjustments.css',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');

const INVENTORY='1200',LOSS='5900';
const account=(code,name,type)=>({id:'acc-'+code,code,name,type,active:true,isGroup:false});
const state=()=>({accounts:[account(INVENTORY,'Inventory','Assets'),account(LOSS,'Inventory Loss','Expenses')],journals:[],audit:[],invoices:[],payments:[],inventoryAdjustments:[]});
const items=()=>[
 {id:'item-1',name:'Product A',sku:'SKU-1',unit:'pcs',type:'Goods',trackInventory:true,organizationId:'abc',warehouseId:'abc-kochi',openingQuantity:'100',openingRate:'500',inventoryAccount:INVENTORY},
 {id:'item-2',name:'Product B',sku:'SKU-2',unit:'pcs',type:'Goods',trackInventory:true,organizationId:'abc',warehouseId:'abc-kochi',openingQuantity:'50',openingRate:'200',inventoryAccount:INVENTORY}
];
const settings=over=>({approvals:{inventoryAdjustments:true,...(over?.approvals||{})},inventory:{negativeStock:false,...(over?.inventory||{})},transactions:{reference:true},accountMappings:{inventoryAsset:'1200 · Inventory',stockAdjustment:'5900 · Inventory Loss'}});
const line=(itemId,fields)=>Object.assign(blankLine(itemId,'abc-kochi'),fields);
const draft=over=>({...blankAdjustment({date:'2026-09-15',account:LOSS,reason:'Damaged Stock',organisation:{companyId:'ABC01',companyName:'ABC Ltd',branchId:'abc-kochi',branchName:'Kochi'},type:'Quantity Adjustment'}),...over,lines:over?.lines||[line('item-1',{qtyDelta:'-3'})]});
const ctx=over=>({actor:'Admin',role:'Admin',items:items(),...over,settings:settings(over)});

test('a quantity decrease is valued at the item rate and produces a balanced entry',()=>{
  const impact=adjustmentImpact(state(),items(),draft());
  assert.equal(impact.totals.items,1);
  assert.equal(impact.totals.increased,0);
  assert.equal(impact.totals.decreased,-3);
  assert.equal(impact.totals.netQuantity,-3);
  assert.equal(impact.totals.valueImpact,-150000);
  assert.equal(impact.lines[0].newQty,97);
  const preview=accountingPreview(state(),items(),draft(),settings(),state().accounts);
  assert.deepEqual(preview.lines.map(entry=>[entry.account,entry.debit,entry.credit]),[[LOSS,150000,0],[INVENTORY,0,150000]]);
  assert.equal(preview.totalDebit,150000);
  assert.equal(preview.totalCredit,150000);
  assert.equal(preview.balanced,true);
});

test('increase and decrease are reported separately for the impact summary',()=>{
  const impact=adjustmentImpact(state(),items(),draft({lines:[line('item-1',{qtyDelta:'-3'}),line('item-2',{qtyDelta:'5'})]}));
  assert.equal(impact.totals.items,2);
  assert.equal(impact.totals.increased,5);
  assert.equal(impact.totals.decreased,-3);
  assert.equal(impact.totals.netQuantity,2);
  assert.equal(impact.totals.valueImpact,-150000+100000);
});

test('a quantity increase debits inventory and credits the configured adjustment account',()=>{
  const preview=accountingPreview(state(),items(),draft({lines:[line('item-1',{qtyDelta:'5'})]}),settings(),state().accounts);
  assert.deepEqual(preview.lines.map(entry=>[entry.account,entry.debit,entry.credit]),[[INVENTORY,250000,0],[LOSS,0,250000]]);
  assert.equal(preview.balanced,true);
});

test('a value adjustment never changes the quantity',()=>{
  const doc=draft({type:'Value Adjustment',lines:[line('item-1',{valueDelta:'-5000'})]});
  const impact=adjustmentImpact(state(),items(),doc);
  const row=impact.lines[0];
  assert.equal(row.currentQty,100);
  assert.equal(row.qtyDelta,0);
  assert.equal(row.newQty,100);
  assert.equal(row.currentValue,5000000);
  assert.equal(row.valueDelta,-500000);
  assert.equal(row.newValue,4500000);
  assert.deepEqual([impact.totals.currentValue,impact.totals.valueDelta,impact.totals.newValue],[5000000,-500000,4500000]);
  const preview=accountingPreview(state(),items(),doc,settings(),state().accounts);
  assert.deepEqual(preview.lines.map(entry=>[entry.account,entry.debit,entry.credit]),[[LOSS,500000,0],[INVENTORY,0,500000]]);
});

test('setting a new quantity derives the adjustment instead of the other way round',()=>{
  const impact=adjustmentImpact(state(),items(),draft({entryMode:'Set New Value',lines:[line('item-1',{newQty:'94'})]}));
  assert.equal(impact.lines[0].qtyDelta,-6);
  assert.equal(impact.lines[0].newQty,94);
  assert.equal(impact.totals.netQuantity,-6);
  assert.equal(inventoryPosition(state(),items())['item-1::abc-kochi'].quantity,100);
});

test('only an adjusted document moves inventory and posts exactly one entry',()=>{
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  assert.equal(saved.result.number,'ADJ-00001');
  assert.equal(saved.result.status,'Draft');
  assert.equal(saved.result.posted,false);
  assert.equal(saved.state.journals.length,0);
  assert.deepEqual(inventoryPosition(saved.state,items()),inventoryPosition(state(),items()));
  const posted=adjustmentCommand(saved.state,'adjust',{id:saved.result.id},ctx());
  assert.equal(posted.result.status,'Adjusted');
  assert.equal(posted.result.posted,true);
  assert.equal(posted.state.journals.length,1);
  const entry=posted.state.journals[0];
  assert.equal(entry.source,'Inventory Adjustment');
  assert.equal(entry.reference,'ADJ-00001');
  assert.equal(entry.companyId,'ABC01');
  assert.equal(entry.branchId,'abc-kochi');
  assert.equal(entry.createdBy,'Admin');
  assert.equal(entry.status,'Posted');
  assert.equal(entry.token,'inventory-adjustment:'+posted.result.id);
  assert.equal(posted.result.journalId,entry.id);
  assert.deepEqual(entry.lines.map(row=>[row.account,row.debit,row.credit]),[[LOSS,150000,0],[INVENTORY,0,150000]]);
  assert.equal(inventoryPosition(posted.state,items())['item-1::abc-kochi'].quantity,97);
  assert.equal(inventoryPosition(posted.state,items())['item-1::abc-kochi'].value,5000000-150000);
});

test('a cancelled document posts nothing and leaves the position untouched',()=>{
  const before=inventoryPosition(state(),items());
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  assert.throws(()=>adjustmentCommand(saved.state,'cancel',{id:saved.result.id},ctx()),/cancellation reason/);
  const cancelled=adjustmentCommand(saved.state,'cancel',{id:saved.result.id,cancellationReason:'Raised in error'},ctx());
  assert.equal(cancelled.result.status,'Cancelled');
  assert.equal(cancelled.result.cancellationReason,'Raised in error');
  assert.equal(cancelled.state.journals.length,0);
  assert.deepEqual(inventoryPosition(cancelled.state,items()),before);
  assert.throws(()=>adjustmentCommand(cancelled.state,'adjust',{id:cancelled.result.id},ctx()),/cannot be adjusted/);
});

test('an adjusted record is corrected by a reversal instead of an edit',()=>{
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  const posted=adjustmentCommand(saved.state,'adjust',{id:saved.result.id},ctx());
  const original={...storedLines(posted.result)[0]};
  const journalCount=posted.state.journals.length;
  assert.throws(()=>adjustmentCommand(posted.state,'save',{...posted.result,reason:'Lost Stock'},ctx()),/reversal/);
  assert.throws(()=>adjustmentCommand(posted.state,'reverse',{id:posted.result.id,date:'2026-09-16'},ctx()),/reason for the reversal/);
  const reversed=adjustmentCommand(posted.state,'reverse',{id:posted.result.id,date:'2026-09-16',reason:'Count was wrong'},ctx());
  const mirror=reversed.result;
  assert.equal(reversed.state.journals.length,journalCount+1);
  assert.equal(mirror.reversalOf,posted.result.id);
  assert.equal(mirror.status,'Adjusted');
  assert.equal(mirror.posted,true);
  assert.equal(mirror.reason,'Reversal');
  assert.equal(mirror.notes,'Count was wrong');
  assert.deepEqual(storedLines(mirror).map(row=>[row.qtyDelta,row.valueImpact]),[[3,150000]]);
  assert.deepEqual(reversed.state.journals[1].lines.map(row=>[row.account,row.debit,row.credit]),[[INVENTORY,150000,0],[LOSS,0,150000]]);
  const stored=adjustmentRows(reversed.state).find(row=>row.id===posted.result.id);
  assert.deepEqual(storedLines(stored)[0],original);
  assert.equal(stored.reversedBy,mirror.id);
  assert.equal(stored.status,'Adjusted');
  assert.equal(inventoryPosition(reversed.state,items())['item-1::abc-kochi'].quantity,100);
  assert.equal(inventoryPosition(reversed.state,items())['item-1::abc-kochi'].value,5000000);
  assert.throws(()=>adjustmentCommand(reversed.state,'reverse',{id:posted.result.id,reason:'again'},ctx()),/already exists/);
});

test('the approval lifecycle moves only through the allowed steps',()=>{
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  const submitted=adjustmentCommand(saved.state,'submit',{id:saved.result.id},ctx({role:'Accountant'}));
  assert.equal(submitted.result.status,'Pending Approval');
  assert.equal(submitted.result.submittedBy,'Admin');
  assert.throws(()=>adjustmentCommand(submitted.state,'adjust',{id:saved.result.id},ctx({role:'Accountant'})),/cannot adjust/);
  const approved=adjustmentCommand(submitted.state,'adjust',{id:saved.result.id},ctx({role:'Finance Manager'}));
  assert.equal(approved.result.status,'Adjusted');
  assert.deepEqual(adjustmentActivity(approved.result).map(entry=>entry.action),['Adjustment created','Adjustment submitted for approval','Adjustment approved','Inventory and accounting updated']);
  assert.match(adjustmentActivity(approved.result).at(-1).note,/Journal ADJ-00001 posted/);
});

test('approval can be switched off, and then only a role that may post adjusts',()=>{
  const off={approvals:{inventoryAdjustments:false}};
  const saved=adjustmentCommand(state(),'save',draft(),ctx(off));
  assert.throws(()=>adjustmentCommand(saved.state,'submit',{id:saved.result.id},ctx(off)),/Approval is switched off/);
  assert.throws(()=>adjustmentCommand(saved.state,'adjust',{id:saved.result.id},ctx({...off,role:'Accountant'})),/cannot adjust/);
  const posted=adjustmentCommand(saved.state,'adjust',{id:saved.result.id},ctx(off));
  assert.equal(posted.result.status,'Adjusted');
  const direct=adjustmentCommand(state(),'save-and-adjust',draft(),ctx(off));
  assert.equal(direct.result.status,'Adjusted');
  assert.equal(direct.state.journals.length,1);
  assert.throws(()=>adjustmentCommand(state(),'save-and-adjust',draft(),ctx()),/Save the draft and submit it/);
});

test('validation states each requirement before anything is posted',()=>{
  const blank=validateAdjustment(state(),blankAdjustment(),{items:items(),settings:settings()});
  assert.deepEqual(Object.keys(blank).sort(),['account','branchId','companyId','lines','reason']);
  assert.ok(validateAdjustment(state(),draft({type:'Revaluation'}),{items:items(),settings:settings()}).type);
  assert.ok(validateAdjustment(state(),draft({date:'15/09/2026'}),{items:items(),settings:settings()}).date);
  assert.match(validateAdjustment(state(),draft({account:'9999'}),{items:items(),settings:settings()}).account,/active posting account/);
  assert.ok(validateAdjustment(state(),draft({lines:[blankLine('','')]}),{items:items(),settings:settings()}).lines);
  assert.match(validateAdjustment(state(),draft({lines:[blankLine('item-1','')]}),{items:items(),settings:settings()})['line-0'],/Choose the location for Product A/);
  assert.match(validateAdjustment(state(),draft({lines:[line('item-1',{qtyDelta:'1'}),line('item-1',{qtyDelta:'2'})]}),{items:items(),settings:settings()})['line-1'],/more than once/);
  /* A draft is allowed to be incomplete - that is what a draft is for - so only
     the steps that post or hand the document on are held to the whole rule. */
  const noItems=draft({lines:[blankLine('','')]});
  assert.equal(adjustmentCommand(state(),'save',noItems,ctx()).result.status,'Draft');
  assert.throws(()=>adjustmentCommand(state(),'save-and-adjust',noItems,ctx({approvals:{inventoryAdjustments:false}})),/at least one item/);
});

test('negative stock and negative value are refused unless the organisation allows them',()=>{
  const below=draft({lines:[line('item-1',{qtyDelta:'-250'})]});
  assert.match(validateAdjustment(state(),below,{items:items(),settings:settings()})['line-0'],/below zero stock/);
  assert.equal(validateAdjustment(state(),below,{items:items(),settings:settings({inventory:{negativeStock:true}})})['line-0'],undefined);
  const negativeValue=draft({type:'Value Adjustment',lines:[line('item-1',{valueDelta:'-90000'})]});
  assert.match(validateAdjustment(state(),negativeValue,{items:items(),settings:settings()})['line-0'],/negative inventory value/);
  assert.equal(validateAdjustment(state(),negativeValue,{items:items(),settings:settings({inventory:{negativeStock:true}})})['line-0'],'Product A cannot carry a negative inventory value.');
});

test('a stored reference is never reused and duplication takes the next free one',()=>{
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  assert.equal(nextAdjustmentNumber(saved.state),'ADJ-00002');
  assert.throws(()=>adjustmentCommand(saved.state,'save',{...draft(),number:'ADJ-00001'},ctx()),/already exists/);
  const copy=duplicateAdjustment(saved.state,saved.result);
  assert.equal(copy.number,'ADJ-00002');
  assert.equal(copy.status,'Draft');
  assert.equal(copy.posted,false);
  assert.equal(copy.date,new Date().toLocaleDateString('en-CA'));
  assert.deepEqual(storedLines(copy).map(row=>[row.itemId,row.locationId,row.qtyDelta,row.newQty]),[['item-1','abc-kochi','','']]);
  assert.deepEqual(copy.activity,[]);
});

test('the adjustment account comes from the settings mapping or the Chart of Accounts',()=>{
  assert.equal(configuredAdjustmentAccount({accountMappings:{stockAdjustment:'SA-01 · Stock Adjustment'}}),'SA-01');
  assert.equal(configuredAdjustmentAccount({}),'');
  assert.equal(accountCodeOf('5900 \u00b7 Other Expenses'),'5900');
  assert.equal(accountCodeOf(''),'');
});

test('stored locations resolve to the branch ids the register works in',()=>{
  const branches=[{id:'abc-kochi',code:'KOC01',name:'Kochi Branch'},{id:'abc-pune',code:'PUN02',name:'Pune Branch'}];
  assert.deepEqual(canonicalItems([{id:'item-1',warehouseId:'Kochi Branch'},{id:'item-2',warehouseId:'KOC01'},{id:'item-3',warehouseId:'abc-pune'},{id:'item-4',warehouseId:''}],branches).map(item=>item.warehouseId),['abc-kochi','abc-kochi','abc-pune','']);
});

test('the exported register row carries what the list needs to print',()=>{
  const saved=adjustmentCommand(state(),'save',draft(),ctx());
  const csv=adjustmentCsv(saved.result,{items:items(),settings:settings()});
  assert.match(csv,/ADJ-00001/);
  assert.match(csv,/Damaged Stock/);
  assert.match(csv,/"Product A"/);
  assert.match(csv,/"Quantity adjusted"/);
  assert.equal(formatQuantity(-3.5),'-3.5');
  assert.equal(formatQuantity(1200),'1,200');
});

test('the module posts through the shared journal engine and never a cash account',()=>{
  assert.match(engine,/import \{journal,today\} from '\.\/invoice-engine\.js'/);
  assert.match(engine,/periodModule:'Inventory'/);
  assert.doesNotMatch(engine,/['"](1000|1010)['"]/);
  assert.doesNotMatch(engine,/localStorage/);
  assert.doesNotMatch(engine,/document\.(getElementById|querySelector|createElement|body)/);
  assert.doesNotMatch(engine,/window\.(addEventListener|dispatchEvent|localStorage)/);
  assert.match(screen,/adjustmentCommand\(/);
  assert.doesNotMatch(screen,/localStorage\.setItem/);
});

test('the sidebar and the route expose Inventory > Inventory Adjustments',()=>{
  assert.match(navigation,/\{label:'Inventory',icon:IconPackage,children:\[leaf\('Items'\),leaf\('Inventory Adjustments'\)\]\}/);
  assert.match(app,/import InventoryAdjustments from '\.\/InventoryAdjustments\.jsx'/);
  assert.match(app,/a==='Inventory Adjustments'\?<InventoryAdjustments seed=\{coaSeed\} notify=\{notify\} onNavigate=\{setA\}\/>/);
});

test('the screens keep the wording an accountant and a storekeeper both need',()=>{
  for(const text of ['Inventory Adjustments','New Inventory Adjustment','Adjust inventory quantities or values and keep your accounting records accurate.','Correct inventory quantities or values without creating a purchase or sales transaction.','Adjustment type','Adjustment account','Inventory impact','Accounting impact','Activity history','Current quantity','Quantity adjusted','Value adjusted','New quantity','New value','Adjust By','Set New Value','Add Item','Save as Draft','Submit for Approval','Save &amp; Adjust','View Journal Entry','Create Reversal / Correcting Adjustment']){
    assert.ok(screen.includes(text),text);
  }
  assert.match(screen,/import '\.\/inventory-adjustments\.css'/);
});

test('the register follows the accounting register structure of Journal Entries and Budgets',()=>{
  assert.match(screen,/import \{useTerminology\} from '\.\/terminology\.jsx'/);
  assert.match(screen,/const role=mode==='business'\?'Admin':'Accountant'/,'the acting role follows the header View as switch');
  assert.doesNotMatch(screen,/Acting as/,'the acting-as control left the page');
  assert.doesNotMatch(screen,/RoleField|setRole/,'no role selector is wired on any of the three screens');
  assert.match(screen,/<div className="iaHeading">/,'the register heading is the plain title row the other registers use');
  assert.match(screen,/<div className="iaHeadActions"><button className="primary" type="button" onClick=\{onNew\}>/);
  assert.match(screen,/<details className="iaFilters">/,'one Filters disclosure holds every dropdown');
  assert.match(screen,/<summary aria-label="Open filters"><IconFilter size=\{16\}\/>Filters/,'the filter button carries the filter icon and is labelled for a screen reader');
  assert.match(screen,/IconFileDownload,IconFilter,IconHistory/,'the filter icon is imported from the design-system icon set');
  assert.ok(!screen.includes('iaFilterCount'),'the register bar prints no count beside the filters');
  assert.ok(!styles.includes('iaFilterCount'),'no count styling is left behind');
  assert.match(screen,/document\.querySelectorAll\('details\.iaKebab\[open\],details\.iaFilters\[open\]'\)/,'one dismissal effect closes the filters panel and the row menus together');
  for(const label of ['Adjustment type','Status','Organisation','Branch / location','From date','To date'])assert.ok(screen.includes('<span>'+label+'</span>'),'the filter panel carries '+label);
  assert.match(screen,/\{REGISTER_COLUMNS\.map\(column=><th key=\{column\} scope="col"/,'the table headings are plain labels');
  assert.doesNotMatch(screen,/iaSort|toggleSort|aria-sort|SORTERS/,'no column sorting control remains');
  assert.match(styles,/\.iaRegisterBar\{display:flex/);
  assert.match(styles,/\.iaFiltersPanel\{position:absolute/);
  assert.match(styles,/\.iaRegisterCard\{overflow:visible\}/,'the register card never clips its own filter panel');
  assert.doesNotMatch(styles,/\.iaRole|\.iaSort|\.iaRange|\.iaTools/,'the deleted controls left no styling behind');
});

test('the item tables pin their header row and Item column and keep text legible',()=>{
  assert.match(styles,/\.iaItemTable thead th\{position:sticky;top:0/);
  assert.match(styles,/\.iaItemTable \.iaStickyCol\{position:sticky;left:0/);
  assert.match(styles,/\.iaItemsScroll\{overflow:auto/);
  assert.match(styles,/\.iaKebab>summary\{display:grid;place-items:center;width:32px;height:32px/);
  assert.match(styles,/\.iaKebabMenu\{position:absolute;right:0;top:38px;z-index:80/);
  assert.match(styles,/th\.iaNum,td\.iaNum\{text-align:right/);
  assert.doesNotMatch(styles,/font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
});
