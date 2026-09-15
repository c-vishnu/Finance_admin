import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {NO_BRANCH,scopePickerState} from "../src/organisation-scope.js";

const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const component = read("OrganisationBranchScope.jsx");
const closing = read("PeriodClosing.jsx");
const journal = read("JournalEntriesPro.jsx");
const context = read("organisation-context.js");

const organisations = [
  {id: 'one', code: 'ONE1', name: 'One Branch Co', branches: [{id: 'one-main', name: 'Main Branch'}]},
  {id: 'many', code: 'MANY2', name: 'Many Branch Co', branches: [{id: 'many-s', name: 'South Branch'}, {id: 'many-n', name: 'North Branch'}]},
  {id: 'nil', code: 'NIL3', name: 'No Branch Co', branches: []},
  {id: 'other', code: 'OTH4', name: 'Other Co', branches: [{id: 'other-w', name: 'West Branch'}, {id: 'other-e', name: 'East Branch'}]}
];

test("the picker is the journal line control: one implementation over the shared rule", () => {
  assert.ok(component.includes("from './organisation-scope.js'"), "the picker reads the shared scope module");
  assert.ok(component.includes("scopePickerState("), "every decision comes from the shared picker state");
  assert.ok(component.includes("import {ALL_BRANCHES,normaliseScope,scopePickerState} from './organisation-scope.js';"), 'no second scope rule is introduced');
  assert.ok(!component.includes('flatMap'), 'the picker keeps no private branch filtering');
  assert.ok(!/demoOrganizations\.filter/.test(component), 'the picker never filters the organisation list itself');
});

test("one organisation with one branch shows no selectors and states the scope", () => {
  const state = scopePickerState({organisations: [organisations[0]], companyIds: ['ONE1']});
  assert.equal(state.showOrganisation, false);
  assert.equal(state.showBranch, false);
  assert.equal(state.line, 'Locking for: One Branch Co \u00b7 Main Branch');
  assert.deepEqual(state.branchOptions.map(branch => branch.name), ['Main Branch']);
});

test("one organisation with several branches offers the branch list only", () => {
  const state = scopePickerState({organisations: [organisations[1]], companyIds: ['MANY2']});
  assert.equal(state.showOrganisation, false, "the single organisation stays implicit");
  assert.equal(state.showBranch, true);
  assert.deepEqual(state.branchOptions.map(branch => branch.name), ['South Branch', 'North Branch'], 'only the owning organisation branches are offered');
  assert.equal(state.line, 'Locking for: Many Branch Co \u00b7 All branches', 'a whole-organisation lock keeps reading All branches');
  assert.equal(state.allBranches, true);
});

test("several organisations offer both selectors and filter the branch list", () => {
  const state = scopePickerState({organisations, companyIds: ["MANY2"]});
  assert.equal(state.showOrganisation, true);
  assert.equal(state.showBranch, true);
  assert.deepEqual(state.organisationOptions.map(option => option.name), ['One Branch Co', 'Many Branch Co', 'No Branch Co', 'Other Co']);
  assert.deepEqual(state.branchOptions.map(branch => branch.name), ['South Branch', 'North Branch']);
  assert.deepEqual(scopePickerState({organisations, companyIds: ['OTH4']}).branchOptions.map(branch => branch.name), ['West Branch', 'East Branch'], 'no branch of another organisation is ever offered');
});

test("changing organisation clears a branch that belongs to the previous one", () => {
  const kept = scopePickerState({organisations, companyIds: ['MANY2'], branchIds: ['many-n']});
  assert.equal(kept.branchId, 'many-n', 'a branch that still belongs is kept');
  assert.equal(kept.line, 'Locking for: Many Branch Co \u00b7 North Branch');
  const cleared = scopePickerState({organisations, companyIds: ['OTH4'], branchIds: ['many-n']});
  assert.equal(cleared.branchId, '', 'an incompatible branch is never carried across');
  assert.equal(cleared.allBranches, true);
  assert.deepEqual(cleared.branchOptions.map(branch => branch.name), ['West Branch', 'East Branch']);
});

