const ADMIN_ROLES = new Set(['platform_owner', 'super_admin', 'admin']);
const STAFF_ROLES = new Set([
  'academic_director',
  'ielts_tutor',
  'student_support',
  'content_editor',
  'marketing',
  'exam_manager',
  'finance',
  'read_only_auditor',
]);

export function rolesFor(user: any, explicitRoles?: unknown): string[] {
  return [
    ...(Array.isArray(explicitRoles) ? explicitRoles : []),
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.user_metadata?.role,
    user?.app_metadata?.role,
  ]
    .filter(Boolean)
    .map((value: unknown) => String(value).toLowerCase());
}

export function destinationFor(user: any, explicitRoles?: unknown): string {
  const roles = rolesFor(user, explicitRoles);
  if (roles.some(role => ADMIN_ROLES.has(role))) return '/admin/dashboard';
  if (roles.some(role => STAFF_ROLES.has(role))) return '/staff/dashboard';
  return '/dashboard';
}

export function isRoleDashboardDestination(destination: string): boolean {
  return destination === '/admin/dashboard' || destination === '/staff/dashboard';
}
