import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('working context renders as a compact shared bar with a right drawer',()=>{
 const component=readFileSync('src/HeaderOrgSelectors.jsx','utf8');
 for(const token of ['document.body','orgContextBar','Change / Customize','Choose organisations and branches','role="checkbox"','data-summary','Apply Context','wayvida-working-context-change'])assert.ok(component.includes(token),token);
 for(const removed of ['type="radio"','Single Selection','Consolidated reporting','Multi-selection enabled','wcEyebrow','wcSelectionNote'])assert.ok(!component.includes(removed),removed);
 for(const removed of ['Financial year','wayvida-demo-year','hosSelector'])assert.ok(!component.includes(removed),removed);
 assert.ok(!component.includes("document.querySelector('.headerActions')"));
});

test('context bar sits below the header and shifts portal workspaces',()=>{
 const css=readFileSync('src/ui-quality-polish.css','utf8');
 for(const token of ['top:59px','left:270px','height:46px','.app>main{margin-top:46px}', 'top:105px!important'])assert.ok(css.includes(token),token);
 const drawer=readFileSync('src/header-org-selectors.css','utf8');
 for(const token of ['justify-content:flex-end','.wcDrawer','width:min(540px,100vw)','.wcHoverSummary','.wcBox'])assert.ok(drawer.includes(token),token);
});

test('the header profile menu owns the terminology view switch',()=>{
 const app=readFileSync('src/App.jsx','utf8');
 const navigation=readFileSync('src/Navigation.jsx','utf8');
 const terminology=readFileSync('src/terminology.jsx','utf8');
 const styles=readFileSync('src/styles.css','utf8');
 assert.ok(app.includes('<details className="profileMenu">'),'the profile chip is now a disclosure menu');
 assert.ok(app.includes('const {mode,setMode}=useTerminology();'),'the header reads the terminology view');
 for(const role of ['Business owner','Head of Accountant'])assert.ok(app.includes(role),role);
 assert.ok(app.includes('<small>Admin</small>')&&app.includes('<small>Staff</small>'),'each view names its acting role');
 assert.ok(app.includes("setMode('business')")&&app.includes("setMode('accountant')"),'both views switch from the menu');
 assert.ok(app.includes('closeProfileMenu'),'choosing a view closes the menu');
 assert.ok(app.includes("document.querySelectorAll('.profileMenu[open]')"),'the menu dismisses on outside pointerdown and Escape');
 assert.ok(!navigation.includes('terminologySwitch')&&!navigation.includes('.headerActions'),'the sidebar no longer injects a header control imperatively');
 assert.ok(!terminology.includes('TerminologySwitch'),'the standalone switch component is removed');
 for(const file of ['src/App.jsx','src/Navigation.jsx','src/terminology.jsx'])assert.ok(!readFileSync(file,'utf8').includes('View As:'),'no leftover View As label in '+file);
 for(const token of ['.profileMenuPanel{position:absolute','.profileMenuRole{','.profileMenuHead{'])assert.ok(styles.includes(token),token);
 const sizes=[...styles.matchAll(/\.profileMenu[^{]*\{[^}]*font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length>=3&&Math.min(...sizes)>=12,'profile menu text stays at least 12px');
});
