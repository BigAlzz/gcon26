import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css?gcon=2027';
import { acceptInvitationApi, createApiApplication, demoLoginApi, evaluateQualificationApi, getApiApplication, getApiState, getIntakeConfig, getStoredSession, issueApiLetters, loginApi, logoutApi, recordApiNonQualifier, registerLearnerApi, respondApiPlacement, saveApiDraft, updateApiAdvert, updateApiCycle, updateApiDecision, updateApiPlacement, updateApiWithdrawal, uploadApiDocument } from './api.js?placement=1';
import { defaultQualification, evaluateQualification, pathways } from './qualification';
import { UploadableDocumentRow } from './DocumentUpload.jsx';
import { AddressMapPicker } from './AddressMapPicker.jsx';
import { CompleteAuditPage, CompleteLettersPage, CompletePlacementsPage, CompleteReportsPage, CompleteReviewQueue, CompleteShortlistPage } from './CompleteWorkspacePages.jsx';
import { MassApplicationsPage } from './MassApplicationsWorklist.jsx';
import { CompleteReviewApplicationMinimal } from './CompleteApplicantViews.jsx';
import { CompleteEmployerWorkspace } from './CompleteEmployerWorkspace.jsx';
import { DEFAULT_CAMPUS_CAPACITIES } from '../shared/campusCapacity.mjs';

const applicantSteps = [
  ['landing', 'Welcome'],
  ['checker', 'Qualification'],
  ['access', 'Access'],
  ['profile', 'Profile'],
  ['review', 'Review'],
];

const staffNav = [
  ['dashboard', 'Dashboard', '⌂'],
  ['applications', 'Applications', '▦'],
  ['reviewQueue', 'Review queue', '✓'],
  ['shortlist', 'Shortlist', '☆'],
  ['letters', 'Letters & comms', '✉'],
  ['reports', 'Reports', '◌'],
  ['audit', 'Audit trail', '≡'],
];

staffNav.splice(4, 0, ['placements', 'Placements & withdrawals', '+']);
const declineReasons = ['Incorrect or unreadable document', 'Required subject or score not met', 'Document type not supplied', 'Information could not be verified'];
const collegeCampuses = ['Ann Latsky Campus', 'Chris Hani Baragwanath Campus', 'SG Lourens Campus', 'Bonalesedi Campus'];
const defaultCollegePreferences = ['Ann Latsky Campus', 'SG Lourens Campus', '', ''];
function normalizeCollegePreferences(value) {
  const source = Array.isArray(value) ? value : defaultCollegePreferences;
  return [...source, '', '', '', ''].slice(0, collegeCampuses.length);
}
const relationshipOptions = ['Community leader', 'Councillor', 'Teacher', 'Mentor', 'Pastor'];
const resultYearOptions = Array.from({ length: 15 }, (_, index) => String(new Date().getFullYear() - index));
const defaultProfile = {
  firstName: 'Lerato',
  surname: 'Mokoena',
  email: 'lerato.mokoena@email.com',
  mobile: '082 555 0194',
  idNumber: '9901015808081',
  streetAddress: '18 Vilakazi Street',
  suburb: 'Soweto',
  province: 'Gauteng',
  postcode: '1804',
  latitude: -26.2485,
  longitude: 27.8546,
  mapAddress: '18 Vilakazi Street, Soweto, Gauteng',
  school: 'Mofolo Secondary School',
  resultYear: '2025',
};

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

function modeForRole(role) {
  if (["staff_reviewer", "staff_supervisor", "platform_admin"].includes(role)) return 'staff';
  if (["employer_member", "employer_coordinator"].includes(role)) return 'employer';
  return 'applicant';
}

const defaultCycleRequirements = {
  'NSC / Grade 12': 'English Level 4+, Life Sciences Level 4+, Mathematics Level 4 or Maths Literacy Level 5+, with APS 27+ verified from the uploaded certificate.',
  'Senior Certificate': 'English, Biology and Mathematics in the approved HG/SG pass bands, plus M score 17+.',
  'NC(V) Level 4': 'Fundamentals at 50%+, with each named vocational subject at 60%+.',
};

function cycleDateInputValue(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return '';
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  return months[match[2]] ? `${match[3]}-${months[match[2]]}-${String(match[1]).padStart(2, '0')}` : '';
}

