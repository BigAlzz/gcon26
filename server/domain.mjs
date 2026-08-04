import crypto from 'node:crypto';

export const ROLES = Object.freeze({
  LEARNER: 'learner',
  STAFF_REVIEWER: 'staff_reviewer',
  STAFF_SUPERVISOR: 'staff_supervisor',
  EMPLOYER_MEMBER: 'employer_member',
  EMPLOYER_COORDINATOR: 'employer_coordinator',
  ADMIN: 'platform_admin',
});

export const APPLICATION_STATUS = Object.freeze({
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under review',
  CORRECTION_REQUESTED: 'Correction requested',
  SHORTLISTED: 'Shortlisted',
  PLACEMENT_READY: 'Placement ready',
  PLACED: 'Placed',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
});

export const ORG_GCON = 'org-gcon';
export const CYCLE_GCON_2027 = 'cycle-gcon-2027';

export const DEFAULT_CYCLE_REQUIREMENTS = Object.freeze({
  'NSC / Grade 12': 'English Level 4+, Life Sciences Level 4+, Mathematics Level 4 or Maths Literacy Level 5+, reported APS 27+.',
  'Senior Certificate': 'English, Biology and Mathematics in the approved HG/SG pass bands, plus M score 17+.',
  'NC(V) Level 4': 'Fundamentals at 50%+, with each named vocational subject at 60%+.',
});

const defaultCommunicationMessages = Object.freeze({
  'Psychometric test invitation': 'Your psychometric assessment invitation will be available in your applicant communication history.',
  'Shortlist confirmation': 'Your application has been approved for the next evaluation stage.',
  'Decline outcome': 'Your application outcome is available. Please review the recorded reason in your applicant portal.',
  'Termination / withdrawal': 'This letter records the withdrawal or termination decision against the application.',
});

export function communicationMessageForTemplate(template) {
  return defaultCommunicationMessages[String(template || '')] || 'An update is available in your applicant communication history.';
}

const clone = (value) => JSON.parse(JSON.stringify(value));

export function isReviewableApplication(application) {
  return application?.status === APPLICATION_STATUS.UNDER_REVIEW || (application?.status === APPLICATION_STATUS.CORRECTION_REQUESTED && Boolean(application?.correctionResubmittedAt));
}

export function isIntakeOpen(cycle, now = new Date()) {
  if (!cycle || cycle.advertStatus !== 'Published') return false;
  const current = now instanceof Date ? now : new Date(now);
  const open = cycle.openDate ? new Date(cycle.openDate) : null;
  const close = cycle.closeDate ? new Date(`${cycle.closeDate} 23:59:59`) : null;
  if (open && !Number.isNaN(open.valueOf()) && current < open) return false;
  if (close && !Number.isNaN(close.valueOf()) && current > close) return false;
  return true;
}

function applyApplicationPayload(application, payload = {}) {
  const { documents, ...fields } = payload;
  Object.assign(application, fields);
  if (Array.isArray(documents)) application.documents = documents;
  else if (documents && typeof documents === 'object') application.documentChecklist = { ...documents };
  if (!Array.isArray(application.documents)) application.documents = [];
  return application;
}

