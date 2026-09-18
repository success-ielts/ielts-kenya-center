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

const adminRoles = ['super_admin', 'admin'];
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
      const [students, activeEnrollments, publishedCourses, modules, lessons, completedLessons, progressRecords, roles, roleAssignments] = await Promise.all([
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
      const staffRoleNames = new Set(staffRoles);
      const staffProfiles = new Set<string>();
      if (assignments.response.ok && Array.isArray(assignments.data)) {
        for (const row of assignments.data) if (staffRoleNames.has(row?.roles?.name)) staffProfiles.add(row.profile_id);
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
    const [userResult, profileResult, enrollmentsResult, progressResult] = await Promise.all([
      adminSupabase(`/auth/v1/admin/users/${encodeURIComponent(studentId)}`),
      adminSupabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}&select=id,full_name,created_at`),
      adminSupabase(`/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=id,course_id,status,enrolled_at,completed_at,courses(id,title,slug)&order=enrolled_at.desc`),
      adminSupabase(`/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=id,lesson_id,status,percent,last_position_seconds,completed_at,updated_at,lessons(id,title,module_id,course_modules(id,title,course_id,courses(id,title)))&order=updated_at.desc`),
    ]);
    if (!userResult.response.ok || !profileResult.response.ok || !enrollmentsResult.response.ok || !progressResult.response.ok) return error('Unable to load the student profile.', 502);
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
