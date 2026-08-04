import React, { useEffect, useMemo, useState } from 'react';
import { getApiState, inviteApiInterview, issueApiLetters, massDeclineApi, recordApiInterviewOutcome, recordApiTerminationLetter, reviewApiDocument, updateApiDecision, updateApiPlacement, updateApiWithdrawal } from './api.js?placement=1';

const campuses = ['Ann Latsky Campus', 'Chris Hani Baragwanath Campus', 'SG Lourens Campus', 'Bonalesedi Campus'];
const reviewStatuses = ['Under review', 'Correction requested'];
const shortlistStatuses = ['Shortlisted', 'Placement ready', 'Placed'];

function useWorkspaceData() {
  const [data, setData] = useState({ cycle: null, applications: [], auditLog: [], lettersIssued: false, notifications: [], communications: [] });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    getApiState().then((remote) => {
      if (active && remote) { setData(remote); setConnected(true); }
    });
    return () => { active = false; };
  }, []);

  return { data, setData, connected };
}

function statusClass(status) {
  return status === 'Under review' ? 'review-status' : status === 'Correction requested' ? 'correction-status' : status === 'Shortlisted' ? 'shortlist-status' : status === 'Declined' ? 'decline-status' : 'placement-status';
}

function LocalStatus({ status }) {
  return <span className={`status ${statusClass(status)}`}><i />{status}</span>;
}

