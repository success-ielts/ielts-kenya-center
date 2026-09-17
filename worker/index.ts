import { identity, requireRoles } from './authorization';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  RESEND_API_KEY: string;
  CLOUDFLARE_API_TOKEN?: string;
  OPS_SETUP_KEY?: string;
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

  if (method === 'GET' && path === '/api/_healthcheck') return json({ ok: true, service: 'ielts-kenya-center' });
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
    const { response } = await supabase(env, `/auth/v1/recover?redirect_to=${encodeURIComponent(authRedirect('/reset-password'))}`, { method: 'POST', body: JSON.stringify({ email: String(body.email).trim() }) });
    if (!response.ok) return error('We could not send the password recovery email. Please check the address and try again.', response.status);
    return json({ ok: true, message: 'If an account exists for that email, a password recovery link has been sent.' });
  }

  if (method === 'POST' && path === '/api/auth/exchange') {
    if (!body.accessToken) return error('Authentication callback is missing its session token.', 400);
    const { response, data } = await supabase(env, '/auth/v1/user', {}, String(body.accessToken));
    if (!response.ok) return error('This authentication link is invalid or has expired.', 401);
    return withCookie(json({ ok: true, user: data }), String(body.accessToken));
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
      if (!course.response.ok || !modules.response.ok || !progress.response.ok) return error('Unable to load this course.', 502);
      const lessonRows: any[] = [];
      for (const module of (Array.isArray(modules.data) ? modules.data : [])) {
        const lessons = await supabase(env, `/rest/v1/lessons?module_id=eq.${encodeURIComponent(module.id)}&is_published=eq.true&select=id,module_id,title,slug,content,sort_order&order=sort_order.asc`, {}, auth.token);
        if (!lessons.response.ok) return error('Unable to load course lessons.', 502);
        lessonRows.push(...(Array.isArray(lessons.data) ? lessons.data : []));
      }
      return json({ course: Array.isArray(course.data) ? course.data[0] || null : null, modules: modules.data, lessons: lessonRows, progress: progress.data });
    }

    const lessonMatch = path.match(/^\/api\/learning\/lessons\/([^/]+)$/);
    if (method === 'GET' && lessonMatch) {
      const lessonId = decodeURIComponent(lessonMatch[1]);
      const lesson = await supabase(env, `/rest/v1/lessons?id=eq.${encodeURIComponent(lessonId)}&is_published=eq.true&select=id,module_id,title,slug,content,sort_order`, {}, auth.token);
      if (!lesson.response.ok || !Array.isArray(lesson.data) || !lesson.data.length) return error('Lesson not found.', 404);
      const lessonRow = lesson.data[0];
      const module = await supabase(env, `/rest/v1/course_modules?id=eq.${encodeURIComponent(lessonRow.module_id)}&select=id,course_id`, {}, auth.token);
      if (!module.response.ok || !Array.isArray(module.data) || !module.data.length) return error('Lesson course not found.', 404);
      const enrollment = await isEnrolled(env, studentId, module.data[0].course_id, auth.token);
      if (!enrollment.ok) return error('Unable to check enrollment.', 502);
      if (!enrollment.enrolled) return error('Enroll in this course to access its lessons.', 403);
      const progress = await supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&lesson_id=eq.${encodeURIComponent(lessonId)}&select=id,status,percent,last_position_seconds,completed_at,updated_at`, {}, auth.token);
      if (!progress.response.ok) return error('Unable to load lesson progress.', 502);
      return json({ lesson: lessonRow, progress: Array.isArray(progress.data) ? progress.data[0] || null : null });
    }

    if (method === 'PUT' && path === '/api/learning/progress') {
      if (!body.lessonId) return error('Lesson is required.', 400);
      const lesson = await supabase(env, `/rest/v1/lessons?id=eq.${encodeURIComponent(body.lessonId)}&is_published=eq.true&select=id,module_id`, {}, auth.token);
      if (!lesson.response.ok || !Array.isArray(lesson.data) || !lesson.data.length) return error('Lesson not found.', 404);
      const module = await supabase(env, `/rest/v1/course_modules?id=eq.${encodeURIComponent(lesson.data[0].module_id)}&select=id,course_id`, {}, auth.token);
      if (!module.response.ok || !Array.isArray(module.data) || !module.data.length) return error('Lesson course not found.', 404);
      const enrollment = await isEnrolled(env, studentId, module.data[0].course_id, auth.token);
      if (!enrollment.ok) return error('Unable to check enrollment.', 502);
      if (!enrollment.enrolled) return error('Enroll in this course to update progress.', 403);
      const payload = { student_id: studentId, lesson_id: body.lessonId, status: body.status || 'in_progress', percent: Math.max(0, Math.min(100, Number(body.percent) || 0)), last_position_seconds: Math.max(0, Number(body.lastPositionSeconds) || 0), completed_at: body.status === 'completed' ? new Date().toISOString() : null };
      const saved = await supabase(env, `/rest/v1/lesson_progress?on_conflict=student_id,lesson_id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(payload) }, auth.token);
      if (!saved.response.ok) return error('Unable to save lesson progress.', saved.response.status);
      return json({ progress: Array.isArray(saved.data) ? saved.data[0] || null : null });
    }
  }

  if (path === '/api/profile') {
    if (method === 'GET') {
      const profile = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,full_name,email,phone,country,avatar_url`, {}, auth.token);
      if (!profile.response.ok) return error('Unable to load your profile.', 502);
      return json({ profile: Array.isArray(profile.data) ? profile.data[0] || null : null });
    }
    if (method === 'PATCH') {
      const allowed = { full_name: body.fullName, phone: body.phone, country: body.country, avatar_url: body.avatarUrl };
      const updated = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(allowed) }, auth.token);
      if (!updated.response.ok) return error('Unable to update your profile.', updated.response.status);
      return json({ profile: Array.isArray(updated.data) ? updated.data[0] || null : null });
    }
  }

  return error('Not found.', 404);
}

export default { fetch: (request: Request, env: Env) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return api(request, env);
  if (url.pathname.startsWith('/admin/')) return protectedAppRoute(request, env, adminRoles);
  if (url.pathname.startsWith('/staff/')) return protectedAppRoute(request, env, staffRoles);
  return env.ASSETS.fetch(request);
} };
