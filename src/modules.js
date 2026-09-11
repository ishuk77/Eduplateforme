export const modules = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    eyebrow: 'Platform overview',
    title: 'Dashboard',
    description:
      'A responsive command center for the educational platform, highlighting the current operating model and the next domain capabilities to connect.',
    highlights: ['Tenant overview', 'Operational status', 'Delivery roadmap'],
  },
  {
    id: 'organizations',
    path: '/organizations',
    label: 'Organizations',
    eyebrow: 'Institution structure',
    title: 'Organizations',
    description:
      'A future workspace for campuses, faculties, departments, and partner institutions that need a shared yet well-governed operating model.',
    highlights: ['Multi-organization hierarchy', 'Governance boundaries', 'Shared services'],
  },
  {
    id: 'people',
    path: '/people',
    label: 'People & Identity',
    eyebrow: 'Identity and access',
    title: 'People & Identity',
    description:
      'A placeholder for the learner, educator, staff, and guardian identity foundations that will later support access, roles, and lifecycle workflows.',
    highlights: ['Profiles and roles', 'Identity lifecycle', 'Access control'],
  },
  {
    id: 'academics',
    path: '/academics',
    label: 'Academics & Enrollments',
    eyebrow: 'Teaching operations',
    title: 'Academics & Enrollments',
    description:
      'A modular starting point for academic structures, cohorts, enrollment flows, and the rules that bind academic operations together.',
    highlights: ['Programs and cohorts', 'Enrollment rules', 'Academic timelines'],
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents & Credentials',
    eyebrow: 'Trusted records',
    title: 'Documents & Credentials',
    description:
      'A future home for official records, verifiable credentials, and the document workflows that support traceability across the platform.',
    highlights: ['Credential issuance', 'Document history', 'Verification journeys'],
  },
  {
    id: 'audit',
    path: '/audit',
    label: 'Audit & Governance',
    eyebrow: 'Control and trust',
    title: 'Audit & Governance',
    description:
      'A governance-focused area for policy visibility, audit trails, and decision accountability across the platform foundation.',
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
