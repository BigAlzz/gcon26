import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateContact, createExcelWorkbookHtml, DEFAULT_CAMPUS_DIRECTORY, groupCandidatesByCampus } from './employerExports.js';

test('campus placement exports group assigned candidates in directory order', () => {
  const groups = groupCandidatesByCampus([
    { ref: 'B', name: 'Candidate B', placementCampus: 'SG Lourens Campus', status: 'Placed' },
    { ref: 'A', name: 'Candidate A', placementCampus: 'Ann Latsky Campus', status: 'Placement ready' },
    { ref: 'C', name: 'Candidate C', status: 'Shortlisted' },
  ]);

  assert.deepEqual(groups.map((group) => group.campus.name), ['Ann Latsky Campus', 'SG Lourens Campus', 'Awaiting campus assignment']);
  assert.equal(groups[0].candidates[0].ref, 'A');
  assert.equal(groups[2].candidates[0].ref, 'C');
});

test('campus reports can include empty campus sections so every placement contact is visible', () => {
  const groups = groupCandidatesByCampus([], DEFAULT_CAMPUS_DIRECTORY, { includeEmpty: true });
  assert.deepEqual(groups.map((group) => group.campus.name), DEFAULT_CAMPUS_DIRECTORY.map((campus) => campus.name));
  assert.equal(groups.every((group) => group.candidates.length === 0), true);
});

test('candidate contact details prefer explicit placement contact fields and support submitted profiles', () => {
  assert.deepEqual(candidateContact({ contactMobile: '082 111 1111', contactEmail: 'candidate@example.com', profile: { mobile: 'old', email: 'old@example.com' } }), { mobile: '082 111 1111', email: 'candidate@example.com' });
  assert.deepEqual(candidateContact({ profile: { mobile: '082 222 2222', email: 'profile@example.com' } }), { mobile: '082 222 2222', email: 'profile@example.com' });
});

test('Excel workbook HTML contains campus groups, candidates, and placement contact columns', () => {
  const groups = groupCandidatesByCampus([{ ref: 'A', name: 'Amina Example', pathway: 'NSC / Grade 12', status: 'Placed', placementCampus: DEFAULT_CAMPUS_DIRECTORY[0].name, contactMobile: '082 333 3333', contactEmail: 'amina@example.com' }]);
  const html = createExcelWorkbookHtml(groups, 'GCON 2027');

  assert.match(html, /Ann Latsky Campus/);
  assert.match(html, /Amina Example/);
  assert.match(html, /Candidate mobile/);
  assert.match(html, /annlatsky\.placements@gcon\.example/);
});
