import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQualification, mathematicsScore, selectMathematicsResult } from './qualification.js';

test('NSC accepts the minimum subject levels and APS boundary', () => {
  const result = evaluateQualification('NSC / Grade 12', { english: '4', lifeSciences: '4', mathematics: '4', mathsLiteracy: '4', aps: '27' });
  assert.equal(result.status, 'qualifies');
  assert.equal(evaluateQualification('NSC / Grade 12', { english: '4', lifeSciences: '4', mathematics: '3', mathsLiteracy: '4', aps: '27' }).status, 'does-not-qualify');
  assert.equal(evaluateQualification('NSC / Grade 12', { english: '4', lifeSciences: '4', mathematics: '3', mathsLiteracy: '5', aps: '27' }).status, 'qualifies');
  assert.equal(evaluateQualification('NSC / Grade 12', { english: '4', lifeSciences: '4', mathematics: '4', mathsLiteracy: '4', aps: '26.9' }).status, 'does-not-qualify');
});

test('Senior Certificate accepts approved HG/SG results and requires M score 17', () => {
  const result = evaluateQualification('Senior Certificate', { english: 'HG D', biology: 'SG C', mathematics: 'HG D', mScore: '17' });
  assert.equal(result.status, 'qualifies');
  assert.equal(evaluateQualification('Senior Certificate', { english: 'HG D', biology: 'SG C', mathematics: 'HG D', mScore: '16' }).status, 'does-not-qualify');
  assert.equal(evaluateQualification('Senior Certificate', { english: 'HG E', biology: 'SG C', mathematics: 'HG D', mScore: '17' }).status, 'does-not-qualify');
});

test('NC(V) applies 50% fundamentals and 60% named vocational boundaries', () => {
  const boundary = { englishFal: '50', mathematics: '50', lifeOrientation: '50', saHealthCare: '60', publicHealth: '60', humanBody: '60', communityPrimaryCare: '60' };
  assert.equal(evaluateQualification('NC(V) Level 4', boundary).status, 'qualifies');
  assert.equal(evaluateQualification('NC(V) Level 4', { ...boundary, publicHealth: '59' }).status, 'does-not-qualify');
});

test('NSC keeps Mathematics and Maths Literacy mutually exclusive for score calculations', () => {
  const both = { mathematics: '7', mathsLiteracy: '6' };
  assert.deepEqual(selectMathematicsResult(both), { subject: 'Mathematics', value: '7' });
  assert.equal(mathematicsScore(both), 7);
  assert.equal(evaluateQualification('NSC / Grade 12', { english: '4', lifeSciences: '4', ...both, aps: '27' }).mathematicsScore, 7);
  assert.deepEqual(selectMathematicsResult({ mathematics: 'Not taken', mathsLiteracy: '5' }), { subject: 'Maths Literacy', value: '5' });
  assert.equal(mathematicsScore({ mathematics: 'Not taken', mathsLiteracy: '5' }), 5);
});