const seedApplications = [
  { ref: 'GCON20270731-01', name: 'Lerato Mokoena', id: '900101•••••081', ownerUserId: 'user-learner-demo', pathway: 'NSC / Grade 12', score: '34.5', status: APPLICATION_STATUS.UNDER_REVIEW, updated: 'Today, 09:42', preferences: ['Ann Latsky Campus', 'SG Lourens Campus'], addressVerified: true, organisationId: ORG_GCON, releasedToOrganisationIds: [], pathwayValues: { english: '5', lifeSciences: '5', mathematics: '4', mathsLiteracy: '4', aps: '34.5' }, documents: [{ id: 'doc-demo-id', type: 'identity', label: 'Certified copy of ID', state: 'verified' }, { id: 'doc-demo-results', type: 'results', label: 'Statement of results / certificate', state: 'verified' }] },
  { ref: 'GCON20270731-02', name: 'Mpho Dlamini', id: '990418•••••082', ownerUserId: 'user-applicant-2', pathway: 'Senior Certificate', score: '18', status: APPLICATION_STATUS.SHORTLISTED, updated: 'Today, 09:21', preferences: ['Chris Hani Baragwanath Campus'], addressVerified: true, organisationId: ORG_GCON, releasedToOrganisationIds: [ORG_GCON], pathwayValues: { english: 'HG D', biology: 'HG D', mathematics: 'HG D', mScore: '18' }, documents: [{ id: 'doc-2-id', type: 'identity', label: 'Certified copy of ID', state: 'verified' }, { id: 'doc-2-results', type: 'results', label: 'Statement of results / certificate', state: 'verified' }] },
  { ref: 'GCON20270730-18', name: 'Karabo Molefe', id: '010622•••••317', ownerUserId: 'user-applicant-3', pathway: 'NSC / Grade 12', score: '29.0', status: APPLICATION_STATUS.CORRECTION_REQUESTED, updated: 'Yesterday, 16:08', preferences: ['Bonalesedi Campus'], addressVerified: true, organisationId: ORG_GCON, releasedToOrganisationIds: [], correctionRequest: { reason: 'Please upload a clearer statement of results.', requestedAt: 'Yesterday, 16:08' }, documents: [{ id: 'doc-3-id', type: 'identity', label: 'Certified copy of ID', state: 'verified' }, { id: 'doc-3-results', type: 'results', label: 'Statement of results / certificate', state: 'correction_required' }] },
  { ref: 'GCON20270730-14', name: 'Thato Ndlovu', id: '000914•••••520', ownerUserId: 'user-applicant-4', pathway: 'NC(V) Level 4', score: '72%', status: APPLICATION_STATUS.SHORTLISTED, updated: 'Yesterday, 14:26', preferences: ['SG Lourens Campus'], addressVerified: true, organisationId: ORG_GCON, releasedToOrganisationIds: [ORG_GCON], pathwayValues: { englishFal: '60', mathematics: '55', lifeOrientation: '50', saHealthCare: '60', publicHealth: '60', humanBody: '60', communityPrimaryCare: '60' }, documents: [{ id: 'doc-4-id', type: 'identity', label: 'Certified copy of ID', state: 'verified' }, { id: 'doc-4-results', type: 'results', label: 'Statement of results / certificate', state: 'verified' }] },
  { ref: 'GCON20270729-09', name: 'Naledi Seema', id: '990212•••••114', ownerUserId: 'user-applicant-5', pathway: 'NSC / Grade 12', score: '31.5', status: APPLICATION_STATUS.UNDER_REVIEW, updated: '29 Jul, 11:12', preferences: ['Ann Latsky Campus'], addressVerified: true, organisationId: ORG_GCON, releasedToOrganisationIds: [], pathwayValues: { english: '5', lifeSciences: '5', mathematics: '4', mathsLiteracy: '4', aps: '31.5' }, documents: [{ id: 'doc-5-id', type: 'identity', label: 'Certified copy of ID', state: 'pending' }, { id: 'doc-5-results', type: 'results', label: 'Statement of results / certificate', state: 'pending' }] },
];

const seedAuditLog = [
  { id: 'audit-1', time: '10:14', event: 'Application submitted', ref: 'GCON20270731-01', actor: 'Applicant portal', actorUserId: 'user-learner-demo', organisationId: ORG_GCON },
  { id: 'audit-2', time: '10:18', event: 'Documents verified', ref: 'GCON20270731-01', actor: 'Thandi Mokoena', actorUserId: 'user-reviewer', organisationId: ORG_GCON },
  { id: 'audit-3', time: '10:21', event: 'Application approved for shortlisting', ref: 'GCON20270731-02', actor: 'Thandi Mokoena', actorUserId: 'user-reviewer', organisationId: ORG_GCON },
  { id: 'audit-4', time: '10:24', event: 'Psychometric invitation queued', ref: 'GCON20270731-02', actor: 'System', actorUserId: 'system', organisationId: ORG_GCON },
];

