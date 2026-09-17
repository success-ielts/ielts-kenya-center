export interface RoleAuthEnv {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}

export type AuthorizedIdentity = {
  user: any;
  roles: string[];
  token: string;
};

const authJson = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function sessionToken(request: Request) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === 'ikc_session' && rawValue.length) return decodeURIComponent(rawValue.join('='));
  }
  return '';
}

async function supabaseUser(env: RoleAuthEnv, token: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

export async function getUserRoles(env: RoleAuthEnv, userId: string, token: string): Promise<string[]> {
  const query = `/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(userId)}&select=role_id,roles(name)`;
  const response = await fetch(`${env.SUPABASE_URL}${query}`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return [];
  const rows = await response.json<any[]>();
  return Array.from(new Set(
    (Array.isArray(rows) ? rows : [])
      .map(row => row?.roles?.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  ));
}

export async function requireRoles(
  env: RoleAuthEnv,
  request: Request,
  allowedRoles: string[],
): Promise<{ response: Response | null; identity: AuthorizedIdentity | null }> {
  const token = sessionToken(request);
  if (!token) return { response: authJson({ message: 'Authentication required.' }, 401), identity: null };

  const { response, data } = await supabaseUser(env, token);
  if (!response.ok || !data?.id) return { response: authJson({ message: 'Authentication required.' }, 401), identity: null };

  const roles = await getUserRoles(env, data.id, token);
  if (!roles.some(role => allowedRoles.includes(role))) {
    return { response: authJson({ message: 'You are not authorized to access this resource.', roles: [] }, 403), identity: null };
  }

  return { response: null, identity: { user: data, roles, token } };
}

export async function identity(env: RoleAuthEnv, request: Request) {
  const token = sessionToken(request);
  if (!token) return { user: null, roles: [] as string[] };
  const { response, data } = await supabaseUser(env, token);
  if (!response.ok || !data?.id) return { user: null, roles: [] as string[] };
  return { user: data, roles: await getUserRoles(env, data.id, token) };
}
