import crypto from 'node:crypto';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { addAudit, applyReviewDecision, canReadApplication, createOrUpdateDraft, dashboardMetrics, findApplication, hasRole, isReviewableApplication, issueCommunication, massDeclineApplications, recordInterviewOutcome, recordNonQualifierContact, recordPlacementResponse, recordStaffPlacement, recordTerminationLetter, reviewDocument, saveDraft, submitApplication, updateIntakeCycle, visibleState, ROLES, APPLICATION_STATUS } from './server/domain.mjs';
import { acceptInvitation, authenticateLocal, createInvitation, endSession, ensureAuthState, requireActor, requireRoles, resolveActor } from './server/auth.mjs';
import { LocalEncryptedStore, providerStatus, publicStoragePath } from './server/storage.mjs';
import { validateChecksum, validateDocumentMetadata, validateUploadedContent } from './server/upload-policy.mjs';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4000);
const store = new LocalEncryptedStore();

const sendJson = (response, status, payload, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-request-id', ...headers });
  response.end(JSON.stringify(payload));
};

const requestId = (request) => request.headers['x-request-id'] || crypto.randomUUID();

function sendError(response, error, id) {
  const status = error.status || 500;
  sendJson(response, status, { error: { code: status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED', message: error.message || 'Request failed', requestId: id } }, { 'x-request-id': id });
}

function readRaw(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => { size += chunk.length; if (size > 12_000_000) { reject(Object.assign(new Error('Request body too large'), { status: 413 })); request.destroy(); return; } chunks.push(chunk); });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function documentResponse(document) {
  if (!document) return null;
  const { ownerUserId, organisationId, ...safe } = document;
  return safe;
}

async function readJson(request) {
  const raw = await readRaw(request);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function routeMatches(url, prefix) {
  return url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
}

function applicationResponse(application) {
  if (!application) return null;
  const { ownerUserId, organisationId, releasedToOrganisationIds, ...safe } = application;
  const copy = { ...safe };
  if (copy.id) copy.id = `${String(copy.id).slice(0, 6)}•••••${String(copy.id).slice(-3)}`;
  return copy;
}

async function handle(request, response) {
  const id = requestId(request);
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,OPTIONS', 'access-control-allow-headers': 'content-type, authorization, x-demo-role, x-request-id, x-idempotency-key' });
      response.end();
      return;
    }
    const url = new URL(request.url || '/', `http://${host}:${port}`);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, service: 'gcon-local-api', storage: providerStatus() }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/health') {
      sendJson(response, 200, { ok: true, service: 'gcon-api', version: 'v1', storage: providerStatus() }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/openapi.json') {
      const contract = JSON.parse(await readFile(new URL('./openapi/v1.json', import.meta.url), 'utf8'));
      sendJson(response, 200, contract, { 'x-request-id': id });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/auth/demo-login') {
      if ((process.env.GCON_AUTH_MODE || 'demo') !== 'demo') throw Object.assign(new Error('Demo login is disabled'), { status: 404 });
      const body = await readJson(request);
      const token = ({ learner: 'demo-learner', staff: 'demo-staff', employer: 'demo-employer', admin: 'demo-admin' })[String(body.role || '').toLowerCase()];
      if (!token) throw Object.assign(new Error('Choose a valid demo role'), { status: 400 });
      const session = resolveActor({ headers: { authorization: `Bearer ${token}` } });
      sendJson(response, 200, { token, user: { userId: session.userId, role: session.role, organisationId: session.organisationId, name: session.name } }, { 'x-request-id': id });
      return;
    }

    const state = store.state;
    if (request.method === 'POST' && url.pathname === '/v1/auth/login') {
      const body = await readJson(request);
      const session = authenticateLocal(state, body.email, body.password);
      if (!session) throw Object.assign(new Error('Email or password is incorrect'), { status: 401 });
      await store.save();
      sendJson(response, 200, session, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/auth/logout') {
      const authorization = request.headers.authorization || '';
      endSession(state, authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
      await store.save();
      sendJson(response, 200, { loggedOut: true }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/auth/invitations/accept') {
      const body = await readJson(request);
      const session = acceptInvitation(state, body);
      await store.save();
      sendJson(response, 200, session, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/intake/current') {
      sendJson(response, 200, { cycle: state.cycle }, { 'x-request-id': id });
      return;
    }

    const actor = requireActor(request, state);

    if (request.method === 'POST' && url.pathname === '/v1/auth/invitations') {
      const invitation = createInvitation(state, actor, await readJson(request));
      addAudit(state, 'Membership invitation created', actor, { ref: invitation.email, reason: invitation.role });
      await store.save();
      sendJson(response, 201, { invitation: { ...invitation, token: invitation.token } }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/auth/invitations') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_SUPERVISOR]);
      sendJson(response, 200, { invitations: state.invitations || [] }, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/v1/state' || url.pathname === '/api/state')) {
      sendJson(response, 200, visibleState(state, actor), { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
      sendJson(response, 200, { userId: actor.userId, role: actor.role, organisationId: actor.organisationId, name: actor.name }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/notifications') {
      sendJson(response, 200, { notifications: state.notifications.filter((item) => item.userId === actor.userId) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/communications') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      sendJson(response, 200, { communications: state.communications || [] }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'PATCH' && url.pathname === '/v1/intake/current') {
      const body = await readJson(request);
      const cycle = updateIntakeCycle(state, actor, body);
      await store.save();
      sendJson(response, 200, { cycle }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/storage/status') {
      sendJson(response, 200, { provider: providerStatus(), localDataFile: publicStoragePath() }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/audit') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      sendJson(response, 200, { entries: state.auditLog }, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/applications/me') {
      requireRoles(actor, [ROLES.LEARNER]);
      const own = state.applications.filter((item) => item.ownerUserId === actor.userId);
      const application = own.find((item) => [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.CORRECTION_REQUESTED].includes(item.status)) || own.toSorted((a, b) => String(b.submittedAt || b.updated || '').localeCompare(String(a.submittedAt || a.updated || '')))[0];
      sendJson(response, 200, { application: applicationResponse(application), cycle: state.cycle }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/applications/non-qualifier') {
      requireRoles(actor, [ROLES.LEARNER]);
      const body = await readJson(request);
      const contact = recordNonQualifierContact(state, actor, body);
      await store.save();
      sendJson(response, 201, { contact: { id: contact.id, cycleId: contact.cycleId, recordedAt: contact.recordedAt } }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'PATCH' && url.pathname === '/v1/applications/me') {
      requireRoles(actor, [ROLES.LEARNER]);
      const body = await readJson(request);
      const application = saveDraft(state, actor, body);
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/applications/submit') {
      requireRoles(actor, [ROLES.LEARNER]);
      const idem = request.headers['x-idempotency-key'];
      if (idem && state.idempotency[idem]) { sendJson(response, 200, state.idempotency[idem], { 'x-request-id': id }); return; }
      const body = await readJson(request);
      const application = submitApplication(state, actor, body);
      const result = { application: applicationResponse(application), receipt: { reference: application.ref, submittedAt: application.submittedAt } };
      if (idem) state.idempotency[idem] = result;
      await store.save();
      sendJson(response, 201, result, { 'x-request-id': id });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/documents/upload-intent') {
      requireRoles(actor, [ROLES.LEARNER, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const body = await readJson(request);
      const metadata = validateDocumentMetadata(body);
      let application = body.ref ? findApplication(state, body.ref) : state.applications.find((item) => item.ownerUserId === actor.userId && ['Draft', 'Correction requested'].includes(item.status));
      if (application && !canReadApplication(actor, application)) throw Object.assign(new Error('Application not found'), { status: 404 });
      if (!application && hasRole(actor, ROLES.LEARNER)) application = createOrUpdateDraft(state, actor, { pathway: body.pathway || 'NSC / Grade 12', pathwayValues: body.pathwayValues || {} });
      if (!application && !hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR)) throw Object.assign(new Error('Application draft not found'), { status: 404 });
      const ref = body.ref || application?.ref || 'draft';
      const documentId = `doc-${crypto.randomUUID()}`;
      const document = { id: documentId, ref, ownerUserId: application?.ownerUserId || actor.userId, organisationId: application?.organisationId || 'org-gcon', type: body.type || 'other', label: body.label || 'Supporting document', filename: String(body.filename || 'upload.bin').slice(0, 255), contentType: metadata.contentType, size: metadata.size, checksum: null, scanState: 'not_uploaded', state: 'upload_pending', objectKey: `applications/${ref}/${documentId}` };
      state.documents.push(document);
      if (application) { if (!Array.isArray(application.documents)) application.documents = []; application.documents.push(document); }
      addAudit(state, 'Document upload intent created', actor, { ref, documentId });
      await store.save();
      sendJson(response, 201, { document: { id: documentId, uploadUrl: `/v1/documents/${documentId}/content`, completeUrl: `/v1/documents/${documentId}/complete`, expiresInSeconds: 900 } }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'PUT' && routeMatches(url, '/v1/documents') && url.pathname.endsWith('/content')) {
      const documentId = url.pathname.split('/')[3];
      const document = state.documents.find((item) => item.id === documentId);
      const staffCanAccess = hasRole(actor, ROLES.ADMIN) || (hasRole(actor, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR) && document?.organisationId === actor.organisationId);
      if (!document || (document.ownerUserId !== actor.userId && !staffCanAccess)) throw Object.assign(new Error('Document not found'), { status: 404 });
      const content = await readRaw(request);
      const contentType = String(request.headers['content-type'] || document.contentType).toLowerCase();
      const uploaded = validateUploadedContent(document, contentType, content);
      const saved = await store.saveDocument(documentId, content);
      document.size = content.length;
      document.contentType = uploaded.contentType;
      document.checksum = uploaded.checksum;
      document.objectKey = saved.objectKey;
      document.state = 'uploaded_pending_scan';
      document.scanState = 'pending';
      document.uploadedAt = new Date().toISOString();
      await store.save();
      sendJson(response, 200, { document: { id: documentId, state: document.state, scanState: document.scanState, size: document.size, checksum: document.checksum } }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/documents') && url.pathname.endsWith('/complete')) {
      const documentId = url.pathname.split('/')[3];
      const body = await readJson(request);
      const document = state.documents.find((item) => item.id === documentId);
      const staffCanAccess = hasRole(actor, ROLES.ADMIN) || (hasRole(actor, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR) && document?.organisationId === actor.organisationId);
      if (!document || (document.ownerUserId !== actor.userId && !staffCanAccess)) throw Object.assign(new Error('Document not found'), { status: 404 });
      validateChecksum(body.checksum, document.checksum);
      document.state = 'pending_review';
      document.scanState = 'pending';
      addAudit(state, 'Document upload completed', actor, { ref: document.ref, documentId });
      await store.save();
      sendJson(response, 200, { document: documentResponse(document) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/documents') && url.pathname.endsWith('/review')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const documentId = url.pathname.split('/')[3];
      const body = await readJson(request);
      const document = reviewDocument(state, actor, documentId, body.decision, body.reason);
      await store.save();
      sendJson(response, 200, { document: documentResponse(document), state: visibleState(state, actor) }, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/reviews/queue') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const queue = state.applications.filter((application) => application.organisationId === actor.organisationId && isReviewableApplication(application)).map(applicationResponse);
      sendJson(response, 200, { applications: queue, count: queue.length }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/reviews') && url.pathname.endsWith('/decision')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = applyReviewDecision(state, actor, ref, body.decision, body.reason);
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/reviews/mass-decline') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const body = await readJson(request);
      const result = massDeclineApplications(state, actor, body.refs, body.reason);
      await store.save();
      sendJson(response, 200, { summary: result.summary, communication: result.communication, state: visibleState(state, actor) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/shortlists') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const body = await readJson(request);
      const application = applyReviewDecision(state, actor, body.ref, body.action === 'remove' ? 'undo' : 'approve', body.reason || 'Shortlist action');
      await store.save();
      sendJson(response, 200, { shortlist: { ref: application.ref, status: application.status }, application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/interviews') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const body = await readJson(request);
      const application = findApplication(state, body.ref);
      if (!application || !canReadApplication(actor, application)) throw Object.assign(new Error('Application not found'), { status: 404 });
      application.interview = { status: 'invited', scheduledAt: body.scheduledAt || null, invitedAt: new Date().toISOString() };
      addAudit(state, 'Psychometric interview invitation queued', actor, { ref: application.ref });
      await store.save();
      sendJson(response, 201, { interview: application.interview, application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'PATCH' && routeMatches(url, '/v1/interviews') && url.pathname.endsWith('/outcome')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = recordInterviewOutcome(state, actor, ref, body);
      await store.save();
      sendJson(response, 200, { interview: application.interview, application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/communications/issue') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const body = await readJson(request);
      const communication = issueCommunication(state, actor, body.audience || 'Shortlisted applicants', body.template);
      await store.save();
      sendJson(response, 200, { lettersIssued: true, communication, state: visibleState(state, actor) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/placements') && url.pathname.endsWith('/prepare')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = recordStaffPlacement(state, actor, ref, body.campus);
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'PATCH' && routeMatches(url, '/v1/applications') && url.pathname.endsWith('/withdrawal')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = findApplication(state, ref);
      if (!application || !canReadApplication(actor, application)) throw Object.assign(new Error('Application not found'), { status: 404 });
      application.status = APPLICATION_STATUS.WITHDRAWN;
      application.withdrawalReason = body.reason || 'Applicant requested withdrawal';
      application.updated = new Date().toISOString();
      addAudit(state, 'Applicant withdrawal recorded', actor, { ref, reason: application.withdrawalReason });
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/placements') && url.pathname.endsWith('/termination-letter')) {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = recordTerminationLetter(state, actor, ref, body);
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/employer/dashboard') {
      requireRoles(actor, [ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR]);
      const candidates = state.applications.filter((application) => canReadApplication(actor, application));
      sendJson(response, 200, { metrics: dashboardMetrics(candidates, actor.organisationId), candidates: candidates.map(applicationResponse) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/v1/employer/candidates') {
      requireRoles(actor, [ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR]);
      const candidates = state.applications.filter((application) => canReadApplication(actor, application));
      sendJson(response, 200, { applications: candidates.map(applicationResponse) }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'POST' && routeMatches(url, '/v1/placements') && url.pathname.endsWith('/response')) {
      requireRoles(actor, [ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR]);
      const ref = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await readJson(request);
      const application = recordPlacementResponse(state, actor, ref, body.response, body.campus);
      await store.save();
      sendJson(response, 200, { application: applicationResponse(application) }, { 'x-request-id': id });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/storage/status') {
      sendJson(response, 200, { provider: 'Azure Blob Storage', mode: providerStatus().mode, readyForProductionBinding: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING), dataFile: publicStoragePath() }, { 'x-request-id': id });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/audit') {
      requireRoles(actor, [ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR]);
      sendJson(response, 200, { entries: state.auditLog }, { 'x-request-id': id });
      return;
    }
    sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, { 'x-request-id': id });
  } catch (error) {
    sendError(response, error, id);
  }
}

await store.load();
if (ensureAuthState(store.state)) await store.save();
const server = http.createServer((request, response) => { void handle(request, response); });
server.listen(port, host, () => console.log(`GCON API listening at http://${host}:${port} (${providerStatus().mode})`));