export function createInitialStore() {
  return {
    schemaVersion: 2,
    cycle: {
      id: CYCLE_GCON_2027,
      name: 'GCON 2027',
      openDate: '01 Jul 2026',
      closeDate: '26 Sep 2026',
      referenceDate: '2026-07-31',
      advertStatus: 'Published',
      policyStatus: 'pending-approval',
      documentTypes: ['Certified copy of ID', 'Statement of results / certificate'],
      requirements: clone(DEFAULT_CYCLE_REQUIREMENTS),
    },
    organisations: [{ id: ORG_GCON, name: 'Gauteng College of Nursing', code: 'GCON', active: true }],
    users: [
      { id: 'user-learner-demo', name: 'Lerato Mokoena', email: 'lerato.mokoena@email.com', roles: [ROLES.LEARNER], organisationIds: [] },
      { id: 'user-reviewer', name: 'Thandi Mokoena', email: 'thandi.mokoena@gcon.example', roles: [ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR], organisationIds: [ORG_GCON] },
      { id: 'user-employer', name: 'GCON Placement Team', email: 'placements@gcon.example', roles: [ROLES.EMPLOYER_COORDINATOR], organisationIds: [ORG_GCON] },
      { id: 'user-admin', name: 'Platform Administrator', email: 'admin@gcon.example', roles: [ROLES.ADMIN], organisationIds: [ORG_GCON] },
    ],
    memberships: [{ userId: 'user-reviewer', organisationId: ORG_GCON, role: ROLES.STAFF_REVIEWER, status: 'active' }, { userId: 'user-employer', organisationId: ORG_GCON, role: ROLES.EMPLOYER_COORDINATOR, status: 'active' }, { userId: 'user-admin', organisationId: ORG_GCON, role: ROLES.ADMIN, status: 'active' }],
    applications: clone(seedApplications),
    auditLog: clone(seedAuditLog),
    reviewTasks: seedApplications.filter(isReviewableApplication).map((application, index) => ({ id: `review-${index + 1}`, ref: application.ref, assignedTo: 'user-reviewer', status: 'open' })),
    documents: seedApplications.flatMap((application) => (application.documents || []).map((document) => ({ ...document, ref: application.ref, ownerUserId: application.ownerUserId, organisationId: application.organisationId, objectKey: `applications/${application.ref}/${document.id}` }))),
    communications: [],
    notifications: [],
    applicantChats: {},
    invitations: [],
    sessions: {},
    authUsers: {},
    nonQualifierContacts: [],
    idempotency: {},
    referenceCounters: {},
    lettersIssued: false,
  };
}

export function cloneStore(store) {
  return clone(store);
}

export function actorFromToken(token) {
  const mapping = {
    'demo-learner': { userId: 'user-learner-demo', role: ROLES.LEARNER, organisationId: null },
    'demo-staff': { userId: 'user-reviewer', role: ROLES.STAFF_SUPERVISOR, organisationId: ORG_GCON },
    'demo-employer': { userId: 'user-employer', role: ROLES.EMPLOYER_COORDINATOR, organisationId: ORG_GCON },
    'demo-admin': { userId: 'user-admin', role: ROLES.ADMIN, organisationId: ORG_GCON },
  };
  return mapping[token] || null;
}

export function hasRole(actor, ...roles) {
  return Boolean(actor && roles.includes(actor.role));
}

export function canReadApplication(actor, application) {
  if (!actor || !application) return false;
  if (hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR)) return actor.organisationId === application.organisationId;
  if (hasRole(actor, ROLES.LEARNER)) return actor.userId === application.ownerUserId;
  return actor.organisationId === application.organisationId && application.releasedToOrganisationIds?.includes(actor.organisationId);
}

export function canActOnApplication(actor, application, action) {
  if (!actor || !application) return false;
  if (action === 'review' || action === 'decision' || action === 'correction') return hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR) && actor.organisationId === application.organisationId;
  if (action === 'placement') return hasRole(actor, ROLES.ADMIN, ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR) && actor.organisationId === application.organisationId && application.releasedToOrganisationIds?.includes(actor.organisationId);
  return false;
}

export function maskIdentifier(value) {
  const raw = String(value || '');
  return raw.length > 6 ? `${raw.slice(0, 6)}•••••${raw.slice(-3)}` : '••••••••••';
}

export function nextReference(store) {
  const datePart = String(store.cycle.referenceDate || new Date().toISOString().slice(0, 10)).replaceAll('-', '');
  const prefix = `GCON${datePart}-`;
  const next = (store.referenceCounters[datePart] || 0) + 1;
  store.referenceCounters[datePart] = next;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

export function addAudit(store, event, actor, details = {}) {
  store.auditLog.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), event, actor: actor?.name || actor?.role || 'System', actorUserId: actor?.userId || 'system', organisationId: actor?.organisationId || ORG_GCON, ...details });
}

