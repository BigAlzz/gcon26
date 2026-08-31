export const DEFAULT_CAMPUS_DIRECTORY = Object.freeze([
  { name: 'Ann Latsky Campus', address: 'Ann Latsky Campus, Gauteng', contactName: 'Ann Latsky placement desk', phone: '+27 10 000 2027', email: 'annlatsky.placements@gcon.example' },
  { name: 'Chris Hani Baragwanath Campus', address: 'Chris Hani Baragwanath Campus, Gauteng', contactName: 'Chris Hani placement desk', phone: '+27 10 000 2028', email: 'chb.placements@gcon.example' },
  { name: 'SG Lourens Campus', address: 'SG Lourens Campus, Gauteng', contactName: 'SG Lourens placement desk', phone: '+27 10 000 2029', email: 'sglourens.placements@gcon.example' },
  { name: 'Bonalesedi Campus', address: 'Bonalesedi Campus, Gauteng', contactName: 'Bonalesedi placement desk', phone: '+27 10 000 2030', email: 'bonalesedi.placements@gcon.example' },
]);

const UNASSIGNED_CAMPUS = Object.freeze({
  name: 'Awaiting campus assignment',
  address: 'No placement campus has been recorded',
  contactName: 'Not assigned',
  phone: 'Not assigned',
  email: 'Not assigned',
});

function text(value, fallback = 'Not provided') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

export function candidateContact(application = {}) {
  const profile = application.profile || {};
  return {
    mobile: text(application.contactMobile || application.mobile || profile.mobile),
    email: text(application.contactEmail || application.email || profile.email),
  };
}

export function placementCampus(application = {}) {
  return text(application.placementCampus, '');
}

export function campusDetails(campusName, directory = DEFAULT_CAMPUS_DIRECTORY) {
  const found = directory.find((campus) => campus.name === campusName);
  return found || { ...UNASSIGNED_CAMPUS, name: campusName || UNASSIGNED_CAMPUS.name };
}

