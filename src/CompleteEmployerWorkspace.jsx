import React, { useState } from 'react';

const campuses = ['Ann Latsky Campus', 'Chris Hani Baragwanath Campus', 'SG Lourens Campus', 'Bonalesedi Campus'];

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
  const canRespond = application.status === 'Placement ready';
  function respond(nextResponse) {
    setResponse(nextResponse);
    respondPlacement(application.ref, nextResponse, campus);
  }

  return <div className="employer-candidate">
    <div className="employer-candidate-main"><span className="queue-avatar">{application.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></div></div>
    <Status status={application.status} />
    <div className="employer-candidate-meta"><span>Preference</span><strong>{application.preferences?.[0] || 'Not supplied'}</strong></div>
    {canRespond ? <div className="employer-actions"><select value={campus} onChange={(event) => setCampus(event.target.value)}>{campuses.map((option) => <option key={option}>{option}</option>)}</select><button className="approve-button" onClick={() => respond('accepted')}>Accept placement</button><button className="outline-button" onClick={() => respond('declined')}>Decline</button></div> : application.status === 'Shortlisted' ? <span className="employer-response">Awaiting staff placement offer</span> : <span className="employer-response">Accepted at {application.placementCampus || campus}</span>}
    {response && <small className="employer-confirmation">Response recorded: {response}</small>}
  </div>;
}

export function CompleteEmployerWorkspace({ applications, metrics, respondPlacement, apiConnected }) {
  const candidates = applications.filter((application) => ['Shortlisted', 'Placement ready', 'Placed'].includes(application.status));
  const totals = metrics || {
    visibleApplicants: applications.length,
    underReview: applications.filter((application) => application.status === 'Under review').length,
    shortlisted: applications.filter((application) => application.status === 'Shortlisted').length,
    placed: applications.filter((application) => application.status === 'Placed').length,
    needsAction: applications.filter((application) => application.status === 'Placement ready').length,
  };

  return <div className="employer-shell"><header className="employer-header"><div><p className="eyebrow">GCON EMPLOYER PORTAL</p><h1>Placement work, scoped to your organisation.</h1><p>Review released candidates and respond only to placement offers prepared by staff.</p></div><div className="employer-identity"><span className="org-mark">G</span><strong>GCON Placement Team</strong><small>{apiConnected ? 'Secure API session' : 'Demo session'}</small></div></header><main className="employer-content"><section className="employer-metrics"><EmployerMetric label="Visible applicants" value={totals.visibleApplicants} note="Released to GCON" icon="◌" /><EmployerMetric label="Under review" value={totals.underReview} note="Staff-owned decisions" icon="✓" /><EmployerMetric label="Shortlisted" value={totals.shortlisted} note="Awaiting placement offer" icon="☆" accent /><EmployerMetric label="Needs response" value={totals.needsAction} note="Placement requests" icon="!" alert /></section><section className="employer-grid"><div className="panel employer-panel"><div className="panel-heading"><div><h2>Released candidate worklist</h2><p>Only records explicitly released to GCON appear here.</p></div><span className="review-scope"><span className="secure-dot" /> Organisation-scoped</span></div><div className="employer-table">{candidates.map((application) => <EmployerCandidateRow key={application.ref} application={application} respondPlacement={respondPlacement} />)}{candidates.length === 0 && <div className="empty-table">No released candidates need employer action.</div>}</div></div><aside className="panel employer-boundary"><div className="side-icon">✓</div><h2>What your team can do</h2><p>Respond to placement requests, record the campus response, and keep the placement action traceable.</p><div className="boundary-rule"><strong>Not visible here</strong><span>Unreleased applicants, sensitive review evidence, and staff eligibility decisions.</span></div><div className="boundary-rule"><strong>Next action</strong><span>Wait for staff to prepare a placement offer before responding.</span></div></aside></section></main></div>;
}
