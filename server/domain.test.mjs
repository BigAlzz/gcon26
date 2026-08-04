import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReviewDecision, canReadApplication, createInitialStore, isIntakeOpen, isReviewableApplication, issueCommunication, nextReference, recordInterviewOutcome, recordNonQualifierContact, recordPlacementResponse, recordStaffPlacement, recordTerminationLetter, reviewDocument, ROLES, saveDraft, submitApplication, updateIntakeCycle, visibleState } from './domain.mjs';

const staff = { userId: 'user-reviewer', role: ROLES.STAFF_REVIEWER, organisationId: 'org-gcon', name: 'Thandi Mokoena' };
const supervisor = { userId: 'user-reviewer', role: ROLES.STAFF_SUPERVISOR, organisationId: 'org-gcon', name: 'Thandi Mokoena' };
const employer = { userId: 'user-employer', role: ROLES.EMPLOYER_COORDINATOR, organisationId: 'org-gcon', name: 'GCON Placement Team' };
const learner = { userId: 'user-learner-demo', role: ROLES.LEARNER, organisationId: null, name: 'Lerato Mokoena' };

test('daily references are sequential and reset by date', () => {
  const store = createInitialStore();
  store.referenceCounters = {};
  assert.equal(nextReference(store), 'GCON20260731-01');
  assert.equal(nextReference(store), 'GCON20260731-02');
  store.cycle.referenceDate = '2026-08-01';
  assert.equal(nextReference(store), 'GCON20260801-01');
});

test('learner visibility is self-only and employer visibility requires release', () => {
  const store = createInitialStore();
  const own = store.applications.find((application) => application.ownerUserId === learner.userId);
  const unreleased = store.applications.find((application) => application.releasedToOrganisationIds.length === 0 && application.ownerUserId !== learner.userId);
  const released = store.applications.find((application) => application.releasedToOrganisationIds.includes('org-gcon'));
  assert.equal(canReadApplication(learner, own), true);
  assert.equal(canReadApplication(learner, unreleased), false);
  assert.equal(canReadApplication(employer, released), true);
  assert.equal(canReadApplication(employer, own), false);
  assert.equal(canReadApplication(employer, unreleased), false);
  assert.equal(visibleState(store, learner).applications.every((application) => !('ownerUserId' in application)), true);
  assert.equal(visibleState(store, employer).applications.every((application) => !('releasedToOrganisationIds' in application)), true);
});

test('employer visible state keeps released candidates after sanitisation', () => {
  const store = createInitialStore();
  const visible = visibleState(store, employer);
  assert.ok(visible.applications.length > 0);
  assert.equal(visible.applications.every((application) => !('releasedToOrganisationIds' in application)), true);
  assert.equal(visible.employer.visibleApplicants, visible.applications.length);
});

test('staff decisions record reasons and release approved candidates', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Under review');
  applyReviewDecision(store, staff, application.ref, 'approve', 'Manual evidence review complete');
  assert.equal(application.status, 'Shortlisted');
  assert.deepEqual(application.releasedToOrganisationIds, ['org-gcon']);
  assert.match(store.auditLog[0].event, /approved/);
});

test('staff correction requests preserve a reason and keep the candidate unreleased', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Under review');
  applyReviewDecision(store, staff, application.ref, 'correction', 'Please upload a clearer statement of results.');
  assert.equal(application.status, 'Correction requested');
  assert.equal(application.correctionRequest.reason, 'Please upload a clearer statement of results.');
  assert.deepEqual(application.releasedToOrganisationIds, []);
});

test('employer can respond only to a released placement', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Shortlisted');
  recordStaffPlacement(store, staff, application.ref, 'Ann Latsky Campus');
  recordPlacementResponse(store, employer, application.ref, 'accepted', 'Ann Latsky Campus');
  assert.equal(application.status, 'Placed');
  assert.equal(application.placementResponse, 'accepted');
  assert.equal(application.placementCampus, 'Ann Latsky Campus');
});

test('employer cannot respond to a shortlist before staff prepares an offer', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Shortlisted');
  assert.throws(() => recordPlacementResponse(store, employer, application.ref, 'accepted', 'Ann Latsky Campus'), /Placement offer is not ready/);
});

test('a learner cannot create a second submitted application in the same intake', () => {
  const store = createInitialStore();
  const first = submitApplication(store, learner, { pathway: 'NSC / Grade 12' });
  assert.throws(() => submitApplication(store, learner, { pathway: 'NSC / Grade 12' }), /submitted application already exists/);
  assert.equal(first.status, 'Under review');
});

test('submissions respect the configured intake status and dates', () => {
  const store = createInitialStore();
  assert.equal(isIntakeOpen(store.cycle, new Date('2026-08-04T10:00:00Z')), true);
  store.cycle.advertStatus = 'Paused';
  assert.throws(() => submitApplication(store, learner, { pathway: 'NSC / Grade 12' }), /not currently open/);
  store.cycle.advertStatus = 'Published';
  assert.equal(isIntakeOpen(store.cycle, new Date('2026-09-27T00:00:00Z')), false);
});

