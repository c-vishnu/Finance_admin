import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* core.autocrlf is on for this repository, so the working tree holds CRLF while
   the committed blobs hold LF. Normalise before matching multi-line source. */
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');

const component=source('src/EmptyState.jsx');
const css=source('src/empty-state.css');
const budgets=source('src/BudgetWorkspace.jsx');
const closing=source('src/PeriodClosing.jsx');
const journals=source('src/JournalEntriesPro.jsx');
const adjustments=source('src/InventoryAdjustments.jsx');

test('one reusable EmptyState component backs every table empty state',()=>{
  assert.ok(component.includes('export default function EmptyState({variant="default",title,description,action,actionLabel,onAction,className=""})'),'the shared component takes an illustration variant, a title, a description and an optional action');
  assert.ok(component.includes('export function EmptyIllustration({variant="default"})'),'the illustration is reusable on its own');
  for(const hook of ['className="emptyArt"','className="emptyArtPlate"','className="emptyArtGlyph"','className="emptyTitle"','className="emptyText"','className="emptyAction"','className="emptyCta"']){
    assert.ok(component.includes(hook),hook+' is part of the shared empty state');
  }
  assert.ok(component.includes('viewBox="0 0 96 96"'),'every variant shares one illustration frame');
  assert.ok(component.includes('aria-hidden="true"'),'the illustration is decorative for assistive technology');
  for(const variant of ['budget','lock','request','journal','adjustment','default']){
    assert.ok(component.includes(variant+': <>'),variant+' has its own illustration variant');
  }
  assert.ok(component.includes('{ART[variant]||ART.default}'),'an unknown variant falls back to the default art');
  assert.ok(component.includes('action||(actionLabel&&onAction?'),'the call to action only renders when it is actually wired');
  assert.deepEqual(component.split('\n').filter(line=>line.startsWith('import ')),['import React from "react";','import "./empty-state.css";'],'the component depends on nothing but React and its own stylesheet');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(component),'no emoji appear in the empty states');
});

test('the empty state is centred inside the table content area',()=>{
  assert.ok(css.includes('.emptyState{display:flex;flex-direction:column;align-items:center;justify-content:center'),'the group is centred horizontally and vertically');
  assert.ok(/\.emptyState\{[^}]*min-height:250px/.test(css),'the block has a bounded height so it never forces a scroll');
  assert.ok(/\.emptyState\{[^}]*padding:32px 20px/.test(css),'the block breathes evenly');
  assert.ok(css.includes('.emptyState .emptyArt{display:block;width:96px;height:96px;flex:none;'),'the illustration sits at 96px, inside the 80-120px band');
  assert.ok(css.includes('td.emptyStateCell.emptyStateCell.emptyStateCell{padding:0!important'),'the spanning cell drops the table padding');
  assert.ok(css.includes('.emptyStateRow,.emptyStateRow:hover{background:transparent!important}'),'the placeholder row never picks up the row hover fill');
  assert.ok(css.includes('.emptyStateHost{grid-column:1/-1;width:100%}'),'the card-list form spans the whole list');
  assert.ok(css.includes('.emptyState .emptyTitle{margin:2px 0 0;color:#172033;font-size:15px;font-weight:650'),'the title uses the design system type scale');
  assert.ok(css.includes('.emptyState .emptyText{margin:0;max-width:430px;color:#667085;font-size:13px'),'the description stays secondary and readable');
  assert.ok(css.includes('@media(max-width:640px){.emptyState{min-height:205px;padding:26px 16px}.emptyState .emptyArt{width:82px;height:82px}}'),'the block scales down on small screens');
  const sizes=[...css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=2&&sizes.every(size=>size>=12),'no empty state text falls below the 12px floor');
});

test('the five documented empty states carry their exact copy',()=>{
  assert.ok(budgets.includes('<EmptyState variant="budget" title="No budgets found" description="No budgets match these filters. Create a budget to start planning." actionLabel="Create Budget" onAction={create}/>'),'Budgets: No budgets found, with Create Budget');
  assert.ok(closing.includes('<EmptyState variant="lock" title="No locks created yet" description="Create a lock to close a period across your modules." actionLabel={onCreate?\'Create Lock\':null} onAction={onCreate}/>'),'Period Locks: No locks created yet, with Create Lock');
  assert.ok(closing.includes('<EmptyState variant="request" title="No unlock requests yet" description="Unlock requests will appear here when submitted."/>'),'Unlock Requests: No unlock requests yet');
  assert.ok(!/variant="request"[^>]*actionLabel/.test(closing),'Unlock Requests offer no action, because submitting is not what creates them');
  assert.ok(journals.includes('<EmptyState variant="journal" title="No journals found" description="Adjust the filters or create a manual journal." actionLabel="Create Journal" onAction={onCreate}/>'),'Journals: No journals found, with Create Journal');
  assert.ok(adjustments.includes('<EmptyState variant="adjustment" title="No adjustments found" description="Create an inventory adjustment to correct a quantity or value." actionLabel="Create Adjustment" onAction={onNew}/>'),'Inventory Adjustments: No adjustments found, with Create Adjustment');
});

