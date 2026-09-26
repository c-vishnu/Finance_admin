/* The organisation and branch switcher's non-React half.

   The header bar has always written the working context to the same five
   storage keys and dispatched the same two events. Both the quick switcher and
   the Change / Customize drawer go through applyWorkingContext, so the drawer,
   the quick switch and every reader (Create Journal Entry and Period Lock read
   getAccessibleOrganizations, Create Budget reads getScopeOrganisations) can
   never disagree about what the working context is. */

export const SWITCH_MODES = {single: 'Single organisation', multi: 'Multi Selection'};

/* The mark on the switcher trigger and on each organisation row: up to two
   initials, so a four-organisation list is readable at a glance. */
export const initialsOf = name => String(name || '')
  .replace(/[^A-Za-z ]/g, ' ')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map(word => word[0].toUpperCase())
  .join('');

/* Row marks avoid green, red and grey: those three already mean status in the
   Chart of Accounts, so the switcher stays on the brand and type hues. */
export const ORG_TONES = ['blue', 'violet', 'cyan', 'amber'];
export const toneOf = id => ORG_TONES[[...String(id || '')].reduce((total, character) => total + character.charCodeAt(0), 0) % ORG_TONES.length];

/* The branch a single-organisation switch lands on: the branch the user is
   already on when it belongs to the chosen organisation, otherwise that
   organisation's first branch. */
export const switchedBranchIds = (organization, branchIds) => {
  if (!organization?.branches?.length) return [];
  const keep = (branchIds || []).find(value => organization.branches.some(branch => branch.id === value));
  return [keep || organization.branches[0].id];
};

/* Persist the working context and announce it. Returns the resolved company and
   branch, or null when the pair is empty and nothing should change. */
export function applyWorkingContext(organizations, companyIds, branchIds, mode) {
  if (!companyIds?.length || !branchIds?.length) return null;
  const company = organizations.find(item => item.id === companyIds[0]);
  const branch = company?.branches.find(item => item.id === branchIds[0]);
  try {
    localStorage.setItem('wayvida-context-companies', JSON.stringify(companyIds));
    localStorage.setItem('wayvida-context-branches', JSON.stringify(branchIds));
    localStorage.setItem('wayvida-context-mode', mode);
    localStorage.setItem('wayvida-demo-company', companyIds[0]);
    localStorage.setItem('wayvida-demo-branch', branchIds[0]);
  } catch {/* Keep the switcher usable when storage is unavailable. */}
  window.dispatchEvent(new CustomEvent('wayvida-organization-change', {detail: {company, branch, companyIds, branchIds, mode}}));
  window.dispatchEvent(new CustomEvent('wayvida-working-context-change', {detail: {companyIds, branchIds, mode}}));
  return {company, branch};
}
