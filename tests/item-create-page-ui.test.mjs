/* Create Item - the compact form behind Wayvida Books > Inventory > Items > Create Item.

   The page is held to the Create Journal Entry shell: one full-bleed 56px head bar
   that shares the app header gutter, a single card holding the divided sections, the
   journal control, label and grid geometry, and one fixed rounded action bar above the
   main content scroll port, so wheel, trackpad, touch, keyboard and scrollbar input agree.
   also held to three fixes: the Basic information block stacked two .itemFormGrid
   blocks with no gap at all, the HSN/SAC field stripped the letter D instead of every
   non-digit, and .itemDialogBody lost its own padding for every page sharing it. The
   shared dialog classes stay declared for the create pages and for the other dialog surfaces
   src/ui-system.css groups with them. The Customers form no longer renders a modal overlay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync('src/Items.jsx','utf8');
const styles=readFileSync('src/items.css','utf8');

test('the create head is the compact journal bar with no subtitle',()=>{
 for(const rule of [
  '.itemCreatePage .itemDialogHead{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:14px;min-height:56px',
  'padding:8px 24px',
  'border:1px solid var(--ui-border);border-left:0;border-right:0;border-radius:0;box-shadow:none}',
  '.itemCreatePage .itemDialogHead h2{margin:0;color:var(--ui-text);font-size:16px;font-weight:650',
  '.itemCreatePage .itemBack{display:inline-grid;place-items:center;flex:none;width:40px;height:40px',
 ])assert.ok(styles.includes(rule),rule);
 assert.ok(screen.includes('<div className="itemHeadText"><h2 id="itemDialogTitle">'),'the head holds one text block');
 assert.ok(screen.includes("form.id?'Edit Item':'Create Item'"),'the title switches between Create Item and Edit Item');
 assert.ok(screen.includes('itemHeadHint'),'an edit hint names the item being edited');
 assert.ok(!screen.includes('Add the item details'),'the removed page subtitle stays gone');
});

test('the page keeps the app header gutter instead of the stale negative margin',()=>{
 for(const rule of [
  '.app main:has(>.itemsPage .itemCreatePage),',
  'body:has(.itemCreatePage) .app main{max-width:none!important;padding:0!important}',
 ])assert.ok(styles.includes(rule),'the shell padding is removed: '+rule);
assert.ok(!/:has\([^()]*:has\(/.test(styles.replace(/\/\*[\s\S]*?\*\//g,'')),'no selector nests :has() inside :has(): a nested :has() is invalid CSS and one invalid selector drops its whole rule');
assert.ok(styles.includes('min-height:56px;margin:0;padding:8px 24px'),'the head bar keeps a zero top margin so it sits flush under the working-context bar');
assert.ok(styles.includes('@media(max-width:760px){')&&styles.includes('.itemCreatePage .itemDialogHead{padding:8px 12px}'),'the head gutter narrows at the same 700px breakpoint as the Organisation / Branch bar');
 assert.ok(styles.includes('.itemsPage:has(.itemCreatePage){background:#f6f8fb;min-height:100%}'),'the page paints the full scroll port');
 assert.ok(styles.includes('.itemCreatePage>*:not(.itemDialogHead){margin-left:clamp(16px,2.2vw,24px);margin-right:clamp(16px,2.2vw,24px)}'),'every child but the head keeps the Organisation / Branch gutter');
 assert.ok(styles.includes('@media(max-width:900px)')&&styles.includes('.itemCreatePage>*:not(.itemDialogHead){margin-left:16px;margin-right:16px}'),'the gutter narrows with the header');
 for(const gone of ['margin:-24px','calc(100% + 48px)','100vh - 62px','width:calc(100% - 64px)','.itemCreatePage .itemSection:first-child'])
  assert.ok(!styles.includes(gone),'the stale rule '+gone+' is gone');
});

test('the body is one card and the two Basic information grids are separated',()=>{
 assert.ok(styles.includes('.itemCreatePage .itemDialogBody{width:auto;margin-top:12px;padding:0;overflow:hidden'),'the body is a single card');
 assert.ok(styles.includes('.itemCreatePage .itemDialogFooter{position:fixed;left:calc(250px + clamp(16px,2.2vw,24px))'),'the actions stay accessible in one fixed card');
 assert.ok(styles.includes('.itemCreatePage .itemFormGrid+.itemFormGrid{margin-top:10px}'),'two stacked grids are separated');
 assert.ok(screen.includes('</div><div className="itemFormGrid itemFormGrid3">'),'the name grid and the three-across grid are adjacent siblings');
 assert.ok(screen.includes('<div className="itemFormGrid itemFormGrid3">'),'SKU, HSN/SAC and Unit share one row');
 assert.ok(screen.indexOf('>SKU <')<screen.indexOf("?'HSN':'SAC'} code")&&screen.indexOf("?'HSN':'SAC'} code")<screen.indexOf('>Unit *'),'SKU, HSN/SAC and Unit render in that order');
});

test('fields, labels and the focus ring follow the Create Journal Entry geometry',()=>{
 for(const rule of [
  '.itemCreatePage .itemFormGrid{gap:10px 14px}',
  '.itemCreatePage .itemFormGrid label{gap:7px;color:#344054;font-size:12px;font-weight:600}',
  'min-height:40px;padding:7px 10px;border:1px solid #d7e0eb;border-radius:7px;background:#fff;color:#26354b',
  '.itemCreatePage .itemFormGrid input:focus,.itemCreatePage .itemFormGrid select:focus,.itemCreatePage .itemFormGrid textarea:focus{outline:0;border-color:var(--ui-primary);box-shadow:0 0 0 3px rgba(52,120,246,.12)}',
  '.itemCreatePage .itemDialogFooter button{flex:none;min-width:0;min-height:40px;padding:0 15px',
  '.itemCreatePage .itemSubDetails summary,.itemCreatePage .itemAdvanced summary{padding:12px 16px',
 ])assert.ok(styles.includes(rule),rule);
 assert.ok(styles.includes('.itemCreatePage .itemInputAction input{border-top-right-radius:0'),'the SKU group carries the journal radius');
 assert.ok(!styles.includes('.itemInputAction input{border-radius:6px 0 0 6px!important}'),'the forced group radius is gone');
});

test('the HSN/SAC field keeps digits only and no other page loses its dialog padding',()=>{
 assert.ok(screen.includes("e.target.value.replace(/\\D/g,'')"),'the sanitizer strips every non-digit');
 assert.ok(!screen.includes('value.replace(/D/g,'),'the letter-D sanitizer is gone');
 assert.ok(screen.includes('<input inputMode="numeric" maxLength={8} value={form.hsnSac}'),'the code is capped at eight digits');
 assert.ok(!styles.includes('.itemDialogBody{padding:0}'),'the shared dialog body keeps its own padding');
 for(const shared of ['.itemOverlay{','.itemDialog{width:760px;','.itemDialogBody{overflow-y:auto;padding:20px 24px}','.itemDialogFooter{padding:16px 24px','.itemFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}'])
  assert.ok(styles.includes(shared),'the shared dialog stylesheet still declares '+shared);
});

test('the title sits beside the back arrow and section titles avoid the global header element',()=>{
 const shell=readFileSync('src/styles.css','utf8');
 assert.ok(styles.includes('.itemCreatePage .itemDialogHead{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:14px'),
  'the Create Item title follows the back button instead of being pushed to the far right by the shared .itemDialogHead space-between');
 assert.ok(/\.app header\{border-top:3px solid #1f5fae/.test(shell),
  'the legacy dark blue app-bar rule that painted every in-form heading is still in the shell');
 assert.ok(!styles.includes('.itemSection>header'),'no section heading reset survives');
 assert.ok(!/<section className="itemSection"><header>/.test(screen),'no section renders a <header> element');
 assert.ok(screen.includes('<Section title="Basic information">'),'basic information has a compact section label');
 assert.ok(screen.includes('<div className="itemAdvancedTitle">Tax settings</div>'),'tax settings is labelled inside Advanced settings');
 assert.ok(screen.includes('className="itemSectionTitle"'),'section titles use a div, not the global header element');
 assert.ok(screen.includes('<section className="itemSection">'),'the section container stays');
 assert.ok(/header\{position:fixed[^}]*top:0[^}]*left:206px/.test(shell),
  'the legacy application-bar element rule that leaked into the form is still the reason the reset is required');
});

test('the page uses one document scroll surface and keeps fixed actions visible',()=>{
 for(const rule of [
  '.itemCreatePage .itemDialogFooter{position:fixed;left:calc(250px + clamp(16px,2.2vw,24px));right:clamp(16px,2.2vw,24px);bottom:10px;z-index:18',
  '.itemCreatePage{display:block;padding-bottom:88px;color:var(--ui-text)}',
 ])assert.ok(styles.includes(rule),rule);
 for(const rule of [
  'html:has(.itemCreatePage),body:has(.itemCreatePage),body:has(.itemCreatePage) #root{height:auto;min-height:100%;overflow-y:auto}',
  'body:has(.itemCreatePage) .app{height:auto;min-height:100vh;overflow:visible}',
  'body:has(.itemCreatePage) .app>main{height:auto;max-height:none;overflow:visible;scrollbar-gutter:auto}',
 ])assert.ok(styles.includes(rule),rule);
 assert.ok(styles.includes('backdrop-filter:blur(8px)'),'the fixed bar remains distinct above scrolling content');
 assert.ok(styles.includes('.itemCreatePage .itemDialogFooter{left:12px;right:12px}'),'tablet and narrow layouts remove the sidebar offset');
 assert.ok(styles.includes('.itemsPage:has(.itemCreatePage){background:#f6f8fb;min-height:100%}'),'the page fills the main scroll port');
 assert.ok(!styles.includes('.itemSection>header h3'),'the dead section heading rule is gone');
 assert.ok(screen.includes('function Section({title,children})'),'the shared Section supports compact labels without header elements');
 for(const gone of ['What this item is.','Defaults used when you buy this item.','Defaults used when you sell this item.','Track stock and its accounting value.','Set the default tax treatment.'])
  assert.ok(!screen.includes(gone),'the removed description line stays gone: '+gone);
});

test('the item form exposes the requested dynamic controls without changing stored fields',()=>{
 assert.ok(screen.includes('type="radio" name="item-type"'),'item type uses radio buttons');
 assert.ok(screen.includes("['Goods','Service']"),'Goods and Service are the two item types');
 assert.ok(screen.includes("form.type==='Goods'?'HSN':'SAC'"),'one hsnSac field receives a dynamic label');
 assert.ok(!screen.includes('placeholder="Enter item description"'),'Description is not rendered on Create Item');
 assert.equal((screen.match(/<summary>Opening stock/g)||[]).length,0,'the opening stock disclosure is gone with the fields it collected');
 assert.equal((screen.match(/openingStockDetails/g)||[]).length,0,'and nothing renders from the removed opening stock block');
 const advanced=screen.indexOf('<div className="itemAdvanced">');
 assert.ok(advanced>-1&&screen.indexOf('Tax settings',advanced)>advanced,'the advanced block stays, always visible, and still carries the tax settings');
 assert.ok(screen.includes("['Taxable','Non-taxable']"),'tax treatment uses the requested choices');
 assert.ok(styles.includes('.itemCreatePage .itemRadioGroup label:has(input:checked)'),'the selected item type has a clear Wayvida card state');
 assert.ok(styles.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'the radio choices stay balanced without horizontal overflow');
});

test('the advanced block stays visible and owns tax and the minimal image attachment surface',()=>{
 for(const value of ['IconPhotoPlus','itemImageUpload','Choose image','Replace image','Browse','JPG, PNG or WebP · Maximum 2 MB','Image ready','Tax settings'])assert.ok(screen.includes(value),value);
 assert.ok(screen.includes('accept="image/png,image/jpeg,image/webp" onChange={upload}'),'the existing upload handler and formats remain connected');
 for(const rule of ['.itemCreatePage .itemImageUpload{position:relative;display:grid','min-height:58px','border:1px solid #d7e0eb','.itemCreatePage .itemImageUpload:focus-within{','.itemCreatePage .itemImageChoose{display:inline-flex'])assert.ok(styles.includes(rule),rule);
 const advanced=screen.indexOf('<div className="itemAdvanced">');
 assert.ok(!screen.includes('<details className="itemAdvanced">'),'the Advanced settings accordion is gone, so nothing needs opening to reach tax or the image');
 assert.ok(!screen.includes("accountField('Inventory Asset Account'"),'the Track inventory grid left with the control that owned it');
 assert.ok(!screen.includes('Inventory accounting'),'the removed duplicate Advanced inventory group stays gone');
 assert.equal((screen.match(/itemOpeningStockGroup/g)||[]).length,0,'and the opening stock group went with the field');
 assert.ok(screen.indexOf('>Tax settings</div>',advanced)<screen.indexOf('>Item image</div>',advanced),'Tax settings precedes the minimal Item image field');
});

test('the create page body never traps the wheel',()=>{
 assert.ok(styles.includes('.itemCreatePage .itemDialogBody{width:auto;margin-top:12px;padding:0;overflow:hidden;overscroll-behavior:auto;'),'the page body must chain the wheel to the document scroller');
 assert.doesNotMatch(styles,/\.itemCreatePage \.itemDialogBody\{[^}]*overscroll-behavior:contain/,'the page body must never contain the wheel');
 assert.ok(styles.includes('src/ui-system.css gives .itemDialogBody overscroll-behavior:contain'),'the reason is recorded beside the rule');
});
