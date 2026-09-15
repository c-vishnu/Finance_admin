import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const settings=readFileSync(new URL('../src/PeriodLockSettings.jsx',import.meta.url),'utf8');
const closing=readFileSync(new URL('../src/PeriodClosing.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/period-lock-settings.css',import.meta.url),'utf8');
const closingCss=readFileSync(new URL('../src/period-closing.css',import.meta.url),'utf8');
const journal=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const service=readFileSync(new URL('../src/period-locking.js',import.meta.url),'utf8');

test('one Automatic locking card carries the two switches and the schedule fields',()=>{
 for(const text of ['Enable automatic locking','Require approval to unlock',"const automaticLocking=value.lockingMode==='Automatic',lockingOn=value.lockingMode!=='Off'",'scheduleField=!lockingOn||!automaticLocking','pls-fields-off','disabled={scheduleField}','disabled={!lockingOn}']) assert.ok(settings.includes(text),text);
 assert.ok(!settings.includes('LOCKING_MODES.map'),'the three way segmented control never comes back');
 assert.equal(settings.split('<section className="pls-card').length-1,1,'the popup is a single card');
 const card=settings.slice(settings.indexOf('<section className="pls-card'),settings.indexOf('</section>'));
 for(const text of ['Enable automatic locking','pls-rule','Require approval to unlock','Generated schedule']) assert.ok(card.includes(text),text+' belongs to the one card');
 assert.ok(!settings.includes('<h2>Period locking</h2>'),'the separate Period locking card is removed');
 assert.ok(!settings.includes('Switch off to disable locking app-wide'),'its app-wide on and off copy leaves with it');
 assert.match(settings,/patch\(\{lockingMode:next\?"Automatic":"Manual"\}\)/,'the master switch only moves between automatic and manual');
 assert.match(settings,/Manual locking: you create every lock yourself with Create Lock \/ Close/);
 assert.match(settings,/Manual locking is active, so these schedule fields stay disabled/);
 assert.match(settings,/Period locking is switched off in Accounting settings/,'a stored off mode points at where locking is switched off');
});

test('the automatic schedule keeps the closing fields and drops every boundary field',()=>{
 for(const text of ['Frequency','Effective from','Lock after period end','Lock at','Notify before locking','LOCK_FREQUENCIES.map','SCHEDULE_CHOICES.notifyDays']) assert.ok(settings.includes(text),text);
 for(const text of ['Frequency boundaries','Organisation timezone','Week starts on','Month boundary','Quarter boundary','Year boundary','Anniversary start','Financial year starts','Label format','Month start day','Month end day','SCHEDULE_CHOICES.weekStart','SCHEDULE_CHOICES.monthMode','SCHEDULE_CHOICES.quarterMode','SCHEDULE_CHOICES.yearMode','SCHEDULE_CHOICES.fyStartMonth','SCHEDULE_CHOICES.fyLabelFormat',"patchSchedule('weekStart'","patchSchedule('monthMode'","patchSchedule('quarterMode'","patchSchedule('yearMode'","patchSchedule('fyStartMonth'","patchSchedule('fyLabelFormat'","patchSchedule('anniversaryDate'","patchSchedule('monthStartDay'","patchSchedule('monthEndDay'"]) assert.ok(!settings.includes(text),text+' is removed with the More policy settings block');
});

test('the popup leads with one sentence straight into the switches, with no card heading text',()=>{
 const header=settings.slice(settings.indexOf('pls-heading-popup'),settings.indexOf('{warnings.map('));
 assert.ok(header.includes('<h1>Period Closing Settings</h1>'));
 assert.ok(header.includes('<p>Locking applies to every module in Wayvida Books, and changes apply from the next unclosed period.</p>'),'the popup subheading is one line');
 assert.ok(!settings.includes('Locking schedule and unlock approval.'),'the long scheduling sentence is gone');
 assert.ok(!settings.includes('<h2>'),'the card no longer carries a heading');
 assert.ok(!settings.includes('pls-chip'),'the read only policy chip is not part of the popup');
 assert.ok(!settings.includes('periods lock on this schedule'),'the schedule description paragraph is gone');
 assert.ok(!settings.includes('chip=policyChip(value)')&&!settings.includes('policyChip'),'the popup no longer reads the policy chip text');
 assert.match(settings,/<section className="pls-card wide">\n +<Switch label="Enable automatic locking"/,'the first thing inside the card is the automatic locking switch');
 assert.ok(!closing.includes('policyChip'),'the page header no longer renders the locking policy chip');
});

test('the generated schedule is listed read-only and comes from the policy',()=>{
 assert.ok(settings.includes('generatedSchedule(value,{limit:6})'));
 for(const text of ['Generated schedule','{schedule.map(row=><div key={row.start}>','row.lockAfterDays','row.lockAtTime','No periods generated. Check the effective date and frequency.']) assert.ok(settings.includes(text),text);
});

