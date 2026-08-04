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
  if (request.method === 'GET' && url.pathname === '/v1/notifications') return json({ notifications: DEMO_STATE.notifications.filter((item) => item.userId === actor.userId) });
  if (request.method === 'GET' && url.pathname === '/v1/communications') return json({ communications: DEMO_STATE.communications });
  if (request.method === 'GET' && url.pathname === '/v1/audit') return json({ entries: DEMO_STATE.auditLog });
  if (request.method === 'GET' && url.pathname === '/v1/storage/status') return json({ provider: 'Sites hosted demo', mode: 'static-demo' });
  if (request.method === 'POST' && url.pathname === '/v1/reviews/mass-decline') {
    if (!['platform_admin', 'staff_reviewer', 'staff_supervisor'].includes(actor.role)) return json({ error: 'Staff access required' }, 403);
    const body = await request.json().catch(() => ({}));
    const refs = Array.isArray(body.refs) ? [...new Set(body.refs.map((ref) => String(ref || '').trim()).filter(Boolean))] : [];
    const reason = String(body.reason || '').trim();
    const applications = refs.map((ref) => DEMO_STATE.applications.find((item) => item.ref === ref));
    if (!refs.length || !reason || applications.some((item) => !item || !['Under review', 'Correction requested'].includes(item.status))) return json({ error: 'Select eligible applications and provide a reason' }, 409);
    const now = new Date().toISOString();
    const communication = { id: 'site-demo-communication-' + Date.now(), audience: 'Declined applicants', template: 'Mass decline outcome', channel: 'in_app', cycleId: DEMO_STATE.cycle.id, issuedAt: now, issuedBy: actor.userId, deliveryStatus: 'sent', provider: 'sites-hosted-demo', recipientCount: applications.length };
    DEMO_STATE.communications.unshift(communication);
    for (const application of applications) {
      application.status = 'Declined';
      application.updated = now;
      application.declineReason = reason;
      application.releasedToOrganisationIds = [];
      DEMO_STATE.notifications.unshift({ id: 'site-demo-notification-' + application.ref, userId: application.ownerUserId, applicationRef: application.ref, communicationId: communication.id, channel: 'in_app', status: 'sent', queuedAt: now, sentAt: now, provider: communication.provider, subject: 'Application outcome available · ' + DEMO_STATE.cycle.name, message: 'Your application was not approved for the next stage. Reason: ' + reason });
      DEMO_STATE.auditLog.unshift({ id: 'site-demo-audit-' + application.ref, time: now, event: 'Application declined by mass action', actor: actor.name, actorUserId: actor.userId, organisationId: actor.organisationId, ref: application.ref, reason, communicationId: communication.id });
    }
    DEMO_STATE.auditLog.unshift({ id: 'site-demo-audit-bulk-' + Date.now(), time: now, event: 'Applications mass declined', actor: actor.name, actorUserId: actor.userId, organisationId: actor.organisationId, ref: DEMO_STATE.cycle.id, reason: applications.length + ' applications; in-app notifications created', communicationId: communication.id });
    return json({ summary: { requested: applications.length, declined: applications.length, notificationsCreated: applications.length }, communication, state: DEMO_STATE });
  }
  const placementMatch = url.pathname.match(new RegExp('^/v1/placements/([^/]+)/(prepare|response|termination-letter)$'));
  if (placementMatch && request.method === 'POST') {
    const ref = decodeURIComponent(placementMatch[1]);
    const action = placementMatch[2];
    const application = DEMO_STATE.applications.find((item) => item.ref === ref);
    if (!application) return json({ error: 'Application not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    if (action === 'prepare') {
      if (!['platform_admin', 'staff_reviewer', 'staff_supervisor'].includes(actor.role)) return json({ error: 'Staff access required' }, 403);
      if (!['Shortlisted', 'Placement ready', 'Placed'].includes(application.status)) return json({ error: 'Only shortlisted candidates can receive a placement offer' }, 409);
      const campus = String(body.campus || application.placementCampus || application.preferences?.[0] || 'Ann Latsky Campus').trim();
      application.placementCampus = campus;
      application.placementOffer = { status: 'prepared', campus, preparedAt: now, preparedBy: actor.userId };
      application.status = 'Placement ready';
      application.releasedToOrganisationIds = [application.organisationId];
      application.updated = now;
      DEMO_STATE.auditLog.unshift({ id: 'site-demo-placement-' + Date.now(), time: now, event: 'Placement offer prepared', actor: actor.name, actorUserId: actor.userId, organisationId: actor.organisationId, ref, reason: campus });
      return json({ application, state: DEMO_STATE });
    }
    if (action === 'response') {
      if (!['employer_member', 'employer_coordinator', 'platform_admin'].includes(actor.role)) return json({ error: 'Employer access required' }, 403);
      if (application.status !== 'Placement ready') return json({ error: 'Placement offer is not ready for an employer response' }, 409);
      if (!['accepted', 'declined'].includes(body.response)) return json({ error: 'Placement response must be accepted or declined' }, 400);
      application.placementResponse = body.response;
      application.placementCampus = body.campus || application.placementCampus;
      application.status = body.response === 'accepted' ? 'Placed' : 'Placement ready';
      application.updated = now;
      DEMO_STATE.auditLog.unshift({ id: 'site-demo-response-' + Date.now(), time: now, event: 'Employer placement ' + body.response, actor: actor.name, actorUserId: actor.userId, organisationId: actor.organisationId, ref, reason: application.placementCampus });
      return json({ application, state: DEMO_STATE });
    }
    if (!['platform_admin', 'staff_reviewer', 'staff_supervisor'].includes(actor.role)) return json({ error: 'Staff access required' }, 403);
    if (application.status !== 'Withdrawn') return json({ error: 'Termination letters are only available for withdrawn applications' }, 409);
    application.terminationLetter = { status: 'recorded', filename: body.filename || 'termination-' + ref + '.pdf', notes: body.notes || '', recordedAt: now, recordedBy: actor.userId };
    DEMO_STATE.auditLog.unshift({ id: 'site-demo-termination-' + Date.now(), time: now, event: 'Termination letter recorded', actor: actor.name, actorUserId: actor.userId, organisationId: actor.organisationId, ref });
    return json({ application, state: DEMO_STATE });
  }
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
