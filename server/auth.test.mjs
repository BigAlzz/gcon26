import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptInvitation, authenticateLocal, createInvitation, ensureAuthState, resolveActor } from './auth.mjs';
import { createInitialStore, ORG_GCON, ROLES } from './domain.mjs';

const requestWith = (headers = {}) => ({ headers });

test('accepts demo identities only in demo mode', () => {
  const previous = process.env.GCON_AUTH_MODE;
  process.env.GCON_AUTH_MODE = 'demo';
  assert.equal(resolveActor(requestWith({ authorization: 'Bearer demo-learner' }))?.userId, 'user-learner-demo');
  process.env.GCON_AUTH_MODE = 'external';
  assert.equal(resolveActor(requestWith({ authorization: 'Bearer demo-learner' })), null);
  assert.equal(resolveActor(requestWith({ 'x-demo-role': 'staff' })), null);
  if (previous === undefined) delete process.env.GCON_AUTH_MODE;
  else process.env.GCON_AUTH_MODE = previous;
});

test('local login creates an expiring session with membership-derived role', () => {
  const store = createInitialStore();
  ensureAuthState(store);
  const session = authenticateLocal(store, 'thandi.mokoena@gcon.example', 'staff-demo');
  assert.equal(session.user.role, ROLES.STAFF_REVIEWER);
  assert.equal(resolveActor(requestWith({ authorization: `Bearer ${session.token}` }), store).userId, 'user-reviewer');
  store.sessions[session.token].expiresAt = new Date(Date.now() - 1).toISOString();
  assert.equal(resolveActor(requestWith({ authorization: `Bearer ${session.token}` }), store), null);
});

test('supervisors can invite and a member can accept into the organisation', () => {
  const store = createInitialStore();
  ensureAuthState(store);
  const supervisor = { userId: 'user-reviewer', role: ROLES.STAFF_SUPERVISOR, organisationId: ORG_GCON, name: 'Thandi Mokoena' };
  const invitation = createInvitation(store, supervisor, { email: 'new.member@gcon.example', name: 'New Member', role: ROLES.EMPLOYER_MEMBER });
  const session = acceptInvitation(store, { token: invitation.token, password: 'member-pass-1' });
  assert.equal(session.user.role, ROLES.EMPLOYER_MEMBER);
  assert.equal(store.memberships.some((item) => item.userId === session.user.userId && item.organisationId === ORG_GCON), true);
});