export function groupCandidatesByCampus(candidates = [], directory = DEFAULT_CAMPUS_DIRECTORY, { includeEmpty = false } = {}) {
  const groups = new Map();
  const directoryNames = directory.map((campus) => campus.name);

  if (includeEmpty) directory.forEach((campus) => groups.set(campus.name, { campus, candidates: [] }));

  for (const application of candidates) {
    const campusName = placementCampus(application) || UNASSIGNED_CAMPUS.name;
    if (!groups.has(campusName)) groups.set(campusName, { campus: campusDetails(campusName, directory), candidates: [] });
    groups.get(campusName).candidates.push(application);
  }

  return [...groups.values()].sort((left, right) => {
    const leftIndex = directoryNames.indexOf(left.campus.name);
    const rightIndex = directoryNames.indexOf(right.campus.name);
    if (leftIndex === -1 && rightIndex === -1) return left.campus.name.localeCompare(right.campus.name);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const EXPORT_STATUSES = ['Shortlisted', 'Placement ready', 'Placed'];

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sheetName(campusName, status) {
  const campus = String(campusName || 'Campus')
    .replace('Chris Hani Baragwanath Campus', 'CHB')
    .replace('Ann Latsky Campus', 'Ann Latsky')
    .replace('SG Lourens Campus', 'SG Lourens')
    .replace('Bonalesedi Campus', 'Bonalesedi')
    .replace('Awaiting campus assignment', 'Awaiting');
  return `${campus} | ${status}`.slice(0, 31);
}

function workbookCell(value, styleId = 'Body') {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function workbookCandidateRow(application, campus) {
  const contact = candidateContact(application);
  return `<Row>${[
    application.name,
    application.ref,
    application.pathway,
    application.status,
    contact.mobile,
    contact.email,
    campus.contactName,
    campus.phone,
    campus.email,
    campus.address,
  ].map((value) => workbookCell(value)).join('')}</Row>`;
}

export function createExcelWorkbookXml(groups = [], cycleName = 'GCON 2027') {
  const columns = ['Candidate', 'Reference', 'Pathway', 'Status', 'Candidate mobile', 'Candidate email', 'Placement contact', 'Placement phone', 'Placement email', 'Placement address'];
  const summaryRows = groups.flatMap(({ campus, candidates }) => EXPORT_STATUSES.map((status) => [campus.name, status, candidates.filter((application) => application.status === status).length]));
  const summary = `<Worksheet ss:Name="Summary"><Table ss:ExpandedColumnCount="3" ss:ExpandedRowCount="${summaryRows.length + 1}" x:FullColumns="1" x:FullRows="1"><Row>${['Campus', 'Status', 'Applicants'].map((heading) => workbookCell(heading, 'Header')).join('')}</Row>${summaryRows.map((row) => `<Row>${workbookCell(row[0])}${workbookCell(row[1])}${workbookCell(row[2])}</Row>`).join('')}</Table></Worksheet>`;
  const worksheets = groups.flatMap(({ campus, candidates }) => EXPORT_STATUSES.map((status) => {
    const matching = candidates.filter((application) => application.status === status);
    return `<Worksheet ss:Name="${escapeXml(sheetName(campus.name, status))}"><Table ss:ExpandedColumnCount="10" ss:ExpandedRowCount="${matching.length + 3}" x:FullColumns="1" x:FullRows="1"><Row>${workbookCell(`${campus.name} · ${status}`, 'Title')}</Row><Row>${columns.map((heading) => workbookCell(heading, 'Header')).join('')}</Row>${matching.length ? matching.map((application) => workbookCandidateRow(application, campus)).join('') : `<Row>${workbookCell('No applicants in this campus/status group')}</Row>`}</Table></Worksheet>`;
  })).join('');
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>${escapeXml(cycleName)} campus and status export</Title></DocumentProperties><Styles><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#0B2D52"/><Interior ss:Color="#EAF2F7" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B2D52" ss:Pattern="Solid"/></Style><Style ss:ID="Body"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style></Styles>${summary}${worksheets}</Workbook>`;
}

function excelCell(value, className = '') {
  return `<td${className ? ` class="${className}"` : ''}>${escapeHtml(value)}</td>`;
}

export function createExcelWorkbookHtml(groups = [], cycleName = 'GCON 2027') {
  const rows = groups.flatMap(({ campus, candidates }) => [
    `<tr class="campus-heading"><td colspan="10"><strong>${escapeHtml(campus.name)}</strong><br>${escapeHtml(campus.address)} · ${escapeHtml(campus.contactName)} · ${escapeHtml(campus.phone)} · ${escapeHtml(campus.email)}</td></tr>`,
    `<tr class="column-heading">${['Candidate', 'Reference', 'Pathway', 'Status', 'Candidate mobile', 'Candidate email', 'Placement contact', 'Placement phone', 'Placement email', 'Placement address'].map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr>`,
    ...(candidates.length ? candidates.map((application) => {
      const contact = candidateContact(application);
      return `<tr>${[
        application.name,
        application.ref,
        application.pathway,
        application.status,
        contact.mobile,
        contact.email,
        campus.contactName,
        campus.phone,
        campus.email,
        campus.address,
      ].map((value) => excelCell(value)).join('')}</tr>`;
    }) : ['<tr><td colspan="10">No candidates are currently assigned to this campus.</td></tr>']),
  ]);

  const empty = rows.length ? '' : '<tr><td colspan="10">No released candidates are available.</td></tr>';
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>${escapeHtml(cycleName)} campus placements</title><style>body{font-family:Arial,sans-serif;color:#152a3b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c7d4de;padding:7px;text-align:left;vertical-align:top}th{background:#0b2d52;color:#fff;font-weight:700}.campus-heading td{background:#eaf2f7;color:#0b2d52;font-size:14px;font-weight:700}.column-heading th{background:#52718b;font-size:11px}td{font-size:11px}.campus-heading strong{font-size:15px}</style></head><body><h1>${escapeHtml(cycleName)} campus placement list</h1><p>Grouped by assigned campus. Includes candidate and placement contact details.</p><table>${rows.join('')}${empty}</table></body></html>`;
}

export function downloadExcelWorkbook(groups, cycleName = 'GCON 2027') {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const blob = new Blob([`\ufeff${createExcelWorkbookXml(groups, cycleName)}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = String(cycleName || 'GCON-2027').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'gcon-2027';
  link.href = url;
  link.download = `${safeName}-campus-status-workbook.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