export function visibleState(store, actor) {
  const readableApplications = store.applications.filter((application) => canReadApplication(actor, application));
  const applications = readableApplications.map(publicApplication);
  const staffVisible = hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR);
  const base = { cycle: store.cycle, organisations: store.organisations, applications, auditLog: staffVisible ? store.auditLog : [], notifications: store.notifications.filter((item) => item.userId === actor?.userId), communications: staffVisible ? (store.communications || []) : [], lettersIssued: store.lettersIssued, nonQualifierContacts: staffVisible ? (store.nonQualifierContacts || []) : [] };
  if (hasRole(actor, ROLES.LEARNER)) return base;
  if (hasRole(actor, ROLES.EMPLOYER_MEMBER, ROLES.EMPLOYER_COORDINATOR)) {
    const visible = readableApplications.filter((application) => application.releasedToOrganisationIds?.includes(actor.organisationId)).map(publicApplication);
    return { ...base, applications: visible, employer: dashboardMetrics(readableApplications, actor.organisationId) };
  }
  return { ...base, reviewTasks: store.reviewTasks, employer: dashboardMetrics(applications, actor?.organisationId) };
}

function publicApplication(application) {
  const { ownerUserId, organisationId, releasedToOrganisationIds, ...safe } = application;
  return { ...safe, id: maskIdentifier(application.id) };
}

export function dashboardMetrics(applications, organisationId = ORG_GCON) {
  const scoped = applications.filter((application) => !organisationId || application.organisationId === organisationId);
  const count = (statuses) => scoped.filter((application) => statuses.includes(application.status)).length;
  return { organisationId, visibleApplicants: scoped.length, underReview: count([APPLICATION_STATUS.UNDER_REVIEW]), shortlisted: count([APPLICATION_STATUS.SHORTLISTED]), placed: count([APPLICATION_STATUS.PLACED]), needsAction: count([APPLICATION_STATUS.PLACEMENT_READY]), pendingPlacement: count([APPLICATION_STATUS.PLACEMENT_READY]) };
}

export function updateIntakeCycle(store, actor, payload = {}) {
  if (!hasRole(actor, ROLES.ADMIN, ROLES.STAFF_SUPERVISOR)) throw Object.assign(new Error('Only administrators or staff supervisors can update intake settings'), { status: 403 });
  const cycle = store.cycle;
  const next = {};
  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (name.length < 3 || name.length > 120) throw Object.assign(new Error('Intake name must be between 3 and 120 characters'), { status: 400 });
    next.name = name;
  }
  const openDate = payload.openDate === undefined ? cycle.openDate : String(payload.openDate || '').trim();
  const closeDate = payload.closeDate === undefined ? cycle.closeDate : String(payload.closeDate || '').trim();
  if (Number.isNaN(new Date(openDate).valueOf()) || Number.isNaN(new Date(closeDate).valueOf())) throw Object.assign(new Error('Intake dates must be valid dates'), { status: 400 });
  if (new Date(openDate).valueOf() > new Date(closeDate).valueOf()) throw Object.assign(new Error('The intake close date cannot be before the open date'), { status: 400 });
  if (payload.openDate !== undefined) next.openDate = openDate;
  if (payload.closeDate !== undefined) next.closeDate = closeDate;
  if (payload.status !== undefined) {
    if (!['Published', 'Paused'].includes(payload.status)) throw Object.assign(new Error('Advert status must be Published or Paused'), { status: 400 });
    next.advertStatus = payload.status;
  }
  if (payload.documentTypes !== undefined) {
    if (!Array.isArray(payload.documentTypes) || payload.documentTypes.length < 2 || payload.documentTypes.length > 8) throw Object.assign(new Error('Provide between 2 and 8 document labels'), { status: 400 });
    const documentTypes = payload.documentTypes.map((item) => String(item || '').trim()).filter(Boolean);
    if (documentTypes.length !== payload.documentTypes.length || documentTypes.some((item) => item.length > 160) || new Set(documentTypes).size !== documentTypes.length) throw Object.assign(new Error('Document labels must be unique and non-empty'), { status: 400 });
    next.documentTypes = documentTypes;
  }
  if (payload.requirements !== undefined) {
    if (!payload.requirements || typeof payload.requirements !== 'object' || Array.isArray(payload.requirements)) throw Object.assign(new Error('Requirements must be a pathway-to-description object'), { status: 400 });
    const requirements = { ...(cycle.requirements || DEFAULT_CYCLE_REQUIREMENTS) };
    for (const pathway of Object.keys(DEFAULT_CYCLE_REQUIREMENTS)) {
      if (payload.requirements[pathway] !== undefined) {
        const description = String(payload.requirements[pathway] || '').trim();
        if (!description || description.length > 600) throw Object.assign(new Error(`Requirement description for ${pathway} is invalid`), { status: 400 });
        requirements[pathway] = description;
      }
    }
    next.requirements = requirements;
  }
  Object.assign(cycle, next, { updatedAt: new Date().toISOString(), updatedBy: actor.userId });
  addAudit(store, 'Intake cycle configuration updated', actor, { ref: cycle.id, reason: Object.keys(next).join(', ') || 'no changes' });
  return cycle;
}

