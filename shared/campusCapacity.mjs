export const DEFAULT_CAMPUS_CAPACITIES = Object.freeze({
  'Ann Latsky Campus': 10,
  'Chris Hani Baragwanath Campus': 10,
  'SG Lourens Campus': 10,
  'Bonalesedi Campus': 10,
});

export const PLACEMENT_CAPACITY_STATUSES = Object.freeze(['Placement ready', 'Placed']);

export function capacityFor(cycle, campus) {
  const configured = cycle?.campusCapacities?.[campus];
  const value = Number(configured);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_CAMPUS_CAPACITIES[campus] || 0;
}

export function summarizeCampusCapacities(applications = [], cycle = {}, campusNames = Object.keys(DEFAULT_CAMPUS_CAPACITIES)) {
  return campusNames.map((campus) => {
    const assigned = applications.filter((application) => PLACEMENT_CAPACITY_STATUSES.includes(application.status) && application.placementCampus === campus).length;
    const capacity = capacityFor(cycle, campus);
    return { campus, assigned, capacity, available: Math.max(0, capacity - assigned), overCapacity: assigned > capacity };
  });
}
