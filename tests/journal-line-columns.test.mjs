import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../src/JournalEntriesPro.jsx", import.meta.url), "utf8");
const orgSource = readFileSync(new URL("../src/HeaderOrgSelectors.jsx", import.meta.url), "utf8");
const scopeSource = readFileSync(new URL("../src/organisation-scope.js", import.meta.url), "utf8").replace(/^export /gm, "");
const contextSource = readFileSync(new URL("../src/organisation-context.js", import.meta.url), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "");

const grab = (text, pattern, label) => {
  const found = text.match(pattern);
  assert.ok(found, label + " located in the create page source");
  return found[0];
};

const demoOrganizations = new Function("return " + orgSource.match(/export const demoOrganizations=(\[[\s\S]*?\n\]);/)[1])();

const buildPage = new Function("localStorage", "demoOrganizations", [
  scopeSource,
  contextSource,
  "const contextOrganizations=getAccessibleOrganizations();",
  grab(source, /const lineScope=[^\n]*/, "lineScope"),
  grab(source, /const showOrganizationColumn=[^\n]*/, "showOrganizationColumn"),
  grab(source, /const showBranchColumn=[^\n]*/, "showBranchColumn"),
  grab(source, /const branchNamesFor=[^\n]*/, "branchNamesFor"),
  grab(source, /const alignLine=[^\n]*/, "alignLine"),
  "return {contextOrganizations,showOrganizationColumn,showBranchColumn,branchNamesFor,alignLine};"
].join("\n"));

const store = entries => ({getItem: key => Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null});
const page = entries => buildPage(store(entries), demoOrganizations);

test("one organisation with one branch hides both the organisation and branch columns", () => {
  const state = page({"wayvida-context-companies": '["abc"]', "wayvida-context-branches": '["abc-kochi"]'});
  assert.equal(state.contextOrganizations.length, 1);
  assert.equal(state.showOrganizationColumn, false);
  assert.equal(state.showBranchColumn, false);
  const line = state.alignLine({organization: "Northstar Retail LLP", branch: "Chennai Branch"});
  assert.equal(line.organization, "ABC Technologies Pvt Ltd", "the single organisation becomes implicit");
  assert.equal(line.branch, "Kochi Branch", "the single branch becomes implicit");
});

test("one organisation with several branches keeps only the branch column", () => {
  const state = page({"wayvida-context-companies": '["abc"]', "wayvida-context-branches": '["abc-kochi","abc-bengaluru"]'});
  assert.equal(state.showOrganizationColumn, false);
  assert.equal(state.showBranchColumn, true);
  assert.deepEqual(state.branchNamesFor("ABC Technologies Pvt Ltd"), ["Kochi Branch", "Bengaluru Branch"], "the branch dropdown lists only the accessible branches of the single organisation");
  const kept = state.alignLine({organization: "ABC Technologies Pvt Ltd", branch: "Bengaluru Branch"});
  assert.equal(kept.branch, "Bengaluru Branch", "a branch that still belongs is kept");
  const reset = state.alignLine({organization: "ABC Technologies Pvt Ltd", branch: "Chennai Branch"});
  assert.equal(reset.branch, "Kochi Branch", "a branch from another organisation falls back to the first accessible branch");
  const forced = state.alignLine({organization: "Northstar Retail LLP", branch: "Chennai Branch"});
  assert.equal(forced.organization, "ABC Technologies Pvt Ltd", "the implicit organisation is restored");
  assert.equal(forced.branch, "Kochi Branch");
});

test("several organisations show both columns and filter branches by the selected organisation", () => {
  const state = page({
    "wayvida-context-companies": '["abc","northstar"]',
    "wayvida-context-branches": '["abc-kochi","abc-bengaluru","northstar-chennai"]'
  });
  assert.equal(state.showOrganizationColumn, true);
  assert.equal(state.showBranchColumn, true);
  assert.deepEqual(state.branchNamesFor("Northstar Retail LLP"), ["Chennai Branch"], "no other organisation branch is offered");
  assert.deepEqual(state.branchNamesFor("ABC Technologies Pvt Ltd"), ["Kochi Branch", "Bengaluru Branch"], "branches outside the working context are not offered");
  assert.deepEqual(state.branchNamesFor("Malabar Trading Co."), [], "an organisation outside the context offers no branch");
  const kept = state.alignLine({organization: "Northstar Retail LLP", branch: "Chennai Branch"});
  assert.deepEqual([kept.organization, kept.branch], ["Northstar Retail LLP", "Chennai Branch"]);
  const reset = state.alignLine({organization: "Northstar Retail LLP", branch: "Kochi Branch"});
  assert.equal(reset.branch, "Chennai Branch", "changing organisation clears an incompatible branch");
  const rescoped = state.alignLine({organization: "Malabar Trading Co.", branch: "Calicut Branch"});
  assert.deepEqual([rescoped.organization, rescoped.branch], ["ABC Technologies Pvt Ltd", "Kochi Branch"], "an organisation outside the context falls back to the first accessible one");
});

test("an empty or unavailable working context falls back to the selected organisation and branch", () => {
  const empty = page({});
  assert.equal(empty.contextOrganizations.length, 1, "the existing working-context fallback is the selected company");
  assert.equal(empty.contextOrganizations[0].name, "ABC Technologies Pvt Ltd");
  assert.equal(empty.showOrganizationColumn, false);
  assert.equal(empty.showBranchColumn, false);
  assert.equal(empty.alignLine({organization: "", branch: ""}).branch, "Kochi Branch", "blank line values resolve to the fallback branch");
  const blocked = buildPage({getItem() { throw new Error("storage unavailable"); }}, demoOrganizations);
  assert.equal(blocked.contextOrganizations.length, 1);
  assert.equal(blocked.showOrganizationColumn, false);
  assert.equal(blocked.showBranchColumn, false);
});

test("a single organisation scoped to all of its branches keeps only the branch column", () => {
  const state = page({
    "wayvida-context-companies": '["bluewave"]',
    "wayvida-context-branches": '["bluewave-mumbai","bluewave-pune"]'
  });
  assert.equal(state.showOrganizationColumn, false);
  assert.equal(state.showBranchColumn, true);
  assert.deepEqual(state.branchNamesFor("Bluewave Services Pvt Ltd"), ["Mumbai Branch", "Pune Branch"]);
});

test("the full organisation list keeps both columns exactly as before", () => {
  const state = page({
    "wayvida-context-companies": JSON.stringify(demoOrganizations.map(item => item.id)),
    "wayvida-context-branches": JSON.stringify(demoOrganizations.flatMap(item => item.branches.map(branch => branch.id)))
  });
  assert.equal(state.contextOrganizations.length, demoOrganizations.length);
  assert.equal(state.showOrganizationColumn, true);
  assert.equal(state.showBranchColumn, true);
  assert.equal(state.alignLine({organization: "Northstar Retail LLP", branch: "Chennai Branch"}).organization, "Northstar Retail LLP");
});
