import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ALL_BRANCHES,NO_BRANCH,findOrganisation,getBranchesForOrganisation,getScopeVisibility,normaliseScope,organisationBranches,scopeLabel,scopePickerRows,scopePickerState,toggleScopePicker,validateScope} from '../src/organisation-scope.js';

const orgSource=readFileSync(new URL('../src/demo-organisations.js',import.meta.url),'utf8');
const demoOrganizations=new Function('return '+orgSource.match(/export const demoOrganizations=(\[[\s\S]*?\n\]);/)[1])();

const one={id:'one',code:'ONE',name:'One Branch Co',currency:'INR',branches:[{id:'one-main',name:'Main Branch',code:'MB'}]};
const many={id:'many',code:'MANY',name:'Many Branch Co',currency:'INR',branches:[{id:'many-n',name:'North Branch'},{id:'many-s',name:'South Branch'}]};
const other={id:'other',code:'OTHER',name:'Other Branch Co',currency:'INR',branches:[{id:'other-w',name:'West Branch'}]};
const nil={id:'nil',code:'NIL',name:'No Branch Co',currency:'INR',branches:[]};
const organisations=[one,many,other,nil];

test('one organisation with one branch hides both selectors and states the resolved scope',()=>{
 const view=getScopeVisibility({organisations,organisationIds:['one']});
 assert.equal(view.orgCount,1);
 assert.equal(view.showOrganisation,false);
 assert.equal(view.showBranch,false);
 assert.equal(view.showOrgColumn,false);
 assert.equal(view.showBranchColumn,false);
 assert.equal(view.strip,'Locking for: One Branch Co \u00b7 Main Branch');
 assert.equal(view.rows[0].singleBranch,true);
 assert.equal(view.branchRequired,false);
});

test('one organisation with several branches offers the branch only, filtered to that organisation',()=>{
 const view=getScopeVisibility({organisations,organisationIds:['many']});
 assert.equal(view.showOrganisation,false);
 assert.equal(view.showBranch,true);
 assert.equal(view.anySelectedOrgHasMultipleBranches,true);
 assert.equal(view.branchRequired,true);
 assert.deepEqual(view.rows[0].branchOptions,['North Branch','South Branch']);
 assert.deepEqual(getBranchesForOrganisation('many',organisations).map(branch=>branch.name),['North Branch','South Branch']);
 assert.ok(!getBranchesForOrganisation('many',organisations).some(branch=>branch.id==='other-w'),'another organisation branch is never returned');
});

test('several organisations show both selectors and a branch can only come from its own organisation',()=>{
 const view=getScopeVisibility({organisations,organisationIds:['many','other'],branchIds:['other-w']});
 assert.equal(view.showOrganisation,true);
 assert.equal(view.showBranch,true);
 assert.deepEqual(view.rows.map(row=>row.organisationName),['Many Branch Co','Other Branch Co']);
 assert.deepEqual(view.rows[0].branchOptions,['North Branch','South Branch']);
 assert.deepEqual(view.rows[1].branchOptions,['West Branch']);
 assert.equal(view.rows[1].branchId,'other-w','the branch resolves inside the organisation that owns it');
 assert.equal(view.rows[0].allBranches,true,'an organisation without a choice keeps every branch of its own');
});

test('a branchless organisation is its own scope and prints an em dash',()=>{
 const view=getScopeVisibility({organisations,organisationIds:['nil']});
 assert.equal(view.showOrganisation,false);
 assert.equal(view.showBranch,false);
 assert.equal(view.rows[0].noBranches,true);
 assert.equal(view.rows[0].branchName,NO_BRANCH);
 assert.deepEqual(getBranchesForOrganisation('nil',organisations),[]);
 assert.equal(scopeLabel({organisationName:'No Branch Co',branchName:NO_BRANCH}),'No Branch Co \u00b7 '+NO_BRANCH);
});

test('normaliseScope auto resolves one branch, clears a foreign branch and keeps a valid one',()=>{
 assert.deepEqual(normaliseScope({organisations,organisationIds:['one'],branchIds:[]}).branchIds,['one-main']);
 assert.deepEqual(normaliseScope({organisations,organisationIds:['many'],branchIds:['other-w']}).branchIds,[],'a branch from another organisation is cleared');
 assert.deepEqual(normaliseScope({organisations,organisationIds:['many'],branchIds:['many-s']}).branchIds,['many-s']);
 assert.deepEqual(normaliseScope({organisations,organisationIds:['one','other'],branchIds:[]}).branchIds,['one-main','other-w'],'every single-branch organisation resolves itself');
 assert.deepEqual(normaliseScope({organisations,organisationIds:['nil'],branchIds:['many-n']}).branchIds,[]);
});