function cycleDisplayDate(value) {
  const input = cycleDateInputValue(value);
  if (!input) return String(value || '');
  const [year, month, day] = input.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function displayCycleState(state) {
  if (!state?.cycle) return state;
  const displayed = { ...state, cycle: { ...state.cycle, openDate: cycleDisplayDate(state.cycle.openDate), closeDate: cycleDisplayDate(state.cycle.closeDate) } };
  globalThis.__gconCycle = displayed.cycle;
  return displayed;
}

function IntakeCycleEditor({ cycle, onSave }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(() => ({
    name: cycle?.name || 'GCON 2027',
    openDate: cycleDateInputValue(cycle?.openDate),
    closeDate: cycleDateInputValue(cycle?.closeDate),
    status: cycle?.advertStatus || 'Published',
    documentTypes: [...(cycle?.documentTypes || ['Certified copy of ID', 'Statement of results / certificate'])],
    requirements: { ...defaultCycleRequirements, ...(cycle?.requirements || {}) },
    capacities: { ...DEFAULT_CAMPUS_CAPACITIES, ...(cycle?.campusCapacities || {}) },
  }));

  function startEditing() {
    setDraft({
      name: cycle?.name || 'GCON 2027',
      openDate: cycleDateInputValue(cycle?.openDate),
      closeDate: cycleDateInputValue(cycle?.closeDate),
      status: cycle?.advertStatus || 'Published',
      documentTypes: [...(cycle?.documentTypes || ['Certified copy of ID', 'Statement of results / certificate'])],
      requirements: { ...defaultCycleRequirements, ...(cycle?.requirements || {}) },
      capacities: { ...DEFAULT_CAMPUS_CAPACITIES, ...(cycle?.campusCapacities || {}) },
    });
    setMessage('');
    setError('');
    setOpen(true);
  }

  function updateDocument(index, value) {
    setDraft((current) => ({ ...current, documentTypes: current.documentTypes.map((item, itemIndex) => itemIndex === index ? value : item) }));
  }

  function updateRequirement(pathway, value) {
    setDraft((current) => ({ ...current, requirements: { ...current.requirements, [pathway]: value } }));
  }

  async function save() {
    setBusy(true);
    setMessage('');
    setError('');
    const result = await onSave({ ...draft, campusCapacities: draft.capacities });
    if (result?.cycle) {
      setMessage('Annual intake settings saved.');
      setOpen(false);
    } else {
      setError('Settings could not be saved. Check your role, dates, and required labels.');
    }
    setBusy(false);
  }

  return <div className="cycle-settings"><button className="cycle-settings-toggle" type="button" onClick={open ? () => setOpen(false) : startEditing}>{open ? 'Close intake settings' : 'Configure intake settings'}</button>{message && <span className="cycle-settings-success">{message}</span>}{open && <div className="cycle-settings-panel"><div className="section-line"><strong>Annual intake configuration</strong><span className="saved-label">Supervisor / admin</span></div><label className="field"><span>Season or intake name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><div className="field-grid two"><label className="field"><span>Opening date</span><input type="date" value={draft.openDate} onChange={(event) => setDraft((current) => ({ ...current, openDate: event.target.value }))} /></label><label className="field"><span>Closing date</span><input type="date" value={draft.closeDate} onChange={(event) => setDraft((current) => ({ ...current, closeDate: event.target.value }))} /></label></div><label className="field"><span>Advert status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option>Published</option><option>Paused</option></select></label><div className="cycle-settings-subhead">Approved evidence labels</div>{draft.documentTypes.slice(0, 2).map((label, index) => <label className="field" key={`document-label-${index}`}><span>Document {index + 1}</span><input value={label} onChange={(event) => updateDocument(index, event.target.value)} /></label>)}<div className="cycle-settings-subhead">Campus capacity (available seats)</div><p className="cycle-capacity-note">Set the maximum number of placement offers for each campus in this annual intake. New offers are blocked when a campus is full.</p>{Object.keys(DEFAULT_CAMPUS_CAPACITIES).map((campus) => <label className="field" key={campus}><span>{campus}</span><input type="number" min="0" max="100000" step="1" value={draft.capacities[campus] ?? DEFAULT_CAMPUS_CAPACITIES[campus]} onChange={(event) => setDraft((current) => ({ ...current, capacities: { ...current.capacities, [campus]: event.target.value } }))} /></label>)}<div className="cycle-settings-subhead">Requirement wording shown to applicants and staff</div>{Object.keys(defaultCycleRequirements).map((pathway) => <label className="field" key={pathway}><span>{pathway}</span><textarea rows="2" value={draft.requirements[pathway] || ''} onChange={(event) => updateRequirement(pathway, event.target.value)} /></label>)}{error && <p className="login-error">{error}</p>}<div className="form-actions compact-actions"><button className="quiet-button" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save intake settings'}</button></div></div>}</div>;
}

function App() {
  const [store, setStore] = useState({ cycle: { name: 'GCON 2027', openDate: '01 Jul 2026', closeDate: '26 Sep 2026', advertStatus: 'Published', documentTypes: ['Certified copy of ID', 'Statement of results / certificate'], requirements: defaultCycleRequirements }, applications: [], auditLog: [], lettersIssued: false, notifications: [], communications: [] });
  const [session, setSession] = useState(getStoredSession);
  const [mode, setMode] = useState(() => modeForRole(getStoredSession()?.user?.role || getStoredSession()?.role));
  const [applicantStep, setApplicantStep] = useState('landing');
  const [staffPage, setStaffPage] = useState('dashboard');
  const [checkerPathway, setCheckerPathway] = useState('NSC / Grade 12');
  const [checkerResult, setCheckerResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState('');
  const [decision, setDecision] = useState(null);
  const [declineReason, setDeclineReason] = useState(declineReasons[0]);
  const [submittedReference, setSubmittedReference] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [learnerApplication, setLearnerApplication] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginTarget, setLoginTarget] = useState('staff');
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpRole, setHelpRole] = useState('applicant');

  function openHelp(role) {
    setHelpRole(role);
    setHelpOpen(true);
  }

  function switchMode(nextMode) {
    if (nextMode === 'applicant' && session?.user?.role && modeForRole(session.user.role) !== 'applicant') {
      logoutApi();
      setSession(null);
    }
    if (nextMode !== 'applicant' && modeForRole(session?.user?.role) !== nextMode) {
      setLoginTarget(nextMode);
      setLoginOpen(true);
      return;
    }
    setMode(nextMode);
  }

  async function handleLogin(email, password, preauthenticated = null) {
    const result = preauthenticated || await loginApi(email, password);
    if (!result?.user) return false;
    setSession(result);
    setMode(modeForRole(result.user.role));
    setLoginOpen(false);
    return result;
  }

  async function handleInvitation(payload) {
    const result = await acceptInvitationApi(payload);
    if (!result?.user) return false;
    setSession(result);
    setMode(modeForRole(result.user.role));
    setLoginOpen(false);
    return result;
  }

  async function handleLearnerRegistration(payload) {
    const result = await registerLearnerApi(payload);
    if (!result?.user) return result;
    setSession(result);
    setMode('applicant');
    setApiConnected(true);
    return result;
  }

  function handleLogout() {
    logoutApi();
    setSession(null);
    setMode('applicant');
  }

  useEffect(() => {
    const expire = () => { setSession(null); setMode('applicant'); setLoginTarget('learner'); };
    window.addEventListener('gcon-session-expired', expire);
    let active = true;
    Promise.all([getApiState(), mode === 'applicant' ? getApiApplication() : Promise.resolve(null), mode === 'applicant' ? getIntakeConfig() : Promise.resolve(null)]).then(([remoteState, remoteApplication, intakeConfig]) => {
      if (!active) return;
      if (remoteState) { setStore(displayCycleState(remoteState)); setApiConnected(true); }
      else if (intakeConfig?.cycle) setStore((current) => displayCycleState({ ...current, cycle: intakeConfig.cycle }));
      if (mode === 'applicant') setLearnerApplication(remoteApplication?.application || null);
    });
    return () => { active = false; window.removeEventListener('gcon-session-expired', expire); };
  }, [mode, session?.token]);

  const scopedApplications = useMemo(() => {
    const applications = store.applications || [];
    if (mode === 'staff') return applications.filter((application) => application.status !== 'Draft');
    if (mode === 'employer') return applications.filter((application) => application.releasedToOrganisationIds ? application.releasedToOrganisationIds.includes('org-gcon') : ['Shortlisted', 'Placement ready', 'Placed'].includes(application.status));
    return applications.filter((application) => !application.ownerUserId || application.ownerUserId === session?.user?.userId);
  }, [mode, store.applications]);
  const filteredApplications = useMemo(() => scopedApplications.filter((application) =>
    `${application.ref} ${application.name} ${application.id} ${application.pathway}`.toLowerCase().includes(query.toLowerCase())
  ), [query, scopedApplications]);
  const selectedApplication = scopedApplications.find((application) => application.ref === selectedRef) || scopedApplications[0];

  function goApplicant(step) { setApplicantStep(step); if (step === 'landing') { setCheckerResult(null); setSubmitted(false); } }
  async function checkQualification(result) {
    const remote = await evaluateQualificationApi(result.pathway, result.values);
    const finalResult = remote?.qualification || result;
    setCheckerResult(finalResult);
    setSubmitted(false);
    setSubmittedReference(null);
    setApplicantStep('checker');
  }
  function submitDecision(nextDecision) {
    setDecision(nextDecision);
    if (selectedRef) {
      void updateApiDecision(selectedRef, nextDecision, declineReason).then((remoteState) => { if (remoteState) { setStore(remoteState); setApiConnected(true); } });
    }
  }
  async function submitApplication(payload = {}) {
    const qualification = checkerResult || evaluateQualification(checkerPathway, defaultQualification[checkerPathway]);
    const profile = payload.profile || {};
    const name = `${profile.firstName || 'Lerato'} ${profile.surname || 'Mokoena'}`.trim();
    const applicationPayload = {
      ...payload,
      name,
      id: profile.idNumber || qualification.values?.idNumber || '9901015808081',
      pathway: qualification.pathway,
      pathwayValues: qualification.values,
      qualification,
      score: qualification.score,
      profile,
      preferences: normalizeCollegePreferences(payload.preferences),
      addressVerified: Boolean(payload.addressVerified),
    };
    const remoteResult = await createApiApplication(applicationPayload);
    if (remoteResult?.application) {
      if (remoteResult.state) setStore(remoteResult.state);
      setLearnerApplication(remoteResult.application);
      setSubmittedReference(remoteResult.receipt?.reference || remoteResult.application.ref);
      setSubmitted(true);
      setApiConnected(true);
      return remoteResult.application.ref;
    }
    return null;
  }

  async function recordNonQualifier(contact) {
    const result = await recordApiNonQualifier(contact);
    if (result) {
      setApiConnected(true);
      return result;
    }
    return null;
  }

  function issueLetters(audience = 'Shortlisted applicants', template = 'Shortlist confirmation', message = '') {
    void issueApiLetters(audience, template, message).then((remoteState) => { if (remoteState) { setStore(remoteState); setApiConnected(true); } });
  }
  function changeAdvertStatus(status) {
    void updateApiAdvert(status).then((remoteState) => { if (remoteState) { setStore(displayCycleState(remoteState)); setApiConnected(true); } });
  }
  function updateCycle(payload) {
    return updateApiCycle(payload).then((remoteState) => {
      if (remoteState) { setStore(displayCycleState(remoteState)); setApiConnected(true); }
      return remoteState;
    });
  }
  async function refreshWorkspace() {
    const remoteState = await getApiState();
    if (remoteState) { setStore(displayCycleState(remoteState)); setApiConnected(true); }
    return remoteState;
  }
  function handleWorkspaceState(nextState) {
    if (nextState) { setStore(displayCycleState(nextState)); setApiConnected(true); }
  }
  function assignPlacement(ref, campus) {
    void updateApiPlacement(ref, campus).then((remoteState) => { if (remoteState) { setStore(remoteState); setApiConnected(true); } });
  }
  function withdrawApplication(ref, reason) {
    void updateApiWithdrawal(ref, reason).then((remoteState) => { if (remoteState) { setStore(remoteState); setApiConnected(true); } });
  }

  function respondPlacement(ref, response, campus) {
    void respondApiPlacement(ref, response, campus).then((remoteState) => { if (remoteState?.application) { setStore((current) => ({ ...current, applications: current.applications.map((application) => application.ref === ref ? { ...application, ...remoteState.application } : application) })); setApiConnected(true); } });
  }

  return (
    <div className="app-shell">
      <div className="portal-strip">
        <div className="portal-brand"><span className="brand-dot" /> Gauteng College of Nursing <span className="portal-divider">/</span> GCON 2027</div>
        <div className="portal-switcher" role="group" aria-label="Portal navigation">
          <button className={mode === 'applicant' ? 'active' : ''} onClick={() => switchMode('applicant')}>Applicant portal</button>
          <button className={mode === 'staff' ? 'active' : ''} onClick={() => switchMode('staff')}>Admissions workspace</button>
          <button className={mode === 'employer' ? 'active' : ''} onClick={() => switchMode('employer')}>Employer portal</button>
        </div>
      </div>
      {mode === 'applicant' ? (
        <MvpApplicantPortal step={applicantStep} setStep={goApplicant} pathway={checkerPathway} setPathway={setCheckerPathway} result={checkerResult} setResult={setCheckerResult} checkQualification={checkQualification} submitted={submitted} submittedReference={submittedReference} application={learnerApplication} cycle={store.cycle} submitApplication={submitApplication} recordNonQualifier={recordNonQualifier} onRegisterLearner={handleLearnerRegistration} onLogin={() => { setLoginTarget('learner'); setLoginOpen(true); }} onHelp={() => openHelp('applicant')} session={session} onLogout={handleLogout} />
      ) : mode === 'staff' ? (
        <StaffWorkspaceWithPlacements page={staffPage} setPage={setStaffPage} query={query} setQuery={setQuery} applications={filteredApplications} selectedApplication={selectedApplication} selectedRef={selectedRef} setSelectedRef={setSelectedRef} decision={decision} declineReason={declineReason} setDeclineReason={setDeclineReason} submitDecision={submitDecision} auditLog={store.auditLog} lettersIssued={store.lettersIssued} issueLetters={issueLetters} cycle={store.cycle} changeAdvertStatus={changeAdvertStatus} updateCycle={updateCycle} assignPlacement={assignPlacement} withdrawApplication={withdrawApplication} apiConnected={apiConnected} liveData={store} onRefreshReports={refreshWorkspace} onStateChange={handleWorkspaceState} />
      ) : (
        <CompleteEmployerWorkspace applications={scopedApplications} metrics={store.employer} respondPlacement={respondPlacement} apiConnected={apiConnected} cycle={store.cycle} campusDirectory={store.employer?.campusDirectory} />
      )}
      {mode !== 'applicant' && <button className="global-help-button" type="button" onClick={() => openHelp(mode)} aria-label="Open workspace help">Help</button>}
      {loginOpen && <LoginModal targetMode={loginTarget} onLogin={handleLogin} onAcceptInvitation={handleInvitation} onClose={() => setLoginOpen(false)} />}
      {helpOpen && <HelpPanel role={helpRole} onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function EmployerWorkspace({ applications, metrics, respondPlacement, apiConnected }) {
  const candidates = applications.filter((application) => ['Shortlisted', 'Placement ready', 'Placed'].includes(application.status));
  const totals = metrics || {
    visibleApplicants: applications.length,
    underReview: applications.filter((application) => application.status === 'Under review').length,
    shortlisted: applications.filter((application) => application.status === 'Shortlisted').length,
    placed: applications.filter((application) => application.status === 'Placed').length,
    needsAction: applications.filter((application) => application.status === 'Placement ready').length,
  };
  return <div className="employer-shell"><header className="employer-header"><div><p className="eyebrow">GCON EMPLOYER PORTAL</p><h1>Placement work, scoped to your organisation.</h1><p>Review released candidates and respond to placement requests. Staff remain responsible for eligibility decisions.</p></div><div className="employer-identity"><span className="org-mark">G</span><strong>GCON Placement Team</strong><small>{apiConnected ? 'Secure API session' : 'Demo session'}</small></div></header><main className="employer-content"><section className="employer-metrics"><Metric label="Visible applicants" value={totals.visibleApplicants} note="Released to GCON" icon="◌" /><Metric label="Under review" value={totals.underReview} note="Staff-owned decisions" icon="✓" /><Metric label="Shortlisted" value={totals.shortlisted} note="Ready for next action" icon="☆" accent /><Metric label="Needs response" value={totals.needsAction} note="Placement requests" icon="!" alert /></section><section className="employer-grid"><div className="panel employer-panel"><div className="panel-heading"><div><h2>Released candidate worklist</h2><p>Only records explicitly released to GCON appear here.</p></div><span className="review-scope"><span className="secure-dot" /> Organisation-scoped</span></div><div className="employer-table">{candidates.map((application) => <EmployerCandidateRow key={application.ref} application={application} respondPlacement={respondPlacement} />)}{candidates.length === 0 && <div className="empty-table">No released candidates need employer action.</div>}</div></div><aside className="panel employer-boundary"><div className="side-icon">✓</div><h2>What your team can do</h2><p>Respond to placement requests, record the campus response, and keep the placement action traceable.</p><div className="boundary-rule"><strong>Not visible here</strong><span>Unreleased applicants, sensitive review evidence, and staff eligibility decisions.</span></div><div className="boundary-rule"><strong>Next action</strong><span>Open a candidate, confirm the campus, and accept or decline the placement response.</span></div></aside></section></main></div>;
}

function EmployerCandidateRow({ application, respondPlacement }) {
  const [campus, setCampus] = useState(application.placementCampus || application.preferences?.[0] || 'Ann Latsky Campus');
  const [response, setResponse] = useState(application.placementResponse || '');
  const isActionable = application.status === 'Placement ready';
  const pendingOffer = application.status === 'Shortlisted';
  return <div className="employer-candidate"><div className="employer-candidate-main"><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></div></div><Status tone={application.status}>{application.status}</Status><div className="employer-candidate-meta"><span>Preference</span><strong>{application.preferences?.[0] || 'Not supplied'}</strong></div>{isActionable ? <div className="employer-actions"><select value={campus} onChange={(event) => setCampus(event.target.value)}><option>Ann Latsky Campus</option><option>Chris Hani Baragwanath Campus</option><option>SG Lourens Campus</option><option>Bonalesedi Campus</option></select><button className="approve-button" onClick={() => { setResponse('accepted'); respondPlacement(application.ref, 'accepted', campus); }}>Accept placement</button><button className="outline-button" onClick={() => { setResponse('declined'); respondPlacement(application.ref, 'declined', campus); }}>Decline</button></div> : <span className="employer-response">Accepted at {application.placementCampus || campus}</span>}{response && <small className="employer-confirmation">Response recorded: {response}</small>}</div>;
}

function GpgBrand({ compact = false }) {
  return <div className={`gpg-brand ${compact ? 'compact' : ''}`}><img src="/gpg-logo.png" alt="Gauteng Provincial Government" /><div><strong>GCON <span>2027</span></strong><small>Student Nurse Intake</small></div></div>;
}

function loadApplicantDraft() {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem('gcon-learner-draft') || '{}'); } catch { return {}; }
}

function AccessManagement({ result, profile, session, onRegister, setStep }) {
  const username = result?.values?.idNumber || profile.idNumber || '';
  const sitesDemo = typeof window !== 'undefined' && window.location.hostname.endsWith('.chatgpt.site');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createAccount() {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Password and confirmation must match.'); return; }
    setBusy(true);
    const response = await onRegister(sitesDemo ? { username, password } : { username, password, name: `${profile.firstName || 'Applicant'} ${profile.surname || ''}`.trim(), email: profile.email || '' });
    setBusy(false);
    if (!response?.user) { setError(response?.error?.message || 'The account could not be created.'); return; }
    setStep('profile');
  }
  return <div className="form-page"><StepHeader current="access" /><div className="form-grid"><section className="form-card access-card"><div className="card-heading"><div><h2>Access management</h2><p>Create your applicant account before completing the registration form.</p></div><span className="required-note">Required</span></div>{sitesDemo && <div className="sites-demo-banner"><strong>Sites demo registration</strong><span>Use demo values only. This temporary session is for workflow testing; the password, identifier and personal contact details are not stored.</span></div>}{session ? <div className="access-active"><div className="result-mark">✓</div><div><strong>{sitesDemo ? 'Temporary Sites demo account is active' : 'Your applicant account is active'}</strong><p>{sitesDemo ? 'This session is temporary and will expire. Continue to test the profile and review workflow.' : 'You are signed in securely. Continue to complete your profile.'}</p></div><button className="primary-button" type="button" onClick={() => setStep('profile')}>Continue to profile <span>→</span></button></div> : <><p className="access-note">{sitesDemo ? 'Use the demo username shown below and a throwaway password of at least 8 characters. Do not enter a real ID number, password, name or email address.' : 'Your username is your South African ID number. It is shown here for account identification and cannot be changed on this page.'}</p><label className="field"><span>Username</span><input value={username} readOnly /></label><div className="field-grid two"><label className="field"><span>Password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button form-submit" type="button" disabled={busy || !username} onClick={createAccount}>{busy ? 'Creating demo session…' : sitesDemo ? 'Start Sites demo registration' : 'Create applicant account'} <span>→</span></button></>}</section><aside className="side-explain"><div className="side-icon">✓</div><h3>One account for your application</h3><p>{sitesDemo ? 'The Sites demo session lets you test the registration screens without creating a persistent account.' : 'Your account lets you save the registration draft, upload documents, and return to your application securely.'}</p><div className="criteria-mini"><strong>Privacy boundary</strong><span>{sitesDemo ? 'No password, identifier or personal contact details are stored by the hosted demo registration route.' : 'Passwords are stored as secure hashes. The full password is never placed in the application record.'}</span></div></aside></div></div>;
}

function MvpApplicantPortal({ step, setStep, pathway, setPathway, result, setResult, checkQualification, submitted, submittedReference, application, cycle, submitApplication, recordNonQualifier, onRegisterLearner, onLogin, onHelp, session, onLogout }) {
  const savedDraft = useMemo(loadApplicantDraft, []);
  const [addressConfirmed, setAddressConfirmed] = useState(true);
  const [profile, setProfile] = useState(() => ({ ...defaultProfile, ...(savedDraft.profile || {}) }));
  const [preferences, setPreferences] = useState(() => normalizeCollegePreferences(savedDraft.preferences));
  const [documents, setDocuments] = useState(savedDraft.documents || { id: false, results: false });
  const [references, setReferences] = useState(savedDraft.references || [{ name: 'Nomsa Khumalo', relationship: 'Teacher', telephone: '082 555 0188' }]);
  const [previousTraining, setPreviousTraining] = useState(savedDraft.previousTraining || 'No');
  const [experience, setExperience] = useState(savedDraft.experience || []);
  const [additionalSubjects, setAdditionalSubjects] = useState(savedDraft.additionalSubjects || []);
  const [trainingHistory, setTrainingHistory] = useState(savedDraft.trainingHistory || []);
  const hasCompleteReference = references.some((reference) => reference.name?.trim() && reference.telephone?.trim());
  const hasRequiredProfile = ['firstName', 'surname', 'email', 'mobile', 'idNumber', 'streetAddress', 'suburb', 'province', 'school', 'resultYear'].every((key) => profile[key]?.trim());
  const intakeOpen = cycle?.advertStatus !== 'Paused';
  const canReview = Boolean(session) && intakeOpen && addressConfirmed && hasRequiredProfile && documents.id && documents.results && hasCompleteReference && preferences.some(Boolean);

  useEffect(() => {
    const draft = { pathway, pathwayValues: result?.values || {}, profile, preferences, documents, references, previousTraining, experience, additionalSubjects, trainingHistory, addressVerified: addressConfirmed };
    if (typeof window !== 'undefined') window.localStorage.setItem('gcon-learner-draft', JSON.stringify(draft));
    if (step === 'profile' || step === 'review') void saveApiDraft(draft);
  }, [step, pathway, result, profile, preferences, documents, references, previousTraining, experience, additionalSubjects, trainingHistory, addressConfirmed]);

  useEffect(() => {
    if (!result?.values) return;
    setProfile((current) => ({ ...current, idNumber: result.values.idNumber || current.idNumber, resultYear: result.values.resultYear || current.resultYear }));
  }, [result]);

  return <div className="applicant-layout">
    <header className="public-header"><GpgBrand /><nav><button onClick={() => setStep('landing')}>Home</button><button onClick={() => setStep('checker')}>Qualification checker</button><button onClick={onHelp}>FAQ</button>{session && <button className="header-profile" type="button" onClick={() => setStep('profile')} aria-label="Open my profile">My profile</button>}{session ? <button className="header-login" onClick={onLogout}>Sign out</button> : <button className="header-login" onClick={onLogin}>Login</button>}</nav></header>
    <main className="public-main">
      <div className={`intake-banner ${intakeOpen ? '' : 'paused-banner'}`}><span className="live-dot" /> {intakeOpen ? '2027 intake is open' : '2027 intake is currently paused'} <b>·</b> Applications close {cycle?.closeDate || '26 Sep 2026'}</div>
      {step === 'landing' && <MvpLanding setStep={setStep} cycle={cycle} application={application} />}
      {step === 'checker' && <QualificationCheckerV2 pathway={pathway} setPathway={setPathway} result={result} setResult={setResult} checkQualification={checkQualification} recordNonQualifier={recordNonQualifier} setStep={setStep} />}
      {step === 'access' && <AccessManagement result={result} profile={profile} session={session} onRegister={onRegisterLearner} setStep={setStep} />}
      {step === 'profile' && <ProfileForm applicationRef={application?.ref} preferences={preferences} setPreferences={setPreferences} profile={profile} setProfile={setProfile} pathway={pathway} qualificationResult={result} addressConfirmed={addressConfirmed} setAddressConfirmed={setAddressConfirmed} documents={documents} setDocuments={setDocuments} references={references} setReferences={setReferences} previousTraining={previousTraining} setPreviousTraining={setPreviousTraining} experience={experience} setExperience={setExperience} additionalSubjects={additionalSubjects} setAdditionalSubjects={setAdditionalSubjects} trainingHistory={trainingHistory} setTrainingHistory={setTrainingHistory} canReview={canReview} setStep={setStep} />}
      {step === 'review' && <CompleteReviewApplicationMinimal application={application} qualificationResult={result} profile={profile} pathway={pathway} preferences={preferences} documents={documents} references={references} previousTraining={previousTraining} experience={experience} additionalSubjects={additionalSubjects} trainingHistory={trainingHistory} submitted={submitted} submittedReference={submittedReference} submitApplication={() => submitApplication({ profile, pathway, preferences, documents, references, previousTraining, experience, additionalSubjects, trainingHistory, addressVerified: addressConfirmed })} setStep={setStep} />}
    </main>
    <footer className="public-footer"><span>Gauteng Provincial Government · Department of Health</span><button className="footer-link" onClick={onHelp}>Privacy · Help · Contact</button></footer>
  </div>;
}

function MvpLanding({ setStep, cycle, application }) {
  return <>
    <section className="public-hero"><div className="hero-copy"><p className="eyebrow">STUDENT NURSE INTAKE 2027</p><h1>Start your nursing journey in Gauteng.</h1><p className="hero-lede">Apply for the Diploma in Nursing at Gauteng College of Nursing. Check your subjects and scores first, then complete your profile if you qualify.</p><div className="hero-actions"><button className="primary-button" onClick={() => setStep('checker')}>Check my qualification →</button><button className="quiet-button" onClick={() => setStep('checker')}>View requirements</button><a className="quiet-button advert-link" href="/gcon-nursing-intake-advert-2026.png" target="_blank" rel="noreferrer">View original advert <span>↗</span></a></div><div className="hero-note"><span className="secure-dot" /> Gauteng applicants only · No late applications</div></div><div className="hero-panel"><div className="crest-ring"><img src="/gpg-logo.png" alt="" /></div><div><strong>Diploma in Nursing</strong><span>Ann Latsky · Chris Hani Baragwanath<br />SG Lourens · Bonalesedi</span></div><div className="hero-rule" /><div className="hero-panel-row"><span>Applications close</span><strong>{cycle?.closeDate || '26 Sep 2026'}</strong></div><div className="hero-panel-row"><span>Current step</span><strong>Qualification check</strong></div></div></section>
    {application && application.status !== 'Draft' && <section className="application-status-card"><div><p className="eyebrow">YOUR APPLICATION</p><strong>{application.status}</strong><span>{application.ref || 'Reference pending'} · Your receipt and correction messages are available.</span></div><button className="outline-button" onClick={() => setStep('review')}>View application status →</button></section>}
    <section className="info-band"><div><span className="info-number">01</span><strong>Check first</strong><p>Confirm the required subjects and scores before creating an account.</p></div><div><span className="info-number">02</span><strong>Complete profile</strong><p>Upload the two approved documents and add one reference.</p></div><div><span className="info-number">03</span><strong>Keep your receipt</strong><p>Use your daily reference number for corrections and outcomes.</p></div></section>
  </>;
}

function LoginModal({ targetMode, onLogin, onAcceptInvitation, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  async function submitLogin() {
    setBusy(true);
    setError('');
    const result = await onLogin(email, password);
    if (!result?.user) setError('Email or password is incorrect.');
    setBusy(false);
  }
  async function submitInvitation() {
    setBusy(true);
    setError('');
    const result = await onAcceptInvitation({ token, name, password });
    if (!result?.user) setError('The invitation could not be accepted. Check the token and password requirements.');
    setBusy(false);
  }
  async function useDemo(role) {
    setBusy(true);
    setError('');
    const result = await demoLoginApi(role);
    if (result?.user) {
      await onLogin('__demo__', '__demo__', result);
    } else {
      setError('The local demo session could not be started.');
    }
    setBusy(false);
  }
  const targetLabel = targetMode === 'staff' ? 'admissions workspace' : targetMode === 'employer' ? 'employer portal' : 'applicant portal';
  return <div className="modal-backdrop" role="presentation"><section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="modal-close" aria-label="Close login" onClick={onClose}>×</button><p className="eyebrow">GCON 2027 ACCESS</p><h2 id="login-title">Sign in to the {targetLabel}</h2><p className="login-copy">Use your account email and password. Your active role and organisation membership control what you can see.</p><div className="login-tabs"><button className={view === 'login' ? 'selected' : ''} onClick={() => { setView('login'); setError(''); }}>Sign in</button><button className={view === 'invite' ? 'selected' : ''} onClick={() => { setView('invite'); setError(''); }}>Accept invitation</button></div>{view === 'login' ? <div className="login-form"><label className="field"><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label><small className="login-hint">Local test accounts: lerato.mokoena@email.com / learner-demo · thandi.mokoena@gcon.example / staff-demo · placements@gcon.example / employer-demo</small></div> : <div className="login-form"><label className="field"><span>Invitation token</span><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the invitation token" /></label><label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label><label className="field"><span>Create password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label></div>}{error && <p className="login-error">{error}</p>}<button className="primary-button login-submit" disabled={busy || (view === 'login' ? !email || !password : !token || !password)} onClick={view === 'login' ? submitLogin : submitInvitation}>{busy ? 'Working…' : view === 'login' ? 'Sign in' : 'Accept invitation'}</button><div className="demo-access"><span className="saved-label">Demo access for presentation</span><div className="login-options"><button disabled={busy} onClick={() => useDemo('learner')}><strong>Applicant demo</strong><span>Open the learner journey</span></button><button disabled={busy} onClick={() => useDemo('staff')}><strong>Admissions demo</strong><span>Open the staff review workspace</span></button><button disabled={busy} onClick={() => useDemo('employer')}><strong>Employer demo</strong><span>Open released placement candidates</span></button></div></div></section></div>;
}

function LegacyHelpPanel({ onClose }) {
  return <div className="modal-backdrop" role="presentation"><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="modal-close" aria-label="Close help" onClick={onClose}>×</button><p className="eyebrow">HELP & FAQ</p><h2 id="help-title">GCON application help</h2><div className="help-list"><div><strong>Which pathways are supported?</strong><span>Senior Certificate, National Senior Certificate / Grade 12, and NC(V) Level 4.</span></div><div><strong>How are academic results compared?</strong><span>Your original pathway result is preserved. Any academic rank is calculated only against applicants in the same pathway; APS, M score and NC(V) percentages are not converted into a common score.</span></div><div><strong>What must I upload?</strong><span>A certified copy of your ID and your statement of results or certificate in PDF, JPG, or PNG format.</span></div><div><strong>Can I track progress?</strong><span>You receive a receipt, correction requests, and a final outcome. Detailed progress tracking is not shown.</span></div><div><strong>Need support?</strong><span>Contact the GCON admissions support team through your approved intake support channel.</span></div></div><button className="outline-button" onClick={onClose}>Close help</button></section></div>;
}

const helpContent = {
  applicant: {
    eyebrow: 'APPLICANT PORTAL HELP',
    title: 'Complete your intake application',
    intro: 'Use this portal to check the correct pathway, complete one application, and keep your receipt and official updates in one place.',
    sections: [
      ['1. Check your pathway', 'Choose Senior Certificate, National Senior Certificate / Grade 12, or NC(V) Level 4. Enter the original values shown on your record. Mathematics and Maths Literacy are alternatives; the app never adds them together.'],
      ['2. Understand your academic result', 'The checker applies the minimum rule for your selected pathway and preserves the original result. APS, Senior Certificate M score and NC(V) percentages are not converted into a common score. Any displayed academic rank is only within the same qualification pathway and does not decide the final outcome.'],
      ['3. Complete your profile', 'Provide your contact details, South African ID, school and result year. Click the OpenStreetMap pin to fill the address, then confirm that the location is in Gauteng.'],
      ['4. Upload and review', 'Upload the two approved evidence documents as PDF, JPG, or PNG, add at least one reference, select college preferences, and review the application before submitting.'],
      ['5. After submission', 'Keep the daily reference number. You will see a receipt, correction requests, in-app notifications and the final outcome. A detailed progress tracker is not shown. Use chat to ask admissions a question.'],
    ],
  },
  staff: {
    eyebrow: 'ADMISSIONS WORKSPACE HELP',
    title: 'Run the intake process step by step',
    intro: 'Admissions owns eligibility decisions, pathway-scoped academic review, evidence review, shortlist control, communications, placements and the audit trail. Employers only act after a staff placement offer is prepared.',
    sections: [
      ['1. Set the annual intake', 'On the dashboard, open Configure intake settings. Update the season name, opening and closing dates, advert status, approved document labels, pathway wording and each campus capacity. Save changes before the advert opens.'],
      ['2. Review applications', 'Open Applications or Review queue. Work from the original pathway values and uploaded evidence. Verify each document separately, request a correction when something is unclear, or reject it with the controlled reason.'],
      ['3. Use academic ranking correctly', 'Academic rank is calculated separately inside the NSC, Senior Certificate and NC(V) pathways. Do not compare an APS directly with an M score or NC(V) percentage. A cross-pathway ranking must remain unavailable until GCON approves a versioned equivalency matrix, including its formula, subject weights, rounding and tie rules.'],
      ['4. Make the eligibility decision', 'Approve only after the identity, documents, Gauteng address and pathway requirements are checked. Decline with a reason when the requirements are not met. Mass decline is limited to under-review or correction-requested records and creates one linked in-app notification per learner.'],
      ['5. Invite and record the psychometric test', 'Approved candidates appear in Shortlist. Select Invite psychometric test to record that the invitation was issued. The demo does not administer the test; a real test provider would send the assessment and return the result. After an invitation, record Pending, Passed, Failed or No show, with an optional score and notes. The outcome supports the next decision but does not replace eligibility or the pathway-scoped academic ranking.'],
      ['6. Prepare placement offers', 'After the required review and evaluation steps, open Placements, choose a campus and select Prepare offer. The API checks capacity, records the offer and releases that candidate to the employer organisation. A full campus cannot receive another offer.'],
      ['7. Communicate and close the loop', 'In Communication centre, choose the controlled audience and template, edit the message, preview it, then issue it. Delivery batches are recorded. Learners see official outcomes and notifications in their portal. Use Audit trail to confirm decisions, notifications, offers and withdrawals.'],
    ],
  },
  employer: {
    eyebrow: 'EMPLOYER PORTAL HELP',
    title: 'Respond to released placement offers',
    intro: 'The employer portal is organisation-scoped. It shows only candidates explicitly released to your organisation after admissions has completed its staff-owned work.',
    sections: [
      ['What you can see', 'Review released or assigned candidates, their pathway, original pathway score, placement status, candidate contact details and the approved campus contact directory. A pathway score is not a common cross-pathway ranking. Unreleased evidence and other organisations are not visible.'],
      ['When you can act', 'A candidate must have a Placement ready offer. Select the campus, then Accept placement or Decline. Shortlisted candidates are still waiting for admissions to prepare the offer.'],
      ['Campus reports', 'Use Print / save PDF for a print-ready list grouped by campus, or Export Excel list (.xls). Each campus section includes the campus address, placement contact, candidate reference, candidate contact details and placement contact details.'],
      ['What remains with admissions', 'Employers do not decide eligibility, verify documents, change decline reasons, browse unreleased candidates or access another organisation\'s work.'],
    ],
  },
};

function HelpPanel({ role = 'applicant', onClose }) {
  const content = helpContent[role] || helpContent.applicant;
  return <div className="modal-backdrop" role="presentation"><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="modal-close" aria-label="Close help" onClick={onClose}>×</button><p className="eyebrow">{content.eyebrow}</p><h2 id="help-title">{content.title}</h2><p className="help-intro">{content.intro}</p><div className="help-list">{content.sections.map(([title, body]) => <div key={title}><strong>{title}</strong><span>{body}</span></div>)}</div><button className="outline-button" onClick={onClose}>Close help</button></section></div>;
}

function ApplicantPortal({ step, setStep, pathway, setPathway, result, setResult, checkQualification, submitted, setSubmitted, submittedReference, submitApplication }) {
  const savedDraft = useMemo(loadApplicantDraft, []);
  const [addressConfirmed, setAddressConfirmed] = useState(true);
  const [preferences, setPreferences] = useState(() => normalizeCollegePreferences(savedDraft.preferences));
  const [documents, setDocuments] = useState(savedDraft.documents || { id: false, results: false });
  const [references, setReferences] = useState(savedDraft.references || [{ name: 'Nomsa Khumalo', relationship: 'Teacher', telephone: '082 555 0188' }]);
  const [previousTraining, setPreviousTraining] = useState(savedDraft.previousTraining || 'No');
  const [experience, setExperience] = useState(savedDraft.experience || []);
  const isReview = step === 'review';
  const preference = preferences[0];
  const canReview = addressConfirmed && documents.id && documents.results && references.length >= 1;

  useEffect(() => {
    const draft = { pathway, pathwayValues: result?.values || {}, preferences, documents, references, previousTraining, experience, addressVerified: addressConfirmed };
    if (typeof window !== 'undefined') window.localStorage.setItem('gcon-learner-draft', JSON.stringify(draft));
    if (step === 'profile' || step === 'review') void saveApiDraft(draft);
  }, [step, pathway, result, preferences, documents, references, previousTraining, experience, addressConfirmed]);

  return <div className="applicant-layout">
    <header className="public-header"><GpgBrand /><nav><button onClick={() => setStep('landing')}>Home</button><button onClick={() => setStep('checker')}>Qualification checker</button><button onClick={() => setStep('landing')}>FAQ</button><button className="header-login">Login</button></nav></header>
    <main className="public-main">
      <div className="intake-banner"><span className="live-dot" /> 2027 intake is open <b>·</b> Applications close 26 September 2026</div>
      {step === 'landing' && <Landing setStep={setStep} />}
       {step === 'checker' && <QualificationCheckerV2 pathway={pathway} setPathway={setPathway} result={result} setResult={setResult} checkQualification={checkQualification} setStep={setStep} />}
      {step === 'profile' && <ProfileForm preferences={preferences} setPreferences={setPreferences} addressConfirmed={addressConfirmed} setAddressConfirmed={setAddressConfirmed} documents={documents} setDocuments={setDocuments} references={references} setReferences={setReferences} previousTraining={previousTraining} setPreviousTraining={setPreviousTraining} experience={experience} setExperience={experience} canReview={canReview} setStep={setStep} />}
      {isReview && <ReviewApplicationMinimal preferences={preferences} documents={documents} references={references} previousTraining={previousTraining} experience={experience} submitted={submitted} setSubmitted={setSubmitted} submittedReference={submittedReference} submitApplication={submitApplication} setStep={setStep} />}
    </main>
    <footer className="public-footer"><span>Gauteng Provincial Government · Department of Health</span><span>Privacy · Help · Contact</span></footer>
  </div>;
}

function Landing({ setStep }) {
  return <>
    <section className="public-hero">
      <div className="hero-copy"><p className="eyebrow">STUDENT NURSE INTAKE 2027</p><h1>Start your nursing journey in Gauteng.</h1><p className="hero-lede">Apply for the Diploma in Nursing at Gauteng College of Nursing. Check your subjects and scores first, then complete your profile if you qualify.</p><div className="hero-actions"><button className="primary-button" onClick={() => setStep('checker')}>Check my qualification <span>→</span></button><button className="quiet-button" onClick={() => setStep('checker')}>View requirements</button></div><div className="hero-note"><span className="secure-dot" /> Gauteng applicants only · No late applications</div></div>
      <div className="hero-panel"><div className="crest-ring"><img src="/gpg-logo.png" alt="" /></div><div><strong>Diploma in Nursing</strong><span>Ann Latsky · Chris Hani Baragwanath<br />SG Lourens · Bonalesedi</span></div><div className="hero-rule" /><div className="hero-panel-row"><span>Applications close</span><strong>26 Sep 2026</strong></div><div className="hero-panel-row"><span>Current step</span><strong>Qualification check</strong></div></div>
    </section>
    <section className="info-band"><div><span className="info-number">01</span><strong>Check first</strong><p>Confirm the required subjects and scores before creating an account.</p></div><div><span className="info-number">02</span><strong>Complete profile</strong><p>Add your Gauteng address, school details and supporting evidence.</p></div><div><span className="info-number">03</span><strong>Submit once</strong><p>Review your CV-style application and receive a daily reference number.</p></div></section>
  </>;
}

function StepHeader({ current }) {
  const currentIndex = applicantSteps.findIndex(([id]) => id === current);
  return <div className="step-header"><div><p className="eyebrow">APPLICATION JOURNEY</p><h1>{applicantSteps[currentIndex]?.[1] || 'Qualification'}</h1></div><div className="steps">{applicantSteps.slice(1).map(([id, label], index) => <div className={`step ${id === current ? 'current' : index < currentIndex - 1 ? 'complete' : ''}`} key={id}><span>{index < currentIndex - 1 ? '✓' : index + 1}</span><label>{label}</label></div>)}</div></div>;
}

function QualificationChecker({ pathway, setPathway, result, setResult, checkQualification, setStep }) {
  const pathways = ['NSC / Grade 12', 'Senior Certificate', 'NC(V) Level 4'];
  const subjects = pathway === 'Senior Certificate' ? [['English', 'C'], ['Biology', 'C'], ['Mathematics', 'C']] : pathway === 'NC(V) Level 4' ? [['English FAL', '60%'], ['Mathematics', '55%'], ['Public Health', '60%'], ['The Human Body and Mind', '60%']] : [['English', 'Level 5'], ['Life Sciences', 'Level 5'], ['Mathematics', 'Level 4'], ['Life Orientation', 'Level 5']];
  return <div className="form-page"><StepHeader current="checker" /><div className="form-grid"><section className="form-card checker-card"><div className="card-heading"><div><h2>Check your qualification</h2><p>Use your final results, or your current Grade 11 results if you are in Grade 12.</p></div><span className="required-note">Required</span></div><div className="pathway-tabs">{pathways.map((item) => <button className={pathway === item ? 'selected' : ''} key={item} onClick={() => { setPathway(item); setResult(null); }}>{item}</button>)}</div><div className="field-grid two"><Field label="South African ID number" value="9901015808081" /><Field label="Year of results" value="2025" /></div><div className="field-grid two">{subjects.map(([label, value]) => <Field key={label} label={`${label} result`} value={value} select />)}</div><div className="form-footnote"><span className="secure-dot" /> Only the subjects needed for this pathway are requested.</div>{result === 'qualifies' && <ResultCard setStep={setStep} />}{result === 'does-not-qualify' && <NonQualifierCard setResult={setResult} />}{!result && <><button className="primary-button form-submit" onClick={checkQualification}>Check qualification <span>→</span></button><button className="checker-secondary" onClick={() => setResult('does-not-qualify')}>I do not meet all of the criteria</button></>}</section><aside className="side-explain"><div className="side-icon">✓</div><h3>Why we ask this first</h3><p>Your qualification result determines whether you continue to registration. If you do not qualify, we store the entered qualification values and non-qualifying result with any details you provide.</p><div className="criteria-mini"><strong>NSC minimum</strong><span>APS 27 · required subjects at Level 4+</span></div><div className="criteria-mini"><strong>Gauteng residence</strong><span>Your address and map pin must be within Gauteng.</span></div></aside></div></div>;
}

function ResultCard({ setStep }) { return <div className="result-card"><div className="result-mark">✓</div><div><strong>You meet the 2027 minimum criteria</strong><p>Indicative APS: <b>34.5</b> · Your subjects can be carried into your profile.</p></div><button className="text-button" onClick={() => setStep('profile')}>Continue registration <span>→</span></button></div>; }
function NonQualifierCardForm({ setResult, result }) {
  const [contact, setContact] = useState({ name: 'Lerato Mokoena', email: 'lerato.mokoena@email.com', telephone: '082 555 0194' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setContact((current) => ({ ...current, [key]: value }));
  const idNumber = String(result?.values?.idNumber || '');
  const maskedId = idNumber.length > 4 ? `${idNumber.slice(0, 3)}••••••${idNumber.slice(-4)}` : idNumber || 'Not supplied';
  async function saveContact() {
    setError('');
    const response = await recordApiNonQualifier({
      ...contact,
      pathway: result?.pathway,
      idNumber,
      qualificationValues: result?.values || {},
      qualificationStatus: result?.status || 'does-not-qualify',
      failed: result?.failed || [],
      score: result?.score ?? null,
    });
    if (!response) { setError('We could not save your contact details. Please try again.'); return; }
    setSaved(true);
  }
  return <div className="nonqualifier-card"><div className="result-mark">!</div><div><strong>We could not confirm the minimum criteria</strong><p>Your entered scores, selected certificate and ID are recorded with this non-qualifying result. Add your details if you want the intake team to retain a contact request for future requirements.</p></div><div className="nonqualifier-summary"><div><span>Selected certificate</span><strong>{result?.pathway || 'Not supplied'}</strong></div><div><span>South African ID number</span><strong>{maskedId}</strong></div></div><div className="minimal-contact"><label className="field"><span>Name</span><input value={contact.name} onChange={(event) => update('name', event.target.value)} /></label><label className="field"><span>Email</span><input type="email" value={contact.email} onChange={(event) => update('email', event.target.value)} /></label><label className="field"><span>Telephone</span><input type="tel" value={contact.telephone} onChange={(event) => update('telephone', event.target.value)} /></label></div>{error && <p className="login-error">{error}</p>}{saved ? <div className="decision-banner approved"><span>✓</span><div><strong>Details saved as a non-qualifying record</strong><small>Your entered qualification values and contact details were recorded for this intake.</small></div></div> : <button className="primary-button" type="button" onClick={saveContact}>Keep my details</button>}<button className="quiet-button" type="button" onClick={() => setResult(null)}>Review my results again</button></div>;
}

function NonQualifierCardComplete({ setResult, result }) { return <NonQualifierCardForm setResult={setResult} result={result} />; }

function ProfileForm({ preferences, setPreferences, addressConfirmed, setAddressConfirmed, documents, setDocuments, references, setReferences, previousTraining, setPreviousTraining, experience, setExperience, canReview, setStep }) {
  const updatePreference = (index, value) => setPreferences(preferences.map((item, itemIndex) => itemIndex === index ? value : item));
  const addReference = () => references.length < 3 && setReferences([...references, { name: '', relationship: 'Teacher', telephone: '' }]);
  const updateReference = (index, key, value) => setReferences(references.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const addExperience = () => experience.length < 3 && setExperience([...experience, { employer: '', role: '', years: '' }]);
  const updateExperience = (index, key, value) => setExperience(experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return <div className="form-page"><StepHeader current="profile" /><div className="profile-layout"><section className="form-card"><div className="card-heading"><div><h2>Create your profile</h2><p>Your qualification checker details have been pre-populated.</p></div><span className="saved-label">Saved automatically</span></div><div className="form-section"><h3>Personal details</h3><div className="field-grid three"><Field label="First name" value="Lerato" /><Field label="Surname" value="Mokoena" /><Field label="Email address" value="lerato.mokoena@email.com" /></div><div className="field-grid three"><Field label="Mobile number" value="082 555 0194" /><Field label="Create password" value="••••••••••" /><Field label="Confirm password" value="••••••••••" /></div></div><div className="form-section"><div className="section-line"><h3>Gauteng address</h3><span className={`verified-chip ${addressConfirmed ? '' : 'unverified-chip'}`}>{addressConfirmed ? '✓ Map location verified' : '! Pin needs confirmation'}</span></div><div className="field-grid two"><Field label="Street address" value="18 Vilakazi Street, Soweto" /><Field label="Suburb / town" value="Soweto" /><Field label="Province" value="Gauteng" select /></div><div className="map-box"><div className="map-grid" /><span className="map-pin">●</span><div className="map-label"><strong>{addressConfirmed ? 'Gauteng location confirmed' : 'Confirm your Gauteng location'}</strong><span>GPS pin is within the province boundary</span></div><button className="map-action" onClick={() => setAddressConfirmed(!addressConfirmed)}>{addressConfirmed ? 'Change pin' : 'Use current pin'}</button></div></div><div className="form-section"><div className="section-line"><h3>School and college preferences</h3><span className="required-note">Rank 1–4</span></div><div className="field-grid two"><Field label="School" value="Mofolo Secondary School" /><Field label="Result year" value="2025" /></div>{preferences.map((preference, index) => <div className="preference-input" key={`preference-${index}`}><span>Preference {index + 1}</span><select value={preference} onChange={(event) => updatePreference(index, event.target.value)}><option value="">No preference selected</option>{collegeCampuses.filter((campus) => !preferences.includes(campus) || campus === preference).map((campus) => <option key={campus}>{campus}</option>)}</select><small>Selection count is recorded for capacity planning.</small></div>)}</div><div className="form-section"><div className="section-line"><h3>Evidence documents</h3><span className="required-note">2 required</span></div><p className="section-copy">Upload the document types shown below. Accepted formats: PDF, JPG or PNG.</p><DocumentRow label="Certified copy of ID" required checked={documents.id} onChange={() => setDocuments({ ...documents, id: !documents.id })} /><DocumentRow label="Statement of results / certificate" required checked={documents.results} onChange={() => setDocuments({ ...documents, results: !documents.results })} /></div><div className="form-section"><div className="section-line"><h3>Additional questions</h3><span className="saved-label">Optional</span></div><div className="field-grid two"><Field label="Previous nursing training" value={previousTraining} select onChange={(event) => setPreviousTraining(event.target.value)} /><Field label="Previous training detail" value={previousTraining === 'Yes' ? 'Diploma / programme name' : 'Not required'} /></div><div className="subsection-line"><strong>Work experience</strong><span>Up to 3 entries · not required</span></div>{experience.map((item, index) => <div className="experience-row" key={`experience-${index}`}><input value={item.employer} onChange={(event) => updateExperience(index, 'employer', event.target.value)} placeholder="Employer" /><input value={item.role} onChange={(event) => updateExperience(index, 'role', event.target.value)} placeholder="Role" /><input value={item.years} onChange={(event) => updateExperience(index, 'years', event.target.value)} placeholder="Years" /></div>)}<button className="quiet-button add-button" onClick={addExperience}>+ Add work experience</button></div><div className="form-section"><div className="section-line"><h3>References</h3><span className="required-note">1–3 mandatory</span></div><p className="section-copy">Add at least one reference. Include their relationship to you and a telephone number.</p>{references.map((reference, index) => <div className="reference-row" key={`reference-${index}`}><input value={reference.name} onChange={(event) => updateReference(index, 'name', event.target.value)} placeholder="Reference name" /><select value={reference.relationship} onChange={(event) => updateReference(index, 'relationship', event.target.value)}>{relationshipOptions.map((relationship) => <option key={relationship}>{relationship}</option>)}</select><input value={reference.telephone} onChange={(event) => updateReference(index, 'telephone', event.target.value)} placeholder="Telephone" /></div>)}<button className="quiet-button add-button" onClick={addReference} disabled={references.length >= 3}>+ Add another reference</button></div><div className="form-actions"><button className="quiet-button" onClick={() => setStep('checker')}>Back</button><div className="form-submit-group"><span>{canReview ? 'Ready for review' : 'Upload both documents and add one reference to continue'}</span><button className="primary-button" disabled={!canReview} onClick={() => setStep('review')}>Review application <span>→</span></button></div></div></section><aside className="profile-summary"><div className="summary-top"><span className="summary-avatar">LM</span><div><strong>Lerato Mokoena</strong><span>NSC / Grade 12</span></div></div><div className="summary-score"><span>Indicative APS</span><strong>34.5</strong></div><div className="summary-list"><div><span>Stage</span><strong>Stage 1: Applicant</strong></div><div><span>Address</span><strong>{addressConfirmed ? 'Gauteng verified' : 'Confirm map pin'}</strong></div><div><span>Preferences</span><strong>{preferences.filter(Boolean).length} selected</strong></div><div><span>References</span><strong>{references.length} added</strong></div></div><div className="summary-note">Your application will use the latest profile information when you submit.</div></aside></div></div>;
}

function ReviewApplicationMinimal({ preferences, documents, references, previousTraining, experience, submitted, setSubmitted, submittedReference, submitApplication, setStep }) {
  if (submitted) return <div className="confirmation"><div className="confirmation-mark">✓</div><p className="eyebrow">APPLICATION RECEIVED</p><h1>Your application has been submitted.</h1><p>Keep your reference number. We will contact you if a correction is required or when an outcome is available.</p><div className="reference-card"><span>Reference number</span><strong>{submittedReference || 'GCON20260731-01'}</strong><small>Submission receipt · saved by the intake service</small></div><div className="minimal-status"><strong>What happens next</strong><span>Staff review your original pathway results and uploaded evidence.</span><span>You will only see a correction request or final outcome here.</span></div><button className="primary-button" onClick={() => setStep('landing')}>Return to home <span>→</span></button></div>;
  return <div className="form-page"><StepHeader current="review" /><section className="application-sheet"><div className="sheet-head"><div><p className="eyebrow">APPLICATION PREVIEW</p><h2>GCON 2027 · Diploma in Nursing</h2><p>Review your details before submitting. Your submitted application becomes a fixed snapshot.</p></div><div className="draft-tag">Draft · APS double-checked</div></div><div className="cv-grid"><div className="cv-main"><section className="cv-section"><h3>Applicant</h3><div className="cv-fields"><div><span>Full name</span><strong>Lerato Mokoena</strong></div><div><span>ID number</span><strong>990101•••••081</strong></div><div><span>Email</span><strong>lerato.mokoena@email.com</strong></div><div><span>Telephone</span><strong>082 555 0194</strong></div></div></section><section className="cv-section"><h3>Education and score</h3><div className="cv-fields"><div><span>Pathway</span><strong>NSC / Grade 12</strong></div><div><span>School</span><strong>Mofolo Secondary School</strong></div><div><span>Subjects</span><strong>English · Life Sciences · Mathematics</strong></div><div><span>Verified APS</span><strong className="score-text">34.5</strong></div></div></section><section className="cv-section"><h3>College preferences</h3>{preferences.filter(Boolean).map((preference, index) => <div className="preference-row" key={preference}><span>{index + 1}</span><strong>{preference}</strong><small>Ranked preference · capacity count recorded</small></div>)}</section><section className="cv-section"><h3>Additional information</h3><div className="cv-fields"><div><span>Previous nursing training</span><strong>{previousTraining}</strong></div><div><span>Work experience</span><strong>{experience.length ? `${experience.length} entries` : 'None supplied'}</strong></div><div><span>References</span><strong>{references.length} recorded</strong></div></div></section></div><aside className="cv-side"><div className="cv-profile"><span className="large-avatar">LM</span><strong>Lerato Mokoena</strong><span>Gauteng · Ready for submission</span></div><div className="cv-block"><h3>Evidence</h3><DocumentStatus label="Certified copy of ID" ready={documents.id} /><DocumentStatus label="Statement of results" ready={documents.results} /></div><div className="cv-block"><h3>Profile completeness</h3><div className="progress"><span /></div><strong>100%</strong><small>Required documents and at least one reference are present.</small></div></aside></div><div className="sheet-footer"><button className="quiet-button" onClick={() => setStep('profile')}>Back to profile</button><button className="primary-button" onClick={() => { submitApplication(); setSubmitted(true); }}>Submit application <span>→</span></button></div></section></div>;
}

function ReviewApplication({ preferences, documents, references, previousTraining, experience, submitted, setSubmitted, submittedReference, submitApplication, setStep }) {
  if (submitted) return <div className="confirmation"><div className="confirmation-mark">✓</div><p className="eyebrow">APPLICATION RECEIVED</p><h1>Your application is in evaluation.</h1><p>Keep this reference number for future communication. You can view neutral progress stages from your applicant profile.</p><div className="reference-card"><span>Reference number</span><strong>{submittedReference || 'GCON20270731-01'}</strong><small>Submitted 31 July 2026 · 10:14 · Saved to local intake store</small></div><div className="stage-track"><div className="active"><span>1</span><strong>Stage 1: Applicant</strong><small>Application received</small></div><div><span>2</span><strong>Stage 2: Evaluation</strong><small>Next step</small></div></div><button className="primary-button" onClick={() => setStep('landing')}>Return to home <span>→</span></button></div>;
  return <div className="form-page"><StepHeader current="review" /><section className="application-sheet"><div className="sheet-head"><div><p className="eyebrow">APPLICATION PREVIEW</p><h2>GCON 2027 · Diploma in Nursing</h2><p>Review your details before submitting. Your submitted application becomes a fixed snapshot.</p></div><div className="draft-tag">Draft · APS double-checked</div></div><div className="cv-grid"><div className="cv-main"><section className="cv-section"><h3>Applicant</h3><div className="cv-fields"><div><span>Full name</span><strong>Lerato Mokoena</strong></div><div><span>ID number</span><strong>990101•••••081</strong></div><div><span>Email</span><strong>lerato.mokoena@email.com</strong></div><div><span>Telephone</span><strong>082 555 0194</strong></div></div></section><section className="cv-section"><h3>Education and score</h3><div className="cv-fields"><div><span>Pathway</span><strong>NSC / Grade 12</strong></div><div><span>School</span><strong>Mofolo Secondary School</strong></div><div><span>Subjects</span><strong>English · Life Sciences · Mathematics</strong></div><div><span>Verified APS</span><strong className="score-text">34.5</strong></div></div></section><section className="cv-section"><h3>College preferences</h3>{preferences.filter(Boolean).map((preference, index) => <div className="preference-row" key={preference}><span>{index + 1}</span><strong>{preference}</strong><small>Ranked preference · capacity count recorded</small></div>)}</section><section className="cv-section"><h3>Additional information</h3><div className="cv-fields"><div><span>Previous nursing training</span><strong>{previousTraining}</strong></div><div><span>Work experience</span><strong>{experience.length ? `${experience.length} entries` : 'None supplied'}</strong></div><div><span>References</span><strong>{references.length} recorded</strong></div></div></section></div><aside className="cv-side"><div className="cv-profile"><span className="large-avatar">LM</span><strong>Lerato Mokoena</strong><span>Gauteng · Stage 1: Applicant</span></div><div className="cv-block"><h3>Evidence</h3><DocumentStatus label="Certified copy of ID" ready={documents.id} /><DocumentStatus label="Statement of results" ready={documents.results} /></div><div className="cv-block"><h3>Profile completeness</h3><div className="progress"><span /></div><strong>100%</strong><small>Required documents and at least one reference are present.</small></div></aside></div><div className="sheet-footer"><button className="quiet-button" onClick={() => setStep('profile')}>Back to profile</button><button className="primary-button" onClick={() => { submitApplication(); setSubmitted(true); }}>Submit application <span>→</span></button></div></section></div>;
}

function ProfileFormComplete({ cycle, preferences, setPreferences, profile, setProfile, pathway, qualificationResult, addressConfirmed, setAddressConfirmed, documents, setDocuments, references, setReferences, previousTraining, setPreviousTraining, experience, setExperience, additionalSubjects, setAdditionalSubjects, trainingHistory, setTrainingHistory, canReview, setStep, applicationRef }) {
  const updateProfile = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const updatePreference = (index, value) => setPreferences(preferences.map((item, itemIndex) => itemIndex === index ? value : item));
  const addReference = () => references.length < 3 && setReferences([...references, { name: '', relationship: 'Teacher', telephone: '' }]);
  const updateReference = (index, key, value) => setReferences(references.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const addExperience = () => experience.length < 3 && setExperience([...experience, { startDate: '', endDate: '', current: false, employer: '', jobTitle: '', responsibilities: '', reason: '' }]);
  const updateExperience = (index, key, value) => setExperience(experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const addSubject = () => additionalSubjects.length < 12 && setAdditionalSubjects([...additionalSubjects, { name: '', result: '' }]);
  const updateSubject = (index, key, value) => setAdditionalSubjects(additionalSubjects.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const addTraining = () => trainingHistory.length < 3 && setTrainingHistory([...trainingHistory, { institution: '', qualification: '', completed: 'Yes', year: '', sancRegistered: 'No', course: 'Enrolled Nurse' }]);
  const updateTraining = (index, key, value) => setTrainingHistory(trainingHistory.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const input = (label, key, type = 'text') => {
    const inputId = `profile-${key}`;
    const handleInput = (event) => updateProfile(key, event.target.value);
    const inputType = type === 'email' || type === 'tel' ? 'text' : type;
    const contactField = type === 'email' || type === 'tel';
    return <label className="field" key={key} htmlFor={inputId}><span>{label}</span><input id={inputId} name={key} aria-label={label} type={inputType} {...(contactField ? { defaultValue: profile[key] ?? '' } : { value: profile[key] ?? '' })} onInput={handleInput} /></label>;
  };
  const documentTypes = cycle?.documentTypes || globalThis.__gconCycle?.documentTypes || ['Certified copy of ID', 'Statement of results / certificate'];
  const referenceReady = references.some((reference) => reference.name?.trim() && reference.telephone?.trim());
  return <div className="form-page"><StepHeader current="profile" /><div className="profile-layout"><section className="form-card"><div className="card-heading"><div><h2>Complete your profile</h2><p>Your qualification values stay in their original reported form and the fields below are saved as your draft.</p></div><span className="saved-label">Saved automatically</span></div>
    <div className="form-section"><h3>Personal details</h3><div className="field-grid three">{input('First name', 'firstName')}{input('Surname', 'surname')}{input('Email address', 'email', 'email')}</div><div className="field-grid two">{input('Mobile number', 'mobile', 'tel')}{input('South African ID number', 'idNumber')}</div></div>
    <div className="form-section"><div className="section-line"><h3>Gauteng address</h3><span className={`verified-chip ${addressConfirmed ? '' : 'unverified-chip'}`}>{addressConfirmed ? 'Map location verified' : 'Pin needs confirmation'}</span></div><div className="field-grid three">{input('Street address', 'streetAddress')}{input('Suburb / town', 'suburb')}<label className="field"><span>Province</span><select value={profile.province || ''} onChange={(event) => { updateProfile('province', event.target.value); setAddressConfirmed(false); }}><option>Gauteng</option><option>Other province</option></select></label></div><AddressMapPicker profile={profile} setProfile={setProfile} addressConfirmed={addressConfirmed} setAddressConfirmed={setAddressConfirmed} /></div>
    <div className="form-section"><div className="section-line"><h3>School details and college preferences</h3><span className="required-note">Rank 1-4</span></div><div className="field-grid two">{input('School', 'school')}<label className="field" htmlFor="profile-resultYear"><span>Year of results</span><select id="profile-resultYear" name="resultYear" aria-label="Year of results" value={profile.resultYear || ''} onChange={(event) => updateProfile('resultYear', event.target.value)}>{resultYearOptions.map((year) => <option key={year}>{year}</option>)}</select></label></div><div className="subsection-line"><strong>Remaining subjects</strong><span>{pathway}-specific subjects not used in the minimum check</span></div>{additionalSubjects.map((subject, index) => <div className="subject-entry" key={`subject-${index}`}><input value={subject.name} onChange={(event) => updateSubject(index, 'name', event.target.value)} placeholder="Subject name" /><input value={subject.result} onChange={(event) => updateSubject(index, 'result', event.target.value)} placeholder="Result / level" /></div>)}<button className="quiet-button add-button" type="button" onClick={addSubject} disabled={additionalSubjects.length >= 12}>+ Add remaining subject</button>{preferences.map((preference, index) => <div className="preference-input" key={`preference-${index}`}><span>Preference {index + 1}</span><select id={`profile-preference-${index + 1}`} name={`preference-${index + 1}`} aria-label={`Preference ${index + 1}`} value={preference} onChange={(event) => updatePreference(index, event.target.value)}><option value="">No preference selected</option>{collegeCampuses.filter((campus) => !preferences.includes(campus) || campus === preference).map((campus) => <option key={campus}>{campus}</option>)}</select><small>Selection count is recorded for capacity planning.</small></div>)}</div>
    <div className="form-section"><div className="section-line"><h3>Evidence documents</h3><span className="required-note">2 required</span></div><p className="section-copy">Upload the document types shown below. Accepted formats: PDF, JPG or PNG, up to 10 MB each.</p><UploadableDocumentRow label={documentTypes[0]} required checked={Boolean(documents.id)} pathway={pathway} pathwayValues={qualificationResult?.values} ref={applicationRef} onChange={(document) => setDocuments((current) => ({ ...current, id: document }))} /><UploadableDocumentRow label={documentTypes[1]} required checked={Boolean(documents.results)} pathway={pathway} pathwayValues={qualificationResult?.values} ref={applicationRef} onChange={(document) => setDocuments((current) => ({ ...current, results: document }))} /></div>
    <div className="form-section"><div className="section-line"><h3>Previous nursing training</h3><span className="saved-label">Optional</span></div><label className="field"><span>Have you completed previous nursing training?</span><select value={previousTraining} onChange={(event) => { setPreviousTraining(event.target.value); if (event.target.value === 'No') setTrainingHistory([]); }}><option>No</option><option>Yes</option></select></label>{previousTraining === 'Yes' && <>{trainingHistory.map((training, index) => <div className="training-card" key={`training-${index}`}><div className="field-grid two"><label className="field"><span>Name of institution</span><input value={training.institution} onChange={(event) => updateTraining(index, 'institution', event.target.value)} /></label><label className="field"><span>Qualification</span><input value={training.qualification} onChange={(event) => updateTraining(index, 'qualification', event.target.value)} /></label><label className="field"><span>Completed</span><select value={training.completed} onChange={(event) => updateTraining(index, 'completed', event.target.value)}><option>Yes</option><option>No</option></select></label><label className="field"><span>Year</span><input type="number" value={training.year} onChange={(event) => updateTraining(index, 'year', event.target.value)} /></label><label className="field"><span>Registered with South African Nursing Council</span><select value={training.sancRegistered} onChange={(event) => updateTraining(index, 'sancRegistered', event.target.value)}><option>Yes</option><option>No</option></select></label><label className="field"><span>Course</span><select value={training.course} onChange={(event) => updateTraining(index, 'course', event.target.value)}><option>Enrolled Nurse</option><option>Professional Nurse</option><option>Auxiliary Nurse</option><option>Other</option></select></label></div></div>)}<button className="quiet-button add-button" type="button" onClick={addTraining} disabled={trainingHistory.length >= 3}>+ Add training record</button></>}</div>
    <div className="form-section"><div className="section-line"><h3>Work experience</h3><span className="saved-label">Optional · up to 3 entries</span></div>{experience.map((item, index) => <div className="experience-card" key={`experience-${index}`}><div className="field-grid two"><label className="field"><span>Start date</span><input type="date" value={item.startDate || ''} onChange={(event) => updateExperience(index, 'startDate', event.target.value)} /></label><label className="field"><span>End date</span><input type="date" value={item.endDate || ''} disabled={item.current} onChange={(event) => updateExperience(index, 'endDate', event.target.value)} /></label><label className="field"><span>Employer</span><input value={item.employer || ''} onChange={(event) => updateExperience(index, 'employer', event.target.value)} /></label><label className="field"><span>Job title</span><input value={item.jobTitle || item.role || ''} onChange={(event) => updateExperience(index, 'jobTitle', event.target.value)} /></label><label className="field field-wide"><span>Job responsibilities</span><textarea rows="3" value={item.responsibilities || ''} onChange={(event) => updateExperience(index, 'responsibilities', event.target.value)} /></label><label className="field field-wide"><span>Reason for leaving</span><input value={item.reason || ''} onChange={(event) => updateExperience(index, 'reason', event.target.value)} /></label></div><label className="checkbox-field"><input type="checkbox" checked={Boolean(item.current)} onChange={(event) => updateExperience(index, 'current', event.target.checked)} /> Current employment</label></div>)}<button className="quiet-button add-button" type="button" onClick={addExperience} disabled={experience.length >= 3}>+ Add work experience</button></div>
    <div className="form-section"><div className="section-line"><h3>References</h3><span className="required-note">1-3 mandatory</span></div><p className="section-copy">Add at least one reference with a relationship and telephone number.</p>{references.map((reference, index) => <div className="reference-row" key={`reference-${index}`}><input id={`reference-name-${index + 1}`} name={`reference-name-${index + 1}`} aria-label={`Reference ${index + 1} name`} value={reference.name} onChange={(event) => updateReference(index, 'name', event.target.value)} placeholder="Reference name" /><select id={`reference-relationship-${index + 1}`} name={`reference-relationship-${index + 1}`} aria-label={`Reference ${index + 1} relationship`} value={reference.relationship} onChange={(event) => updateReference(index, 'relationship', event.target.value)}>{relationshipOptions.map((relationship) => <option key={relationship}>{relationship}</option>)}</select><input id={`reference-telephone-${index + 1}`} name={`reference-telephone-${index + 1}`} aria-label={`Reference ${index + 1} telephone`} defaultValue={reference.telephone || ''} onInput={(event) => updateReference(index, 'telephone', event.target.value)} placeholder="Telephone" /></div>)}<button className="quiet-button add-button" type="button" onClick={addReference} disabled={references.length >= 3}>+ Add another reference</button></div>
    <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setStep('checker')}>Back</button><div className="form-submit-group"><span>{canReview && referenceReady ? 'Ready for review' : 'Complete your profile, confirm Gauteng, upload both documents, and add one reference'}</span><button className="primary-button" type="button" disabled={!canReview || !referenceReady} onClick={() => setStep('review')}>Review application <span>→</span></button></div></div>
  </section><aside className="profile-summary"><div className="summary-top"><span className="summary-avatar">{`${profile.firstName?.[0] || 'L'}${profile.surname?.[0] || 'M'}`}</span><div><strong>{`${profile.firstName || 'First'} ${profile.surname || 'name'}`}</strong><span>{pathway}</span></div></div><div className="summary-score"><span>{pathway === 'Senior Certificate' ? 'M score' : pathway === 'NSC / Grade 12' ? 'APS' : 'NC(V) result'}</span><strong>{qualificationResult?.score || qualificationResult?.values?.aps || 'Pending'}</strong></div><div className="summary-list"><div><span>Stage</span><strong>Stage 1: Applicant</strong></div><div><span>Address</span><strong>{addressConfirmed ? 'Gauteng verified' : 'Confirm map pin'}</strong></div><div><span>Preferences</span><strong>{preferences.filter(Boolean).length} selected</strong></div><div><span>References</span><strong>{references.filter((reference) => reference.name?.trim()).length} added</strong></div></div><div className="summary-note">Your latest saved profile is used when you submit.</div></aside></div></div>;
}

function Field({ label, value, select, onChange }) { const options = label === 'Province' ? ['Gauteng', 'Other province'] : label === 'Previous nursing training' ? ['No', 'Yes'] : label.toLowerCase().includes('result') ? [value, 'Level 4', 'Level 5', '60%', '55%', 'C'] : [value, 'Chris Hani Baragwanath Campus', 'SG Lourens Campus', 'Bonalesedi Campus']; return <label className="field"><span>{label}</span>{select ? <select {...(onChange ? { value, onChange } : { defaultValue: value })}>{options.filter((option, index) => options.indexOf(option) === index).map((option) => <option key={option}>{option}</option>)}</select> : <input value={value} readOnly />}</label>; }
function DocumentRow({ label, required, checked, onChange }) { return <button className={`document-row ${checked ? 'checked' : ''}`} onClick={onChange}><span className="doc-icon">{checked ? '✓' : '↑'}</span><span><strong>{label}</strong><small>{required ? 'Required · click to simulate upload' : 'Optional'}</small></span><b>{checked ? 'Uploaded' : 'Upload'}</b></button>; }
function DocumentStatus({ label, ready }) { return <div className="document-status"><span className={ready ? 'doc-ready' : 'doc-missing'}>{ready ? '✓' : '!'}</span><span>{label}</span><strong>{ready ? 'Ready' : 'Missing'}</strong></div>; }

function StaffWorkspace({ page, setPage, query, setQuery, applications, selectedApplication, selectedRef, setSelectedRef, decision, declineReason, setDeclineReason, submitDecision, auditLog, lettersIssued, issueLetters, cycle, changeAdvertStatus, updateCycle, assignPlacement, withdrawApplication, apiConnected, liveData, onRefreshReports, onStateChange }) {
  return <div className="staff-layout"><aside className="staff-sidebar"><GpgBrand compact /><div className="rail-label">Admissions workspace</div><nav className="main-nav" aria-label="Admissions navigation">{staffNav.map(([id, label, symbol]) => <button key={id} aria-label={label} className={`nav-item ${page === id ? 'selected' : ''}`} onClick={() => setPage(id)}><Icon>{symbol}</Icon><span>{label}</span>{id === 'reviewQueue' && <em>27</em>}</button>)}</nav><div className="sidebar-footer"><button className="learner-link" aria-label="Applicant portal" onClick={() => setPage('applications')}><Icon>↔</Icon><span>Applicant portal</span></button><div className="privacy-note"><span className="secure-dot" /> Restricted staff access · {apiConnected ? 'Local API connected' : 'Browser storage fallback'}</div><div className="user-mini"><div className="avatar">TM</div><div><strong>Thandi Mokoena</strong><small>Admissions coordinator</small></div><span className="more">···</span></div></div></aside><main className="staff-main"><header className="staff-topbar"><div className="crumb"><span>{cycle?.name || 'GCON 2027'}</span><b>/</b><strong>{staffNav.find(([id]) => id === page)?.[1] || 'Dashboard'}</strong></div><div className="staff-actions"><span className="cycle-label">Annual cycle <strong>{cycle?.name || 'GCON 2027'}</strong></span><button className="icon-button" aria-label="Notifications">♧<i /></button><div className="org-mark">G</div></div></header><div className="staff-content">{page === 'dashboard' && <StaffDashboard applications={applications} setPage={setPage} setSelectedRef={setSelectedRef} cycle={cycle} changeAdvertStatus={changeAdvertStatus} updateCycle={updateCycle} />} {page === 'applications' && <ApplicationsPage data={liveData} onDataChange={onStateChange} applications={applications} query={query} setQuery={setQuery} setSelectedRef={setSelectedRef} setPage={setPage} />} {page === 'reviewQueue' && <ReviewQueue data={liveData} onDataChange={onStateChange} applications={applications} selectedApplication={selectedApplication} selectedRef={selectedRef} setSelectedRef={setSelectedRef} decision={decision} declineReason={declineReason} setDeclineReason={setDeclineReason} submitDecision={submitDecision} />} {page === 'shortlist' && <ShortlistPage data={liveData} onDataChange={onStateChange} setPage={setPage} />} {page === 'letters' && <LettersPage issued={lettersIssued} issueLetters={issueLetters} />} {page === 'reports' && <ReportsPage cycle={cycle} data={liveData} onRefresh={onRefreshReports} />} {page === 'audit' && <AuditPage auditLog={auditLog} />} {page === 'placements' && <PlacementsPage />}</div></main></div>;
}

function StaffDashboard({ applications, setPage, setSelectedRef, cycle, changeAdvertStatus }) { return <><section className="staff-welcome"><div><p className="eyebrow">ADMISSIONS WORKSPACE</p><h1>See the next decision clearly.</h1><p>A focused view of Gauteng applicants for the 2027 intake. Personal data stays protected and every decision remains auditable.</p></div><div className="cycle-card"><span>Applications open</span><strong>{cycle.openDate} — {cycle.closeDate}</strong><span className="advert-state">Advert: {cycle.advertStatus}</span><button onClick={() => setPage('applications')}>View applications <span>→</span></button><button className="cycle-control" onClick={() => changeAdvertStatus(cycle.advertStatus === 'Published' ? 'Paused' : 'Published')}>{cycle.advertStatus === 'Published' ? 'Pause advert' : 'Publish advert'} <span>↗</span></button></div></section><section className="metric-grid staff-metrics"><Metric label="Submitted" value="12 480" note="Across all pathways" icon="◌" /><Metric label="Under review" value="3 210" note="Manual checks in progress" icon="✓" /><Metric label="Shortlisted" value="680" note="Ready for evaluation" icon="☆" accent /><Metric label="Needs action" value="94" note="Across review queues" icon="!" alert /></section><section className="staff-dashboard-grid"><div className="staff-primary"><div className="panel pipeline-panel"><div className="panel-heading"><div><h2>Evaluation pipeline</h2><p>Where applications are in the visible journey.</p></div><button className="text-button" onClick={() => setPage('applications')}>Open applications <span>→</span></button></div><div className="pipeline-bar"><span className="bar-submitted" /><span className="bar-review" /><span className="bar-shortlist" /><span className="bar-place" /></div><div className="pipeline-legend"><PipelineLegend color="submitted" label="Applicant" value="90%" /><PipelineLegend color="review" label="Evaluation" value="62%" /><PipelineLegend color="shortlist" label="Shortlisted" value="34%" /><PipelineLegend color="place" label="Deferred phase" value="12%" /></div></div><div className="panel work-panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Names, references and scores are visible; IDs stay masked.</p></div><button className="text-button" onClick={() => setPage('applications')}>View all <span>→</span></button></div><ApplicationTable applications={applications.slice(0, 4)} setSelectedRef={setSelectedRef} setPage={setPage} compact /></div></div><div className="staff-side"><div className="panel attention-panel"><div className="panel-heading compact"><div><h2>Attention queue</h2><p>What needs a decision next.</p></div><span className="queue-count">3</span></div><div className="attention-list"><button className="attention-item" onClick={() => setPage('reviewQueue')}><span className="queue-icon gold">!</span><span><strong>18 shortlist decisions due</strong><small>Decisions due by 08 Aug</small></span><b>18</b></button><button className="attention-item" onClick={() => setPage('reviewQueue')}><span className="queue-icon blue">↑</span><span><strong>9 document checks pending</strong><small>Require human review</small></span><b>9</b></button><button className="attention-item" onClick={() => setPage('applications')}><span className="queue-icon slate">+</span><span><strong>67 new applications</strong><small>Since your last visit</small></span><b>67</b></button></div><button className="queue-button" onClick={() => setPage('reviewQueue')}>Open review queue <span>→</span></button></div><div className="review-note"><div className="review-icon">✓</div><div><h2>Human review stays visible.</h2><p>Evidence, decisions, reasons, timestamps and letters remain available to authorised staff.</p><button className="text-button" onClick={() => setPage('audit')}>View audit trail <span>→</span></button></div></div></div></section></>; }

function ApplicationsPage({ applications, query, setQuery, setSelectedRef, setPage }) { return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">APPLICATIONS</p><h1>All submitted applications</h1><p>Search by surname or ID number. Protected identifiers are masked in the worklist.</p></div><button className="outline-button">Export report <span>↓</span></button></div><div className="panel work-panel full-table"><div className="table-toolbar"><div className="search wide"><Icon>⌕</Icon><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search surname, ID number or reference" /></div><span className="results-count">{applications.length} visible results</span><button className="filter-button">All pathways⌄</button></div><ApplicationTable applications={applications} setSelectedRef={setSelectedRef} setPage={setPage} /></div></section>; }

function ApplicationTable({ applications, setSelectedRef, setPage, compact }) { return <div className="table-wrap"><table className={compact ? 'compact-table' : ''}><thead><tr><th>Applicant</th><th>Reference</th><th>Pathway</th><th>Score</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{applications.map((application) => <tr key={application.ref} onClick={() => { setSelectedRef(application.ref); setPage('reviewQueue'); }}><td><strong>{application.name}</strong><small>{application.id}</small></td><td>{application.ref}</td><td>{application.pathway}</td><td><strong>{application.score}</strong></td><td><Status tone={application.status}>{application.status}</Status></td><td>{application.updated}</td><td><button className="row-arrow" aria-label={`Open ${application.ref}`}>→</button></td></tr>)}{applications.length === 0 && <tr><td colSpan="7" className="empty-table">No matching applications.</td></tr>}</tbody></table></div>; }

function ReviewQueue({ applications, selectedApplication, selectedRef, setSelectedRef, decision, declineReason, setDeclineReason, submitDecision }) { return <section className="staff-page review-page"><div className="page-heading"><div><p className="eyebrow">REVIEW QUEUE · 27 OPEN</p><h1>Verify and decide</h1><p>Review evidence and scores, then approve for shortlisting or decline with a controlled reason.</p></div><span className="review-scope"><span className="secure-dot" /> Human review required</span></div><div className="review-layout"><div className="panel queue-list"><div className="queue-list-head"><strong>Assigned to me</strong><span>{applications.length} of 27</span></div>{applications.map((application) => <button className={`queue-row ${selectedRef === application.ref ? 'selected' : ''}`} key={application.ref} onClick={() => setSelectedRef(application.ref)}><span className="queue-avatar">{application.name.split(' ').map(part => part[0]).join('')}</span><span><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></span><b>{application.score}</b></button>)}</div><div className="panel candidate-card"><div className="candidate-header"><div><p className="eyebrow">CANDIDATE RECORD</p><h2>{selectedApplication.name}</h2><p>{selectedApplication.ref} · {selectedApplication.pathway}</p></div><Status tone={decision === 'approved' ? 'Shortlisted' : decision === 'declined' ? 'Declined' : selectedApplication.status}>{decision === 'approved' ? 'Shortlisted' : decision === 'declined' ? 'Declined' : selectedApplication.status}</Status></div><div className="candidate-stats"><div><span>Indicative APS</span><strong>{selectedApplication.score}</strong></div><div><span>Gauteng address</span><strong className="success-text">Verified</strong></div><div><span>Profile</span><strong>82% complete</strong></div></div><div className="candidate-section"><div className="section-line"><h3>Required evidence</h3><span className="verified-chip">2 of 2 uploaded</span></div><DocumentStatus label="Certified copy of ID" ready /><DocumentStatus label="Statement of results / certificate" ready /></div><div className="candidate-section"><div className="section-line"><h3>Subject check</h3><span className="verified-chip">Criteria passed</span></div><div className="subject-grid"><div><span>English</span><strong>Level 5</strong></div><div><span>Life Sciences</span><strong>Level 5</strong></div><div><span>Mathematics</span><strong>Level 4</strong></div><div><span>Life Orientation</span><strong>Level 5</strong></div></div></div><div className="decision-area">{decision ? <div className={`decision-banner ${decision}`}><span>{decision === 'approved' ? '✓' : '!'}</span><div><strong>{decision === 'approved' ? 'Application approved for shortlisting' : 'Application declined'}</strong><small>{decision === 'approved' ? 'The applicant is now visible on the shortlist.' : `Reason recorded: ${declineReason}`}</small></div><button onClick={() => submitDecision(null)}>Undo</button></div> : <><div className="decision-actions"><button className="approve-button" onClick={() => submitDecision('approved')}>Approve for shortlist <span>→</span></button><button className="decline-button" onClick={() => submitDecision('declined')}>Decline</button></div><label className="decline-select"><span>Decline reason (required when declining)</span><select value={declineReason} onChange={e => setDeclineReason(e.target.value)}>{declineReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label></>}</div></div></div></section>; }

function ShortlistPage({ setPage }) { return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">SHORTLIST</p><h1>Shortlisted applicants</h1><p>Approved candidates move here for psychometric testing and later placement decisions.</p></div><span className="review-scope"><span className="secure-dot" /> 680 approved</span></div><div className="panel shortlist-summary"><div className="shortlist-stat"><span>Ready for psychometric tests</span><strong>612</strong><small>90% of shortlist</small></div><div className="shortlist-stat"><span>Test invitations issued</span><strong>438</strong><small>Awaiting completion</small></div><div className="shortlist-stat"><span>Capacity planning</span><strong>4 campuses</strong><small>Preference counts recorded</small></div></div><div className="panel work-panel"><div className="panel-heading"><div><h2>Next evaluation actions</h2><p>Keep shortlist decisions separate from final placement.</p></div><button className="outline-button" onClick={() => setPage('letters')}>Issue test invitations <span>→</span></button></div><div className="shortlist-rows"><div><span className="queue-avatar">LM</span><div><strong>Lerato Mokoena</strong><small>GCON20270731-01 · Ann Latsky Campus</small></div><Status tone="Shortlisted">Shortlisted</Status><button className="text-button">View record</button></div><div><span className="queue-avatar">MD</span><div><strong>Mpho Dlamini</strong><small>GCON20270731-02 · Chris Hani Baragwanath Campus</small></div><Status tone="Shortlisted">Test invited</Status><button className="text-button">View record</button></div><div><span className="queue-avatar">TN</span><div><strong>Thato Ndlovu</strong><small>GCON20270730-14 · SG Lourens Campus</small></div><Status tone="Under review">Test pending</Status><button className="text-button">View record</button></div></div></div></section>; }

const defaultCommunicationMessages = Object.freeze({
  'Psychometric test invitation': 'Your psychometric assessment invitation will be available in your applicant communication history.',
  'Shortlist confirmation': 'Your application has been approved for the next evaluation stage.',
  'Decline outcome': 'Your application outcome is available. Please review the recorded reason in your applicant portal.',
  'Termination / withdrawal': 'This letter records the withdrawal or termination decision against the application.',
});

function LettersPage({ issued, issueLetters }) {
  const [audience, setAudience] = useState('Shortlisted applicants');
  const [template, setTemplate] = useState('Psychometric test invitation');
  const [messageBody, setMessageBody] = useState(defaultCommunicationMessages['Psychometric test invitation']);
  const [mode, setMode] = useState('preview');
  const [error, setError] = useState('');
  function changeTemplate(nextTemplate) { setTemplate(nextTemplate); setMessageBody(defaultCommunicationMessages[nextTemplate]); setMode('preview'); setError(''); }
  function issue() { if (!messageBody.trim()) { setMode('edit'); setError('Enter a message before issuing this communication.'); return; } setError(''); issueLetters(audience, template, messageBody.trim()); }
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">LETTERS & COMMS</p><h1>Communication centre</h1><p>Choose a controlled audience and template, edit the message, preview it, then record the issue action.</p></div><span className="review-scope"><span className="secure-dot" /> Azure-ready archive</span></div><div className="panel letter-composer"><div className="letter-controls"><label className="field"><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value)}><option>Shortlisted applicants</option><option>Declined applicants</option><option>Withdrawn applicants</option></select></label><label className="field"><span>Letter template</span><select value={template} onChange={(event) => changeTemplate(event.target.value)}><option>Psychometric test invitation</option><option>Shortlist confirmation</option><option>Decline outcome</option><option>Termination / withdrawal</option></select></label><label className="field"><span>Annual cycle</span><select defaultValue="GCON 2027"><option>GCON 2027</option><option>GCON 2028</option></select></label></div><div className="letter-mode-toggle" aria-label="Message view controls"><strong>Message</strong><div className="letter-mode-actions"><button type="button" className={`quiet-button ${mode === 'preview' ? 'selected' : ''}`} aria-pressed={mode === 'preview'} onClick={() => { setMode('preview'); setError(''); }}>Preview message</button><button type="button" className={`quiet-button ${mode === 'edit' ? 'selected' : ''}`} aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setError(''); }}>Edit message</button></div></div>{mode === 'edit' ? <label className="field letter-editor"><span>Message text</span><textarea aria-label="Message text" value={messageBody} onChange={(event) => { setMessageBody(event.target.value); setError(''); }} rows={7} maxLength={2000} /><small>{messageBody.length}/2000 characters · Changes are applied only when you issue this communication.</small></label> : <div className="letter-preview"><div className="letter-mark"><img src="/gpg-logo.png" alt="" /><strong>GCON 2027</strong></div><p>Dear applicant,</p><p className="letter-message-body">{messageBody}</p><div className="letter-sign">Admissions coordinator<br /><strong>Gauteng College of Nursing</strong></div></div>}<div className="letter-actions"><span>{issued ? 'Issued and recorded in the audit trail.' : 'Preview before issuing. The recipient list is controlled by status.'}</span><button className="primary-button" onClick={issue}>{issued ? 'Issue again' : 'Issue letters'} <span>→</span></button></div>{error && <p className="letter-error" role="alert">{error}</p>}</div></section>;
}

function ReportsPage({ cycle }) { return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">REPORTS · GCON 2027</p><h1>Intake reporting</h1><p>Cycle reporting combines demand, preference counts, qualification outcomes and staff decisions.</p></div><button className="outline-button">Export cycle report <span>↓</span></button></div><div className="report-grid"><div className="panel report-card"><span>Applications</span><strong>12 480</strong><div className="report-bar"><i style={{ width: '78%' }} /></div><small>6 930 complete · 5 550 in progress</small></div><div className="panel report-card"><span>Qualification pass rate</span><strong>58.4%</strong><div className="report-bar gold"><i style={{ width: '58%' }} /></div><small>Subject and APS criteria verified</small></div><div className="panel report-card"><span>Shortlisted</span><strong>680</strong><div className="report-bar green"><i style={{ width: '34%' }} /></div><small>Psychometric phase next</small></div></div><div className="panel preference-report"><div className="panel-heading"><div><h2>College preference demand</h2><p>Use selections to check capacity requirements before placement.</p></div><span className="saved-label">{cycle.advertStatus} · {cycle.openDate} – {cycle.closeDate}</span></div>{[['Ann Latsky Campus', '3 420', 82], ['Chris Hani Baragwanath Campus', '2 980', 71], ['SG Lourens Campus', '2 310', 56], ['Bonalesedi Campus', '1 680', 41]].map(([campus, count, width]) => <div className="demand-row" key={campus}><span>{campus}</span><strong>{count}</strong><div><i style={{ width: `${width}%` }} /></div></div>)}</div></section>; }

function AuditPage({ auditLog }) { return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h1>Decision history</h1><p>Protected changes, approvals, decline reasons and communications are timestamped for authorised staff.</p></div><span className="review-scope"><span className="secure-dot" /> Restricted staff access</span></div><div className="panel audit-panel"><div className="audit-toolbar"><div className="search"><Icon>⌕</Icon><input placeholder="Search reference or staff member" /></div><select defaultValue="All events"><option>All events</option><option>Decisions</option><option>Communications</option><option>Profile changes</option></select></div>{auditLog.slice(0, 8).map(({ time, event, ref, actor }) => <div className="audit-row" key={`${time}-${event}-${ref}`}><span>{time}</span><div><strong>{event}</strong><small>{ref}</small></div><em>{actor}</em><b>Recorded</b></div>)}</div></section>; }

function Metric({ label, value, note, icon, accent, alert }) { return <div className={`metric ${accent ? 'accent' : ''} ${alert ? 'alert' : ''}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>; }
function PipelineLegend({ color, label, value }) { return <div className="pipeline-step"><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong></div>; }
function Status({ tone, children }) { const cls = tone === 'Under review' ? 'review-status' : tone === 'Correction requested' ? 'correction-status' : tone === 'Shortlisted' ? 'shortlist-status' : tone === 'Declined' ? 'decline-status' : 'placement-status'; return <span className={`status ${cls}`}><i />{children}</span>; }

function QualificationCheckerV2({ pathway, setPathway, result, setResult, checkQualification, setStep }) {
  const [values, setValues] = useState(() => ({ ...defaultQualification[pathway] }));
  useEffect(() => { setValues({ ...defaultQualification[pathway] }); setResult(null); }, [pathway]);
  const update = (key, value) => setValues((current) => {
    const next = { ...current, [key]: value };
    if (pathway === 'NSC / Grade 12' && key === 'mathematics' && value !== '0') next.mathsLiteracy = '0';
    if (pathway === 'NSC / Grade 12' && key === 'mathsLiteracy' && value !== '0') next.mathematics = '0';
    return next;
  });
  const select = (label, key, options) => <label className="field" key={key} htmlFor={`checker-${key}`}><span>{label}</span><select id={`checker-${key}`} name={key} aria-label={label} value={values[key] || ''} onChange={(event) => update(key, event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  const number = (label, key) => <label className="field" key={key} htmlFor={`checker-${key}`}><span>{label}</span><input id={`checker-${key}`} name={key} aria-label={label} type="number" min="0" max="100" value={values[key] || ''} onChange={(event) => update(key, event.target.value)} /></label>;
  const descendingNumbers = (maximum, minimum = 0) => Array.from({ length: maximum - minimum + 1 }, (_, index) => String(maximum - index));
  const percentageSelect = (label, key) => select(label, key, [...descendingNumbers(100), 'Below requirement']);
  const controls = pathway === 'Senior Certificate'
    ? [select('English (HG D or SG C)', 'english', ['HG A', 'HG B', 'HG C', 'HG D', 'HG E', 'HG F', 'SG A', 'SG B', 'SG C', 'SG D', 'SG E', 'SG F']), select('Biology (HG D or SG C)', 'biology', ['HG A', 'HG B', 'HG C', 'HG D', 'HG E', 'HG F', 'SG A', 'SG B', 'SG C', 'SG D', 'SG E', 'SG F']), select('Mathematics (HG D or SG C)', 'mathematics', ['HG A', 'HG B', 'HG C', 'HG D', 'HG E', 'HG F', 'SG A', 'SG B', 'SG C', 'SG D', 'SG E', 'SG F']), number('M score', 'mScore')]
    : [select('English level', 'english', ['7', '6', '5', '4', '3', '2', '1', 'Below requirement']), select('Life Sciences level', 'lifeSciences', ['7', '6', '5', '4', '3', '2', '1', 'Below requirement']), select('Mathematics level', 'mathematics', ['7', '6', '5', '4', '3', '2', '1', '0', 'Below requirement']), select('Maths Literacy level', 'mathsLiteracy', ['7', '6', '5', '4', '3', '2', '1', '0', 'Not taken', 'Below requirement']), number('Reported APS (LO half-weighted)', 'aps')];
  if (pathway === 'Senior Certificate') controls.length = 3;
  if (pathway === 'NSC / Grade 12') controls.length = 4;
  const ncvFundamentalControls = [percentageSelect('English First Additional Language (%)', 'englishFal'), percentageSelect('Maths / Maths Literacy (%)', 'mathematics'), percentageSelect('Life Orientation (%)', 'lifeOrientation')];
  const ncvVocationalControls = [percentageSelect('SA Health Care System (%)', 'saHealthCare'), percentageSelect('Public Health (%)', 'publicHealth'), percentageSelect('The Human Body and Mind (%)', 'humanBody'), percentageSelect('Community Oriented Primary Care (%)', 'communityPrimaryCare')];
  const evaluate = () => checkQualification(evaluateQualification(pathway, values));
  const markNotQualified = () => setResult({ status: 'does-not-qualify', pathway, values, score: 'Not scored', failed: ['Applicant did not confirm all required criteria'] });
  return <div className="form-page"><StepHeader current="checker" /><div className="form-grid"><section className="form-card checker-card"><div className="card-heading"><div><h2>Check your qualification</h2><p>Choose the certificate pathway and confirm only the criteria that apply to it.</p></div><span className="required-note">Required</span></div><div className="pathway-tabs">{pathways.map((item) => <button className={pathway === item ? 'selected' : ''} key={item} onClick={() => setPathway(item)}>{item}</button>)}</div><div className="field-grid two"><label className="field"><span>South African ID number</span><input value={values.idNumber || ''} onChange={(event) => update('idNumber', event.target.value)} /></label><label className="field"><span>Year of results</span><select value={values.resultYear || ''} onChange={(event) => update('resultYear', event.target.value)}>{resultYearOptions.map((year) => <option key={year}>{year}</option>)}</select></label></div>{pathway === 'NC(V) Level 4' ? <div className="qualification-groups"><div className="qualification-group"><h3>Fundamental Subjects</h3><p>English First Additional Language, Maths/Maths Literacy, and Life Orientation.</p><div className="field-grid two">{ncvFundamentalControls}</div></div><div className="qualification-group"><h3>Vocational Subjects</h3><p>Use the named NC(V) nursing-related subjects below.</p><div className="field-grid two">{ncvVocationalControls}</div></div></div> : <div className="field-grid two">{controls}</div>}{pathway === 'NSC / Grade 12' && <p className="subject-note">Enter either Mathematics or Maths Literacy. Only one mathematics result is used in a score calculation; they are never added together.</p>}<div className="form-footnote"><span className="secure-dot" /> Original reported values are preserved. No percentage-to-APS or certificate equivalency is invented.</div>{result?.status === 'qualifies' && <QualificationResultCard result={result} setStep={setStep} />}{result?.status === 'does-not-qualify' && <NonQualifierCardComplete setResult={setResult} result={result} />}{!result && <><button className="primary-button form-submit" onClick={evaluate}>Check qualification <span>→</span></button><button className="checker-secondary" onClick={markNotQualified}>I do not meet all of the criteria</button></>}</section><aside className="side-explain"><div className="side-icon">✓</div><h3>Why we ask this first</h3><p>Your qualification result determines whether you continue to registration. If you do not qualify, we store the entered qualification values and non-qualifying result with any details you provide.</p><div className="criteria-mini"><strong>{pathway} rule</strong><span>{pathway === 'Senior Certificate' ? 'English, Biology and Mathematics at HG D or SG C, plus M score 17.' : pathway === 'NC(V) Level 4' ? 'Fundamentals at 50%+ and 60%+ in each named vocational subject.' : 'English and Life Sciences Level 4+, Maths Level 4 or Maths Literacy Level 5+, reported APS 27+.'}</span></div><div className="criteria-mini"><strong>Gauteng residence</strong><span>Your structured address and map pin must be within Gauteng.</span></div></aside></div></div>;
}

function QualificationResultCard({ result, setStep }) { return <div className="result-card"><div className="result-mark">✓</div><div><strong>{result.pathway === 'NSC / Grade 12' ? 'Subject criteria recorded for review' : `You meet the ${result.pathway} minimum criteria`}</strong><p>{result.pathway === 'Senior Certificate' ? <>Calculated M score: <b>{result.score}</b> · Based on the three submitted HG/SG subject grades.</> : result.pathway === 'NSC / Grade 12' ? 'APS 27+ will be verified from the uploaded certificate during review.' : 'NC(V) pathway criteria passed.'} Your original subject values will be carried into your profile.</p></div><button className="text-button" onClick={() => setStep('access')}>Continue to access management <span>→</span></button></div>; }

function StaffWorkspaceWithPlacements(props) {
  return <><StaffWorkspace {...props} />{props.page === 'dashboard' && <div className="staff-settings-floating"><IntakeCycleEditor cycle={props.cycle} onSave={props.updateCycle} /></div>}</>;
}

function PlacementsPage({ applications, assignPlacement, withdrawApplication, setPage }) {
  const [campuses, setCampuses] = useState({});
  const [withdrawalReason, setWithdrawalReason] = useState('Applicant requested withdrawal');
  const [terminationIssued, setTerminationIssued] = useState({});
  const rows = applications.filter((application) => ['Shortlisted', 'Placed', 'Withdrawn'].includes(application.status));
  const updateCampus = (ref, campus) => setCampuses((current) => ({ ...current, [ref]: campus }));
  return <section className="staff-page placements-page"><div className="page-heading"><div><p className="eyebrow">PLACEMENT CONTROL</p><h1>Placement and withdrawals</h1><p>Record the location assigned to each successful applicant and keep withdrawal records available for reporting.</p></div><span className="review-scope"><span className="secure-dot" /> Organisation-scoped actions</span></div><div className="panel placement-note"><strong>Manual placement record</strong><span>Psychometric outcomes and any supporting letters are recorded before a campus placement is confirmed.</span><button className="text-button" onClick={() => setPage('audit')}>View audit trail <span>?</span></button></div><div className="panel work-panel placement-table"><div className="table-toolbar"><strong>Shortlisted and placed applicants</strong><span className="results-count">{rows.length} records</span></div>{rows.map((application) => <div className="placement-row" key={application.ref}><div className="placement-person"><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} ? {application.pathway}</small></div></div><div className="placement-state"><Status tone={application.status}>{application.status}</Status>{application.placementCampus && <small>{application.placementCampus}</small>}{application.withdrawalReason && <small>{application.withdrawalReason}</small>}</div><div className="placement-actions">{application.status !== 'Withdrawn' && <><select value={campuses[application.ref] || application.placementCampus || collegeCampuses[0]} onChange={(event) => updateCampus(application.ref, event.target.value)}>{collegeCampuses.map((campus) => <option key={campus}>{campus}</option>)}</select><button className="outline-button" onClick={() => assignPlacement(application.ref, campuses[application.ref] || application.placementCampus || collegeCampuses[0])}>{application.status === 'Placed' ? 'Update placement' : 'Record placement'}</button><button className="decline-button" onClick={() => withdrawApplication(application.ref, withdrawalReason)}>Record withdrawal</button></>}{application.status === 'Withdrawn' && <button className="outline-button" onClick={() => setTerminationIssued((current) => ({ ...current, [application.ref]: true }))}>{terminationIssued[application.ref] ? 'Termination letter issued' : 'Issue termination letter'}</button>}</div></div>)}{rows.length === 0 && <div className="empty-table">No shortlisted records are available yet.</div>}<div className="placement-footer"><label className="field"><span>Withdrawal reason used for this test flow</span><select value={withdrawalReason} onChange={(event) => setWithdrawalReason(event.target.value)}><option>Applicant requested withdrawal</option><option>Did not commence programme</option><option>Unable to complete programme</option><option>Administrative withdrawal</option></select></label><small>Termination letters should be signed and uploaded to the candidate record in the production document workflow.</small></div></div></section>;
}

// Keep the existing prototype form wiring while routing evidence rows through
// the real upload component. This can be removed once the form is split into
// smaller production components.
DocumentRow = UploadableDocumentRow;
const NonQualifierCard = NonQualifierCardComplete;
ProfileForm = ProfileFormComplete;
ReviewApplicationMinimal = CompleteReviewApplicationMinimal;
ApplicationsPage = MassApplicationsPage;
ReviewQueue = CompleteReviewQueue;
ShortlistPage = CompleteShortlistPage;
LettersPage = CompleteLettersPage;
ReportsPage = CompleteReportsPage;
AuditPage = CompleteAuditPage;
PlacementsPage = CompletePlacementsPage;

const rootElement = document.getElementById('root');
const appRoot = globalThis.__gconRoot || createRoot(rootElement);
globalThis.__gconRoot = appRoot;
appRoot.render(<App />);
