import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const picker=readFileSync(new URL('../src/AccountGroupPicker.jsx',import.meta.url),'utf8');
const search=readFileSync(new URL('../src/account-group-search.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/account-group-picker.css',import.meta.url),'utf8');
const form=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');
const journalPicker=readFileSync(new URL('../src/JournalAccountPicker.jsx',import.meta.url),'utf8');
const journal=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');

test('create and edit account swap the native group select for the searchable picker',()=>{
 assert.ok(form.includes("import AccountGroupPicker from './AccountGroupPicker.jsx';"),'the form imports the picker');
 assert.ok(form.includes('<Field label="Account Group *">'),'the field label is unchanged');
 assert.ok(form.includes('<AccountGroupPicker groups={groupOptions} value={`${type}::${purpose}`} disabled={locked}'),'the picker replaces the select with the same value and lock state');
 assert.ok(!form.includes('<optgroup'),'the optgroup markup is gone');
 assert.ok(!form.includes('<select required disabled={locked}'),'nothing renders the old Account Group select');
 assert.ok(!form.includes("event.target.value.split('::')"),'the select change handler is gone');
 assert.ok(form.includes("const [nextType,nextPurpose]=next.split('::')")&&form.includes('applyGroup(nextType,nextPurpose)'),'the picker still selects the group through the same applyGroup path');
 assert.ok(form.includes('groupOptions.push')&&form.includes('groupOptions.find'),'the fallback group for an unknown type or purpose is preserved');
 assert.ok(form.includes("<h2>{form.id?'Edit Account':'Create Account'}</h2>"),'one drawer still serves Create Account and Edit Account');
});

test('the picker is the same control the journal lines account cell uses',()=>{
 assert.ok(journal.includes("import JournalAccountPicker from './JournalAccountPicker.jsx';"),'the journal lines still render their own picker');
 assert.ok(journal.includes('<JournalAccountPicker value={line.account} accounts={accounts}'),'the journal account cell is the reference control');
 assert.ok(picker.includes("from './account-group-search.js'")&&journalPicker.includes("from './journal-templates.js'"),'both keep their matching rules in a plain module');
 for(const text of ['role="combobox"','role="listbox"','role="option"','aria-autocomplete="list"','aria-activedescendant','aria-selected={chosen}','onMouseEnter={()=>setActive(index)}']) assert.ok(picker.includes(text),'the account picker mirrors '+text);
 for(const text of [`document.addEventListener('pointerdown',away)`,`{block:'nearest'}`,'requestAnimationFrame','ArrowDown','Escape']) assert.ok(picker.includes(text)&&journalPicker.includes(text),'both pickers keep '+text);
});

test('the picker is safe inside the account drawer label wrapper',()=>{
 assert.ok(form.includes('return <label className={`am-field ${className||\'\'}`}>'),'the drawer still wraps every field, including Account Group, in a label');
 const field=form.slice(form.indexOf('<Field label="Account Group *">'));
 assert.ok(field.slice(0,field.indexOf('</Field>')).includes('<AccountGroupPicker'),'the picker renders inside that label');
 assert.ok(picker.includes('onClick={event=>event.preventDefault()}'),'the picker root cancels the default action of clicks inside it, so the host label cannot re-fire the trigger button from a non-interactive option row');
 assert.ok(picker.includes('<div className="agp-search">'),'the search wrapper is a div, because a label may not contain another label');
 assert.ok(!picker.includes('<label className="agp-search">'),'no nested label is rendered inside the picker');
 assert.ok(picker.includes('aria-label="Search account group"'),'the search input keeps its accessible name without a label element');
 assert.ok(picker.indexOf('onClick={event=>event.preventDefault()}')<picker.indexOf("<button type=\"button\" className=\"agp-field\""),'the guard sits on the root rather than on the trigger, so the visible field label still opens the picker');
});
test('the picker searches by group name, type and purpose',()=>{
 assert.ok(picker.includes('accountGroupRows(groups,query)'),'the component reads its rows from the shared filter');
 assert.ok(picker.includes('selectedAccountGroup(groups,value)'),'the trigger label comes from the resolved selection');
 assert.ok(search.includes("fold([option?.label,option?.type,option?.purpose,option?.group].join(' ')).includes(needle)"),'the query matches the label, the type, the purpose and the group');
 assert.ok(picker.includes('placeholder="Search account group"')&&picker.includes('aria-label="Search account group"'),'the search box is announced and self describing');
 assert.ok(picker.includes('className="agp-section"'),'results are grouped by account type');
 assert.ok(picker.includes('No account group matches'),'a miss says so instead of showing an unlabelled empty box');
 assert.ok(picker.includes('No account group is available.'),'an unconfigured group list has its own empty state');
});

test('the picker stays keyboard and pointer accessible',()=>{
 assert.ok(picker.includes("if(event.key==='Escape'){event.preventDefault();closeList();return}"),'escape closes the list');
 assert.ok(picker.includes("event.key==='Enter'&&rows[active]?.option"),'enter selects the highlighted group');
 assert.ok(picker.includes("if(!open&&(event.key==='ArrowDown'||event.key==='Enter')){event.preventDefault();openList()}"),'the closed combobox opens from the keyboard');
 assert.ok(picker.includes('inputRef.current?.focus()'),'opening moves focus into the search box');
 assert.ok(picker.includes('onPointerDown={event=>{event.preventDefault();select(option)}}'),'pointer selection survives the focus change');
 assert.ok(picker.includes('disabled={disabled}'),'a locked account disables the trigger');
 assert.ok(picker.includes("rootRef.current.contains(event.target)"),'a click outside closes the list');
});

test('the picker stylesheet mirrors the journal picker and keeps readable text',()=>{
 for(const text of ['.agp{position:relative','.agp-field{display:flex','.agp-field:disabled','.agp-pop{position:absolute','.agp-search input{','.agp-list{max-height','.agp-option.selected']) assert.ok(css.includes(text),text);
  assert.match(css,/\.agp-pop\{[^}]*left:0!important[^}]*right:0!important[^}]*width:auto!important/,'the results panel is sized to its trigger instead of to a fixed width');
  assert.ok(!/\.agp-pop\{[^}]*width:min\(/.test(css),'no fixed-width results panel is left, because it overhung the Create Account drawer');
 const rules=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.ok(!rules.includes('.am-create-drawer'),'the picker styling is self contained: no selector reaches into the account drawer');
 assert.ok(css.includes('!important'),'the drawer field input rule is overridden explicitly, the way journal-form.css does');
 const sizes=[...css.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length>=5,'the stylesheet sets its text sizes explicitly');
 assert.ok(Math.min(...sizes)>=12,'every visible label, meta line and result is at least 12px');
});
