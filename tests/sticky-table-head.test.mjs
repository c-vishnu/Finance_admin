import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* The table-page scroll behaviour is one shared module and one shared stylesheet. These tests hold
   the contract, so a future page inherits it rather than writing its own. */
const js=fs.readFileSync(new URL('../src/register-head.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');

test('the page header waits for a deliberate scroll before it gives way to the table',()=>{
 assert.match(js,/const HIDE_AFTER=48;/,'one shared threshold, in the 40-60px band');
 assert.match(js,/const next=y>HIDE_AFTER&&delta>0&&y>h\.offsetHeight;/,'the row hides only on a downward scroll past it, so the top always shows it');
 assert.match(js,/const SCOPES='\.app>main,\.pc';/,'both shell scroll ports are handled, because Period Lock owns its own');
 assert.match(css,/\.registerHead\{[^}]*transition:transform \.22s ease/,'the slide is the subtle 200-300ms transition, not an abrupt toggle');
});

test('one shared module marks the page grid and hands the offset to its column headings',()=>{
 assert.match(js,/const EXCLUDE='form,dialog,\[role=dialog\],details/,'a table inside a form, a dialog or a disclosure is a section, never the page grid');
 assert.match(js,/const found=\[\.\.\.scope\.querySelectorAll\('table'\)\]\.find\(el=>el\.tHead&&el\.tHead\.rows\.length&&!el\.closest\(EXCLUDE\)\);/,'the page grid is the first table with headings that is not excluded');
 assert.match(js,/table\.setAttribute\('data-sticky-head',''\)/,'which is marked for the stylesheet to pin');
 assert.match(js,/document\.documentElement\.style\.setProperty\('--register-head-h',/,'and the measured heading height is published');
 assert.match(js,/h&&!h\.classList\.contains\('isHidden'\)\?h\.offsetHeight\+'px':'0px'/,'as its own height while it is there, and as nothing while it has slid away');
 assert.match(css,/\[data-sticky-head\] thead th\{position:sticky;top:calc\(var\(--register-head-h,0px\) - var\(--register-head-pad,22px\)\);z-index:6;box-shadow:inset 0 -1px 0 #e6ecf6;transition:top \.22s ease\}/,'the column heading pins under the row, keeps a stand-in for the collapsed border, stays below the row and glides with it');
 assert.match(css,/body:has\(\.registerHead\.isHidden\) \[data-sticky-head\] thead th::before,/,'and hides the band above itself while the page heading is away, because a sticky offset is measured from the scroll port content box and the port own top padding would otherwise leave a strip of scrolling rows showing');
 assert.match(js,/document\.documentElement\.style\.setProperty\('--register-head-pad',\(\(box\?parseFloat\(getComputedStyle\(box\)\.paddingTop\):0\)\|\|0\)\+'px'\);/,'the module publishes that padding, measured from the port the page actually scrolls in');
 assert.match(css,/@media print\{\n \[data-sticky-head\] thead th\{position:static/,'and print keeps static headings');
});

test('a wrapper that scrolls is only released while the table fits it',()=>{
 assert.match(js,/const box=scrollBox\(table\);/,'the nearest scroll container is found once per table');
 assert.match(js,/box\.classList\.toggle\('stickyHeadWrap',box\.scrollWidth<=box\.clientWidth\+1\)/,'and released only while the table fits it horizontally');
 assert.match(js,/if\(wrap\)wrap\.classList\.toggle\('stickyHeadWrap',wrap\.scrollWidth<=wrap\.clientWidth\+1\);/,'re-checked on resize, because the same table can start needing sideways scrolling');
 assert.match(css,/\.stickyHeadWrap\{overflow:visible!important\}/,'a released wrapper must not scroll, or the heading would pin to a box that never moves');
});

test('the scroll path stays cheap, and never re-renders or hides a focused action',()=>{
 assert.match(js,/document\.addEventListener\('scroll',onScroll,\{capture:true,passive:true\}\);/,'one passive capture-phase listener, because a scroll event does not bubble');
 assert.match(js,/new MutationObserver\(schedule\)\.observe\(document\.body,\{childList:true,subtree:true\}\);/,'and one observer picks up a route change');
 assert.match(js,/if\(frame\)return;\n    frame=requestAnimationFrame\(\(\)=>\{frame=0;sync\(\)\}\);/,'coalesced to a single run per frame');
 assert.match(js,/h\.classList\.toggle\('isHidden',next\);/,'hiding is one class toggle, so the table is never re-rendered');
 assert.match(js,/document\.addEventListener\('focusin',event=>\{/,'a focusable page action brings the row back rather than leaving it off screen');
 assert.ok(!/setInterval|innerHTML|createElement|textContent\s*=/.test(js),'and the scroll path writes no markup and starts no timer');
});