test('unlock approval is one switch and drops every other unlock control',()=>{
 assert.ok(settings.includes('Require approval to unlock'),'the approval switch stays');
 assert.match(settings,/<Switch label="Require approval to unlock" note=\{value\.approval\?/);
 assert.match(settings,/onChange=\{next=>patch\(\{approval:next\}\)\}/);
 assert.ok(settings.includes('Unlock requests are reviewed by another approver.'),'the switch explains the on state');
 assert.ok(settings.includes('Approval is off, so no Request Unlock action is rendered anywhere'),'the switch explains the off state');
 for(const text of ['Unlock approval role','Default unlock duration','Maximum unlock duration','Auto-approve daily lock unlocks','Re-lock automatically on expiry']) assert.ok(!settings.includes(text),text+' leaves the popup');
 for(const text of ['SCHEDULE_CHOICES.approverRole','SCHEDULE_CHOICES.duration','SCHEDULE_CHOICES.unlockScope','value.maximumUnlockDuration','value.defaultUnlockDuration','value.autoRelock','value.dailyAutoApproval','value.approverRole']) assert.ok(!settings.includes(text),text+' leaves the popup');
});

test('the shared organisation and branch selector survives as an export but leaves the popup',()=>{
 assert.ok(settings.includes('export function ScopeSelector'));
 assert.ok(settings.includes('scopeVisibility({organisations,companyIds,branchIds})'));
 assert.equal(settings.split('scopeVisibility(').length-1,1,'the visibility rule must live in the engine and be consumed once');
 assert.ok(!settings.includes('<ScopeSelector '),'the popup renders no default scope card');
 for(const text of ['Allowed roles','Exemptions','Enforcement coverage','More policy settings','pls-advanced','PERIOD_ROLE_OPTIONS','PERIOD_MODULES','ENFORCED_OPERATIONS','defaultScope:{companyIds:next.companyIds']) assert.ok(!settings.includes(text),text+' is removed with More policy settings');
 assert.ok(closing.includes("import PeriodLockSettings from './PeriodLockSettings.jsx';"),'the page no longer pulls the scope selector into its own header');
 assert.equal(closing.split('<ScopeSelector').length-1,0);
 assert.ok(!closing.includes('export function ScopeSelector'));
 for(const text of ['All branches','single organisation owns one branch','aria-label="Organisation in scope"']) assert.ok(settings.includes(text),text);
});

test('unsafe policies warn, require confirmation and offer the daily auto approval',()=>{
 assert.ok(settings.includes('settingsWarnings(value)'));
 for(const text of ['Locked-forever configuration','Daily unlock request volume','Confirm the locked-forever policy before saving.','I confirm this locked-forever policy','Enable auto-approval for daily locks','item.offer===\'dailyAutoApproval\'']) assert.ok(settings.includes(text),text);
});

test('settings is a right side popup with a sticky footer and a dirty-state guard',()=>{
 assert.match(settings,/<div className="pls pls-popup">/);
 assert.ok(!settings.includes('createPortal'),'the host page owns the portal that frames this popup');
 assert.ok(!settings.includes('pc-modal'));
 for(const text of ['className="pls-footer"','Save changes','Unsaved changes','Discard unsaved changes?','Keep editing','Discard and leave','setDiscard(true)','className="pls-close"']) assert.ok(settings.includes(text),text);
 assert.ok(!settings.includes('pls-advanced'),'the More policy settings disclosure is gone');
 assert.ok(css.includes('.pls-footer{position:sticky'));
 assert.ok(css.includes('.pls{--blue'));
 assert.ok(css.includes('.pls-popup{position:static!important'),'the popup hands layout back to the surrounding drawer');
});

test('period closing drops the read only policy chip and keeps settings and the mode aware lock action in More actions',()=>{
 assert.ok(!closing.includes('policyChip'),'the page no longer renders the policy chip');
 assert.ok(!closing.includes('pc-policy-chip'),'the chip markup leaves the heading');
 assert.ok(closing.indexOf('Period closing settings')<closing.indexOf('Create Lock / Close'),'the More actions entries keep their order');
 assert.ok(closing.includes('menuRun(openSettings)'),'the settings drawer opens from More actions');
 assert.ok(!closing.includes('pc-settings-btn'),'the standalone Settings button is folded into More actions');
 for(const text of ['Create Lock / Close','pc-settings-drawer','pc-more-menu','if(!period)return']) assert.ok(closing.includes(text),text);
 assert.ok(!closingCss.includes('.pc-policy-chip'),'the chip styles leave the stylesheet');
 assert.ok(service.includes('export function policyChip'));
});

test('the unlock request flow and every request action disappear when approval is off',()=>{
 assert.ok(closing.includes('showRequests={approvalOn}'),'the kebab View Requests entry follows the approval policy');
 assert.ok(closing.includes('{onView&&showRequests&&<div className="pc-view-toggle"'),'the locked periods / requests toggle follows the approval policy');
 assert.ok(closing.includes('aria-pressed={isRequests}'),'the requests view stays reachable from the register toggle while approval is on');
 assert.ok(closing.includes("canRequest={approvalOn&&can(activeRole,'request-unlock')}"));
 assert.ok(closing.includes("'Unlocked until '+until"));
 assert.ok(closing.includes('unlockExpiresAt'));
 assert.ok(closing.includes('unlockManual'));
 assert.ok(closingCss.includes('.pc-unlock-until'));
 assert.ok(!closingCss.includes('.pc-status-link'),'the retired status link keeps no styling behind');
});

test('temporary unlocks show their expiry and the admin override needs a written reason',()=>{
 for(const text of ['applyAdminOverride','Written reason','disabled={!reason.trim()}','Record override','Administrator override']) assert.ok(closing.includes(text),text);
 assert.match(closing,/canOverride=\{lockingOn&&can\(activeRole,'configure'\)\}/);
 assert.match(service,/export function applyAdminOverride/);
});

test('the lock form captures a manual period and date, or the saved automatic schedule',()=>{
 for(const text of ['Select period','Reason (optional)','Create Lock / Close','all modules','Manual locking']) assert.ok(closing.includes(text),text);
 assert.ok(closing.includes("['Month','Quarter','Year','Financial Year']"));
 assert.ok(closing.includes('resolveLockRange(manual?form.frequency:schedule.frequency'));
 for(const text of ['Automatic locking','LOCK_FREQUENCIES','SCHEDULE_CHOICES.notifyDays','Lock after period end','Notify before locking','pc-lock-preview']) assert.ok(closing.includes(text),text);
 assert.ok(closing.includes("lockForm.reason.trim()||'Manual lock created for all modules'"));
 assert.ok(!closing.includes('A lock reason is required'),'the lock reason is optional');
 assert.ok(!closing.includes('Lock strength'));
 assert.ok(!closing.includes("scopeVisibility({organisations,companyIds:form.companyIds"));
 assert.match(closing,/createLockWindow\(state,\{frequency,date,companyId/);
 assert.match(closing,/lockPeriod\(window\.state,\{periodId:window\.period\.id,lockType:lockForm\.lockType/);
 assert.ok(closing.includes("panel==='lock'&&createPortal"));
 assert.ok(closing.includes("panel==='override'&&createPortal"));
});

test('journal posting is blocked through the enforcement layer and names the blocking lock',()=>{
 assert.ok(journal.includes("import {validatePostingDate} from './period-locking.js';"));
 assert.ok(journal.includes("import {assertOperationAllowed} from './period-locking.js';"));
 assert.match(journal,/assertOperationAllowed\(\{operation:'post',date,role:'Admin'/);
 assert.ok(journal.includes('periodCheck.lock.name'));
 assert.ok(journal.includes('result.remedy||result.message'));
 assert.match(service,/export function assertOperationAllowed/);
 assert.ok(service.includes('Open Period Closing to request an unlock'));
});

test('the new stylesheet keeps readable text and reflows on small screens',()=>{
 for(const text of ['.pls-card{','.pls-segmented{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));','.pls-scope-strip{','.pls-schedule>div{','@media(max-width:1180px)','@media(max-width:900px)','.pls-guard{','.pls-popup{','.pls-fields-off{','.pls-rule{','.pls-switch>i{']) assert.ok(css.includes(text),text);
 assert.ok(!css.includes('.pls-advanced'),'no orphan styling is left behind for the removed disclosure');
 assert.match(css,/font-size:12px/);
 assert.match(css,/min-height:38px/);
});

test('the settings popup keeps its close button, its gutter and the reflow rules',()=>{
 assert.match(css,/\.pls-popup \.pls-close\{display:inline-flex!important\}/,'the legacy app bar rule would otherwise hide the popup close button below 1050px');
 assert.match(css,/\.pls-popup \.pls-footer\{padding:12px 22px/,'the sticky footer shares the popup gutter');
 assert.ok(css.includes('.pls-popup .pls-card{padding:16px 18px'),'the popup cards use the tighter drawer padding');
 assert.ok(css.includes('.pls-popup .pls-heading{box-shadow:'),'the sticky heading separates itself from the scrolling cards');
 assert.match(css,/@media\(max-width:760px\)\{\.pls-popup \.pls-grid\{padding:0 16px\}/);
});

test('the switches are real toggle controls with a visible track and an accessible name',()=>{
 assert.ok(settings.includes('role="switch"'),'each toggle is a switch, not a styled checkbox');
 assert.ok(settings.includes('<i aria-hidden="true"/>'),'the track is decorative because the label carries the text');
 assert.match(css,/\.pls-switch>i\{position:relative;flex:none;width:38px;height:22px/);
 assert.match(css,/\.pls-switch input:checked\+i:after\{transform:translateX\(16px\)\}/);
 assert.match(css,/\.pls-switch input:focus-visible\+i\{outline:/,'the keyboard focus ring sits on the track');
 assert.match(css,/\.pls-switch-off\{opacity:\.55\}/,'a disabled schedule switch reads as unavailable');
});
