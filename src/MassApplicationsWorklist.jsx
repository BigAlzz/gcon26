import React, { useEffect, useMemo, useState } from 'react';
import { getApiState, massDeclineApi } from './api.js?placement=1';
import { metricLabelFor, metricKeyFor, sortApplications, worklistMetricOptions } from './applicationWorklist.js';

const statuses = ['All statuses', 'Under review', 'Correction requested', 'Shortlisted', 'Placement ready', 'Placed', 'Declined', 'Withdrawn'];
const pathways = ['All pathways', 'NSC / Grade 12', 'Senior Certificate', 'NC(V) Level 4'];
const pageSizes = [25, 50, 100];
const massDeclineStatuses = ['Under review', 'Correction requested'];

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

function useWorklistData() {
  const [data, setData] = useState({ cycle: null, applications: [], auditLog: [], lettersIssued: false, notifications: [], communications: [] });

  useEffect(() => {
    let active = true;
    getApiState().then((remote) => {
      if (active && remote) setData(remote);
    });
    return () => { active = false; };
  }, []);

  return { data, setData };
}

function metricOptionsFor(pathway) {
  const pathwayMetric = pathway === 'NSC / Grade 12' ? 'aps' : pathway === 'Senior Certificate' ? 'm-score' : pathway === 'NC(V) Level 4' ? 'percentage' : null;
  return worklistMetricOptions.filter((option) => !['aps', 'm-score', 'percentage'].includes(option.value) || !pathwayMetric || option.value === pathwayMetric);
}

