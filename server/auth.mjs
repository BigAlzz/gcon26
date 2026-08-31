import crypto from 'node:crypto';
import { actorFromToken, normalizeApplicationIdNumber, ORG_GCON, ROLES } from './domain.mjs';

const roleAliases = new Map([
  ['learner', 'demo-learner'],
  ['staff', 'demo-staff'],
  ['employer', 'demo-employer'],
  ['admin', 'demo-admin'],
]);

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_PASSWORDS = Object.freeze({
  'user-learner-demo': 'learner-demo',
  'user-reviewer': 'staff-demo',
  'user-employer': 'employer-demo',
  'user-admin': 'admin-demo',
});
const ROLE_PRIORITY = [ROLES.ADMIN, ROLES.STAFF_SUPERVISOR, ROLES.STAFF_REVIEWER, ROLES.EMPLOYER_COORDINATOR, ROLES.EMPLOYER_MEMBER, ROLES.LEARNER];
const INVITABLE_ROLES = new Set([ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR, ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR]);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function ensureAuthState(state) {
  state.authUsers ||= {};
  state.sessions ||= {};
  state.invitations ||= [];
  let changed = false;
  for (const [userId, password] of Object.entries(LOCAL_PASSWORDS)) {
    if (state.users?.some((user) => user.id === userId) && !state.authUsers[userId]) {
      state.authUsers[userId] = { passwordHash: hashPassword(password), createdAt: new Date().toISOString(), source: 'local-development-seed' };
      changed = true;
    }
  }
  return changed;
}

function userRole(state, user) {
  const memberships = (state.memberships || []).filter((membership) => membership.userId === user?.id && membership.status === 'active');
  const membershipRoles = new Set(memberships.map((membership) => membership.role));
  const membershipRole = ROLE_PRIORITY.find((role) => membershipRoles.has(role));
  if (membershipRole) return membershipRole;
  return ROLE_PRIORITY.find((role) => (user?.roles || []).includes(role)) || null;
}

export function actorForUser(state, userId) {
  const user = (state?.users || []).find((item) => item.id === userId);
  const role = userRole(state, user);
  if (!user || !role) return null;
  const membership = (state.memberships || []).find((item) => item.userId === user.id && item.status === 'active' && item.role === role);
  return { userId: user.id, role, organisationId: membership?.organisationId || (role === ROLES.LEARNER ? null : ORG_GCON), name: user.name, email: user.email };
}

function publicSession(actor, token, expiresAt) {
  return { token, expiresAt, user: { userId: actor.userId, role: actor.role, organisationId: actor.organisationId, name: actor.name, email: actor.email } };
}

export function authenticateLocal(state, email, password) {
  ensureAuthState(state);
  const identifier = String(email || '').trim().toLowerCase();
  const user = (state.users || []).find((item) => item.email?.toLowerCase() === identifier || item.username?.toLowerCase() === identifier);
  const credentials = user && state.authUsers[user.id];
  if (!user || !credentials || !verifyPassword(password, credentials.passwordHash)) return null;
  const actor = actorForUser(state, user.id);
  if (!actor) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  state.sessions[token] = { userId: actor.userId, createdAt: new Date().toISOString(), expiresAt };
  return publicSession(actor, token, expiresAt);
}