test('every table empty state spans the table body instead of sitting outside it',()=>{
  assert.ok(budgets.includes('{!list.length&&<tr className="emptyStateRow"><td colSpan="4" className="emptyStateCell">'),'the budget register renders the empty state as a row inside tbody');
  assert.ok(closing.includes('<tr className="emptyStateRow"><td className="emptyStateCell" colSpan="7"><EmptyState variant="lock"'),'the lock register renders the empty state as a row inside tbody');
  assert.ok(closing.includes('<div className="emptyStateHost"><EmptyState variant="lock"'),'the lock card list renders the empty state inside the list');
  assert.ok(closing.includes('<tr className="emptyStateRow"><td className="emptyStateCell" colSpan="7"><EmptyState variant="request"'),'the unlock request register renders the empty state as a row inside tbody');
  assert.ok(journals.includes('{!filtered.length&&<tr className="emptyStateRow"><td colSpan={9} className="emptyStateCell">'),'the journal register renders the empty state as a row inside tbody');
  assert.ok(adjustments.includes('<tr className="emptyStateRow"><td colSpan={REGISTER_COLUMNS.length} className="emptyStateCell">'),'the adjustment register spans every register column');
  for(const [file,name] of [[budgets,'Budgets'],[closing,'Period Closing'],[journals,'Journal Entries'],[adjustments,'Inventory Adjustments']]){
    assert.ok(file.includes("from './EmptyState.jsx'"),name+' imports the shared component instead of rolling its own');
  }
  assert.ok(adjustments.includes('function Empty({title,text,variant="default"}){return <EmptyState variant={variant} title={title} description={text}/>}'),'the local helper delegates to the shared component');
  assert.ok(!budgets.includes('budgetEmpty">No budgets match these filters'),'the budget register no longer prints a bare sentence row');
  assert.ok(!closing.includes('{emptyText}'),'the plain-text lock message is gone');
  assert.ok(!closing.includes("pc-detail-empty\">{business?'No reopen requests yet.'"),'the request list no longer prints a bare sentence');
  assert.ok(!journals.includes('je-empty"><IconBook/>'),'no legacy inline journal empty block survives');
});

test('the empty state is only the fallback for a table with no rows',()=>{
  assert.ok(budgets.includes('{list.map(budget=>')&&budgets.includes('{!list.length&&<tr className="emptyStateRow">'),'budget rows still render and the empty state is the fallback');
  assert.ok(journals.includes('{filtered.map(j=>')&&journals.includes('{!filtered.length&&<tr className="emptyStateRow">'),'journal rows still render and the empty state is the fallback');
  assert.ok(closing.includes('{rows.length?rows.map(period=>')&&closing.includes('}):<tr className="emptyStateRow"><td className="emptyStateCell" colSpan="7"><EmptyState variant="lock"'),'the lock table keeps its rows branch beside the empty branch');
  assert.ok(closing.includes('{requests.length?requests.map(request=>')&&closing.includes('}):<tr className="emptyStateRow"><td className="emptyStateCell" colSpan="7"><EmptyState variant="request"'),'the request table keeps its rows branch beside the empty branch');
  assert.ok(closing.includes("actionLabel={onCreate?'Create Lock':null}"),'a viewer who cannot create a lock is offered no dead call to action');
});

test('the illustration animates itself in and then rests',()=>{
  for(const frame of ['emptyArtIn','emptyPlateIn','emptyBarIn','emptyDrawIn','emptyBreathe','emptyPulse']){
    assert.ok(css.includes('@keyframes '+frame+'\{'),frame+' is defined');
  }
  assert.ok(css.includes('.emptyState .emptyArt{display:block;width:96px;height:96px;flex:none;animation:emptyArtIn'),'the illustration fades and lifts in');
  assert.ok(css.includes('.emptyState .emptyArtPlate{fill:#f4f7fb;transform-box:fill-box;transform-origin:50% 50%;animation:emptyPlateIn'),'the plate settles from slightly smaller');
  assert.ok(css.includes('animation:emptyBreathe 7s ease-in-out 1.6s infinite'),'the glyph then breathes slowly instead of looping quickly');
  for(const rule of ['.emptyState .emptyArtGlyph .emptyBar{','.emptyState .emptyArtGlyph .emptyDraw{','.emptyState .emptyArtGlyph .emptyDot{']){
    assert.ok(css.includes(rule),rule+' animates one kind of shape');
  }
  assert.ok(css.includes('.emptyState .emptyArtGlyph .emptyDraw{stroke-dasharray:120;stroke-dashoffset:0;animation:emptyDrawIn'),'a drawn shape rests complete and starts from the hidden offset');
  assert.ok(css.includes('.emptyState .emptyArtGlyph .emptyDraw.emptyDrawLate{animation-delay:.5s}'),'a shape can wait for the one before it');
  for(const hook of ['emptyBar','emptyDraw','emptyDrawLate','emptyDot']){
    assert.ok(component.includes(hook),hook+' is applied by the component');
  }
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce){.emptyState .emptyArt,.emptyState .emptyArt *{animation:none!important}}'),'reduced motion switches every animation off');
  const seconds=[...css.matchAll(/(?<![\d.])(\d+(?:\.\d+)?|\.\d+)s(?![a-z])/g)].map(m=>Number(m[1]));
  assert.ok(seconds.length>=6&&Math.max(...seconds)<=8,'every animation stays under eight seconds, so nothing loops distractingly');
  const declared=[...css.matchAll(/@keyframes (empty\w+)/g)].map(m=>m[1]);
  const used=[...css.matchAll(/animation:(empty\w+)/g)].map(m=>m[1]);
  assert.deepEqual([...used].sort(),[...declared].sort(),'every animation that is used has a keyframe and no keyframe is orphaned');
  const open=(css.match(/\{/g)||[]).length,close=(css.match(/\}/g)||[]).length;
  assert.equal(open,close,'the stylesheet braces balance');
  assert.ok(!/\banimation:[^;}]*(ease-in-out|linear)[^;}]*;[^}]*\bnull\b/.test(css),'no declaration reads as a stub');
  const opacities=[...css.matchAll(/@keyframes emptyPulse\{0%,100%\{opacity:1\}50%\{opacity:(\.\d+)\}/g)].map(m=>Number(m[1]));
  assert.ok(opacities.length===1&&opacities[0]>=.4,'the keyhole pulse stays gentle');
});
