import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dockerfile=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');
const compose=readFileSync(new URL('../docker-compose.yml',import.meta.url),'utf8');
const nginx=readFileSync(new URL('../docker/nginx.conf',import.meta.url),'utf8');
const dockerignore=readFileSync(new URL('../.dockerignore',import.meta.url),'utf8');
const pkg=readFileSync(new URL('../package.json',import.meta.url),'utf8');

test('the VM image builds the Vite client and serves it with nginx',()=>{
  assert.match(dockerfile,/FROM node:22-alpine AS build/);
  assert.match(dockerfile,/RUN npm ci/);
  assert.match(dockerfile,/RUN npm run build/);
  assert.match(dockerfile,/FROM nginx:1\.27-alpine/);
  assert.match(dockerfile,/COPY --from=build \/app\/dist\/client \/usr\/share\/nginx\/html/);
  assert.doesNotMatch(dockerfile,/Sites/);
});

test('compose publishes the prototype on a VM host port',()=>{
  assert.match(compose,/WAYVIDA_PORT:-4002/);
  assert.match(compose,/container_name: wayvida-books/);
  assert.match(compose,/restart: unless-stopped/);
  assert.match(pkg,/"docker:up": "docker compose up --build -d"/);
  assert.match(pkg,/"docker:down": "docker compose down"/);
});

test('nginx keeps the Sites SPA fallback and does not rewrite API requests',()=>{
  assert.match(nginx,/try_files \$uri \$uri\/ \/index.html/);
  assert.match(nginx,/location \/api\//);
  assert.match(nginx,/return 404/);
  assert.match(dockerignore,/^node_modules$/m);
  assert.match(dockerignore,/^dist$/m);
});

test('nginx never serves the HTML shell as a JavaScript module',()=>{
  assert.match(nginx,/location \/assets\//);
  assert.match(nginx,/try_files \$uri =404/);
  assert.match(nginx,/application\/javascript js mjs/);
  assert.match(nginx,/location = \/index.html/);
});