export function findApplication(store, ref) {
  return store.applications.find((application) => application.ref === ref);
}

export function recordNonQualifierContact(store, actor, payload = {}) {
  if (!hasRole(actor, ROLES.LEARNER)) throw Object.assign(new Error('Only learners can record a contact request'), { status: 403 });
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const telephone = String(payload.telephone || '').trim();
  if (!name || !email || !telephone) throw Object.assign(new Error('Name, email, and telephone are required'), { status: 400 });
  store.nonQualifierContacts ||= [];
  const existing = store.nonQualifierContacts.find((item) => item.ownerUserId === actor.userId && item.cycleId === store.cycle.id);
  const contact = existing || { id: `contact-${crypto.randomUUID()}`, cycleId: store.cycle.id, ownerUserId: actor.userId };
  Object.assign(contact, { name, email, telephone, recordedAt: new Date().toISOString() });
  if (!existing) store.nonQualifierContacts.unshift(contact);
  addAudit(store, 'Non-qualifier contact recorded', actor, { ref: 'non-qualifier' });
  return contact;
}

export function reviewDocument(store, actor, documentId, decision, reason = '') {
  if (!hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR)) throw Object.assign(new Error('Only staff can review documents'), { status: 403 });
  const document = (store.documents || []).find((item) => item.id === documentId);
  if (!document || document.organisationId !== actor.organisationId) throw Object.assign(new Error('Document not found'), { status: 404 });
  if (!['verified', 'rejected', 'correction_required'].includes(decision)) throw Object.assign(new Error('Unsupported document decision'), { status: 400 });
  const application = findApplication(store, document.ref);
  if (!application || !canReadApplication(actor, application)) throw Object.assign(new Error('Application not found'), { status: 404 });
  const now = new Date().toISOString();
  document.state = decision;
  document.reviewReason = String(reason || '').trim() || undefined;
  document.reviewedAt = now;
  document.reviewedBy = actor.userId;
  if (decision === 'verified') document.scanState = 'clean';
  if (decision === 'rejected') document.scanState = 'blocked';
  const applicationDocument = (application.documents || []).find((item) => item.id === document.id);
  if (applicationDocument) Object.assign(applicationDocument, { state: decision, reviewReason: document.reviewReason, reviewedAt: now, reviewedBy: actor.userId });
  addAudit(store, `Document ${decision === 'verified' ? 'verified' : decision === 'rejected' ? 'rejected' : 'correction requested'}`, actor, { ref: application.ref, documentId, reason: document.reviewReason });
  return document;
}

export function recordInterviewOutcome(store, actor, ref, payload = {}) {
  const application = findApplication(store, ref);
  if (!application || !canActOnApplication(actor, application, 'review')) throw Object.assign(new Error('Application not found'), { status: 404 });
  if (application.interview?.status !== 'invited') throw Object.assign(new Error('Invite the psychometric test before recording an outcome'), { status: 409 });
  const outcome = String(payload.outcome || '').trim();
  if (!['passed', 'failed', 'no_show', 'pending'].includes(outcome)) throw Object.assign(new Error('Unsupported psychometric outcome'), { status: 400 });
  const recordedAt = new Date().toISOString();
  application.interview = { ...application.interview, outcome, score: payload.score === undefined || payload.score === '' ? undefined : String(payload.score), notes: String(payload.notes || '').trim() || undefined, outcomeRecordedAt: recordedAt, outcomeRecordedBy: actor.userId };
  addAudit(store, `Psychometric outcome recorded: ${outcome}`, actor, { ref: application.ref });
  return application;
}

