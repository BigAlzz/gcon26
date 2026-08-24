const METRIC_LABELS = {
  aps: 'APS',
  'm-score': 'M score',
  percentage: 'Percentage',
};

export function metricKeyFor(application) {
  const label = String(application?.academicScoreLabel || '').toLowerCase();
  if (label.includes('aps')) return 'aps';
  if (label.includes('m score') || label.includes('m-score')) return 'm-score';
  if (label.includes('percentage')) return 'percentage';
  const pathway = String(application?.pathway || '').toLowerCase();
  if (pathway.includes('nsc')) return 'aps';
  if (pathway.includes('senior')) return 'm-score';
  if (pathway.includes('nc(v)')) return 'percentage';
  return null;
}

export function metricLabelFor(application) {
  return METRIC_LABELS[metricKeyFor(application)] || application?.academicScoreLabel || 'Academic value';
}

function numericScoreFor(application) {
  const raw = application?.academicScore ?? application?.score;
  const value = Number.parseFloat(String(raw ?? '').replace('%', '').trim());
  return Number.isFinite(value) ? value : null;
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base' });
}

function compareNumeric(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * (direction === 'asc' ? 1 : -1);
}

function tieBreak(left, right) {
  return compareText(left.name, right.name) || compareText(left.ref, right.ref);
}

export function sortApplications(applications, metric = 'pathway-score', direction = 'desc') {
  const requestedMetric = metric === 'pathway-score' ? null : metric;
  return [...applications].sort((left, right) => {
    const leftMetric = metricKeyFor(left);
    const rightMetric = metricKeyFor(right);

    if (metric === 'name') return compareText(left.name, right.name) * (direction === 'asc' ? 1 : -1) || compareText(left.ref, right.ref);
    if (metric === 'updated') return compareText(left.updatedAt || left.updated, right.updatedAt || right.updated) * (direction === 'asc' ? 1 : -1) || tieBreak(left, right);

    if (requestedMetric && leftMetric !== rightMetric) {
      if (leftMetric === requestedMetric) return -1;
      if (rightMetric === requestedMetric) return 1;
      return compareText(METRIC_LABELS[leftMetric], METRIC_LABELS[rightMetric]) || tieBreak(left, right);
    }

    if (!requestedMetric && leftMetric !== rightMetric) {
      return compareText(METRIC_LABELS[leftMetric], METRIC_LABELS[rightMetric]) || tieBreak(left, right);
    }

    if (requestedMetric && leftMetric !== requestedMetric) return tieBreak(left, right);

    const scoreComparison = compareNumeric(numericScoreFor(left), numericScoreFor(right), direction);
    return scoreComparison || tieBreak(left, right);
  });
}

export const worklistMetricOptions = [
  { value: 'pathway-score', label: 'Pathway academic score' },
  { value: 'aps', label: 'APS' },
  { value: 'm-score', label: 'M score' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'name', label: 'Applicant name' },
  { value: 'updated', label: 'Last updated' },
];