export function MassApplicationsPage({ setSelectedRef, setPage }) {
  const { data, setData } = useWorklistData();
  const [query, setQuery] = useState('');
  const [pathway, setPathway] = useState('All pathways');
  const [status, setStatus] = useState('All statuses');
  const [sortMetric, setSortMetric] = useState('pathway-score');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPageNumber] = useState(1);
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [reason, setReason] = useState('Required subject or score not met');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const applications = useMemo(() => (data.applications || []).filter((application) => application.status !== 'Draft'), [data.applications]);
  const availableMetricOptions = useMemo(() => metricOptionsFor(pathway), [pathway]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesQuery = !needle || `${application.ref} ${application.name} ${application.id} ${application.pathway}`.toLowerCase().includes(needle);
      const matchesPathway = pathway === 'All pathways' || application.pathway === pathway;
      const matchesStatus = status === 'All statuses' || application.status === status;
      return matchesQuery && matchesPathway && matchesStatus;
    });
  }, [applications, pathway, query, status]);
  const sorted = useMemo(() => sortApplications(visible, sortMetric, sortDirection), [visible, sortDirection, sortMetric]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = useMemo(() => sorted.slice(pageStart, pageStart + pageSize), [pageStart, pageSize, sorted]);
  const pageDeclinable = pageRows.filter((application) => massDeclineStatuses.includes(application.status));
  const allPageSelected = pageDeclinable.length > 0 && pageDeclinable.every((application) => selectedRefs.includes(application.ref));
  const rankedVisible = sorted.slice(0, 8);
  const exportRows = [['Applicant', 'Reference', 'Pathway', 'Academic value', 'Score type', 'Pathway rank', 'Status'], ...sorted.map((application) => [application.name, application.ref, application.pathway, application.academicScore || application.score, metricLabelFor(application), application.academicRank ? `#${application.academicRank}` : '', application.status])];
  const showingFrom = sorted.length ? pageStart + 1 : 0;
  const showingTo = Math.min(pageStart + pageSize, sorted.length);

  useEffect(() => {
    if (!availableMetricOptions.some((option) => option.value === sortMetric)) setSortMetric('pathway-score');
  }, [availableMetricOptions, sortMetric]);

  useEffect(() => {
    setPageNumber(1);
  }, [pageSize, pathway, query, sortDirection, sortMetric, status]);

  useEffect(() => {
    if (page > pageCount) setPageNumber(pageCount);
  }, [page, pageCount]);

  function toggleRef(ref) {
    setSelectedRefs((current) => current.includes(ref) ? current.filter((item) => item !== ref) : [...current, ref]);
  }

  function toggleAll() {
    const pageRefs = pageDeclinable.map((application) => application.ref);
    setSelectedRefs((current) => allPageSelected ? current.filter((ref) => !pageRefs.includes(ref)) : [...new Set([...current, ...pageRefs])]);
  }

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

  function openApplication(application) {
    setSelectedRef?.(application.ref);
    setPage('reviewQueue');
  }

  return <section className="staff-page">
    <div className="page-heading">
      <div><p className="eyebrow">APPLICATIONS</p><h1>All submitted applications</h1><p>Filter the applicant pool before it reaches the table, then sort by APS, M score, or percentage. Academic values are only ranked within their pathway.</p></div>
      <button className="outline-button" onClick={() => downloadCsv('gcon-2027-applications.csv', exportRows)}>Export current view <span>Download</span></button>
    </div>
    {message && <div className="decision-banner approved mass-decline-message" role="status"><span>OK</span><div><strong>{message}</strong><small>Each outcome is linked to the in-app notification and audit trail.</small></div></div>}
    {confirming && <div className="mass-decline-confirm" role="alertdialog" aria-labelledby="mass-decline-title"><div><p className="eyebrow">BULK ACTION</p><h2 id="mass-decline-title">Decline {selectedRefs.length} applications?</h2><p>This will set each selected application to Declined and create one in-app outcome notification per learner. The action is audit-linked and cannot be applied to shortlisted or placed records.</p></div><label className="field"><span>Reason recorded for every selected learner</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Required subject or score not met</option><option>Incorrect or unreadable document</option><option>Document type not supplied</option><option>Information could not be verified</option></select></label><div className="form-actions compact-actions"><button className="quiet-button" type="button" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button><button className="decline-button" type="button" onClick={massDecline} disabled={busy}>{busy ? 'Declining...' : `Confirm mass decline (${selectedRefs.length})`}</button></div></div>}
    <div className="panel worklist-controls">
      <div className="worklist-filter-grid">
        <label className="worklist-control"><span>Search applicant, ID or reference</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Mokoena or APP-2027" /></label>
        <label className="worklist-control"><span>Pathway</span><select value={pathway} onChange={(event) => setPathway(event.target.value)}>{pathways.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label className="worklist-control"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
      </div>
      <div className="worklist-sort-grid">
        <label className="worklist-control"><span>Sort by</span><select value={sortMetric} onChange={(event) => setSortMetric(event.target.value)}>{availableMetricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="worklist-control"><span>Order</span><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <label className="worklist-control"><span>Rows per page</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <div className="worklist-summary"><strong>{sorted.length.toLocaleString()} matching</strong><span>Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} · {applications.length.toLocaleString()} submitted</span></div>
      </div>
      <p className="worklist-helper">When all pathways are selected, APS, M score, and percentage records remain grouped by their own measure; no cross-pathway score conversion is performed.</p>
    </div>
    <div className="panel academic-ranking-panel"><div className="panel-heading"><div><h2>Top of current view</h2><p>Use the filters and sort controls above to change this shortlist.</p></div><span className="saved-label">Human review still required</span></div><div className="academic-ranking-grid">{rankedVisible.map((application, index) => <button className="academic-ranking-row" type="button" key={application.ref} onClick={() => openApplication(application)}><span className="academic-rank-badge">#{index + 1}</span><span className="academic-ranking-person"><strong>{application.name}</strong><small>{application.ref} · {application.pathway}</small></span><span className="academic-ranking-score"><strong>{application.academicScore || application.score || '—'}</strong><small>{metricLabelFor(application)}</small></span><LocalStatus status={application.status} /></button>)}{rankedVisible.length === 0 && <div className="empty-table">No applicants match the current filters.</div>}</div></div>
    <div className="panel work-panel full-table">
      <div className="table-toolbar"><span className="results-count">Page {page} of {pageCount}</span><button className="decline-button" type="button" disabled={!selectedRefs.length} onClick={() => setConfirming(true)}>Mass decline{selectedRefs.length ? ` (${selectedRefs.length})` : ''}</button></div>
      <div className="mass-action-hint"><span>{selectedRefs.length ? `${selectedRefs.length} selected for mass decline` : 'Select applications under review to send linked in-app outcomes.'}</span><small>{pageDeclinable.length} eligible on this page · checkbox selects this page only</small></div>
      <div className="table-wrap"><table><thead><tr><th className="bulk-select-cell"><input type="checkbox" aria-label="Select all applications eligible for mass decline on this page" checked={allPageSelected} onChange={toggleAll} /></th><th>Applicant</th><th>Reference</th><th>Pathway</th><th>Academic value</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{pageRows.map((application) => { const canMassDecline = massDeclineStatuses.includes(application.status); return <tr key={application.ref} onClick={() => openApplication(application)}><td className="bulk-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${application.name} for mass decline`} checked={selectedRefs.includes(application.ref)} disabled={!canMassDecline} onChange={() => toggleRef(application.ref)} /></td><td><strong>{application.name}</strong><small>{application.id}</small></td><td>{application.ref}</td><td>{application.pathway}</td><td><strong>{application.academicScore || application.score || '—'}</strong><small>{metricLabelFor(application)}</small></td><td><LocalStatus status={application.status} /></td><td>{application.updated}</td><td><button className="row-arrow" aria-label={`Open ${application.ref}`}>Open</button></td></tr>; })}{pageRows.length === 0 && <tr><td colSpan="8" className="empty-table">No matching applications.</td></tr>}</tbody></table></div>
      <div className="worklist-pagination"><span>Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of {sorted.length.toLocaleString()} matching applications</span><div><button className="quiet-button" type="button" disabled={page <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {pageCount}</span><button className="quiet-button" type="button" disabled={page >= pageCount} onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}>Next</button></div></div>
    </div>
  </section>;
}