export function recordTerminationLetter(store, actor, ref, payload = {}) {
  const application = findApplication(store, ref);
  if (!application || !canActOnApplication(actor, application, 'review')) throw Object.assign(new Error('Application not found'), { status: 404 });
  if (application.status !== APPLICATION_STATUS.WITHDRAWN) throw Object.assign(new Error('Termination letters can only be recorded for withdrawn applications'), { status: 409 });
  const recordedAt = new Date().toISOString();
  application.terminationLetter = { status: 'recorded', filename: String(payload.filename || 'Termination letter').slice(0, 255), notes: String(payload.notes || '').trim() || undefined, recordedAt, recordedBy: actor.userId };
  addAudit(store, 'Termination letter recorded', actor, { ref: application.ref, reason: application.terminationLetter.filename });
  return application;
}

export function issueCommunication(store, actor, audience, template = '', message = '') {
  if (!hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR)) throw Object.assign(new Error('Only staff can issue communications'), { status: 403 });
  const allowedAudiences = new Set(['Shortlisted applicants', 'Declined applicants', 'Withdrawn applicants']);
  if (!allowedAudiences.has(audience)) throw Object.assign(new Error('Unsupported communication audience'), { status: 400 });
  const statusByAudience = { 'Shortlisted applicants': [APPLICATION_STATUS.SHORTLISTED], 'Declined applicants': [APPLICATION_STATUS.DECLINED], 'Withdrawn applicants': [APPLICATION_STATUS.WITHDRAWN] };
  const recipients = store.applications.filter((application) => application.organisationId === actor.organisationId && statusByAudience[audience].includes(application.status) && application.ownerUserId);
  const issuedAt = new Date().toISOString();
  const templateName = String(template || 'controlled-notification');
  const messageText = String(message || '').trim() || communicationMessageForTemplate(templateName);
  const communication = { id: crypto.randomUUID(), audience, template: templateName, message: messageText, cycleId: store.cycle.id, issuedAt, issuedBy: actor.userId, deliveryStatus: 'sent', provider: 'local-development-adapter', recipientCount: recipients.length };
  store.communications ||= [];
  store.notifications ||= [];
  store.communications.unshift(communication);
  for (const application of recipients) {
    store.notifications.unshift({ id: crypto.randomUUID(), userId: application.ownerUserId, applicationRef: application.ref, communicationId: communication.id, channel: 'email', status: 'sent', queuedAt: issuedAt, sentAt: issuedAt, provider: communication.provider, subject: `${audience} · ${store.cycle.name}`, message: messageText });
  }
  store.lettersIssued = true;
  addAudit(store, `${audience} communication issued`, actor, { ref: store.cycle.name, reason: `${recipients.length} notifications` });
  return communication;
}

export function createOrUpdateDraft(store, actor, payload = {}) {
  const existing = store.applications.find((application) => application.ownerUserId === actor.userId && application.status === APPLICATION_STATUS.DRAFT);
  const submitted = store.applications.find((application) => application.ownerUserId === actor.userId && Boolean(application.submittedAt) && application.status !== APPLICATION_STATUS.DRAFT && application.status !== APPLICATION_STATUS.CORRECTION_REQUESTED);
  if (submitted) throw Object.assign(new Error('A submitted application already exists for this intake'), { status: 409 });
  if (existing) {
    applyApplicationPayload(existing, payload);
    existing.updated = new Date().toISOString();
    return existing;
  }
  const application = { ref: null, ownerUserId: actor.userId, organisationId: ORG_GCON, releasedToOrganisationIds: [], status: APPLICATION_STATUS.DRAFT, updated: new Date().toISOString(), documents: [] };
  applyApplicationPayload(application, payload);
  store.applications.unshift(application);
  return application;
}