test('supervisors can update annual intake settings and the change is audited', () => {
  const store = createInitialStore();
  const cycle = updateIntakeCycle(store, supervisor, {
    name: 'GCON 2028 Winter Intake',
    openDate: '2027-05-01',
    closeDate: '2027-07-31',
    status: 'Paused',
    documentTypes: ['Identity document', 'Final results certificate'],
    requirements: { 'NSC / Grade 12': 'Approved NSC wording for this cycle.' },
  });
  assert.equal(cycle.name, 'GCON 2028 Winter Intake');
  assert.equal(cycle.openDate, '2027-05-01');
  assert.equal(cycle.advertStatus, 'Paused');
  assert.deepEqual(cycle.documentTypes, ['Identity document', 'Final results certificate']);
  assert.equal(cycle.requirements['NSC / Grade 12'], 'Approved NSC wording for this cycle.');
  assert.match(store.auditLog[0].event, /Intake cycle configuration updated/);
});

test('reviewers cannot change annual intake settings', () => {
  const store = createInitialStore();
  assert.throws(() => updateIntakeCycle(store, staff, { status: 'Paused' }), /Only administrators or staff supervisors/);
});

test('submission creates an immutable reference and minimal status state', () => {
  const store = createInitialStore();
  const draft = submitApplication(store, learner, { pathway: 'NSC / Grade 12', pathwayValues: { english: '5', lifeSciences: '5', mathematics: '4', aps: '34.5' }, documents: [] });
  assert.equal(draft.status, 'Under review');
  assert.match(draft.ref, /^GCON\d{8}-\d{2}$/);
  assert.equal(typeof draft.submittedAt, 'string');
});

test('draft saves do not create a submission receipt or submitted audit event', () => {
  const store = createInitialStore();
  const draft = saveDraft(store, learner, { pathway: 'NSC / Grade 12', pathwayValues: { english: '5' } });
  assert.equal(draft.status, 'Draft');
  assert.equal(draft.ref, null);
  assert.equal(draft.submittedAt, undefined);
  assert.match(store.auditLog[0].event, /draft saved/);
});

test('correction drafts retain the correction state until resubmission', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Correction requested');
  saveDraft(store, { ...learner, userId: application.ownerUserId }, { pathwayValues: { statement: 'updated' } });
  assert.equal(application.status, 'Correction requested');
});

test('draft checklist metadata does not replace the document collection', () => {
  const store = createInitialStore();
  const draft = saveDraft(store, learner, { documents: { id: false, results: false } });
  assert.deepEqual(draft.documents, []);
  assert.deepEqual(draft.documentChecklist, { id: false, results: false });
});

test('correction requests leave the queue until the learner resubmits', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Under review');
  applyReviewDecision(store, staff, application.ref, 'correction', 'Please upload a clearer statement of results.');
  assert.equal(isReviewableApplication(application), false);
  submitApplication(store, learner, { pathwayValues: { statement: 'updated' } });
  assert.equal(isReviewableApplication(application), true);
});

test('non-qualifier contact capture does not retain qualification evidence', () => {
  const store = createInitialStore();
  const contact = recordNonQualifierContact(store, learner, { name: 'Lerato Mokoena', email: 'lerato@example.test', telephone: '082 555 0194', pathway: 'NSC / Grade 12', aps: '12' });
  assert.equal(contact.email, 'lerato@example.test');
  assert.equal(store.nonQualifierContacts.length, 1);
  assert.equal('pathway' in store.nonQualifierContacts[0], false);
  assert.equal('aps' in store.nonQualifierContacts[0], false);
});

test('staff document decisions update the application evidence and audit trail', () => {
  const store = createInitialStore();
  const document = store.documents.find((item) => item.state === 'pending');
  reviewDocument(store, staff, document.id, 'correction_required', 'Please upload a clearer statement.');
  assert.equal(document.state, 'correction_required');
  assert.equal(document.reviewReason, 'Please upload a clearer statement.');
  assert.match(store.auditLog[0].event, /correction requested/);
});

test('psychometric outcomes are recorded only after an invitation', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Shortlisted');
  application.interview = { status: 'invited', invitedAt: new Date().toISOString() };
  recordInterviewOutcome(store, staff, application.ref, { outcome: 'passed', score: '82', notes: 'Completed' });
  assert.equal(application.interview.outcome, 'passed');
  assert.equal(application.interview.score, '82');
  assert.match(store.auditLog[0].event, /Psychometric outcome recorded/);
});

test('termination letters are persisted and auditable for withdrawn applications', () => {
  const store = createInitialStore();
  const application = store.applications.find((item) => item.status === 'Shortlisted');
  application.status = 'Withdrawn';
  recordTerminationLetter(store, staff, application.ref, { filename: 'termination.pdf' });
  assert.equal(application.terminationLetter.status, 'recorded');
  assert.equal(application.terminationLetter.filename, 'termination.pdf');
  assert.match(store.auditLog[0].event, /Termination letter recorded/);
});

test('issued communications create delivery-tracked notifications', () => {
  const store = createInitialStore();
  const communication = issueCommunication(store, staff, 'Shortlisted applicants', 'Shortlist confirmation');
  assert.equal(communication.deliveryStatus, 'sent');
  assert.ok(communication.recipientCount > 0);
  assert.equal(store.notifications.every((item) => item.status === 'sent'), true);
  assert.equal(visibleState(store, learner).notifications.length, 0);
});
