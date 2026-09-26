import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component=readFileSync(new URL('../src/WorkingContextSwitcher.jsx',import.meta.url),'utf8');
const switcher=readFileSync(new URL('../src/org-switcher.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/working-context.css',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
const organisations=readFileSync(new URL('../src/demo-organisations.js',import.meta.url),'utf8');

test('the sidebar owns one organisation and branch switcher at its foot',()=>{
  assert.ok(navigation.includes("import WorkingContextSwitcher from './WorkingContextSwitcher.jsx';"),'the navigation imports the switcher');
  assert.ok(navigation.includes('<WorkingContextSwitcher theme="light"/></div></nav>'),'the switcher is the last utility and always uses its light surface');
  for(const token of [
    'className="wcIdentity workingContext"',
    'className="wcTrigger"',
    'aria-haspopup="true"',
    'aria-expanded={menu}',
    'aria-controls="wc-switcher"',
    'id="wc-switcher"',
    'className="wcMenuHead">Organisation',
    'className="wcMenuHead">Branch',
    'role="checkbox"',
    'aria-checked={active}',
    'className="wcMenuBox"',
    "companyIds.length>1?<IconBuildingCommunity/>",
    'onClick={()=>toggleCompany(item.id)}',
    'onClick={()=>toggle(draftBranches,setDraftBranches,item.id)}',
    'className="wcMenuFooter"',
    '>Apply</button>'
  ]) assert.ok(component.includes(token),token);
  assert.ok(!component.includes('Change / Customize'),'multi-selection lives directly in the dropdown');
  assert.ok(!component.includes('className="wcMenuIdentity"'),'the dropdown does not repeat the selected organisation and branch summary');
  assert.ok(component.includes('data-summary={tooltipSummary}')&&component.includes('Organisations: ${selectedOrganizationNames.join'), 'the trigger tooltip lists every selected organisation and branch');
  assert.ok(!component.includes('className="wcChange"'),'the old bar button is gone, not duplicated');
});

test('the multi-select panel is portalled, because the sidebar clips its overflow',()=>{
  assert.equal(component.split('createPortal(').length-1,1,'the dropdown panel is portalled to document.body');
  assert.ok(component.includes('triggerRef.current?.contains(node)||menuRef.current?.contains(node)'),'the outside pointerdown ignores the trigger and the panel');
  assert.ok(component.includes('getBoundingClientRect'),'the panel is placed from the trigger box, not from a parent element');
  assert.ok(css.includes('.wcMenu{position:fixed'),'a fixed panel is not clipped by aside{overflow:hidden}');
  assert.ok(css.includes('z-index:300'),'the panel sits above every shell layer');
  assert.ok(css.includes('box-shadow:0 24px 56px #10182833,0 2px 6px #10182814'),'the panel carries a two-layer shadow so it stands off a white sidebar in light mode');
  assert.ok(component.includes("Math.max(240,Math.round(above))")&&component.includes("Math.max(240,Math.round(below))"),'the panel keeps a usable height on whichever side it opens');
  assert.ok(component.includes('data-side={menuBox.side}'),'the panel records which side it opened on');
  assert.ok(css.includes('.app>aside{height:100dvh;overflow:hidden}')===false,'the sidebar keeps its own clipping, which the portal exists for');
});

test('the switcher writes its multi-selection through one function',()=>{
  for(const token of ['wayvida-context-companies','wayvida-context-branches','wayvida-context-mode','wayvida-demo-company','wayvida-demo-branch','wayvida-organization-change','wayvida-working-context-change']) assert.ok(switcher.includes(token),token);
  assert.ok(switcher.includes("multi: 'Multi Selection'"),'the persisted mode identifies the multi-selection context');
  assert.ok(component.includes('commitContext')&&component.includes('applyWorkingContext(accessibleOrganizations,companies,branches,mode)'),'the dropdown goes through the shared writer');
  assert.ok(component.includes('SWITCH_MODES.multi'),'the dropdown always persists the multi-selection mode');
  assert.ok(switcher.includes("ORG_TONES = ['blue', 'violet', 'cyan', 'amber']"),'row marks stay on the brand and type hues, never the status hues the Chart of Accounts already uses');
  assert.ok(organisations.includes('export const demoOrganizations=['),'the organisation list lives in its own module, so the switcher, the scope readers and the tests read one array');
});

test('the trigger follows the sidebar theme and the portalled panel carries it too',()=>{
  for(const token of ['.workingContext{','.wcTrigger{','.wcIdentity[data-theme=dark] .wcTrigger{','.wcMenu{position:fixed','.wcMenu[data-theme=dark]{','.wcMenuRow{','.wcMenuRow.active{','.wcMenuMark[data-tone=violet]','.wcMenuCheck{','.wcMenuDivider{','.wcMenuAction{','.wcDrawer{','.wcBox{']) assert.ok(css.includes(token),token);
  for(const removed of ['.orgContextBar','top:calc(100% + 8px)']) assert.ok(!css.includes(removed),'the old bar geometry is gone: '+removed);
  const sizes=[...css.matchAll(/\.wc(?:Trigger|Menu)[^{]*\{[^}]*font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=4&&Math.min(...sizes)>=12,'switcher text stays at least 12px');
  assert.ok(css.includes('@media(max-width:700px){.wcTrigger{gap:8px;min-height:40px}'),'the narrow drawer keeps the branch subtitle and only tightens the trigger');
  assert.ok(css.includes('.workingContext{flex:none;display:flex;flex-direction:column;margin:0 0 12px;padding:7px;border:1px solid #dbe6f5;border-radius:14px'),'the card is a 14px rounded surface with a top highlight and a 12px gap beneath it');
  assert.ok(css.includes('.wcTrigger>svg{width:20px;height:20px;flex:none;padding:4px;border-radius:999px;background:#e3ecfa;color:#245fd9'),'the chevron is a slightly larger always-visible dropdown chip');
  assert.ok(css.includes('.wcTrigger:hover::after,.wcTrigger:focus-visible::after{opacity:1'),'the whole trigger reveals the combined selection tooltip');
  assert.ok(css.includes('.erpNavigation[data-theme=dark] .workingContext[data-theme=light] .wcTrigger:hover'),'the light switcher keeps a readable hover treatment inside dark navigation');
  assert.ok(css.includes('.wcMark.multi,.wcMenuMark.multi{background:#245fd9;color:#fff'),'a multi-organisation context uses one white company icon on a solid brand tile');
  assert.ok(css.includes('.workingContext[data-theme=dark] .wcTrigger>svg{background:#2b3d5c;color:#cfe0ff}'),'the chip has its own dark fill');
  assert.ok(!css.includes('.wcIdentity[data-theme=dark] .wcTrigger>svg'),'the legacy dark chevron colour rule is gone');
  assert.ok(css.includes('.wcMenuGroup.branches{margin-left:6px;padding-left:4px;border-left:2px solid #eef1f6}'),'the branch list reads as a tree under its heading');
  assert.ok(css.includes('.wcMenuGroup .wcMenuRow:not(:last-child){box-shadow:inset 0 -1px 0 #f1f4f9}'),'panel rows are separated by an inset hairline');
  assert.ok(navigation.includes('<WorkingContextSwitcher theme="light"/>'),'dark navigation never darkens the organisation switcher');
});

test('organisation-prefixed branch display codes keep stable storage ids',()=>{
  for(const code of ['WY-KOC01','WY-TVM01','WY-BLR01','VS-TVM01','VS-TSR01']) assert.ok(organisations.includes(`code:'${code}'`),code);
  for(const id of ['abc-kochi','abc-trivandrum','abc-bengaluru','northstar-chennai','northstar-coimbatore']) assert.ok(organisations.includes(`id:'${id}'`),id);
});