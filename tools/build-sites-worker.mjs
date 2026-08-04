import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from '../server/domain.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const serverDir = path.join(dist, 'server');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function collectFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return relative === 'server' ? [] : collectFiles(absolute, relative);
    return [{ relative: `/${relative.replaceAll(path.sep, '/')}`, absolute }];
  });
}

const assets = Object.fromEntries(collectFiles(dist).map(({ relative, absolute }) => [
  relative,
  {
    type: mimeTypes[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
    body: fs.readFileSync(absolute).toString('base64'),
  },
]));
const demoState = createInitialStore();

const worker = `
const ASSETS = ${JSON.stringify(assets)};
const DEMO_STATE = ${JSON.stringify(demoState)};
const sessions = new Map();
const roles = {
  learner: { userId: 'user-learner-demo', role: 'learner', name: 'Lerato Mokoena', organisationId: null },
  staff: { userId: 'user-reviewer', role: 'staff_supervisor', name: 'Thandi Mokoena', organisationId: 'org-gcon' },
  employer: { userId: 'user-employer', role: 'employer_coordinator', name: 'GCON Placement Team', organisationId: 'org-gcon' },
  admin: { userId: 'user-admin', role: 'platform_admin', name: 'Platform Administrator', organisationId: 'org-gcon' },
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function tokenFor(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function actorFor(request) {
  return sessions.get(tokenFor(request)) || null;
}

async function api(request, url) {
  if (request.method === 'POST' && url.pathname === '/v1/auth/demo-login') {
    const body = await request.json().catch(() => ({}));
    const actor = roles[body.role] || roles.learner;
    const token = 'gcon-site-demo-' + actor.role;
    sessions.set(token, actor);
    return json({ token, user: actor, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() });
  }
  if (request.method === 'GET' && url.pathname === '/v1/intake/current') return json({ cycle: DEMO_STATE.cycle });
  if (request.method === 'POST' && url.pathname === '/v1/auth/logout') return json({ loggedOut: true });

  const actor = actorFor(request);
  if (!actor) return json({ error: 'Authentication required' }, 401);
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') return json(actor);
  if (request.method === 'GET' && url.pathname === '/v1/state') return json(DEMO_STATE);
  if (request.method === 'GET' && url.pathname === '/v1/applications/me') {
    return json({ application: DEMO_STATE.applications.find((item) => item.ownerUserId === actor.userId) || null });
  }
  if (request.method === 'GET' && url.pathname === '/v1/notifications') return json({ notifications: [] });
  if (request.method === 'GET' && url.pathname === '/v1/communications') return json({ communications: DEMO_STATE.communications });
  if (request.method === 'GET' && url.pathname === '/v1/audit') return json({ entries: DEMO_STATE.auditLog });
  if (request.method === 'GET' && url.pathname === '/v1/storage/status') return json({ provider: 'Sites hosted demo', mode: 'static-demo' });
  if (request.method === 'POST' || request.method === 'PATCH') return json({ ok: true });
  return json({ error: 'Not found' }, 404);
}

function assetResponse(asset) {
  const binary = atob(asset.body);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Response(bytes, { headers: { 'content-type': asset.type, 'cache-control': 'no-cache' } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/')) return api(request, url);
    const asset = ASSETS[url.pathname] || (!url.pathname.includes('.') ? ASSETS['/index.html'] : null);
    return asset ? assetResponse(asset) : new Response('Not found', { status: 404 });
  },
};
`;

fs.mkdirSync(serverDir, { recursive: true });
fs.writeFileSync(path.join(serverDir, 'index.js'), worker.trimStart());
console.log(`Sites worker generated: ${Object.keys(assets).length} assets`);
