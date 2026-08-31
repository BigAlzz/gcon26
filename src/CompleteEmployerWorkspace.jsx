import React, { useMemo, useState } from 'react';
import { candidateContact, DEFAULT_CAMPUS_DIRECTORY, downloadExcelWorkbook, groupCandidatesByCampus, placementCampus } from './employerExports.js';

const campuses = DEFAULT_CAMPUS_DIRECTORY.map((campus) => campus.name);

function statusClass(status) {
  return status === 'Shortlisted' ? 'shortlist-status' : status === 'Placed' ? 'placement-status' : 'placement-status';
}

function Status({ status }) {
  return <span className={`status ${statusClass(status)}`}><i />{status}</span>;
}

function EmployerMetric({ label, value, note, icon, accent, alert }) {
  return <div className={`metric ${accent ? 'accent' : ''} ${alert ? 'alert' : ''}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>;
}

function EmployerCandidateRow({ application, respondPlacement }) {
  const [campus, setCampus] = useState(application.placementCampus || application.preferences?.[0] || campuses[0]);
  const [response, setResponse] = useState(application.placementResponse || '');
  const contact = candidateContact(application);
  const canRespond = application.status === 'Placement ready';

  function respond(nextResponse) {
    setResponse(nextResponse);
    respondPlacement(application.ref, nextResponse, campus);
  }

  return <div className="employer-candidate">
    <div className="employer-candidate-main"><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></div></div>
    <Status status={application.status} />
    <div className="employer-candidate-meta"><span>Assigned campus</span><strong>{placementCampus(application) || 'Awaiting staff offer'}</strong><small>Preference: {application.preferences?.[0] || 'Not supplied'}</small></div>
    <div className="employer-candidate-meta employer-candidate-contact"><span>Candidate contact</span><strong>{contact.mobile}</strong><small>{contact.email}</small></div>
    {canRespond ? <div className="employer-actions"><select value={campus} onChange={(event) => setCampus(event.target.value)}>{campuses.map((option) => <option key={option}>{option}</option>)}</select><button className="approve-button" onClick={() => respond('accepted')}>Accept placement</button><button className="outline-button" onClick={() => respond('declined')}>Decline</button></div> : application.status === 'Shortlisted' ? <span className="employer-response">Awaiting staff placement offer</span> : <span className="employer-response">Accepted at {application.placementCampus || campus}</span>}
    {response && <small className="employer-confirmation">Response recorded: {response}</small>}
  </div>;
}

function EmployerCampusExportReport({ groups, cycleName }) {
  return <section id="campus-export-report" className="campus-export-report" aria-label="Campus placement export report"><header className="campus-export-header"><p>Gauteng College of Nursing</p><h1>{cycleName || 'GCON 2027'} campus placement list</h1><span>Grouped by assigned campus · Candidate and placement contact details</span></header>{groups.map(({ campus, candidates }) => <section className="campus-export-group" key={campus.name}><div className="campus-export-contact"><div><h2>{campus.name}</h2><p>{campus.address}</p></div><dl><div><dt>Placement contact</dt><dd>{campus.contactName}</dd></div><div><dt>Phone</dt><dd>{campus.phone}</dd></div><div><dt>Email</dt><dd>{campus.email}</dd></div></dl></div>{candidates.length ? <table><thead><tr><th>Candidate</th><th>Reference</th><th>Pathway</th><th>Status</th><th>Candidate mobile</th><th>Candidate email</th><th>Placement phone</th><th>Placement email</th><th>Placement address</th></tr></thead><tbody>{candidates.map((application) => { const contact = candidateContact(application); return <tr key={application.ref}><td>{application.name}</td><td>{application.ref}</td><td>{application.pathway}</td><td>{application.status}</td><td>{contact.mobile}</td><td>{contact.email}</td><td>{campus.phone}</td><td>{campus.email}</td><td>{campus.address}</td></tr>; })}</tbody></table> : <p className="campus-export-empty">No candidates are currently assigned to this campus.</p>}</section>)}</section>;
}

export function CompleteEmployerWorkspace({ applications, metrics, respondPlacement, apiConnected, cycle, campusDirectory = DEFAULT_CAMPUS_DIRECTORY }) {
  const candidates = applications.filter((application) => ['Shortlisted', 'Placement ready', 'Placed'].includes(application.status));
  const directory = campusDirectory?.length ? campusDirectory : DEFAULT_CAMPUS_DIRECTORY;
  const groupedCandidates = useMemo(() => groupCandidatesByCampus(candidates, directory, { includeEmpty: true }), [candidates, directory]);
  const assignedCount = candidates.filter((application) => placementCampus(application)).length;
  const [exportMessage, setExportMessage] = useState('');
  const totals = metrics || {
    visibleApplicants: applications.length,
    underReview: applications.filter((application) => application.status === 'Under review').length,
    shortlisted: applications.filter((application) => application.status === 'Shortlisted').length,
    placed: applications.filter((application) => application.status === 'Placed').length,
    needsAction: applications.filter((application) => application.status === 'Placement ready').length,
  };

  function printReport() {
    setExportMessage('Print view opened. Choose Save as PDF in the print dialog.');
    if (typeof window !== 'undefined') window.print();
  }

  function exportExcel() {
    const downloaded = downloadExcelWorkbook(groupedCandidates, cycle?.name || 'GCON 2027');
    setExportMessage(downloaded ? 'Excel workbook downloaded with separate campus and status tabs.' : 'Excel export is available in a browser window.');
  }

  return <div className="employer-shell"><header className="employer-header"><div><p className="eyebrow">GCON EMPLOYER PORTAL</p><h1>Placement work, scoped to your organisation.</h1><p>Review released candidates and respond only to placement offers prepared by staff.</p></div><div className="employer-identity"><span className="org-mark">G</span><strong>GCON Placement Team</strong><small>{apiConnected ? 'Secure API session' : 'Demo session'}</small></div></header><main className="employer-content"><section className="employer-metrics"><EmployerMetric label="Visible applicants" value={totals.visibleApplicants} note="Released to GCON" icon="◌" /><EmployerMetric label="Under review" value={totals.underReview} note="Staff-owned decisions" icon="✓" /><EmployerMetric label="Shortlisted" value={totals.shortlisted} note="Awaiting placement offer" icon="☆" accent /><EmployerMetric label="Needs response" value={totals.needsAction} note="Placement requests" icon="!" alert /></section><section className="panel employer-export-panel"><div className="panel-heading"><div><h2>Campus assignment reports</h2><p>{assignedCount} assigned candidates grouped by campus. Reports include candidate and placement contact details.</p></div><div className="employer-export-actions"><button className="outline-button" type="button" onClick={printReport}>Print / save PDF <span>↗</span></button><button className="primary-button" type="button" onClick={exportExcel}>Export Excel workbook (separate tabs) <span>↓</span></button></div></div><div className="campus-report-summary">{groupedCandidates.length ? groupedCandidates.map(({ campus, candidates: campusCandidates }) => <div className="campus-report-summary-row" key={campus.name}><div><strong>{campus.name}</strong><small>{campus.contactName} · {campus.phone} · {campus.email}</small></div><b>{campusCandidates.length}</b></div>) : <div className="empty-table">No released candidates are available for export.</div>}</div><small className="export-directory-note">Excel export creates a summary plus one tab for each campus/status combination. Campus contact directory values are shown with the demo; replace them with approved contacts before a live intake.</small>{exportMessage && <p className="export-action-message" role="status">{exportMessage}</p>}</section><section className="employer-grid"><div className="panel employer-panel"><div className="panel-heading"><div><h2>Released candidate worklist</h2><p>Only records explicitly released to GCON appear here.</p></div><span className="review-scope"><span className="secure-dot" /> Organisation-scoped</span></div><div className="employer-table">{candidates.map((application) => <EmployerCandidateRow key={application.ref} application={application} respondPlacement={respondPlacement} />)}{candidates.length === 0 && <div className="empty-table">No released candidates need employer action.</div>}</div></div><aside className="panel employer-boundary"><div className="side-icon">✓</div><h2>What your team can do</h2><p>Respond to placement requests, record the campus response, and keep the placement action traceable.</p><div className="boundary-rule"><strong>Not visible here</strong><span>Unreleased applicants, sensitive review evidence, and staff eligibility decisions.</span></div><div className="boundary-rule"><strong>Next action</strong><span>Wait for staff to prepare a placement offer before responding.</span></div></aside></section></main><EmployerCampusExportReport groups={groupedCandidates} cycleName={cycle?.name} /></div>;
}