test('validateScope rejects an unknown organisation, a foreign branch and a missing branch choice',()=>{
 assert.equal(validateScope({organisations,organisationIds:['gone']}).code,'UNKNOWN_ORGANISATION');
 assert.equal(validateScope({organisations,organisationIds:['many'],branchIds:['other-w']}).code,'BRANCH_NOT_IN_ORGANISATION');
 assert.equal(validateScope({organisations,organisationIds:['many'],branchIds:[]}).code,'BRANCH_REQUIRED');
 assert.equal(validateScope({organisations,organisationIds:[],branchIds:[]}).code,'NO_SCOPE');
 assert.equal(validateScope({organisations:undefined,organisationIds:undefined,branchIds:undefined}).code,'NO_SCOPE','an empty scope never throws');
 assert.equal(validateScope({organisations,organisationIds:['one'],branchIds:[]}).ok,true,'a one-option branch resolves itself');
 assert.equal(validateScope({organisations,organisationIds:['nil'],branchIds:[]}).ok,true,'a branchless organisation is a valid scope');
 assert.equal(validateScope({organisations,organisationIds:['many'],branchIds:['many-s']}).ok,true);
 assert.equal(validateScope({organisations,organisationIds:['one','many'],branchIds:['one-main','many-n'],requireBranch:true}).ok,true);
});

test('organisationBranches annotates every branch with the organisation that owns it',()=>{
 const rows=organisationBranches([many,nil]);
 assert.deepEqual(rows.map(row=>[row.organisationName,row.name]),[['Many Branch Co','North Branch'],['Many Branch Co','South Branch']]);
 assert.deepEqual(organisationBranches(),[]);
 assert.equal(findOrganisation('MANY',organisations).id,'many','a code resolves to its organisation');
});

test('the three consuming modules read the shared scope rule instead of a private copy',()=>{
 const journal=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
 const closing=readFileSync(new URL('../src/PeriodClosing.jsx',import.meta.url),'utf8');
 const settings=readFileSync(new URL('../src/PeriodLockSettings.jsx',import.meta.url),'utf8');
 const accounts=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');
 const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
 const financeCategoryScope=readFileSync(new URL('../src/finance-category-scope.js',import.meta.url),'utf8');
 const consumers=[['journal entry',journal],['period closing',closing],['period closing settings',settings],['account form',accounts],['account workspace',workspace]];
 for(const [name,source] of consumers)assert.ok(source.includes("from './organisation-scope.js'"),name+' imports the shared scope module');
 assert.ok(financeCategoryScope.includes("from './organisation-scope.js'"),'the Finance Categories display helper imports the shared scope module');
 const duplicated=['flatMap(item=>item.branches)','flatMap(organisation=>organisation.branches','flatMap(org=>org.branches','.branches.map(branch=>({...branch,organisationId'];
 for(const [name,source] of consumers)for(const pattern of duplicated)assert.ok(!source.includes(pattern),name+' keeps no private branch flattening of '+pattern);
 for(const [name,source,helper] of [['journal entry',journal,'getScopeVisibility('],['journal entry',journal,'getBranchesForOrganisation('],['period closing',closing,'validateScope('],['period closing settings',settings,'getBranchesForOrganisation('],['account form',accounts,'organisationBranches('],['account form',accounts,'validateScope('],['account workspace',workspace,'financeCategoryScope('],['finance category scope',financeCategoryScope,'organisationScopeList(']])assert.ok(source.includes(helper),name+' reads '+helper+' from the shared module');
 assert.ok(closing.includes('validateScope({organisations:demoOrganizations,companyIds:lockForm.companyIds'),'creating a lock validates the scope through the shared rule');
 assert.ok(!closing.includes('pc-lock-scope'),'the create lock popup no longer prints a scope chip');
 assert.ok(!closing.includes('on the saved automatic schedule'),'the create lock popup no longer prints its schedule paragraph');
 assert.ok(closing.includes('<OrganisationBranchScope organisations={scopeOrganisations} companyIds={form.companyIds} branchIds={form.branchIds}'),'the lock drawer offers the shared organisation/branch picker');
 assert.ok(closing.includes('const scopeOrganisations=useMemo(()=>getAccessibleOrganizations(),[])'),'the page resolves its available scope through the shared working context');
 assert.ok(journal.includes('getBranchesForOrganisation(organization,contextOrganizations)'),'journal lines resolve branches through the shared helper');
 assert.ok(settings.includes('getBranchesForOrganisation(row.companyId,organisations)'),'the locking scope selector resolves branches through the shared helper');
});

