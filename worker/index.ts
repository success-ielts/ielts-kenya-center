import { identity, requireRoles } from './authorization';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CLOUDFLARE_API_TOKEN?: string;
  OPS_SETUP_KEY?: string;
  RELEASE_ID?: string;
}

const cookieName = 'ikc_session';
const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers || {}) } });
const error = (message: string, status = 400) => json({ message }, { status });
const parseCookies = (header = '') => Object.fromEntries(header.split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2));
const sessionToken = (request: Request) => parseCookies(request.headers.get('Cookie') || '')[cookieName];
const supabase = async (env: Env, path: string, init: RequestInit = {}, token?: string) => {
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_PUBLISHABLE_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  return { response, data };
};
const withCookie = (response: Response, token: string) => {
  const headers = new Headers(response.headers);
  headers.set('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`);
  return new Response(response.body, { status: response.status, headers });
};
const clearCookie = () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
const resend = async (env: Env, to: string, subject: string, html: string) => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'IELTS Kenya Center <admin@ielts-kenyacenter.or.ke>', to: [to], subject, html }) });
const safeName = (name: string) => name.replace(/[<>&\"']/g, '');
const productionOrigin = 'https://ielts-kenyacenter.or.ke';
const authRedirect = (path: string) => `${productionOrigin}${path}`;

async function currentUser(env: Env, request: Request) {
  const token = sessionToken(request);
  if (!token) return { token: '', user: null as any };
  const { response, data } = await supabase(env, '/auth/v1/user', {}, token);
  return response.ok ? { token, user: data as any } : { token: '', user: null as any };
}

async function requireUser(env: Env, request: Request) {
  const session = await currentUser(env, request);
  if (!session.user?.id) return { response: error('Authentication required.', 401), user: null as any, token: '' };
  return { response: null, user: session.user, token: session.token };
}

async function isEnrolled(env: Env, studentId: string, courseId: string, token: string) {
  const result = await supabase(env, `/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&course_id=eq.${encodeURIComponent(courseId)}&status=neq.paused&select=id,status`, {}, token);
  return { ok: result.response.ok, enrolled: Array.isArray(result.data) && result.data.length > 0 };
}

const adminRoles = ['super_admin', 'admin', 'platform_owner'];
const staffRoles = ['academic_director', 'ielts_tutor', 'student_support', 'content_editor', 'marketing', 'exam_manager', 'finance', 'read_only_auditor'];

function accessDeniedPage(status: number, message: string) {
  const title = status === 401 ? 'Sign in required' : 'Access denied';
  const safeMessage = message.replace(/[<>&\"']/g, '');
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:40px;line-height:1.6"><main style="max-width:680px;margin:auto"><h1>${title}</h1><p>${safeMessage}</p><p><a href="/">Return to IELTS Kenya Center</a></p></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function protectedAppRoute(request: Request, env: Env, allowedRoles: string[]) {
  const auth = await requireRoles(env, request, allowedRoles);
  if (auth.response) {
    const message = auth.response.status === 401 ? 'Please sign in to access this protected area.' : 'Your account does not have a role authorized for this area.';
    return accessDeniedPage(auth.response.status, message);
  }
  const shellRequest = new Request(
    new URL('/index.html', request.url),
    {
      method: 'GET',
      headers: request.headers,
    },
  );
  return env.ASSETS.fetch(shellRequest);
}

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  let body: any = {};
  if (method !== 'GET' && method !== 'HEAD') { try { body = await request.json(); } catch { body = {}; } }

  if (method === 'GET' && path === '/api/_healthcheck') return json({ ok: true, service: 'ielts-kenya-center', release: env.RELEASE_ID || 'unknown' }, { headers: { 'Cache-Control': 'no-store' } });
  if (method === 'GET' && path === '/api/config-status') return json({ supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY) });
  if (method === 'POST' && path === '/api/email/status') return json({ configured: Boolean(env.RESEND_API_KEY), from: 'IELTS Kenya Center <admin@ielts-kenyacenter.or.ke>' });

  if (method === 'POST' && path === '/api/email/test') {
    if (!env.OPS_SETUP_KEY) return error('Email test is not configured on the server.', 503);
    if (body.setupKey !== env.OPS_SETUP_KEY) return error('Invalid setup key.', 403);
    if (!body.to) return error('Test recipient is required.', 400);
    try { const response = await resend(env, body.to, 'IELTS Kenya Center email test', '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>IELTS Kenya Center</h2><p>This is a successful test of the Resend email connection.</p><p>From: admin@ielts-kenyacenter.or.ke</p></div>'); if (!response.ok) return error('Resend rejected the test email.', 502); return json({ ok: true, message: 'Test email accepted by Resend.' }); } catch { return error('Unable to reach Resend.', 502); }
  }

  if (method === 'POST' && path === '/api/cloudflare/setup') return error('Cloudflare DNS setup is managed by the production deployment pipeline.', 410);

  if (method === 'POST' && path === '/api/auth/signup') {
    if (!body.email || !body.password || !body.fullName) return error('Full name, email and password are required.', 400);
    if (body.password.length < 8) return error('Password must be at least 8 characters.', 400);
    const email = String(body.email).trim();
    const redirectTo = authRedirect('/auth/callback');
    const { response, data } = await supabase(env, `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: JSON.stringify({ email, password: body.password, data: { full_name: String(body.fullName).trim() } }) });
    if (!response.ok) return error((data as any)?.msg || (data as any)?.message || 'We could not create your account.', response.status);
    const accessToken = (data as any)?.access_token;
    let welcomeEmailAccepted = false;
    try { welcomeEmailAccepted = (await resend(env, email, 'Welcome to IELTS Kenya Center', `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">Welcome to IELTS Kenya Center</h2><p>Hello ${safeName(String(body.fullName).trim())},</p><p>Your learner account has been created. You can now begin your IELTS preparation journey with structured practice, mock tests and progress tracking.</p><p><strong>Prepare • Practice • Achieve</strong></p><p>Please complete the Supabase email verification email before signing in if verification is required.</p><p style="font-size:13px;color:#666">Your Global Opportunities Start Here</p></div>`)).ok; } catch { welcomeEmailAccepted = false; }
    const result = json({ ok: true, user: (data as any)?.user || null, needsEmailVerification: !accessToken, welcomeEmailAccepted, message: accessToken ? 'Account created. Welcome email sent.' : 'Account created. Check your email to verify it before signing in.' });
    return accessToken ? withCookie(result, accessToken) : result;
  }

  if (method === 'POST' && path === '/api/auth/signin') {
    if (!body.email || !body.password) return error('Email and password are required.', 400);
    const { response, data } = await supabase(env, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: String(body.email).trim(), password: body.password }) });
    if (!response.ok) return error((data as any)?.error_description || (data as any)?.msg || 'Invalid email or password.', response.status === 400 ? 401 : response.status);
    return withCookie(json({ ok: true, user: (data as any)?.user || null }), (data as any).access_token);
  }

  if (method === 'POST' && path === '/api/auth/recover') {
    if (!body.email) return error('Email address is required.', 400);
    const email = String(body.email).trim();
    const codeChallenge = typeof body.codeChallenge === 'string' ? body.codeChallenge.trim() : '';
    const codeChallengeMethod = typeof body.codeChallengeMethod === 'string' ? body.codeChallengeMethod.trim() : '';
    const recoveryBody: Record<string, string> = { email };
    if (codeChallenge) {
      if (codeChallenge.length < 43 || codeChallenge.length > 128) return error('Invalid recovery session.', 400);
      if (codeChallengeMethod !== 'S256') return error('Invalid recovery session.', 400);
      recoveryBody.code_challenge = codeChallenge;
      recoveryBody.code_challenge_method = 'S256';
    }
    const { response } = await supabase(env, `/auth/v1/recover?redirect_to=${encodeURIComponent(authRedirect('/reset-password'))}`, { method: 'POST', body: JSON.stringify(recoveryBody) });
    if (!response.ok) return error('We could not send the password recovery email. Please check the address and try again.', response.status);
    return json({ ok: true, message: 'If an account exists for that email, a password recovery link has been sent.' });
  }

  if (method === 'POST' && path === '/api/auth/exchange') {
    if (body.accessToken) {
      const { response, data } = await supabase(env, '/auth/v1/user', {}, String(body.accessToken));
      if (!response.ok) return error('This authentication link is invalid or has expired.', 401);
      return withCookie(json({ ok: true, user: data }), String(body.accessToken));
    }
    if (body.code && body.codeVerifier) {
      const code = String(body.code);
      const codeVerifier = String(body.codeVerifier);
      if (codeVerifier.length < 43 || codeVerifier.length > 128) return error('Invalid recovery session.', 400);
      const { response, data } = await supabase(env, '/auth/v1/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }) });
      if (!response.ok || !(data as any)?.access_token) return error('This authentication link is invalid or has expired.', 401);
      return withCookie(json({ ok: true, user: (data as any)?.user || null }), String((data as any).access_token));
    }
    return error('Authentication callback is missing its secure session.', 400);
  }

  if (method === 'POST' && path === '/api/auth/signout') return clearCookie();
  if (method === 'GET' && path === '/api/auth/me') return json(await identity(env, request));

  if (method === 'PUT' && path === '/api/auth/password') {
    const auth = await requireUser(env, request); if (auth.response) return auth.response;
    if (!body.password || String(body.password).length < 8) return error('Password must be at least 8 characters.', 400);
    const { response, data } = await supabase(env, '/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: String(body.password) }) }, auth.token);
    if (!response.ok) return error((data as any)?.message || 'Unable to update your password.', response.status);
    return json({ ok: true, message: 'Password updated successfully.' });
  }


  const adminAuth = async (request: Request) => requireRoles(env, request, adminRoles);

  const adminSupabase = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('apikey', env.SUPABASE_SECRET_KEY);
    headers.set('Authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { response, data };
  };

  const adminCount = async (path: string) => {
    const result = await adminSupabase(path, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    if (!result.response.ok) throw new Error(`Admin data query failed: ${result.response.status}`);
    const range = result.response.headers.get('content-range') || '';
    const total = range.includes('/') ? Number(range.split('/')[1]) : NaN;
    return Number.isFinite(total) ? total : (Array.isArray(result.data) ? result.data.length : 0);
  };

  if (method === 'GET' && path === '/api/admin/overview') {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    try {
      const [profileCount, activeEnrollments, publishedCourses, modules, lessons, completedLessons, progressRecords, roles, roleAssignments] = await Promise.all([
        adminCount('/rest/v1/profiles?select=id'),
        adminCount('/rest/v1/enrollments?status=eq.active&select=id'),
        adminCount('/rest/v1/courses?is_published=eq.true&select=id'),
        adminCount('/rest/v1/course_modules?select=id'),
        adminCount('/rest/v1/lessons?select=id'),
        adminCount('/rest/v1/lesson_progress?status=eq.completed&select=id'),
        adminCount('/rest/v1/lesson_progress?select=id'),
        adminCount('/rest/v1/roles?select=id'),
        adminCount('/rest/v1/profile_roles?select=profile_id,role_id'),
      ]);
      const assignments = await adminSupabase('/rest/v1/profile_roles?select=profile_id,role_id,roles(name)');
      const privilegedRoleNames = new Set([...staffRoles, 'admin', 'super_admin', 'platform_owner']);
      const privilegedProfiles = new Set<string>();
      if (assignments.response.ok && Array.isArray(assignments.data)) {
        for (const row of assignments.data) if (privilegedRoleNames.has(row?.roles?.name)) privilegedProfiles.add(row.profile_id);
      }
      const students = Math.max(0, profileCount - privilegedProfiles.size);
      const staffProfiles = new Set<string>();
      if (assignments.response.ok && Array.isArray(assignments.data)) {
        for (const row of assignments.data) if (staffRoles.includes(row?.roles?.name)) staffProfiles.add(row.profile_id);
      }
      return json({ ok: true, counts: { students, activeEnrollments, publishedCourses, modules, lessons, completedLessons, progressRecords, staffAccounts: staffProfiles.size, roles, roleAssignments } });
    } catch {
      return error('Unable to load the admin overview.', 502);
    }
  }

  if (method === 'GET' && path === '/api/admin/students') {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const search = (url.searchParams.get('search') || '').trim().replace(/[(),]/g, ' ');
    const usersResult = await adminSupabase('/auth/v1/admin/users?page=1&per_page=1000');
    if (!usersResult.response.ok) return error('Unable to load student accounts.', 502);
    const users = Array.isArray(usersResult.data?.users) ? usersResult.data.users : [];
    const profileQuery = '/rest/v1/profiles?select=id,full_name,created_at&order=created_at.desc';
    const profilesResult = await adminSupabase(profileQuery);
    if (!profilesResult.response.ok) return error('Unable to load student profiles.', 502);
    const profiles = Array.isArray(profilesResult.data) ? profilesResult.data : [];
    const rolesResult = await adminSupabase('/rest/v1/profile_roles?select=profile_id,roles(name)');
    const roleMap = new Map<string,string[]>();
    if (rolesResult.response.ok && Array.isArray(rolesResult.data)) {
      for (const row of rolesResult.data) {
        const name = row?.roles?.name;
        if (name) roleMap.set(row.profile_id, [...(roleMap.get(row.profile_id) || []), name]);
      }
    }
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    let rows = users.map((u: any) => {
      const p = profileMap.get(u.id) || {};
      return { id: u.id, email: u.email || '', full_name: p.full_name || u.user_metadata?.full_name || '', created_at: p.created_at || u.created_at || null, roles: roleMap.get(u.id) || [] };
    }).filter((u: any) => !u.roles.some((r: string) => staffRoles.includes(r)) && !u.roles.includes('admin') && !u.roles.includes('super_admin') && !u.roles.includes('platform_owner'));
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((u: any) => String(u.email).toLowerCase().includes(needle) || String(u.full_name).toLowerCase().includes(needle));
    }
    return json({ ok: true, students: rows.slice(0, 100) });
  }

  const adminStudentMatch = path.match(/^\/api\/admin\/students\/([^/]+)$/);
  if (method === 'GET' && adminStudentMatch) {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const studentId = decodeURIComponent(adminStudentMatch[1]);
    const [userResult, profileResult, roleResult, enrollmentsResult, progressResult] = await Promise.all([
      adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(studentId)}`),
      adminSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}&select=id,full_name,created_at`),
      adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(studentId)}&select=roles(name)`),
      adminSupabase(`/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=id,course_id,status,enrolled_at,completed_at,courses(id,title,slug)&order=enrolled_at.desc`),
      adminSupabase(`/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=id,lesson_id,status,percent,last_position_seconds,completed_at,updated_at,lessons(id,title,module_id,course_modules(id,title,course_id,courses(id,title)))&order=updated_at.desc`),
    ]);
    if (!userResult.response.ok || !profileResult.response.ok || !roleResult.response.ok || !enrollmentsResult.response.ok || !progressResult.response.ok) return error('Unable to load the student profile.', 502);
    const targetRoles = (Array.isArray(roleResult.data) ? roleResult.data : []).map((r:any)=>r?.roles?.name).filter(Boolean);
    if (targetRoles.some((r:string)=>staffRoles.includes(r)||['admin','super_admin','platform_owner'].includes(r))) return error('Student profile not found.',404);
    const user = userResult.data || {};
    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] || null : null;
    const enrollments = Array.isArray(enrollmentsResult.data) ? enrollmentsResult.data : [];
    const progress = Array.isArray(progressResult.data) ? progressResult.data : [];
    return json({
      ok: true,
      student: { id: studentId, email: user.email || '', full_name: profile?.full_name || user.user_metadata?.full_name || '', created_at: profile?.created_at || user.created_at || null },
      enrollments: enrollments.map((e: any) => ({ id:e.id,status:e.status,enrolled_at:e.enrolled_at,completed_at:e.completed_at,course:e.courses ? {id:e.courses.id,title:e.courses.title,slug:e.courses.slug} : null })),
      progress: progress.map((p: any) => ({ id:p.id,lesson_id:p.lesson_id,status:p.status,percent:p.percent,completed_at:p.completed_at,updated_at:p.updated_at,lesson:p.lessons ? {id:p.lessons.id,title:p.lessons.title,module:p.lessons.course_modules ? {id:p.lessons.course_modules.id,title:p.lessons.course_modules.title,course:p.lessons.course_modules.courses ? {id:p.lessons.course_modules.courses.id,title:p.lessons.course_modules.courses.title} : null} : null} : null })),
    });
  }



  const staffManagementRoles = [...staffRoles, ...adminRoles];
  const assignableStaffRoles = [...staffRoles, ...adminRoles];

  async function writeStaffAudit(actorUserId: string, targetUserId: string, action: string, previousValue: unknown, newValue: unknown) {
    await adminSupabase('/rest/v1/staff_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_user_id: actorUserId,
        target_user_id: targetUserId,
        action,
        previous_value: previousValue,
        new_value: newValue,
      }),
    });
  }

  if (method === 'GET' && path === '/api/admin/staff') {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const roleFilter = (url.searchParams.get('role') || '').trim();
    const [usersResult, profilesResult, rolesResult] = await Promise.all([
      adminSupabase('/auth/v1/admin/users?page=1&per_page=1000'),
      adminSupabase('/rest/v1/profiles?select=id,full_name,phone_number,country,county_town,job_title,staff_active,employment_start_date,created_at,updated_at'),
      adminSupabase('/rest/v1/profile_roles?select=profile_id,role_id,roles(id,name,description)'),
    ]);
    if (!usersResult.response.ok || !profilesResult.response.ok || !rolesResult.response.ok) return error('Unable to load staff accounts.', 502);
    const profileMap = new Map((Array.isArray(profilesResult.data) ? profilesResult.data : []).map((p: any) => [p.id, p]));
    const roleMap = new Map<string, any[]>();
    for (const row of (Array.isArray(rolesResult.data) ? rolesResult.data : [])) {
      if (!staffManagementRoles.includes(row?.roles?.name)) continue;
      roleMap.set(row.profile_id, [...(roleMap.get(row.profile_id) || []), row.roles]);
    }
    let staff = (Array.isArray(usersResult.data?.users) ? usersResult.data.users : [])
      .map((u: any) => {
        const p = profileMap.get(u.id) || {};
        const roles = roleMap.get(u.id) || [];
        return {
          id: u.id,
          email: u.email || '',
          full_name: p.full_name || u.user_metadata?.full_name || '',
          job_title: p.job_title || null,
          staff_active: p.staff_active ?? null,
          employment_start_date: p.employment_start_date || null,
          created_at: p.created_at || u.created_at || null,
          roles: roles.map((r: any) => ({ id: r.id, name: r.name, description: r.description || null })),
        };
      })
      .filter((u: any) => u.roles.length > 0);
    if (roleFilter) staff = staff.filter((u: any) => u.roles.some((r: any) => r.name === roleFilter));
    if (search) staff = staff.filter((u: any) => String(u.email).toLowerCase().includes(search) || String(u.full_name).toLowerCase().includes(search) || String(u.job_title || '').toLowerCase().includes(search));
    return json({ ok: true, staff: staff.slice(0, 200), roles: assignableStaffRoles });
  }

  const adminStaffMatch = path.match(/^\/api\/admin\/staff\/([^/]+)$/);
  if (method === 'GET' && adminStaffMatch) {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const targetId = decodeURIComponent(adminStaffMatch[1]);
    const [userResult, profileResult, rolesResult] = await Promise.all([
      adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(targetId)}`),
      adminSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=id,full_name,phone_number,country,county_town,job_title,staff_active,employment_start_date,created_at,updated_at`),
      adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}&select=role_id,created_at,roles(id,name,description)`),
    ]);
    if (!userResult.response.ok) return error('Staff account not found.', 404);
    if (!profileResult.response.ok || !rolesResult.response.ok) return error('Unable to load staff details.', 502);
    const roles = (Array.isArray(rolesResult.data) ? rolesResult.data : [])
      .map((r: any) => r.roles)
      .filter((r: any) => r && staffManagementRoles.includes(r.name))
      .map((r: any) => ({ id: r.id, name: r.name, description: r.description || null }));
    if (!roles.length) return error('Staff account not found.', 404);
    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] || null : null;
    const user = userResult.data || {};
    return json({
      ok: true,
      staff: {
        id: targetId,
        email: user.email || '',
        full_name: profile?.full_name || user.user_metadata?.full_name || '',
        phone_number: profile?.phone_number || null,
        country: profile?.country || null,
        county_town: profile?.county_town || null,
        job_title: profile?.job_title || null,
        staff_active: profile?.staff_active ?? null,
        employment_start_date: profile?.employment_start_date || null,
        created_at: profile?.created_at || user.created_at || null,
        updated_at: profile?.updated_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        roles,
      },
      roles: assignableStaffRoles,
    });
  }

  const adminStaffStatusMatch = path.match(/^\/api\/admin\/staff\/([^/]+)\/status$/);
  if (method === 'PATCH' && adminStaffStatusMatch) {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const targetId = decodeURIComponent(adminStaffStatusMatch[1]);
    const active = body.active;
    if (typeof active !== 'boolean') return error('Active status must be a boolean.', 400);
    if (targetId === auth.identity!.user.id) return error('You cannot change your own staff status.', 409);

    const [targetUser, profileResult, targetRolesResult] = await Promise.all([
      adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(targetId)}`),
      adminSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=id,staff_active`),
      adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}&select=roles(name)`),
    ]);
    if (!targetUser.response.ok) return error('Staff account not found.', 404);
    if (!profileResult.response.ok || !targetRolesResult.response.ok) return error('Unable to load staff status.', 502);
    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] : null;
    if (!profile) return error('Staff account not found.', 404);
    const currentRoles = (Array.isArray(targetRolesResult.data) ? targetRolesResult.data : []).map((r: any) => r?.roles?.name).filter(Boolean);
    if (!currentRoles.some((r: string) => staffManagementRoles.includes(r))) return error('Staff account not found.', 404);
    if (currentRoles.includes('platform_owner')) return error('The platform owner status is protected.', 403);
    if (currentRoles.some((r: string) => adminRoles.includes(r)) && !auth.identity!.roles.includes('super_admin')) {
      return error('Only a super administrator can change administrator status.', 403);
    }
    if (!active && currentRoles.some((r: string) => adminRoles.includes(r))) {
      const adminAssignments = await adminSupabase('/rest/v1/profile_roles?select=profile_id,roles!inner(name)&roles.name=in.(admin,super_admin,platform_owner)');
      if (!adminAssignments.response.ok) return error('Unable to verify administrator protection.', 502);
      const adminProfiles = new Set((Array.isArray(adminAssignments.data) ? adminAssignments.data : []).map((r: any) => r.profile_id));
      if (adminProfiles.size <= 1) return error('The final authorized administrator cannot be deactivated.', 409);
    }
    const previousActive = profile.staff_active === false ? false : true;
    if (previousActive === active) return error('Staff account is already in that status.', 409);
    const result = await adminSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ staff_active: active, updated_at: new Date().toISOString() }),
    });
    if (!result.response.ok) return error('Unable to update staff status.', 502);
    await writeStaffAudit(auth.identity!.user.id, targetId, active ? 'staff_activated' : 'staff_deactivated', { staff_active: previousActive }, { staff_active: active });
    return json({ ok: true, staff_active: active });
  }

  const adminStaffRoleMatch = path.match(/^\/api\/admin\/staff\/([^/]+)\/roles$/);
  if ((method === 'POST' || method === 'PATCH') && adminStaffRoleMatch) {
    const auth = await adminAuth(request);
    if (auth.response) return auth.response;
    const targetId = decodeURIComponent(adminStaffRoleMatch[1]);
    const action = String(body.action || '').trim().toLowerCase();
    const roleName = String(body.roleName || body.role || '').trim().toLowerCase();
    if (!['assign', 'remove'].includes(action)) return error('Role action must be assign or remove.', 400);
    if (!roleName || !assignableStaffRoles.includes(roleName) || roleName === 'platform_owner') return error('Unknown or non-manageable role.', 400);
    if (targetId === auth.identity!.user.id) return error('You cannot change your own roles.', 409);

    const [targetUser, targetRolesResult, roleResult] = await Promise.all([
      adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(targetId)}`),
      adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}&select=role_id,roles(id,name,description)`),
      adminSupabase(`/rest/v1/roles?name=eq.${encodeURIComponent(roleName)}&select=id,name,description`),
    ]);
    if (!targetUser.response.ok) return error('Staff account not found.', 404);
    if (!roleResult.response.ok) return error('Unable to validate role.', 502);
    const role = Array.isArray(roleResult.data) ? roleResult.data[0] : null;
    if (!role || !assignableStaffRoles.includes(role.name) || role.name === 'platform_owner') return error('Unknown or non-manageable role.', 400);
    if (!targetRolesResult.response.ok) return error('Unable to load current roles.', 502);

    const currentRows = Array.isArray(targetRolesResult.data) ? targetRolesResult.data : [];
    const currentRoles = currentRows.map((r: any) => r?.roles?.name).filter(Boolean);
    const callerRoles = auth.identity!.roles || [];
    const callerIsSuperAdmin = callerRoles.includes('super_admin');
    if ((roleName === 'super_admin' || roleName === 'admin' || currentRoles.includes('super_admin') || currentRoles.includes('admin')) && !callerIsSuperAdmin) {
      return error('Only a super administrator can change administrator roles.', 403);
    }

    if (action === 'assign') {
      if (currentRoles.includes(roleName)) return error('That role is already assigned.', 409);
      const insertResult = await adminSupabase('/rest/v1/profile_roles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ profile_id: targetId, role_id: role.id }),
      });
      if (!insertResult.response.ok) return error('Unable to assign the role.', insertResult.response.status === 409 ? 409 : 502);
      await writeStaffAudit(auth.identity!.user.id, targetId, 'role_assigned', { roles: currentRoles }, { roles: [...currentRoles, roleName] });
      return json({ ok: true, action, role: roleName, roles: [...currentRoles, roleName] });
    }

    if (!currentRoles.includes(roleName)) return error('That role is not currently assigned.', 409);
    const isAdminRole = adminRoles.includes(roleName);
    if (isAdminRole) {
      const adminAssignments = await adminSupabase('/rest/v1/profile_roles?select=profile_id,roles!inner(name)&roles.name=in.(admin,super_admin,platform_owner)');
      if (!adminAssignments.response.ok) return error('Unable to verify administrator protection.', 502);
      const adminProfiles = new Set((Array.isArray(adminAssignments.data) ? adminAssignments.data : []).map((r: any) => r.profile_id));
      const targetHasAnotherAdminRole = currentRoles.some((r: string) => adminRoles.includes(r) && r !== roleName);
      if (adminProfiles.size <= 1 && !targetHasAnotherAdminRole) return error('The final authorized administrator cannot be removed or downgraded.', 409);
    }
    const deleteResult = await adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}&role_id=eq.${encodeURIComponent(role.id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    if (!deleteResult.response.ok) return error('Unable to remove the role.', deleteResult.response.status);
    await writeStaffAudit(auth.identity!.user.id, targetId, 'role_removed', { roles: currentRoles }, { roles: currentRoles.filter((r: string) => r !== roleName) });
    return json({ ok: true, action, role: roleName, roles: currentRoles.filter((r: string) => r !== roleName) });
  }

  if (method === 'GET' && path === '/api/admin/courses') {
    const auth = await adminAuth(request); if (auth.response) return auth.response;
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const result = await adminSupabase('/rest/v1/courses?select=id,slug,title,description,level,ielts_type,thumbnail_url,is_published,sort_order,created_at,updated_at&order=sort_order.asc,created_at.desc');
    if (!result.response.ok) return error('Unable to load courses.', 502);
    let courses = Array.isArray(result.data) ? result.data : [];
    if (search) courses = courses.filter((c:any)=>[c.title,c.slug,c.level,c.ielts_type].some(v=>String(v||'').toLowerCase().includes(search)));
    const modules = await adminSupabase('/rest/v1/course_modules?select=id,course_id');
    const lessons = await adminSupabase('/rest/v1/lessons?select=id,module_id');
    const moduleCount = new Map<string,number>(), lessonCount = new Map<string,number>(), moduleCourse = new Map<string,string>();
    for (const m of (Array.isArray(modules.data)?modules.data:[])) { moduleCourse.set(m.id,m.course_id); moduleCount.set(m.course_id,(moduleCount.get(m.course_id)||0)+1); }
    for (const l of (Array.isArray(lessons.data)?lessons.data:[])) { const cid=moduleCourse.get(l.module_id); if(cid) lessonCount.set(cid,(lessonCount.get(cid)||0)+1); }
    return json({ok:true,courses:courses.map((c:any)=>({...c,module_count:moduleCount.get(c.id)||0,lesson_count:lessonCount.get(c.id)||0}))});
  }

  if (method === 'POST' && path === '/api/admin/courses') {
    const auth = await adminAuth(request); if (auth.response) return auth.response;
    const title=String(body.title||'').trim(), slug=String(body.slug||title).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    if(!title||!slug) return error('Course title and slug are required.',400);
    const payload={slug,title,description:body.description?String(body.description).trim():null,level:body.level?String(body.level).trim():null,ielts_type:body.ieltsType?String(body.ieltsType).trim():null,thumbnail_url:body.thumbnailUrl?String(body.thumbnailUrl).trim():null,is_published:Boolean(body.isPublished),sort_order:Number.isFinite(Number(body.sortOrder))?Number(body.sortOrder):0};
    const result=await adminSupabase('/rest/v1/courses',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(!result.response.ok) return error(result.response.status===409?'A course with this slug already exists.':'Unable to create course.',result.response.status===409?409:502);
    return json({ok:true,course:Array.isArray(result.data)?result.data[0]||null:null},{status:201});
  }

  const adminCourseMatch=path.match(/^\/api\/admin\/courses\/([^/]+)$/);
  if(method==='PATCH'&&adminCourseMatch){
    const auth=await adminAuth(request); if(auth.response) return auth.response;
    const courseId=decodeURIComponent(adminCourseMatch[1]), payload:any={};
    if(body.title!==undefined) payload.title=String(body.title).trim();
    if(body.slug!==undefined) payload.slug=String(body.slug).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    if(body.description!==undefined) payload.description=body.description?String(body.description).trim():null;
    if(body.level!==undefined) payload.level=body.level?String(body.level).trim():null;
    if(body.ieltsType!==undefined) payload.ielts_type=body.ieltsType?String(body.ieltsType).trim():null;
    if(body.thumbnailUrl!==undefined) payload.thumbnail_url=body.thumbnailUrl?String(body.thumbnailUrl).trim():null;
    if(body.isPublished!==undefined) payload.is_published=Boolean(body.isPublished);
    if(body.sortOrder!==undefined) payload.sort_order=Number(body.sortOrder)||0;
    payload.updated_at=new Date().toISOString();
    if(payload.title===''||payload.slug==='') return error('Course title and slug are required.',400);
    const existingCourse=await adminSupabase(`/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id`);
    if(!existingCourse.response.ok) return error('Unable to verify course.',502);
    if(!Array.isArray(existingCourse.data)||!existingCourse.data.length) return error('Course not found.',404);
    const result=await adminSupabase(`/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(!result.response.ok) return error(result.response.status===409?'A course with this slug already exists.':'Unable to update course.',result.response.status===409?409:502);
    return json({ok:true,course:Array.isArray(result.data)?result.data[0]||null:null});
  }

  if(method==='GET'&&path==='/api/admin/enrollments'){
    const auth=await adminAuth(request); if(auth.response) return auth.response;
    const courseId=(url.searchParams.get('courseId')||'').trim(), status=(url.searchParams.get('status')||'').trim(), search=(url.searchParams.get('search')||'').trim().toLowerCase();
    const filters=[courseId?`course_id=eq.${encodeURIComponent(courseId)}`:'',status?`status=eq.${encodeURIComponent(status)}`:''].filter(Boolean).join('&');
    const enrollmentResult=await adminSupabase(`/rest/v1/enrollments?select=id,student_id,course_id,status,enrolled_at,completed_at,courses(id,title,slug)&order=enrolled_at.desc${filters?'&'+filters:''}`);
    if(!enrollmentResult.response.ok) return error('Unable to load enrollments.',502);
    const enrollments=Array.isArray(enrollmentResult.data)?enrollmentResult.data:[];
    const [profilesResult,usersResult]=await Promise.all([adminSupabase('/rest/v1/profiles?select=id,full_name,created_at'),adminSupabase('/auth/v1/admin/users?page=1&per_page=1000')]);
    if(!profilesResult.response.ok||!usersResult.response.ok) return error('Unable to load enrollment students.',502);
    const profileMap=new Map((Array.isArray(profilesResult.data)?profilesResult.data:[]).map((p:any)=>[p.id,p]));
    const userMap=new Map((Array.isArray(usersResult.data?.users)?usersResult.data.users:[]).map((u:any)=>[u.id,u]));
    let rows=enrollments.map((e:any)=>{const p=profileMap.get(e.student_id)||{},u=userMap.get(e.student_id)||{};return{id:e.id,student_id:e.student_id,student:{id:e.student_id,email:u.email||'',full_name:p.full_name||u.user_metadata?.full_name||''},course:e.courses?{id:e.courses.id,title:e.courses.title,slug:e.courses.slug}:null,status:e.status,enrolled_at:e.enrolled_at,completed_at:e.completed_at};});
    if(search) rows=rows.filter((r:any)=>String(r.student.email).toLowerCase().includes(search)||String(r.student.full_name).toLowerCase().includes(search)||String(r.course?.title||'').toLowerCase().includes(search));
    return json({ok:true,enrollments:rows.slice(0,200)});
  }

  if(method==='POST'&&path==='/api/admin/enrollments'){
    const auth=await adminAuth(request); if(auth.response) return auth.response;
    const studentId=String(body.studentId||'').trim(),courseId=String(body.courseId||'').trim();
    if(!studentId||!courseId) return error('Student and course are required.',400);
    const course=await adminSupabase(`/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id`);
    if(!course.response.ok||!Array.isArray(course.data)||!course.data.length) return error('Course not found.',404);
    const user=await adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(studentId)}`);
    if(!user.response.ok) return error('Student account not found.',404);
    const roleCheck=await adminSupabase(`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(studentId)}&select=roles(name)`);
    if(!roleCheck.response.ok) return error('Unable to validate student role.',502);
    const assignedRoles=(Array.isArray(roleCheck.data)?roleCheck.data:[]).map((r:any)=>r?.roles?.name).filter(Boolean);
    if(assignedRoles.some((r:string)=>staffRoles.includes(r)||['admin','super_admin','platform_owner'].includes(r))) return error('Only learner accounts can be enrolled.',400);
    const existing=await adminSupabase(`/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&course_id=eq.${encodeURIComponent(courseId)}&select=id,status`);
    if(!existing.response.ok) return error('Unable to check existing enrollment.',502);
    if(Array.isArray(existing.data)&&existing.data.length) return error('This student is already enrolled in this course.',409);
    const result=await adminSupabase('/rest/v1/enrollments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({student_id:studentId,course_id:courseId,status:'active'})});
    if(!result.response.ok) return error('Unable to create enrollment.',result.response.status);
    return json({ok:true,enrollment:Array.isArray(result.data)?result.data[0]||null:null},{status:201});
  }

  const adminEnrollmentMatch=path.match(/^\/api\/admin\/enrollments\/([^/]+)$/);
  if(method==='PATCH'&&adminEnrollmentMatch){
    const auth=await adminAuth(request); if(auth.response) return auth.response;
    const enrollmentId=decodeURIComponent(adminEnrollmentMatch[1]),status=String(body.status||'').trim();
    if(!['active','completed','paused'].includes(status)) return error('Invalid enrollment status.',400);
    const existingEnrollment=await adminSupabase(`/rest/v1/enrollments?id=eq.${encodeURIComponent(enrollmentId)}&select=id`);
    if(!existingEnrollment.response.ok) return error('Unable to verify enrollment.',502);
    if(!Array.isArray(existingEnrollment.data)||!existingEnrollment.data.length) return error('Enrollment not found.',404);
    const result=await adminSupabase(`/rest/v1/enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,completed_at:status==='completed'?new Date().toISOString():null})});
    if(!result.response.ok) return error('Unable to update enrollment.',502);
    return json({ok:true,enrollment:Array.isArray(result.data)?result.data[0]||null:null});
  }

  if (method === 'GET' && path === '/api/admin/dashboard') {
    const auth = await requireRoles(env, request, adminRoles);
    if (auth.response) return auth.response;
    return json({ ok: true, area: 'admin', user: auth.identity!.user, roles: auth.identity!.roles });
  }

  if (method === 'GET' && path === '/api/staff/dashboard') {
    const auth = await requireRoles(env, request, staffRoles);
    if (auth.response) return auth.response;
    return json({ ok: true, area: 'staff', user: auth.identity!.user, roles: auth.identity!.roles });
  }

  const auth = await requireUser(env, request);
  if (path.startsWith('/api/learning/') || path === '/api/profile') {
    if (auth.response) return auth.response;
    const studentId = auth.user.id;

    if (method === 'GET' && path === '/api/learning/dashboard') {
      const [coursesResult, enrollmentsResult, progressResult] = await Promise.all([
        supabase(env, '/rest/v1/courses?is_published=eq.true&select=id,slug,title,description,level,ielts_type,thumbnail_url,sort_order&order=sort_order.asc', {}, auth.token),
        supabase(env, `/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=id,course_id,status,enrolled_at,completed_at`, {}, auth.token),
        supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=lesson_id,status,percent,last_position_seconds,completed_at,updated_at`, {}, auth.token),
      ]);
      if (!coursesResult.response.ok || !enrollmentsResult.response.ok || !progressResult.response.ok) return error('Unable to load your learning dashboard.', 502);
      return json({ courses: coursesResult.data, enrollments: enrollmentsResult.data, progress: progressResult.data });
    }

    if (method === 'POST' && path === '/api/learning/enroll') {
      if (!body.courseId) return error('Course is required.', 400);
      const course = await supabase(env, `/rest/v1/courses?id=eq.${encodeURIComponent(body.courseId)}&is_published=eq.true&select=id`, {}, auth.token);
      if (!course.response.ok || !Array.isArray(course.data) || !course.data.length) return error('Course is not available.', 404);
      const existing = await supabase(env, `/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&course_id=eq.${encodeURIComponent(body.courseId)}&select=id,status`, {}, auth.token);
      if (!existing.response.ok) return error('Unable to check enrollment.', 502);
      if (Array.isArray(existing.data) && existing.data.length) return json({ enrollment: existing.data[0] });
      const created = await supabase(env, '/rest/v1/enrollments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ student_id: studentId, course_id: body.courseId, status: 'active' }) }, auth.token);
      if (!created.response.ok) return error('Unable to enroll in this course.', created.response.status);
      return json({ enrollment: Array.isArray(created.data) ? created.data[0] || null : null });
    }

    const courseMatch = path.match(/^\/api\/learning\/courses\/([^/]+)$/);
    if (method === 'GET' && courseMatch) {
      const courseId = decodeURIComponent(courseMatch[1]);
      const enrollment = await isEnrolled(env, studentId, courseId, auth.token);
      if (!enrollment.ok) return error('Unable to check enrollment.', 502);
      if (!enrollment.enrolled) return error('Enroll in this course to access its lessons.', 403);
      const [course, modules, progress] = await Promise.all([
        supabase(env, `/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&is_published=eq.true&select=id,slug,title,description,level,ielts_type,thumbnail_url`, {}, auth.token),
        supabase(env, `/rest/v1/course_modules?course_id=eq.${encodeURIComponent(courseId)}&select=id,course_id,title,description,sort_order&order=sort_order.asc`, {}, auth.token),
        supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=lesson_id,status,percent,last_position_seconds,completed_at,updated_at`, {}, auth.token),
      ]);
      if (!course.response.ok || !modules.response.ok || !progress.response.ok) return error('Unable to load the course.', 502);
      const moduleRows = Array.isArray(modules.data) ? modules.data : [];
      let lessons: any[] = [];
      if (moduleRows.length) {
        const ids = moduleRows.map(m => m.id).join(',');
        const lessonResult = await supabase(env, `/rest/v1/lessons?module_id=in.(${encodeURIComponent(ids)})&is_published=eq.true&select=id,module_id,title,lesson_type,duration_minutes,sort_order&order=sort_order.asc`, {}, auth.token);
        if (!lessonResult.response.ok) return error('Unable to load course lessons.', 502);
        lessons = Array.isArray(lessonResult.data) ? lessonResult.data : [];
      }
      const progressRows = Array.isArray(progress.data) ? progress.data : [];
      const completed = lessons.filter(l => progressRows.some(p => p.lesson_id === l.id && p.status === 'completed')).length;
      return json({ course: Array.isArray(course.data) ? course.data[0] || null : null, modules: moduleRows, lessons, progress: progressRows, courseProgress: lessons.length ? Math.round((completed / lessons.length) * 100) : 0 });
    }

    const lessonMatch = path.match(/^\/api\/learning\/lessons\/([^/]+)$/);
    if (method === 'GET' && lessonMatch) {
      const lessonId = decodeURIComponent(lessonMatch[1]);
      const lessonResult = await supabase(env, `/rest/v1/lessons?id=eq.${encodeURIComponent(lessonId)}&is_published=eq.true&select=id,module_id,title,lesson_type,content,duration_minutes,sort_order`, {}, auth.token);
      if (!lessonResult.response.ok || !Array.isArray(lessonResult.data) || !lessonResult.data.length) return error('Lesson not found.', 404);
      const lesson = lessonResult.data[0];
      const moduleResult = await supabase(env, `/rest/v1/course_modules?id=eq.${encodeURIComponent(lesson.module_id)}&select=id,course_id,title,sort_order`, {}, auth.token);
      if (!moduleResult.response.ok || !Array.isArray(moduleResult.data) || !moduleResult.data.length) return error('Lesson module not found.', 404);
      const courseId = moduleResult.data[0].course_id;
      const enrollment = await isEnrolled(env, studentId, courseId, auth.token);
      if (!enrollment.ok) return error('Unable to check enrollment.', 502);
      if (!enrollment.enrolled) return error('Enroll in this course to access this lesson.', 403);
      const progress = await supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&lesson_id=eq.${encodeURIComponent(lessonId)}&select=id,lesson_id,status,percent,last_position_seconds,completed_at,updated_at`, {}, auth.token);
      if (!progress.response.ok) return error('Unable to load lesson progress.', 502);
      return json({ lesson, module: moduleResult.data[0], progress: Array.isArray(progress.data) ? progress.data[0] || null : null });
    }

    if (method === 'PUT' && path === '/api/learning/progress') {
      if (!body.lessonId) return error('Lesson is required.', 400);
      const lessonResult = await supabase(env, `/rest/v1/lessons?id=eq.${encodeURIComponent(body.lessonId)}&is_published=eq.true&select=id,module_id`, {}, auth.token);
      if (!lessonResult.response.ok || !Array.isArray(lessonResult.data) || !lessonResult.data.length) return error('Lesson not found.', 404);
      const moduleResult = await supabase(env, `/rest/v1/course_modules?id=eq.${encodeURIComponent(lessonResult.data[0].module_id)}&select=id,course_id`, {}, auth.token);
      if (!moduleResult.response.ok || !Array.isArray(moduleResult.data) || !moduleResult.data.length) return error('Lesson module not found.', 404);
      const courseId = moduleResult.data[0].course_id;
      const enrollment = await isEnrolled(env, studentId, courseId, auth.token);
      if (!enrollment.ok) return error('Unable to check enrollment.', 502);
      if (!enrollment.enrolled) return error('Enroll in this course to save progress.', 403);
      const percent = Math.max(0, Math.min(100, Number(body.percent ?? 0)));
      const status = body.status === 'completed' || percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started';
      const lastPosition = Math.max(0, Math.floor(Number(body.lastPositionSeconds ?? 0)));
      const existing = await supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&lesson_id=eq.${encodeURIComponent(body.lessonId)}&select=id`, {}, auth.token);
      if (!existing.response.ok) return error('Unable to check existing progress.', 502);
      let result;
      const payload = { status, percent, last_position_seconds: lastPosition, completed_at: status === 'completed' ? new Date().toISOString() : null };
      if (Array.isArray(existing.data) && existing.data.length) {
        result = await supabase(env, `/rest/v1/lesson_progress?id=eq.${encodeURIComponent(existing.data[0].id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }, auth.token);
      } else {
        result = await supabase(env, '/rest/v1/lesson_progress', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ student_id: studentId, lesson_id: body.lessonId, ...payload }) }, auth.token);
      }
      if (!result.response.ok) return error('Unable to save lesson progress.', result.response.status);
      return json({ progress: Array.isArray(result.data) ? result.data[0] || null : null });
    }

    if (method === 'GET' && path === '/api/profile') {
      const profileResponse = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}&select=*`, {}, auth.token);
      if (!profileResponse.response.ok) return error('Unable to load your profile.', profileResponse.response.status);
      return json({ profile: Array.isArray(profileResponse.data) ? profileResponse.data[0] || null : null });
    }
    if (method === 'PUT' && path === '/api/profile') {
      const allowed = ['full_name','phone_number','country','county_town','target_ielts_type','target_band','current_estimated_band','planned_exam_date','preferred_study_schedule','study_goal','destination_country','preferred_tutor_id'];
      const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
      const profileResponse = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) }, auth.token);
      if (!profileResponse.response.ok) return error('Unable to save your profile.', profileResponse.response.status);
      return json({ profile: Array.isArray(profileResponse.data) ? profileResponse.data[0] || null : null });
    }
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin/dashboard') return protectedAppRoute(request, env, adminRoles);
    if (url.pathname === '/staff/dashboard') return protectedAppRoute(request, env, staffRoles);
    if (url.pathname.startsWith('/api/')) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
