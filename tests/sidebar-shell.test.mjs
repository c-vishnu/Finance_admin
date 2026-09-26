import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
const navigationCss=readFileSync(new URL('../src/navigation.css',import.meta.url),'utf8');
const shellCss=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');

test('sidebar uses its full height with hidden-scrollbar navigation and persistent utilities',()=>{
  assert.match(navigationCss,/\.app>aside\{display:flex;flex-direction:column/);
  assert.match(navigationCss,/\.erpNavigation\{flex:1;min-height:0;height:auto/);
  assert.match(navigationCss,/\.erpNavigation>ul\{[^}]*overflow-y:auto/);
  assert.match(navigationCss,/scrollbar-width:none/);
  assert.match(navigationCss,/\.erpNavigation>ul::-webkit-scrollbar\{display:none/);
  assert.match(navigationCss,/\.app>aside>\.brand\{flex:none/);
  assert.match(navigation,/setExpanded\(previous=>\(\{\.\.\.previous,\[id\]:!open\}\)\)/);
  assert.match(navigation,/className="navThemeToggle"/);
  assert.match(navigation,/<\/ul><div className="navSidebarFooter"><div className="navUtilityRow"><button[\s\S]*<WorkingContextSwitcher theme="light"\/><\/div><\/nav>/);
  assert.doesNotMatch(navigation,/className="navThemeFooter"|className="navHelp"/,'Help Center and the old footer controls are removed');
  assert.ok(navigation.includes('className="navThemeToggle" aria-label={dark?\'Switch to light mode\':\'Switch to dark mode\'}'));
  assert.match(navigationCss,/\.navSidebarFooter\{flex:none;display:flex;flex-direction:column;gap:10px/);
  assert.match(navigationCss,/\.navUtilityRow\{display:flex;justify-content:flex-end;min-height:34px/);
  assert.match(navigationCss,/\.navThemeToggle\{display:grid!important;place-items:center;width:34px!important;height:34px!important;[^}]*border-radius:9px!important/,'the compact theme icon sits above the context switcher');
  assert.match(navigationCss,/\.erpNavigation\[data-theme=light\] \.navThemeToggle:hover\{background:#dceaff!important;[^}]*color:#175cd3!important/);
});

test('application shell delegates vertical scrolling to main content',()=>{
  assert.match(shellCss,/html,body,#root\{height:100%;overflow:hidden\}/);
  assert.match(shellCss,/\.app>aside\{height:100dvh;overflow:hidden\}/);
  assert.match(shellCss,/\.app>main\{height:calc\(100dvh - 59px\);[^}]*overflow-y:auto/);
});