export function saveDraft(store, actor, payload = {}) {
  const existing = store.applications.find((application) => application.ownerUserId === actor.userId && [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.CORRECTION_REQUESTED].includes(application.status));
  const submitted = store.applications.find((application) => application.ownerUserId === actor.userId && Boolean(application.submittedAt) && [APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.SHORTLISTED, APPLICATION_STATUS.PLACEMENT_READY, APPLICATION_STATUS.PLACED, APPLICATION_STATUS.DECLINED, APPLICATION_STATUS.WITHDRAWN].includes(application.status));
  if (!existing && submitted) throw Object.assign(new Error('A submitted application already exists for this intake'), { status: 409 });
  const application = existing || createOrUpdateDraft(store, actor, payload);
  const status = existing?.status === APPLICATION_STATUS.CORRECTION_REQUESTED ? APPLICATION_STATUS.CORRECTION_REQUESTED : APPLICATION_STATUS.DRAFT;
  applyApplicationPayload(application, payload);
  Object.assign(application, { status, updated: new Date().toISOString() });
  if (status === APPLICATION_STATUS.CORRECTION_REQUESTED) application.correctionDraftSavedAt = new Date().toISOString();
  addAudit(store, existing?.status === APPLICATION_STATUS.CORRECTION_REQUESTED ? 'Correction draft saved' : 'Application draft saved', actor, { ref: application.ref || 'draft' });
  return application;
}

export function submitApplication(store, actor, payload = {}) {
  if (!isIntakeOpen(store.cycle)) throw Object.assign(new Error('Applications are not currently open for this intake'), { status: 409 });
  const existing = store.applications.find((application) => application.ownerUserId === actor.userId && [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.CORRECTION_REQUESTED].includes(application.status));
  const submitted = store.applications.find((application) => application.ownerUserId === actor.userId && Boolean(application.submittedAt) && [APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.SHORTLISTED, APPLICATION_STATUS.PLACEMENT_READY, APPLICATION_STATUS.PLACED, APPLICATION_STATUS.DECLINED, APPLICATION_STATUS.WITHDRAWN].includes(application.status));
  if (submitted && existing?.status !== APPLICATION_STATUS.CORRECTION_REQUESTED) throw Object.assign(new Error('A submitted application already exists for this intake'), { status: 409 });
  const application = existing || createOrUpdateDraft(store, actor, payload);
  applyApplicationPayload(application, payload);
  Object.assign(application, { ref: application.ref || nextReference(store), status: APPLICATION_STATUS.UNDER_REVIEW, submittedAt: new Date().toISOString(), updated: new Date().toISOString(), releasedToOrganisationIds: [] });
  if (existing?.status === APPLICATION_STATUS.CORRECTION_REQUESTED) application.correctionResubmittedAt = application.submittedAt;
  addAudit(store, existing?.status === APPLICATION_STATUS.CORRECTION_REQUESTED ? 'Application correction resubmitted' : 'Application submitted', actor, { ref: application.ref });
  return application;
}

export function applyReviewDecision(store, actor, ref, decision, reason = '') {
  const application = findApplication(store, ref);
  if (!application) throw new Error('Application not found');
  if (!canActOnApplication(actor, application, decision === 'correction' ? 'correction' : 'decision')) throw new Error('Not authorised for this application');
  if (!['approve', 'decline', 'correction', 'undo'].includes(decision)) throw new Error('Unsupported review decision');
  const next = { approve: APPLICATION_STATUS.SHORTLISTED, decline: APPLICATION_STATUS.DECLINED, correction: APPLICATION_STATUS.CORRECTION_REQUESTED, undo: APPLICATION_STATUS.UNDER_REVIEW }[decision];
  application.status = next;
  application.updated = new Date().toISOString();
  application.declineReason = decision === 'decline' ? reason : undefined;
  application.correctionRequest = decision === 'correction' ? { reason, requestedAt: new Date().toISOString() } : undefined;
  if (decision === 'correction') application.correctionResubmittedAt = undefined;
  if (decision === 'approve') application.releasedToOrganisationIds = [application.organisationId];
  if (['decline', 'correction', 'undo'].includes(decision)) application.releasedToOrganisationIds = [];
  addAudit(store, `Application ${decision === 'approve' ? 'approved for shortlisting' : decision === 'decline' ? 'declined' : decision === 'correction' ? 'correction requested' : 'decision undone'}`, actor, { ref, reason });
  return application;
}

