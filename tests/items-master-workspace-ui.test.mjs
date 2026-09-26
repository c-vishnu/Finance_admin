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
 for(const text of ['Item Details','Basic data','Organisations','Branches','Sales account','Purchase account','Transactions','Audit log / History','No transactions reference this item yet.'])assert.ok(screen.includes(text),text);
 assert.match(screen,/accountingState\.inventoryAdjustments/);
 assert.match(screen,/auditTrail:\[\.\.\.\(form\.auditTrail\|\|\[\]\),audit\(isNew\?'Item created':'Item updated'\)\]/);
 assert.match(styles,/\.itemDetailFacts\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('item details follows the full-width document header and tabbed information pattern',()=>{
  assert.match(screen,/<div className="itemDetailHead"><button type="button" className="itemBack" aria-label="Back to Items"/);
  assert.match(screen,/<h1>Item Details<\/h1><\/div><div className="itemDetailBody">/);
  assert.match(screen,/className="itemDetailNameRow"><h2>\{selected\.name\}<\/h2><span className=\{'itemStatus '/,'the lifecycle badge sits on the name line, not in the action row');
  assert.match(screen,/className="itemMore itemDetailMore"><summary aria-label="More item actions">/);
  assert.match(screen,/\['Basic Data','Transactions','History'\]\.map/);
  assert.match(screen,/aria-current=\{detailTab===tab\?'page':undefined\}/);
  assert.match(styles,/\.app main:has\(>\.itemsPage\.itemDetailPage\)\{max-width:none!important;padding:0!important\}/);
  assert.match(styles,/\.itemDetailPage \.itemDetailHead\{display:grid;grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(styles,/\.itemDetailTabs\{display:flex;align-items:center/);
});

test('the item identity card and tab row are one header panel and the tabs never scroll',()=>{
 assert.match(screen,/<section className="itemDetailPanel">/);
 assert.match(screen,/<section className="itemDetailPanel">\s*<div className="itemDetailIdentity">/);
 assert.match(screen,/<nav className="itemDetailTabs"[\s\S]*<\/nav>\s*<\/section>/);
 assert.match(styles,/\.itemDetailPage \.itemDetailPanel\{background:#fff;border:1px solid #e6ebf2;border-radius:10px\}/);
 assert.doesNotMatch(styles,/\.itemDetailPage \.itemDetailPanel\{[^}]*overflow:hidden/,'the panel must not clip the More actions menu');
 assert.match(styles,/\.itemDetailPage \.itemDetailIdentity\{display:grid;grid-template-columns:48px minmax\(0,1fr\) auto;align-items:center;gap:16px;padding:14px 16px\}/);
 assert.match(styles,/\.itemDetailTabs\{display:flex;align-items:center;flex:0 0 auto;gap:0;height:46px;padding:0 4px;border-top:1px solid #e6ebf2;background:transparent;overflow:hidden\}/);
 assert.match(styles,/\.itemDetailTabs button\{display:flex;flex:0 0 auto;width:auto;min-width:0;align-items:center;justify-content:center;gap:6px;height:100%;padding:0 12px/);
 assert.match(styles,/\.itemDetailTabs button\{[^}]*white-space:nowrap/);
 assert.match(styles,/\.itemDetailTabs button\.active\{color:#245fd9;border-bottom-color:#3478f6\}/);
 assert.match(styles,/\.itemDetailTabs button span\{[^}]*border-radius:999px/);
 assert.ok(styles.includes('.itemDetailTabs button{flex:1 1 0;padding:0 8px;gap:5px;font-size:12px}'),'narrow-viewport tab sizing');
 assert.ok(styles.lastIndexOf('@media(max-width:520px){.itemDetailTabs{padding:0}')>styles.indexOf('.itemDetailTabs{display:flex'),'the narrow fallback must be declared after the base rule so it is not overridden by it');
 assert.match(styles,/\.itemDetailTabs button\{[^}]*width:auto/,'width:auto is required because src/styles.css declares nav button{width:100%}');
 assert.doesNotMatch(styles,/\.itemDetailTabs\{[^}]*overflow-x:auto/);
});