test('the account domain layer rejects a branch from another organisation',async()=>{
 const {changeAccount,ACCOUNT_SCOPES}=await import('../src/account-master.js');
 const state={accounts:[{id:'base',code:'1000',name:'Cash',type:'Assets',accountNature:'Cash',group:'Cash and Bank',organizationIds:['many'],applicableBranches:[],scope:ACCOUNT_SCOPES[0]}],journals:[],config:{},accountAudit:[]};
 const save=payload=>changeAccount(state,'save',payload,[],organisations);
 assert.throws(()=>save({name:'Foreign branch bank',type:'Assets',accountNature:'Bank',scope:ACCOUNT_SCOPES[1],organizationIds:['many'],applicableBranches:['other-w']}),/does not belong to the selected organisation/,'a branch of another organisation is refused even when the form is bypassed');
 assert.throws(()=>save({name:'Ghost organisation bank',type:'Assets',accountNature:'Bank',scope:ACCOUNT_SCOPES[1],organizationIds:['gone'],applicableBranches:['many-n']}),/no longer available/,'an organisation that no longer exists is refused');
 assert.doesNotThrow(()=>save({name:'Own branch bank',type:'Assets',accountNature:'Bank',scope:ACCOUNT_SCOPES[1],applicableBranches:['many-n']}),'a branch of a selected organisation is accepted');
 assert.doesNotThrow(()=>save({name:'Legacy default org',type:'Assets',accountNature:'Bank',scope:ACCOUNT_SCOPES[1],organizationIds:['default'],applicableBranches:['Legacy branch']}),'an unresolvable legacy organisation id stays tolerated');
 assert.doesNotThrow(()=>save({name:'Org wide',type:'Assets',accountNature:'Cash'}),'an organisation-wide account stays valid');
});

test('the multi-select rows and the toggling rule live in this module too',()=>{
 const state=scopePickerState({organisations,companyIds:['MANY'],branchIds:['many-n'],label:'Budget scope'});
 assert.equal(state.showOrganisation,true,'more than one available organisation keeps the organisation control');
 assert.equal(state.showBranch,true,'a several branch organisation keeps the branch control');
 assert.equal(state.organisationSummary,'Many Branch Co','the organisation in scope is named');
 assert.equal(state.branchSummary,'North Branch','the narrowed branch is named');
 assert.deepEqual(state.selectedCompanyIds,['MANY']);
 assert.deepEqual(state.chosenBranchIds,['many-n']);
 const rows=scopePickerRows(state);
 assert.deepEqual(rows.organisationRows.map(row=>row.label),['All organisations','One Branch Co','Many Branch Co','Other Branch Co','No Branch Co'],'every available organisation stays selectable');
 assert.deepEqual(rows.organisationRows.filter(row=>row.checked).map(row=>row.label),['Many Branch Co'],'only the organisation in scope reads as ticked');
 assert.deepEqual(rows.branchRows.map(row=>row.label),['All branches','North Branch','South Branch'],'a branch of an organisation out of scope is never offered');
 assert.deepEqual(rows.branchRows.filter(row=>row.checked).map(row=>row.label),['North Branch']);
 assert.deepEqual(toggleScopePicker(state,rows.branchRows[2]),{companyIds:['MANY'],branchIds:['many-n','many-s']},'a second branch of the same organisation can be added');
 assert.deepEqual(toggleScopePicker(state,rows.branchRows[1]),{companyIds:['MANY'],branchIds:[]},'clicking a chosen branch takes it back out');
 assert.deepEqual(toggleScopePicker(state,{kind:'branch',ref:''}),{companyIds:['MANY'],branchIds:[]},'All branches clears the narrowing');
 assert.deepEqual(toggleScopePicker(state,{kind:'organisation',ref:'ONE'}),{companyIds:['MANY','ONE'],branchIds:['many-n']},'another organisation can be added to the scope');
 assert.deepEqual(toggleScopePicker(state,{kind:'organisation',ref:''}),{companyIds:[],branchIds:['many-n']},'All organisations puts the whole list back in scope');
 const whole=scopePickerState({organisations,label:'Budget scope'});
 assert.equal(whole.organisationSummary,'All organisations','an unchosen scope reads as every organisation');
 assert.equal(whole.branchSummary,ALL_BRANCHES,'and as every branch');
 assert.deepEqual(scopePickerRows(whole).branchRows.filter(row=>row.checked).map(row=>row.label),[ALL_BRANCHES],'the All branches row is the ticked one');
 assert.deepEqual(scopePickerRows({}).organisationRows.concat(scopePickerRows({}).branchRows),[],'an empty state builds no rows instead of throwing');
 const oneBranch=scopePickerState({organisations:[one],companyIds:['ONE'],label:'Budget scope'});
 assert.equal(oneBranch.showOrganisation,false,'one available organisation hides the organisation control');
 assert.equal(oneBranch.showBranch,false,'a one branch organisation hides the branch control too');
 assert.equal(oneBranch.branchSummary,'Main Branch','a forced branch is named rather than offered');
 const branchless=scopePickerState({organisations,companyIds:['NIL'],label:'Budget scope'});
 assert.deepEqual(scopePickerRows(branchless).branchRows.map(row=>row.label),[ALL_BRANCHES],'a branchless scope offers no branch to tick');
 assert.equal(branchless.branchSummary,NO_BRANCH,'and prints the em dash');
 const foreign=scopePickerState({organisations,companyIds:['MANY'],branchIds:['other-w'],label:'Budget scope'});
 assert.equal(foreign.branchSummary,ALL_BRANCHES,'a branch of another organisation is cleared rather than reported');
});