export function massDeclineApplications(store, actor, refs = [], reason = '') {
  if (!hasRole(actor, ROLES.ADMIN, ROLES.STAFF_REVIEWER, ROLES.STAFF_SUPERVISOR)) throw Object.assign(new Error('Only staff can mass-decline applications'), { status: 403 });
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > 2000) throw Object.assign(new Error('Select between 1 and 2,000 applications'), { status: 400 });
  const uniqueRefs = [...new Set(refs.map((ref) => String(ref || '').trim()).filter(Boolean))];
  if (uniqueRefs.length !== refs.length) throw Object.assign(new Error('Application references must be unique and non-empty'), { status: 400 });
  const declineReason = String(reason || '').trim();
  if (declineReason.length < 3 || declineReason.length > 500) throw Object.assign(new Error('A decline reason between 3 and 500 characters is required'), { status: 400 });
  const applications = uniqueRefs.map((ref) => findApplication(store, ref));
  if (applications.some((application) => !application || !canReadApplication(actor, application))) throw Object.assign(new Error('One or more applications are not available in your organisation scope'), { status: 404 });
  const allowedStatuses = new Set([APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.CORRECTION_REQUESTED]);
  if (applications.some((application) => !allowedStatuses.has(application.status))) throw Object.assign(new Error('Mass decline is only available for applications under review or awaiting correction resubmission'), { status: 409 });

  const now = new Date().toISOString();
  const communication = { id: crypto.randomUUID(), audience: 'Declined applicants', template: 'Mass decline outcome', channel: 'in_app', cycleId: store.cycle.id, issuedAt: now, issuedBy: actor.userId, deliveryStatus: 'sent', provider: 'local-development-adapter', recipientCount: applications.length };
  store.communications ||= [];
  store.notifications ||= [];
  store.communications.unshift(communication);
  for (const application of applications) {
    application.status = APPLICATION_STATUS.DECLINED;
    application.updated = now;
    application.declineReason = declineReason;
    application.correctionRequest = undefined;
    application.releasedToOrganisationIds = [];
    store.notifications.unshift({ id: crypto.randomUUID(), userId: application.ownerUserId, applicationRef: application.ref, communicationId: communication.id, channel: 'in_app', status: 'sent', queuedAt: now, sentAt: now, provider: communication.provider, subject: `Application outcome available · ${store.cycle.name}`, message: `Your application was not approved for the next stage. Reason: ${declineReason}` });
    addAudit(store, 'Application declined by mass action', actor, { ref: application.ref, reason: declineReason, communicationId: communication.id });
  }
  addAudit(store, 'Applications mass declined', actor, { ref: store.cycle.id, reason: `${applications.length} applications; in-app notifications created`, communicationId: communication.id });
  return { applications, communication, summary: { requested: uniqueRefs.length, declined: applications.length, notificationsCreated: applications.length } };
}

export function recordPlacementResponse(store, actor, ref, response, campus = '') {
  const application = findApplication(store, ref);
  if (!application) throw new Error('Application not found');
  if (!canActOnApplication(actor, application, 'placement')) throw new Error('Not authorised for this placement');
  if (application.status !== APPLICATION_STATUS.PLACEMENT_READY) throw Object.assign(new Error('Placement offer is not ready for an employer response'), { status: 409 });
  if (!['accepted', 'declined'].includes(response)) throw new Error('Placement response must be accepted or declined');
  application.placementResponse = response;
  application.placementCampus = campus || application.placementCampus;
  application.status = response === 'accepted' ? APPLICATION_STATUS.PLACED : APPLICATION_STATUS.PLACEMENT_READY;
  application.updated = new Date().toISOString();
  addAudit(store, `Employer placement ${response}`, actor, { ref, reason: campus });
  return application;
}

export function recordStaffPlacement(store, actor, ref, campus) {
  const application = findApplication(store, ref);
  if (!application) throw new Error('Application not found');
  if (!canActOnApplication(actor, application, 'review')) throw new Error('Not authorised for placement');
  if (![APPLICATION_STATUS.SHORTLISTED, APPLICATION_STATUS.PLACEMENT_READY, APPLICATION_STATUS.PLACED].includes(application.status)) throw Object.assign(new Error('Only shortlisted candidates can receive a placement offer'), { status: 409 });
  application.placementCampus = campus;
  application.status = APPLICATION_STATUS.PLACEMENT_READY;
  application.releasedToOrganisationIds = [application.organisationId];
  application.updated = new Date().toISOString();
  addAudit(store, 'Placement offer prepared', actor, { ref, reason: campus });
  return application;
}
