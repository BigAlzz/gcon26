import { strict as assert } from 'node:assert';
import { metricKeyFor, sortApplications } from './applicationWorklist.js';

const applications = [
  { ref: 'APP-1', name: 'Bongi', pathway: 'NSC / Grade 12', academicScore: 27, academicScoreLabel: 'APS' },
  { ref: 'APP-2', name: 'Andile', pathway: 'NSC / Grade 12', academicScore: 34.5, academicScoreLabel: 'APS' },
  { ref: 'APP-3', name: 'Cleo', pathway: 'Senior Certificate', academicScore: 17, academicScoreLabel: 'M score' },
  { ref: 'APP-4', name: 'Dumisani', pathway: 'Senior Certificate', academicScore: 19, academicScoreLabel: 'M score' },
  { ref: 'APP-5', name: 'Elias', pathway: 'NC(V) Level 4', academicScore: 68, academicScoreLabel: 'Reported percentage' },
];

assert.equal(metricKeyFor(applications[0]), 'aps');
assert.deepEqual(sortApplications(applications.filter((item) => item.pathway.startsWith('NSC')), 'aps', 'desc').map((item) => item.ref), ['APP-2', 'APP-1']);
assert.deepEqual(sortApplications(applications.filter((item) => item.pathway === 'Senior Certificate'), 'm-score', 'asc').map((item) => item.ref), ['APP-3', 'APP-4']);
assert.deepEqual(sortApplications(applications.filter((item) => item.pathway.startsWith('NC')), 'percentage', 'desc').map((item) => item.ref), ['APP-5']);
assert.deepEqual(sortApplications([{ ref: 'APP-6', name: 'No score', academicScoreLabel: 'APS' }, applications[0]], 'aps', 'desc').map((item) => item.ref), ['APP-1', 'APP-6']);
console.log('application worklist tests passed');

