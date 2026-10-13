import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const navigationCss=readFileSync(new URL('../src/navigation.css',import.meta.url),'utf8');

test('the header owns one navigation toggle that persists and mirrors the collapse state',()=>{
  assert.match(app,/\[nav,setNav\]=useState\(\(\)=>\{try\{return localStorage\.getItem\('finance-erp-nav-collapsed'\)==='1'\}catch\{return false\}\}\)/);
  assert.match(app,/localStorage\.setItem\('finance-erp-nav-collapsed',n\?'1':'0'\)/);
  assert.match(app,/if\(nav\)document\.body\.classList\.add\('navCollapsed'\);else document\.body\.classList\.remove\('navCollapsed'\)/);
  assert.match(app,/return <div className=\{'app'\+\(nav\?' navCollapsed':''\)\}><aside id="appNav"/);
  assert.match(app,/<header><button type="button" className="navToggle"[^>]*aria-label=\{nav\?'Expand navigation':'Collapse navigation'\} aria-expanded=\{!nav\} aria-controls="appNav"[^>]*onClick=\{toggleNav\}/);
  assert.match(app,/\{nav\?<IconChevronRight size=\{19\}\/>:<IconChevronLeft size=\{19\}\/>\}/,'the toggle swaps a right arrow for a left arrow with the rail state');
});

test('the collapsed shell keeps a compact icon rail with visible labels on desktop only',()=>{
  assert.match(navigationCss,/\.app>header>button\.navToggle\{display:none\}/);
  assert.match(navigationCss,/\.app>header>button\.navToggle svg\{width:19px;height:19px\}/);
  assert.match(navigationCss,/\.app:has\(>aside \.erpNavigation\)\{padding-left:250px\}/);
  assert.match(navigationCss,/\.app>header\{left:250px\}/);
  const desktopStart=navigationCss.indexOf('@media(min-width:701px){');
  const desktopEnd=navigationCss.indexOf('@media(prefers-reduced-motion:reduce)');
  assert.ok(desktopStart>-1&&desktopEnd>desktopStart,'the desktop-only collapse block exists');
  const desktop=navigationCss.slice(desktopStart,desktopEnd);
  assert.ok(desktop.includes('.app.navCollapsed:has(>aside .erpNavigation){padding-left:72px}'),'the app keeps space for the icon rail');
  assert.ok(desktop.includes('.app.navCollapsed>header{left:72px}'),'the header begins after the rail');
  assert.ok(desktop.includes('.app.navCollapsed>aside{width:72px;transform:none;visibility:visible}'),'the sidebar becomes a visible 72px rail');
  assert.ok(desktop.includes('.app>header>button.navToggle:not(.primary):not(.hamb){position:fixed')&&desktop.includes('display:grid;place-items:center;width:26px;height:26px'),'the transparent edge arrow survives the compact-header rule that hides secondary header buttons');
  assert.ok(desktop.includes('.app.navCollapsed>header>button.navToggle:not(.primary):not(.hamb){left:59px}'),'the toggle arrow re-anchors onto the collapsed rail');
  assert.ok(desktop.includes('body.navCollapsed :where(.auditPortal,.settingsPortal,.helpPortal,.pc,.transactionPortal){left:72px}'),'portaled shell chrome follows the rail');
  assert.ok(desktop.includes('body.navCollapsed .itemCreatePage .itemDialogFooter{left:calc(72px + clamp(16px,2.2vw,24px))}'),'the fixed item action bar follows the rail');
  assert.ok(desktop.includes('body.navCollapsed .guideBackdrop{left:72px!important}'),'the guide backdrop starts after the rail');
  assert.ok(desktop.includes('.app.navCollapsed .erpNavigation .navGroup>ul{display:none}'),'nested lists fold away in rail mode');
  assert.ok(desktop.includes('.app.navCollapsed .erpNavigation :is(.navLeaf,.navGroupButton){flex-direction:column;justify-content:center;gap:3px'),'rail buttons stack the icon over the label');
  assert.ok(desktop.includes('.app.navCollapsed .erpNavigation :is(.navLeaf,.navGroupButton)>span{display:-webkit-box')&&desktop.includes('-webkit-line-clamp:2'),'rail buttons reveal the menu name under the icon');
  assert.ok(!/\.app\.navCollapsed \.erpNavigation :is\(\.navLeaf,\.navGroupButton\)>span\{[^}]*display:none/.test(desktop),'rail labels are never hidden');
  const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  assert.match(navigation,/if\(collapsed\)\{const box=event\.currentTarget\.getBoundingClientRect\(\);setRailMenu\(/,'a compact group opens its submenu flyout instead of expanding the rail');
  assert.match(navigation,/className="railSubmenu"/,'the rail renders a submenu flyout for grouped sections');
  const beforeDesktop=navigationCss.slice(0,desktopStart);
  assert.ok(!beforeDesktop.includes('.app.navCollapsed>aside'),'the sidebar never collapses under the mobile drawer breakpoint, where the hamburger owns it');
  assert.ok(!/\.app\.navCollapsed[^>]*\{/.test(beforeDesktop.replace(/\/\*[\s\S]*?\*\//g,'')),'no collapsed geometry rule exists outside the desktop block');
  assert.ok(/\.app>aside\{display:flex;flex-direction:column/.test(navigationCss),'the sidebar keeps its base flex layout');
});