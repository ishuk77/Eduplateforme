export const modules = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    eyebrow: 'Platform overview',
    title: 'Dashboard',
    description: 'A responsive command center wired to the real backend foundation, current module counts, and authenticated user context.',
    highlights: ['Tenant overview', 'Operational status', 'Delivery roadmap'],
  },
  {
    id: 'organizations',
    path: '/organizations',
    label: 'Organizations',
    eyebrow: 'Institution structure',
    title: 'Organizations',
    description: 'Govern campuses, schools, and departments with tenant-aware structures and organization-scoped security.',
    highlights: ['Multi-organization hierarchy', 'Governance boundaries', 'Shared services'],
  },
  {
    id: 'people',
    path: '/people',
    label: 'People & Identity',
    eyebrow: 'Identity and access',
    title: 'People & Identity',
    description: 'Manage learners, educators, staff, guardians, and role-based permissions with JWT-backed authentication.',
    highlights: ['Profiles and roles', 'Identity lifecycle', 'Access control'],
  },
  {
    id: 'academics',
    path: '/academics',
    label: 'Academics & Enrollments',
    eyebrow: 'Teaching operations',
    title: 'Academics & Enrollments',
    description: 'Track programs, classes, and learner movement across academic years with auditable history.',
    highlights: ['Programs and cohorts', 'Enrollment rules', 'Academic timelines'],
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports',
    eyebrow: 'Bulletins and outcomes',
    title: 'Reports',
    description: 'Generate learner bulletins from grading and attendance data, with archived history and PDF references.',
    highlights: ['Automatic averages', 'Appreciations', 'Version history'],
  },
  {
    id: 'communications',
    path: '/communications',
    label: 'Communications',
    eyebrow: 'School-family exchange',
    title: 'Communications',
    description: 'Coordinate school, parent, and learner conversations through moderated threads and auditable messages.',
    highlights: ['Class discussions', 'Announcements', 'Moderation levels'],
  },
  {
    id: 'discipline',
    path: '/discipline',
    label: 'Discipline',
    eyebrow: 'Behavior governance',
    title: 'Discipline',
    description: 'Record incidents, sanctions, and rewards with strict organization isolation and encrypted persistence.',
    highlights: ['Incident ledger', 'Access audit', 'Sensitive data at rest'],
  },
  {
    id: 'calendar',
    path: '/calendar',
    label: 'Calendar',
    eyebrow: 'Shared scheduling',
    title: 'Calendar',
    description: 'Track courses, exams, meetings, and vacations with filtered event views and history.',
    highlights: ['Events', 'Role filtering', 'History'],
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    label: 'Subscriptions',
    eyebrow: 'Platform billing',
    title: 'Subscriptions',
    description: 'Manage Free, Standard, Premium, and Enterprise plans with organization-bound feature governance.',
    highlights: ['Plan status', 'Billing hooks', 'Feature readiness'],
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents & Credentials',
    eyebrow: 'Trusted records',
    title: 'Documents & Credentials',
    description: 'Preserve verifiable records, credentials, and their lineage across corrections and superseded versions.',
    highlights: ['Credential issuance', 'Document history', 'Verification journeys'],
  },
  {
    id: 'audit',
    path: '/audit',
    label: 'Audit & Governance',
    eyebrow: 'Control and trust',
    title: 'Audit & Governance',
    description: 'Review audit trails, role enforcement, and organization-scoped actions across the platform.',
    highlights: ['Event oversight', 'Policy checkpoints', 'Compliance readiness'],
  },
];

const moduleLookup = new Map([
  ['/', modules[0]],
  ...modules.map((module) => [module.path, module]),
]);

export function resolveModule(pathname) {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return moduleLookup.get(normalizedPath);
}
