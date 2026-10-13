import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {readFileSync} from 'node:fs';
import {DEFAULT_HOST,DEFAULT_PORT,isPortFree,pickFreePort,readRequestedPort} from '../scripts/dev-local.mjs';

const source=readFileSync(new URL('../scripts/dev-local.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

const bindOnce=()=>new Promise((resolve)=>{const server=net.createServer();server.listen(0,DEFAULT_HOST,()=>resolve(server));});
const close=(server)=>new Promise((resolve)=>server.close(resolve));

test('the local preview defaults to port 5173 on every interface',()=>{
  assert.equal(DEFAULT_PORT,5173);
  assert.equal(DEFAULT_HOST,'0.0.0.0');
  assert.equal(readRequestedPort([],{}),5173);
});

test('the requested port comes from --port, DEV_PORT or PORT and ignores nonsense',()=>{
  assert.equal(readRequestedPort(['--port','5183'],{}),5183);
  assert.equal(readRequestedPort(['--port=5184'],{}),5184);
  assert.equal(readRequestedPort(['-p','5185'],{}),5185);
  assert.equal(readRequestedPort([],{DEV_PORT:'5186'}),5186);
  assert.equal(readRequestedPort([],{PORT:'5187'}),5187);
  assert.equal(readRequestedPort(['--port','5188'],{DEV_PORT:'5189'}),5188);
  assert.equal(readRequestedPort(['--port','nonsense'],{}),5173);
  assert.equal(readRequestedPort(['--port','0'],{}),5173);
});

test('a taken port is reported as busy and skipped instead of failing the preview',async()=>{
  const server=await bindOnce();
  const taken=server.address().port;
  try{
    assert.equal(await isPortFree(taken),false);
    const picked=await pickFreePort(taken);
    assert.notEqual(picked,taken);
    assert.ok(picked>taken,'the next free port is searched upwards');
    assert.equal(await isPortFree(picked),true);
  }finally{await close(server);}
  assert.equal(await isPortFree(taken),true);
});

test('package.json adds the launcher without moving the pinned dev and preview ports',()=>{
  assert.equal(pkg.scripts['dev:local'],'node scripts/dev-local.mjs');
  assert.equal(pkg.scripts.dev,'vite --host 0.0.0.0 --port 4001 --strictPort');
  assert.equal(pkg.scripts.preview,'vite preview --port 4001 --strictPort');
});

test('the launcher probes the port and installs the realpath fallback before Vite loads',()=>{
  assert.match(source,/realpathNative/);
  assert.match(source,/net\.createServer/);
  assert.match(source,/"--port",\s*String\(port\),\s*"--strictPort"/);
  assert.doesNotMatch(source,/"--port",\s*"4001"/);
});