test("a branchless organisation is its own scope and prints the em dash", () => {
  const state = scopePickerState({organisations: [organisations[2]], companyIds: ['NIL3']});
  assert.equal(state.line, 'Locking for: No Branch Co \u00b7 ' + NO_BRANCH);
  assert.deepEqual(state.branchOptions, []);
  assert.equal(state.branchId, '');
});

test("an empty scope is handled without throwing", () => {
  const state = scopePickerState({});
  assert.equal(state.line, 'Locking for: no organisation selected');
  assert.deepEqual(state.organisationOptions, []);
  assert.deepEqual(state.branchOptions, []);
});

test("the multi-select form of the same control renders from the shared rows", () => {
  assert.ok(component.includes("import {scopePickerRows,toggleScopePicker} from './organisation-scope.js';"), "the rows and the toggling come from the shared module");
  assert.ok(component.includes("import './organisation-branch-scope.css';"), "the multi-select form carries its own stylesheet");
  assert.ok(component.includes("if(fields&&multiple&&!readOnly){"), "the multi-select form renders from the same visibility decision the selects use");
  assert.ok(component.includes("const rows=scopePickerRows(state);"), "the checkbox rows are built by the shared module");
  assert.ok(component.includes("const next=toggleScopePicker(state,row);"), "toggling a row goes back through the shared module");
  assert.ok(component.includes("const emitScope=(nextCompanyIds,nextBranchIds)=>{const resolved=normaliseScope("), "the result is normalised through the shared scope rule before it is reported");
  assert.ok(component.includes("document.addEventListener('pointerdown',away)")&&component.includes("event.key==='Escape'"), "the open list closes on an outside press or Escape without page wiring");
  assert.ok(component.includes('className="pc-multi-trigger"')&&component.includes("className={'pc-multi-option'+(row.checked?' checked':'')}"), 'each control is a trigger over a checkbox list');
  assert.ok(component.includes('aria-expanded={open}')&&component.includes('aria-multiselectable="true"'), 'the control announces its open state and that it takes several values');
  assert.ok(component.includes('return <div className="pc-scope-picker">'), 'the one-choice selects still render from the same file');
  assert.ok(component.includes('<label className="pc-field">Organisation<select aria-label="Organisation"'), 'the single-select organisation field is untouched');
  assert.ok(!component.includes("OrganisationBranchScopeMulti"), "no second picker component is introduced");
});

test("Period Closing renders the shared picker in the lock and unlock drawers", () => {
  assert.ok(closing.includes("import OrganisationBranchScope from './OrganisationBranchScope.jsx';"), 'the page uses the shared picker');
  assert.ok(closing.includes('<OrganisationBranchScope organisations={scopeOrganisations} companyIds={form.companyIds} branchIds={form.branchIds}'), 'the Create Lock drawer offers organisation and branch selection');
  assert.ok(closing.includes('companyIds={[period.companyId]} branchIds={period.branchIds||[]} label={scopeLabel} strip={scopeLine} showFields={false}'), 'the request unlock drawer states the locked scope with the same control');
  assert.ok(closing.includes('const scopeOrganisations=useMemo(()=>getAccessibleOrganizations(),[])'), 'the page resolves the available scope once, through the shared working context');
  assert.ok(!closing.includes('pc-lock-scope'), 'the Create Lock / Close popup prints no scope chip');
  assert.ok(!closing.includes('Adjust this run if the period should follow a different cadence'), 'the Create Lock / Close popup prints no schedule paragraph');
  assert.ok(closing.includes("from './organisation-context.js'"), 'the working context is not duplicated in the page');
});

test("the journal lines and Period Closing read one working context", () => {
  for (const name of ["getAccessibleOrganizations", "getCurrentOrganizationContext"]) assert.ok(context.includes("export const " + name + "="), name + " lives in the shared context module");
  assert.ok(journal.includes("import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';"), 'the journal page imports the shared context');
  assert.ok(!journal.includes('const readOrgList='), 'the journal page keeps no private copy of the context reader');
});