function downloadCsv(filename, rows) {
  if (typeof document === 'undefined') return;
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function CompleteApplicationsPage({ setSelectedRef, setPage }) {
  const { data } = useWorkspaceData();
  const [query, setQuery] = useState('');
  const [pathway, setPathway] = useState('All pathways');
  const applications = (data.applications || []).filter((application) => application.status !== 'Draft');
  const visible = applications.filter((application) => `${application.ref} ${application.name} ${application.id} ${application.pathway}`.toLowerCase().includes(query.toLowerCase()) && (pathway === 'All pathways' || application.pathway === pathway));
  const exportRows = [['Applicant', 'Reference', 'Pathway', 'Score', 'Status'], ...visible.map((application) => [application.name, application.ref, application.pathway, application.score, application.status])];
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">APPLICATIONS</p><h1>All submitted applications</h1><p>Search, filter, and open a record for human review.</p></div><button className="outline-button" onClick={() => downloadCsv('gcon-2027-applications.csv', exportRows)}>Export report <span>↓</span></button></div><div className="panel work-panel full-table"><div className="table-toolbar"><div className="search wide"><span className="icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search surname, ID number or reference" /></div><span className="results-count">{visible.length} visible results</span><select className="filter-button" value={pathway} onChange={(event) => setPathway(event.target.value)}><option>All pathways</option><option>NSC / Grade 12</option><option>Senior Certificate</option><option>NC(V) Level 4</option></select></div><div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Reference</th><th>Pathway</th><th>Score</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{visible.map((application) => <tr key={application.ref} onClick={() => { setSelectedRef?.(application.ref); setPage('reviewQueue'); }}><td><strong>{application.name}</strong><small>{application.id}</small></td><td>{application.ref}</td><td>{application.pathway}</td><td><strong>{application.score}</strong></td><td><LocalStatus status={application.status} /></td><td>{application.updated}</td><td><button className="row-arrow" aria-label={`Open ${application.ref}`}>→</button></td></tr>)}{visible.length === 0 && <tr><td colSpan="7" className="empty-table">No matching applications.</td></tr>}</tbody></table></div></div></section>;
}

export function CompleteReviewQueue({ selectedRef: initialRef, setSelectedRef }) {
  const { data, setData } = useWorkspaceData();
  const [activeRef, setActiveRef] = useState(initialRef || '');
  const [reason, setReason] = useState('Incorrect or unreadable document');
  const [message, setMessage] = useState('');
  const applications = (data.applications || []).filter((application) => reviewStatuses.includes(application.status) && (application.status === 'Under review' || application.correctionResubmittedAt));
  const selected = applications.find((application) => application.ref === activeRef) || applications[0];

  useEffect(() => {
    if (selected?.ref && selected.ref !== activeRef) { setActiveRef(selected.ref); setSelectedRef?.(selected.ref); }
  }, [selected?.ref, activeRef, setSelectedRef]);

  async function decide(decision) {
    if (!selected) return;
    const ref = selected.ref;
    const localDecision = decision === 'approve' ? 'approved' : decision === 'decline' ? 'declined' : 'correction';
    const remote = await updateApiDecision(ref, localDecision, reason);
    if (remote) setData(remote);
    setMessage(remote ? (decision === 'approve' ? 'Approved for shortlist.' : decision === 'decline' ? 'Application declined with a recorded reason.' : 'Correction request sent to the learner.') : 'The decision could not be saved.');
  }

  async function decideDocument(document, decision) {
    if (!document.id) { setMessage('This evidence record has no document ID and cannot be updated.'); return; }
    const remote = await reviewApiDocument(document.id, decision, reason);
    if (remote) setData(remote);
    setMessage(remote ? `${document.label}: ${decision === 'verified' ? 'verified.' : decision === 'rejected' ? 'rejected.' : 'correction requested.'}` : 'The document decision could not be saved.');
  }

  if (!selected) return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h1>Nothing needs review</h1><p>New submissions and correction resubmissions will appear here.</p></div></div><div className="panel empty-state"><strong>Review queue clear</strong><span>There are no applications waiting for a staff decision.</span></div></section>;
  const evidence = selected.documents || [{ label: 'Certified copy of ID', state: 'pending' }, { label: 'Statement of results / certificate', state: 'pending' }];
  return <section className="staff-page review-page"><div className="page-heading"><div><p className="eyebrow">REVIEW QUEUE · {applications.length} OPEN</p><h1>Verify and decide</h1><p>Review evidence and original reported results, then choose the next controlled action.</p></div><span className="review-scope"><span className="secure-dot" /> Human review required</span></div><div className="review-layout"><div className="panel queue-list"><div className="queue-list-head"><strong>Waiting for decision</strong><span>{applications.length} records</span></div>{applications.map((application) => <button className={`queue-row ${selected.ref === application.ref ? 'selected' : ''}`} key={application.ref} onClick={() => { setActiveRef(application.ref); setSelectedRef?.(application.ref); setMessage(''); }}><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></span><b>{application.score}</b></button>)}</div><div className="panel candidate-card"><div className="candidate-header"><div><p className="eyebrow">CANDIDATE RECORD</p><h2>{selected.name}</h2><p>{selected.ref} · {selected.pathway}</p></div><LocalStatus status={selected.status} /></div><div className="candidate-stats"><div><span>Reported score</span><strong>{selected.score}</strong></div><div><span>Gauteng address</span><strong className="success-text">{selected.addressVerified ? 'Verified' : 'Review needed'}</strong></div><div><span>Documents</span><strong>{evidence.length} supplied</strong></div></div><div className="candidate-section"><div className="section-line"><h3>Required evidence</h3><span className="verified-chip">Human decision per document</span></div>{evidence.map((document) => <div className="document-status document-review-row" key={document.id || document.label}><span className={document.state === 'verified' ? 'doc-ready' : document.state === 'rejected' ? 'doc-missing' : 'doc-missing'}>{document.state === 'verified' ? '✓' : '!'}</span><span><strong>{document.label}</strong><small>{document.state === 'correction_required' ? 'Correction requested' : document.state === 'rejected' ? 'Rejected' : document.state === 'verified' ? 'Verified' : 'Pending review'}</small></span><div className="document-review-actions"><button className="text-button" disabled={!document.id} onClick={() => decideDocument(document, 'verified')}>Verify</button><button className="text-button" disabled={!document.id} onClick={() => decideDocument(document, 'correction_required')}>Request correction</button><button className="text-button danger-text" disabled={!document.id} onClick={() => decideDocument(document, 'rejected')}>Reject</button></div></div>)}</div><div className="candidate-section"><div className="section-line"><h3>Pathway values</h3><span className="verified-chip">Original values preserved</span></div><div className="subject-grid">{Object.entries(selected.pathwayValues || {}).slice(0, 6).map(([key, value]) => <div key={key}><span>{key.replaceAll(/([A-Z])/g, ' $1')}</span><strong>{value}</strong></div>)}</div></div><div className="decision-area"><label className="decline-select"><span>Reason used for decline or correction request</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Incorrect or unreadable document</option><option>Required subject or score not met</option><option>Document type not supplied</option><option>Information could not be verified</option></select></label><div className="decision-actions"><button className="approve-button" onClick={() => decide('approve')}>Approve for shortlist <span>→</span></button><button className="outline-button" onClick={() => decide('correction')}>Request correction</button><button className="decline-button" onClick={() => decide('decline')}>Decline</button></div>{message && <div className="decision-banner approved"><span>✓</span><div><strong>{message}</strong><small>The workflow state and audit event have been updated.</small></div></div>}</div></div></div></section>;
}

function InterviewOutcomeEditor({ application, onSaved }) {
  const [outcome, setOutcome] = useState(application.interview?.outcome || 'pending');
  const [score, setScore] = useState(application.interview?.score || '');
  const [notes, setNotes] = useState(application.interview?.notes || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true);
    const remote = await recordApiInterviewOutcome(application.ref, { outcome, score, notes });
    if (remote) { onSaved(remote); setMessage('Outcome recorded'); } else setMessage('Could not save outcome');
    setBusy(false);
  }
  return <div className="interview-outcome"><span className="saved-label">Test invited{application.interview?.outcome ? ` · ${application.interview.outcome}` : ''}</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)} aria-label={`Psychometric outcome for ${application.name}`}><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="no_show">No show</option></select><input value={score} onChange={(event) => setScore(event.target.value)} placeholder="Score" aria-label={`Psychometric score for ${application.name}`} /><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Outcome notes" aria-label={`Psychometric notes for ${application.name}`} /><button className="text-button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Record outcome'}</button>{message && <small>{message}</small>}</div>;
}

