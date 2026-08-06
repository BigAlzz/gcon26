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
    aps: '34.5',
  },
  'Senior Certificate': {
    idNumber: '9901015808081',
    resultYear: '2025',
    english: 'HG D',
    biology: 'HG D',
    mathematics: 'HG D',
    mScore: '17',
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
  const checks = pathway === 'Senior Certificate'
    ? [
        ['English', seniorPass(values.english)],
        ['Biology', seniorPass(values.biology)],
        ['Mathematics', seniorPass(values.mathematics)],
        ['M score of 17', numberAtLeast(values.mScore, 17)],
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
          ['Reported APS of 27+', numberAtLeast(values.aps, 27)],
        ];

  const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
  return {
    status: failed.length ? 'does-not-qualify' : 'qualifies',
    pathway,
    values,
    score: pathway === 'NSC / Grade 12' ? values.aps : pathway === 'Senior Certificate' ? values.mScore : 'NC(V) rules passed',
    mathematicsSubject: pathway === 'NSC / Grade 12' ? mathematics.subject : undefined,
    mathematicsScore: pathway === 'NSC / Grade 12' ? mathematicsScore(values) : undefined,
    checks,
    failed,
  };
}
