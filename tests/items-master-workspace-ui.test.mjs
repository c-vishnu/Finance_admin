import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync('src/Items.jsx','utf8');
const styles=readFileSync('src/items.css','utf8');

test('item creation uses the shared multi-organisation and branch picker',()=>{
 assert.match(screen,/OrganisationBranchScope organisations=\{organisations\} companyIds=\{form\.organizationIds\|\|\[form\.organizationId\]\} branchIds=\{form\.branchIds\|\|\[\]\}/);
 assert.match(screen,/label="Item availability" showLine=\{false\} multiple/);
 assert.match(screen,/organizationIds:scope\.companyIds/);
 assert.match(screen,/branchIds:scope\.branchIds/);
});

test('the register shows item identity and uses View Details plus a three-dot menu',()=>{
 for(const text of ['Item Details','No SKU',"?'HSN':'SAC'",'View Details','Edit Item','Enable Item','Disable Item','Duplicate Item','Delete'])assert.ok(screen.includes(text),text);
 assert.match(screen,/className="itemMore"><summary aria-label=\{'More actions for '\+item\.name\}><IconDots/);
 assert.match(styles,/\.itemMoreMenu\{position:absolute;right:0;top:calc\(100% \+ 6px\)/);
 assert.doesNotMatch(screen,/className="itemEdit" onClick=\{\(\)=>start\(item\)\}/);
});

test('item details exposes saved data, transactions and audit history',()=>{
 for(const text of ['Item Details','Basic data','Organisations','Branches','Sales account','Purchase account','Inventory asset','Cost of goods sold','Opening stock','Transactions','Audit log / History','No transactions reference this item yet.'])assert.ok(screen.includes(text),text);
 assert.match(screen,/accountingState\.inventoryAdjustments/);
 assert.match(screen,/auditTrail:\[\.\.\.\(form\.auditTrail\|\|\[\]\),audit\(isNew\?'Item created':'Item updated'\)\]/);
 assert.match(styles,/\.itemDetailFacts\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('item details follows the full-width document header and tabbed information pattern',()=>{
  assert.match(screen,/<div className="itemDetailHead"><button type="button" className="itemBack" aria-label="Back to Items"/);
  assert.match(screen,/<h1>Item Details<\/h1><\/div><div className="itemDetailBody">/);
  assert.match(screen,/className="itemDetailActions"><span className=\{'itemStatus '/);
  assert.match(screen,/className="itemMore itemDetailMore"><summary aria-label="More item actions">/);
  assert.match(screen,/\['Basic Data','Transactions','History'\]\.map/);
  assert.match(screen,/aria-current=\{detailTab===tab\?'page':undefined\}/);
  assert.match(styles,/\.app main:has\(>\.itemsPage\.itemDetailPage\)\{max-width:none!important;padding:0!important\}/);
  assert.match(styles,/\.itemDetailPage \.itemDetailHead\{display:grid;grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(styles,/\.itemDetailTabs\{display:flex;align-items:center/);
});

test('the item detail tab row is a gap-free segmented bar that never scrolls',()=>{
 assert.match(styles,/\.itemDetailTabs\{display:flex;align-items:center;flex:0 0 auto;gap:0;height:46px;padding:0;border:1px solid #e6ebf2;border-radius:10px;background:#f7f9fc;overflow:hidden\}/);
 assert.match(styles,/\.itemDetailTabs button\{display:flex;flex:1 1 0;min-width:0;align-items:center;justify-content:center;gap:7px;height:100%;padding:0 12px/);
 assert.match(styles,/\.itemDetailTabs button\{[^}]*white-space:nowrap/);
 assert.match(styles,/\.itemDetailTabs button\.active\{background:#fff;color:#245fd9;border-bottom-color:#3478f6\}/);
 assert.match(styles,/\.itemDetailTabs button span\{[^}]*border-radius:999px/);
 assert.ok(styles.includes('.itemDetailTabs button{padding:0 8px;gap:5px;font-size:12px}'),'narrow-viewport tab padding');
 assert.doesNotMatch(styles,/\.itemDetailTabs\{[^}]*overflow-x:auto/);
});