export function registerLearner(state, { username, password, name = '', email = '' } = {}) {
  ensureAuthState(state);
  const normalizedUsername = String(username || '').replace(/\s+/g, '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^\d{13}$/.test(normalizedUsername)) throw Object.assign(new Error('Username must be a 13-digit South African ID number'), { status: 400 });
  if (String(password || '').length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  if (normalizedEmail && !normalizedEmail.includes('@')) throw Object.assign(new Error('Email address is invalid'), { status: 400 });
  const existing = (state.users || []).find((item) => item.username === normalizedUsername || (normalizedEmail && item.email?.toLowerCase() === normalizedEmail));
  if (existing) throw Object.assign(new Error('An applicant account already exists for these details'), { status: 409 });
  const duplicateApplication = (state.applications || []).some((item) => item.status !== 'Draft' && normalizeApplicationIdNumber(item.id || item.profile?.idNumber) === normalizedUsername);
  if (duplicateApplication) throw Object.assign(new Error('An application already exists for this ID number for this intake'), { status: 409 });
  const user = { id: `user-${crypto.randomUUID()}`, username: normalizedUsername, name: String(name || 'Applicant').trim().slice(0, 160), email: normalizedEmail, roles: [ROLES.LEARNER], organisationIds: [] };
  state.users.push(user);
  state.authUsers[user.id] = { passwordHash: hashPassword(password), createdAt: new Date().toISOString(), source: 'learner-registration' };
  return authenticateLocal(state, normalizedUsername, password);
}

export function endSession(state, token) {
  if (token && state?.sessions?.[token]) delete state.sessions[token];
}

export function createInvitation(state, actor, { email, name = '', role, organisationId = actor?.organisationId } = {}) {
  if (![ROLES.ADMIN, ROLES.STAFF_SUPERVISOR].includes(actor?.role)) throw Object.assign(new Error('Only administrators or staff supervisors can invite members'), { status: 403 });
  if (!INVITABLE_ROLES.has(role)) throw Object.assign(new Error('This role cannot be invited'), { status: 400 });
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) throw Object.assign(new Error('A valid email address is required'), { status: 400 });
  if (organisationId !== actor.organisationId) throw Object.assign(new Error('Invitation organisation is outside your scope'), { status: 403 });
  const token = crypto.randomBytes(24).toString('base64url');
  const invitation = { id: crypto.randomUUID(), token, email: normalizedEmail, name: String(name || '').trim().slice(0, 160), role, organisationId, status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(), invitedBy: actor.userId };
  state.invitations.unshift(invitation);
  return invitation;
}

export function acceptInvitation(state, { token, name, password } = {}) {
  const invitation = (state.invitations || []).find((item) => item.token === token && item.status === 'pending');
  if (!invitation || new Date(invitation.expiresAt) < new Date()) throw Object.assign(new Error('Invitation is invalid or expired'), { status: 400 });
  if (String(password || '').length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  let user = (state.users || []).find((item) => item.email?.toLowerCase() === invitation.email);
  if (!user) {
    user = { id: `user-${crypto.randomUUID()}`, name: String(name || invitation.name || invitation.email).trim().slice(0, 160), email: invitation.email, roles: [invitation.role], organisationIds: [invitation.organisationId] };
    state.users.push(user);
  } else {
    user.roles ||= [];
    if (!user.roles.includes(invitation.role)) user.roles.push(invitation.role);
  }
  user.organisationIds ||= [];
  if (!user.organisationIds.includes(invitation.organisationId)) user.organisationIds.push(invitation.organisationId);
  state.memberships ||= [];
  const existingMembership = state.memberships.find((item) => item.userId === user.id && item.organisationId === invitation.organisationId && item.role === invitation.role);
  if (existingMembership) existingMembership.status = 'active';
  else state.memberships.push({ userId: user.id, organisationId: invitation.organisationId, role: invitation.role, status: 'active' });
  state.authUsers ||= {};
  state.authUsers[user.id] = { passwordHash: hashPassword(password), createdAt: new Date().toISOString(), source: 'invitation' };
  invitation.status = 'accepted';
  invitation.acceptedAt = new Date().toISOString();
  invitation.acceptedUserId = user.id;
  return authenticateLocal(state, invitation.email, password);
}

export function resolveActor(request, state) {
  const authorization = request.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (state && bearer && state.sessions?.[bearer]) {
    const session = state.sessions[bearer];
    if (new Date(session.expiresAt) <= new Date()) {
      delete state.sessions[bearer];
      return null;
    }
    return actorForUser(state, session.userId);
  }
  const demoRole = request.headers['x-demo-role'];
  const authMode = process.env.GCON_AUTH_MODE || 'demo';
  const requestedDemoToken = bearer.startsWith('demo-') || Boolean(demoRole);
  if (authMode !== 'demo' && requestedDemoToken) return null;
  const token = bearer || roleAliases.get(String(demoRole || '').toLowerCase());
  const actor = actorFromToken(token);
  if (!actor || authMode !== 'demo') return null;
  return { ...actor, name: actor.role === ROLES.LEARNER ? 'Lerato Mokoena' : actor.role === ROLES.EMPLOYER_COORDINATOR ? 'GCON Placement Team' : actor.role === ROLES.ADMIN ? 'Platform Administrator' : 'Thandi Mokoena' };
}

export function requireActor(request, state) {
  const actor = resolveActor(request, state);
  if (!actor) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }
  return actor;
}

export function requireRoles(actor, roles) {
  if (!roles.includes(actor.role)) {
    const error = new Error('Insufficient permissions');
    error.status = 403;
    throw error;
  }
}

export { SESSION_TTL_MS };