export function CompleteShortlistPage({ setPage }) {
  const { data, setData } = useWorkspaceData();
  const shortlisted = (data.applications || []).filter((application) => shortlistStatuses.includes(application.status));
  const invited = shortlisted.filter((application) => application.interview?.status === 'invited').length;
  async function invite(application) {
    const remote = await inviteApiInterview(application.ref);
    if (remote) setData(remote);
  }
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">SHORTLIST</p><h1>Shortlisted applicants</h1><p>Invite the next evaluation step without turning the shortlist into a final placement decision.</p></div><span className="review-scope"><span className="secure-dot" /> {shortlisted.length} approved · {invited} invited</span></div><div className="panel shortlist-summary"><div className="shortlist-stat"><span>Ready for psychometric tests</span><strong>{shortlisted.filter((item) => !item.interview).length}</strong><small>Awaiting an invitation</small></div><div className="shortlist-stat"><span>Test invitations issued</span><strong>{invited}</strong><small>Recorded against the candidate</small></div><div className="shortlist-stat"><span>Placement phase</span><strong>{shortlisted.filter((item) => ['Placement ready', 'Placed'].includes(item.status)).length}</strong><small>Separate from eligibility</small></div></div><div className="panel work-panel"><div className="panel-heading"><div><h2>Evaluation actions</h2><p>Open a record only after the staff decision is recorded.</p></div><button className="outline-button" onClick={() => setPage('letters')}>Open communications <span>→</span></button></div><div className="shortlist-rows">{shortlisted.map((application) => <div key={application.ref}><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></div><LocalStatus status={application.status} />{application.interview?.status === 'invited' ? <InterviewOutcomeEditor application={application} onSaved={setData} /> : <button className="text-button" onClick={() => invite(application)}>Invite psychometric test <span>→</span></button>}</div>)}{shortlisted.length === 0 && <div className="empty-table">No approved candidates are ready for this stage.</div>}</div></div></section>;
}

const defaultCommunicationMessages = Object.freeze({
  'Psychometric test invitation': 'Your psychometric assessment invitation will be available in your applicant communication history.',
  'Shortlist confirmation': 'Your application has been approved for the next evaluation stage.',
  'Decline outcome': 'Your application outcome is available. Please review the recorded reason in your applicant portal.',
  'Termination / withdrawal': 'This letter records the withdrawal or termination decision against the application.',
});

function defaultCommunicationMessage(template) {
  return defaultCommunicationMessages[template] || 'An update is available in your applicant communication history.';
}

