export const pathways = ['NSC / Grade 12', 'Senior Certificate', 'NC(V) Level 4'];

export const defaultQualification = {
  'NSC / Grade 12': {
    idNumber: '9901015808081',
    resultYear: '2025',
    english: '5',
    lifeSciences: '5',
    mathematics: '0',
    mathsLiteracy: '0',
    lifeOrientation: '5',
  },
  'Senior Certificate': {
    idNumber: '9901015808081',
    resultYear: '2025',
    english: 'HG C',
    biology: 'HG C',
    mathematics: 'HG D',
  },
  'NC(V) Level 4': {
    idNumber: '9901015808081',
    resultYear: '2025',
    englishFal: '60',
    mathematics: '55',
    lifeOrientation: '50',
    saHealthCare: '60',
    publicHealth: '60',
    humanBody: '60',
    communityPrimaryCare: '60',
  },
};

const seniorPass = (value) => ['HG A', 'HG B', 'HG C', 'HG D', 'SG A', 'SG B', 'SG C'].includes(value);
const numberAtLeast = (value, minimum) => Number(value) >= minimum;
const seniorGradePoints = Object.freeze({
  'HG A': 8,
  'HG B': 7,
  'HG C': 6,
  'HG D': 5,
  'HG E': 4,
  'HG F': 3,
  'SG A': 6,
  'SG B': 5,
  'SG C': 4,
  'SG D': 3,
  'SG E': 2,
  'SG F': 1,
});

export function seniorCertificateMScore(values = {}) {
  const grades = [values.english, values.biology, values.mathematics].map((value) => String(value || '').trim());
  if (grades.some((grade) => !seniorGradePoints[grade])) return null;
  return grades.reduce((total, grade) => total + seniorGradePoints[grade], 0);
}

export function selectMathematicsResult(values = {}) {
  const mathematics = String(values.mathematics ?? '').trim();
  const mathsLiteracy = String(values.mathsLiteracy ?? '').trim();
  if (mathematics && !['0', 'Not taken', 'Not supplied'].includes(mathematics)) return { subject: 'Mathematics', value: mathematics };
  if (mathsLiteracy && !['0', 'Not taken', 'Not supplied'].includes(mathsLiteracy)) return { subject: 'Maths Literacy', value: mathsLiteracy };
  return { subject: null, value: '' };
}

export function mathematicsScore(values = {}) {
  const selected = selectMathematicsResult(values);
  if (!selected.value) return null;
  const score = Number(selected.value);
  return Number.isFinite(score) ? score : null;
}

export function evaluateQualification(pathway, values) {
  const mathematics = selectMathematicsResult(values);
  const mScore = pathway === 'Senior Certificate' ? seniorCertificateMScore(values) : null;
  const checks = pathway === 'Senior Certificate'
    ? [
        ['English', seniorPass(values.english)],
        ['Biology', seniorPass(values.biology)],
        ['Mathematics', seniorPass(values.mathematics)],
        ['Calculated M score of 17', numberAtLeast(mScore, 17)],
      ]
      : pathway === 'NC(V) Level 4'
      ? [
          ['Fundamental subjects at 50%+', [values.englishFal, values.mathematics, values.lifeOrientation].every((value) => numberAtLeast(value, 50))],
          ['SA Health Care System at 60%+', numberAtLeast(values.saHealthCare, 60)],
          ['Public Health at 60%+', numberAtLeast(values.publicHealth, 60)],
          ['The Human Body and Mind at 60%+', numberAtLeast(values.humanBody, 60)],
          ['Community Oriented Primary Care at 60%+', numberAtLeast(values.communityPrimaryCare, 60)],
        ]
      : [
        ['English at Level 4+', numberAtLeast(values.english, 4)],
        ['Life Sciences at Level 4+', numberAtLeast(values.lifeSciences, 4)],
        ['Mathematics at Level 4+ or Maths Literacy at Level 5+', numberAtLeast(values.mathematics, 4) || numberAtLeast(values.mathsLiteracy, 5)],
      ];

  const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
  return {
    status: failed.length ? 'does-not-qualify' : 'qualifies',
    pathway,
    values,
    score: pathway === 'NSC / Grade 12' ? 'Pending certificate verification' : pathway === 'Senior Certificate' ? String(mScore) : 'NC(V) rules passed',
    mScore: pathway === 'Senior Certificate' ? mScore : undefined,
    mathematicsSubject: pathway === 'NSC / Grade 12' ? mathematics.subject : undefined,
    mathematicsScore: pathway === 'NSC / Grade 12' ? mathematicsScore(values) : undefined,
    checks,
    failed,
  };
}
