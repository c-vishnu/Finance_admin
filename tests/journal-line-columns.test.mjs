import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../src/JournalEntriesPro.jsx", import.meta.url), "utf8");
const orgSource = readFileSync(new URL("../src/demo-organisations.js", import.meta.url), "utf8");
const scopeSource = readFileSync(new URL("../src/organisation-scope.js", import.meta.url), "utf8").replace(/^export /gm, "");
const contextSource = readFileSync(new URL("../src/organisation-context.js", import.meta.url), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "");

const grab = (text, pattern, label) => {
  const found = text.match(pattern);
  assert.ok(found, label + " located in the create page source");
  return found[0];
};

const demoOrganizations = new Function("return " + orgSource.match(/export const demoOrganizations=(\[[\s\S]*?\n\]);/)[1])();

const buildPage = (form, storage) => new Function("localStorage", "demoOrganizations", "form", [
  scopeSource,
  contextSource,
  "const contextOrganizations=getAccessibleOrganizations();",
  grab(source, /const branchNamesFor=[^\n]*/, "branchNamesFor"),
  grab(source, /const alignLine=[^\n]*/, "alignLine"),
  "return {contextOrganizations,branchNamesFor,alignLine};"
].join("\n"))(storage, demoOrganizations, form);

const store = entries => ({getItem: key => Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null});
const page = (entries, form = {organization: "", branch: ""}) => buildPage(form, store(entries));

test("organisation and branch are stated in the journal header, not on each line", () => {
  assert.ok(!/lineScope|showOrganizationColumn|showBranchColumn/.test(source), "the per-line scope columns are gone");
  assert.ok(!/updateLineOrganization|lineBranchOptions/.test(source), "and so are their per-line setters");
  assert.match(source, /Posting to <b>\{form\.organization/, "the header states the organisation");
  assert.match(source, /<div className="je-line head"><span>Account \*<\/span><span>Description<\/span><span>Contact \(INR\)<\/span><span className="je-head-amount">Debits \(₹\)<\/span><span className="je-head-amount">Credits \(₹\)<\/span><span\/><\/div>/, "a line has Account, Description, Contact, Debits, Credits and delete");
});

test("every line is stamped from the header scope", () => {
  const scoped = page({}, {organization: "Viskool", branch: "Trivandrum Branch"});
  assert.deepEqual(scoped.alignLine({organization: "Wayvida Learning", branch: "Kochi Branch"}), {organization: "Viskool", branch: "Trivandrum Branch"}, "a line cannot hold its own organisation or branch");
  const blank = page({}, {organization: "", branch: ""});
  assert.equal(blank.alignLine({}).organization, blank.contextOrganizations[0].name, "an empty header falls back to the working context");
});

test("the header branch list follows the header organisation", () => {
  const state = page({"wayvida-context-companies": '["abc","northstar"]', "wayvida-context-branches": '["abc-kochi","abc-bengaluru","northstar-chennai"]'});
  const org = state.contextOrganizations[0].name;
  assert.ok(state.branchNamesFor(org).length > 0, "the working context organisation offers its branches to the header");
  assert.deepEqual(state.branchNamesFor("Acme Industries"), [], "an organisation outside the context offers no branch");
});

test("the working context still supplies the default scope", () => {
  const state = page({"wayvida-context-companies": '["abc"]', "wayvida-context-branches": '["abc-kochi"]'});
  assert.equal(state.contextOrganizations.length, 1);
  assert.equal(state.contextOrganizations[0].name, "Wayvida Learning");
  assert.equal(state.alignLine({}).branch, "", "the header branch is filled by the form, not invented here");
});