export function CompleteLettersPage() {
  const { data, setData } = useWorkspaceData();
  const [audience, setAudience] = useState('Shortlisted applicants');
  const [template, setTemplate] = useState('Psychometric test invitation');
  const [messageBody, setMessageBody] = useState(() => defaultCommunicationMessage('Psychometric test invitation'));
  const [mode, setMode] = useState('preview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const deliveries = data.communications || [];

  function changeTemplate(nextTemplate) {
    setTemplate(nextTemplate);
    setMessageBody(defaultCommunicationMessage(nextTemplate));
    setMode('preview');
    setMessage('');
    setError('');
  }

  async function issue() {
    const trimmedMessage = messageBody.trim();
    if (!trimmedMessage) {
      setMode('edit');
      setError('Enter a message before issuing this communication.');
      return;
    }
    const remote = await issueApiLetters(audience, template, trimmedMessage);
    if (remote) {
      setData(remote);
      setError('');
      setMessage(`Letters issued to ${audience.toLowerCase()}.`);
    } else {
      setMessage('');
      setError('The communication could not be issued. No recipients were changed.');
    }
  }
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">LETTERS & COMMS</p><h1>Communication centre</h1><p>Choose a controlled audience and template, edit the message, preview it, then record the issue action.</p></div><span className="review-scope"><span className="secure-dot" /> Audit-linked communications</span></div><div className="panel letter-composer"><div className="letter-controls"><label className="field"><span>Audience</span><select value={audience} onChange={(event) => { setAudience(event.target.value); setMessage(''); setError(''); }}><option>Shortlisted applicants</option><option>Declined applicants</option><option>Withdrawn applicants</option></select></label><label className="field"><span>Letter template</span><select value={template} onChange={(event) => changeTemplate(event.target.value)}><option>Psychometric test invitation</option><option>Shortlist confirmation</option><option>Decline outcome</option><option>Termination / withdrawal</option></select></label><label className="field"><span>Annual cycle</span><select defaultValue="GCON 2027"><option>GCON 2027</option></select></label></div><div className="letter-mode-toggle" aria-label="Message view controls"><strong>Message</strong><div className="letter-mode-actions"><button type="button" className={`quiet-button ${mode === 'preview' ? 'selected' : ''}`} aria-pressed={mode === 'preview'} onClick={() => { setMode('preview'); setError(''); }}>Preview message</button><button type="button" className={`quiet-button ${mode === 'edit' ? 'selected' : ''}`} aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setError(''); }}>Edit message</button></div></div>{mode === 'edit' ? <label className="field letter-editor"><span>Message text</span><textarea aria-label="Message text" value={messageBody} onChange={(event) => { setMessageBody(event.target.value); setMessage(''); setError(''); }} rows={7} maxLength={2000} /><small>{messageBody.length}/2000 characters · Changes are applied only when you issue this communication.</small></label> : <div className="letter-preview"><div className="letter-mark"><img src="/gpg-logo.png" alt="" /><strong>GCON 2027</strong></div><p>Dear applicant,</p><p className="letter-message-body">{messageBody}</p><div className="letter-sign">Admissions coordinator<br /><strong>Gauteng College of Nursing</strong></div></div>}<div className="letter-actions"><span>{message || (data.lettersIssued ? 'A communication batch has been issued and recorded.' : 'Preview before issuing. The recipient list is controlled by status.')}</span><button className="primary-button" onClick={issue}>Issue letters <span>→</span></button></div>{error && <p className="letter-error" role="alert">{error}</p>}{deliveries.length > 0 && <div className="communication-deliveries"><div><strong>Recent delivery batches</strong><span>{deliveries.length} recorded</span></div>{deliveries.slice(0, 3).map((delivery) => <div className="communication-delivery" key={delivery.id}><span>{delivery.template}</span><small>{delivery.audience} · {delivery.recipientCount} recipients</small><b>{delivery.deliveryStatus}</b>{delivery.message && <p className="communication-delivery-message">{delivery.message}</p>}</div>)}</div>}</div></section>;
}

export function CompleteReportsPage() {
  const { data } = useWorkspaceData();
  const applications = data.applications || [];
  const complete = applications.filter((application) => application.status !== 'Draft').length;
  const shortlisted = applications.filter((application) => shortlistStatuses.includes(application.status)).length;
  const passRate = complete ? ((shortlisted / complete) * 100).toFixed(1) : '0.0';
  const counts = campuses.map((campus) => [campus, applications.filter((application) => application.preferences?.includes(campus)).length]);
  function exportReport() { downloadCsv('gcon-2027-cycle-report.csv', [['Metric', 'Value'], ['Complete applications', complete], ['Qualification or review shortlist rate', `${passRate}%`], ['Shortlisted or placed', shortlisted], ...counts.map(([campus, count]) => [campus, count])]); }
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">REPORTS · {data.cycle?.name || 'GCON 2027'}</p><h1>Intake reporting</h1><p>Reports now reflect the current local workflow state and can be exported for review.</p></div><button className="outline-button" onClick={exportReport}>Export cycle report <span>↓</span></button></div><div className="report-grid"><div className="panel report-card"><span>Complete applications</span><strong>{complete}</strong><div className="report-bar"><i style={{ width: `${Math.min(100, complete * 20)}%` }} /></div><small>Drafts are excluded from the cycle total</small></div><div className="panel report-card"><span>Shortlist rate</span><strong>{passRate}%</strong><div className="report-bar gold"><i style={{ width: `${passRate}%` }} /></div><small>Based on local submitted records</small></div><div className="panel report-card"><span>Shortlisted or placed</span><strong>{shortlisted}</strong><div className="report-bar green"><i style={{ width: `${complete ? (shortlisted / complete) * 100 : 0}%` }} /></div><small>Eligibility and placement remain separate actions</small></div></div><div className="panel preference-report"><div className="panel-heading"><div><h2>College preference demand</h2><p>Selections recorded in current application records.</p></div><span className="saved-label">{data.cycle?.advertStatus || 'Published'}</span></div>{counts.map(([campus, count]) => <div className="demand-row" key={campus}><span>{campus}</span><strong>{count}</strong><div><i style={{ width: `${complete ? (count / complete) * 100 : 0}%` }} /></div></div>)}</div></section>;
}

export function CompleteAuditPage() {
  const { data } = useWorkspaceData();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All events');
  const entries = (data.auditLog || []).filter((entry) => `${entry.event} ${entry.ref} ${entry.actor}`.toLowerCase().includes(query.toLowerCase()) && (kind === 'All events' || (kind === 'Decisions' && /approved|declined|correction|decision/i.test(entry.event)) || (kind === 'Communications' && /letter|communication|invitation/i.test(entry.event)) || (kind === 'Profile changes' && /profile|draft|document/i.test(entry.event))));
  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h1>Decision history</h1><p>Search the append-only local audit trail by reference, actor, or event type.</p></div><span className="review-scope"><span className="secure-dot" /> Restricted staff access</span></div><div className="panel audit-panel"><div className="audit-toolbar"><div className="search"><span className="icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference or staff member" /></div><select value={kind} onChange={(event) => setKind(event.target.value)}><option>All events</option><option>Decisions</option><option>Communications</option><option>Profile changes</option></select></div>{entries.slice(0, 50).map((entry, index) => <div className="audit-row" key={entry.id || `${entry.time}-${entry.event}-${entry.ref}-${index}`}><span>{entry.time}</span><div><strong>{entry.event}</strong><small>{entry.ref}</small></div><em>{entry.actor}</em><b>Recorded</b></div>)}{entries.length === 0 && <div className="empty-table">No audit events match this search.</div>}</div></section>;
}

export function MassApplicationsPage({ setSelectedRef, setPage }) {
  const { data, setData } = useWorkspaceData();
  const [query, setQuery] = useState('');
  const [pathway, setPathway] = useState('All pathways');
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [reason, setReason] = useState('Required subject or score not met');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const applications = (data.applications || []).filter((application) => application.status !== 'Draft');
  const visible = applications.filter((application) => `${application.ref} ${application.name} ${application.id} ${application.pathway}`.toLowerCase().includes(query.toLowerCase()) && (pathway === 'All pathways' || application.pathway === pathway));
  const declinable = visible.filter((application) => ['Under review', 'Correction requested'].includes(application.status));
  const allVisibleSelected = declinable.length > 0 && declinable.every((application) => selectedRefs.includes(application.ref));
  const exportRows = [['Applicant', 'Reference', 'Pathway', 'Score', 'Status'], ...visible.map((application) => [application.name, application.ref, application.pathway, application.score, application.status])];

  function toggleRef(ref) { setSelectedRefs((current) => current.includes(ref) ? current.filter((item) => item !== ref) : [...current, ref]); }
  function toggleAll() { setSelectedRefs(allVisibleSelected ? [] : declinable.map((application) => application.ref)); }
  async function massDecline() {
    setBusy(true);
    const result = await massDeclineApi(selectedRefs, reason);
    if (result?.state) {
      setData(result.state);
      setSelectedRefs([]);
      setConfirming(false);
      setMessage(`${result.summary?.declined || selectedRefs.length} applications declined. In-app notifications were created for each learner.`);
    } else setMessage('The mass decline could not be saved. No applications were changed.');
    setBusy(false);
  }

  return <section className="staff-page"><div className="page-heading"><div><p className="eyebrow">APPLICATIONS</p><h1>All submitted applications</h1><p>Search, filter, and open a record for human review.</p></div><button className="outline-button" onClick={() => downloadCsv('gcon-2027-applications.csv', exportRows)}>Export report <span>Download</span></button></div>{message && <div className="decision-banner approved mass-decline-message" role="status"><span>OK</span><div><strong>{message}</strong><small>Each outcome is linked to the in-app notification and audit trail.</small></div></div>}{confirming && <div className="mass-decline-confirm" role="alertdialog" aria-labelledby="mass-decline-title"><div><p className="eyebrow">BULK ACTION</p><h2 id="mass-decline-title">Decline {selectedRefs.length} applications?</h2><p>This will set each selected application to Declined and create one in-app outcome notification per learner. The action is audit-linked and cannot be applied to shortlisted or placed records.</p></div><label className="field"><span>Reason recorded for every selected learner</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Required subject or score not met</option><option>Incorrect or unreadable document</option><option>Document type not supplied</option><option>Information could not be verified</option></select></label><div className="form-actions compact-actions"><button className="quiet-button" type="button" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button><button className="decline-button" type="button" onClick={massDecline} disabled={busy}>{busy ? 'Declining...' : `Confirm mass decline (${selectedRefs.length})`}</button></div></div>}<div className="panel work-panel full-table"><div className="table-toolbar"><div className="search wide"><span className="icon">Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search surname, ID number or reference" /></div><span className="results-count">{visible.length} visible results</span><select className="filter-button" value={pathway} onChange={(event) => setPathway(event.target.value)}><option>All pathways</option><option>NSC / Grade 12</option><option>Senior Certificate</option><option>NC(V) Level 4</option></select><button className="decline-button" type="button" disabled={!selectedRefs.length} onClick={() => setConfirming(true)}>Mass decline{selectedRefs.length ? ` (${selectedRefs.length})` : ''}</button></div><div className="mass-action-hint"><span>{selectedRefs.length ? `${selectedRefs.length} selected for mass decline` : 'Select applications under review to send linked in-app outcomes.'}</span><small>{declinable.length} eligible on this page</small></div><div className="table-wrap"><table><thead><tr><th className="bulk-select-cell"><input type="checkbox" aria-label="Select all applications eligible for mass decline" checked={allVisibleSelected} onChange={toggleAll} /></th><th>Applicant</th><th>Reference</th><th>Pathway</th><th>Score</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{visible.map((application) => { const canMassDecline = ['Under review', 'Correction requested'].includes(application.status); return <tr key={application.ref} onClick={() => { setSelectedRef?.(application.ref); setPage('reviewQueue'); }}><td className="bulk-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${application.name} for mass decline`} checked={selectedRefs.includes(application.ref)} disabled={!canMassDecline} onChange={() => toggleRef(application.ref)} /></td><td><strong>{application.name}</strong><small>{application.id}</small></td><td>{application.ref}</td><td>{application.pathway}</td><td><strong>{application.score}</strong></td><td><LocalStatus status={application.status} /></td><td>{application.updated}</td><td><button className="row-arrow" aria-label={`Open ${application.ref}`}>Open</button></td></tr>; })}{visible.length === 0 && <tr><td colSpan="8" className="empty-table">No matching applications.</td></tr>}</tbody></table></div></div></section>;
}

export function CompletePlacementsPage() {
  const { data, setData } = useWorkspaceData();
  const [campusByRef, setCampusByRef] = useState({});
  const [reason, setReason] = useState('Applicant requested withdrawal');
  const [busyRef, setBusyRef] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const rows = (data.applications || []).filter((application) => [...shortlistStatuses, 'Withdrawn'].includes(application.status));
  async function prepare(application) {
    const campus = campusByRef[application.ref] || application.placementCampus || campuses[0];
    setBusyRef(application.ref);
    setMessage('');
    setError('');
    try {
      const remote = await updateApiPlacement(application.ref, campus);
      if (!remote) {
        setError(`The placement offer for ${application.name} could not be saved. Please try again.`);
        return;
      }
      setData(remote);
      setMessage(`Placement offer prepared for ${application.name} at ${campus}. The candidate is now released to the employer portal.`);
    } finally {
      setBusyRef('');
    }
  }
  async function withdraw(application) {
    const remote = await updateApiWithdrawal(application.ref, reason);
    if (remote) setData(remote);
  }
  async function recordTermination(application) {
    const remote = await recordApiTerminationLetter(application.ref, { filename: `termination-${application.ref}.pdf`, notes: 'Recorded by placement administration.' });
    if (remote) setData(remote);
  }
  return <section className="staff-page placements-page"><div className="page-heading"><div><p className="eyebrow">PLACEMENT CONTROL</p><h1>Placement and withdrawals</h1><p>Prepare a placement offer, wait for the employer response, and keep withdrawals traceable.</p></div><span className="review-scope"><span className="secure-dot" /> Organisation-scoped actions</span></div>{message && <div className="decision-banner approved placement-message" role="status"><span>✓</span><div><strong>Placement offer prepared</strong><small>{message}</small></div></div>}{error && <div className="decision-banner declined placement-message" role="alert"><span>!</span><div><strong>Placement offer was not saved</strong><small>{error}</small></div></div>}<div className="panel placement-note"><strong>Manual placement record</strong><span>Eligibility approval, placement preparation, employer response, and final placement are separate states.</span></div><div className="panel work-panel placement-table"><div className="table-toolbar"><strong>Shortlisted and placed applicants</strong><span className="results-count">{rows.length} records</span></div>{rows.map((application) => <div className="placement-row" key={application.ref}><div className="placement-person"><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></div></div><div className="placement-state"><LocalStatus status={application.status} />{application.placementCampus && <small>{application.placementCampus}</small>}{application.placementOffer?.preparedAt && <small>Offer prepared {new Date(application.placementOffer.preparedAt).toLocaleString()}</small>}{application.placementResponse && <small>Employer: {application.placementResponse}</small>}{application.withdrawalReason && <small>{application.withdrawalReason}</small>}{application.terminationLetter?.status === 'recorded' && <small>Termination letter recorded</small>}</div><div className="placement-actions">{application.status !== 'Withdrawn' && <><select value={campusByRef[application.ref] || application.placementCampus || campuses[0]} onChange={(event) => setCampusByRef((current) => ({ ...current, [application.ref]: event.target.value }))}>{campuses.map((campus) => <option key={campus}>{campus}</option>)}</select><button className="outline-button" disabled={busyRef === application.ref} onClick={() => prepare(application)}>{busyRef === application.ref ? 'Preparing…' : application.status === 'Placement ready' ? 'Update offer' : 'Prepare offer'}</button><button className="decline-button" onClick={() => withdraw(application)}>Record withdrawal</button></>}{application.status === 'Withdrawn' && <button className="outline-button" onClick={() => recordTermination(application)}>{application.terminationLetter?.status === 'recorded' ? 'Termination letter recorded' : 'Record termination letter'}</button>}</div></div>)}{rows.length === 0 && <div className="empty-table">No shortlisted records are available yet.</div>}<div className="placement-footer"><label className="field"><span>Withdrawal reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Applicant requested withdrawal</option><option>Did not commence programme</option><option>Unable to complete programme</option><option>Administrative withdrawal</option></select></label><small>Employer responses are handled in the employer portal after a placement offer is prepared.</small></div></div></section>;
}
