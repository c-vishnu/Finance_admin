import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const form=readFileSync(new URL('../src/EnterpriseAccountForm.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/account-create-drawer.css',import.meta.url),'utf8');

test('Create Account opens as a right-side drawer instead of a centred card',()=>{
 for(const token of ['position:fixed;z-index:1;top:0;right:0;bottom:0;left:auto','width:min(560px,100vw)','height:100%','border-left:1px solid #dfe6ef','border-radius:0','flex-direction:column'])assert.ok(css.includes(token),token);
 assert.ok(css.includes('.am-create-drawer-layer{position:fixed;inset:0;z-index:1200;display:flex;align-items:stretch;justify-content:flex-end}'),'the layer anchors the drawer to the right edge');
 assert.ok(css.includes('.am-create-drawer{position:fixed'),'the drawer is pinned to the viewport, not floated in a flex centre');
 assert.ok(!css.includes('min-width:340px')&&!css.includes('max-height:calc(100dvh - 48px)'),'the old floating-card geometry is gone');
 assert.ok(form.includes('<aside className="am-create-drawer" role="dialog" aria-modal="true" aria-label="Create Account">'),'the drawer keeps its dialog semantics');
});

test('the drawer carries its own header, title and close control',()=>{
 assert.ok(form.includes('<div className="am-create-drawer-header">'),'a header block renders above the form');
 assert.ok(form.indexOf('am-create-drawer-header')<form.indexOf('am-create-drawer-form'),'the header sits outside the scrolling form');
 assert.ok(form.includes("<h2>{form.id?'Edit Account':'Create Account'}</h2>"),'the title still serves create and edit');
 assert.ok(form.includes('className="am-create-drawer-close" aria-label="Close create account" onClick={close}'),'the header close button calls the same close handler as the backdrop');
 assert.ok(!form.includes('am-create-drawer-page-title'),'the duplicate in-body title is removed');
 assert.ok(form.includes('<button type="button" className="am-drawer-cancel" onClick={close}>Cancel</button>'),'the footer keeps its cancel action');
 const rules=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const sizes=[...rules.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length>=5&&Math.min(...sizes)>=12,'every drawer label, helper line and field stays at least 12px');
});
