interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  RESEND_API_KEY: string;
  CLOUDFLARE_API_TOKEN?: string;
  OPS_SETUP_KEY?: string;
}

const cookieName = 'ikc_session';
const origin = (request: Request) => new URL(request.url).origin;
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
    const { response, data } = await supabase(env, '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: String(body.email).trim(), password: body.password, data: { full_name: String(body.fullName).trim() } }) });
    if (!response.ok) return error((data as any)?.msg || (data as any)?.message || 'We could not create your account.', response.status);
    const accessToken = (data as any)?.access_token;
    let welcomeEmailAccepted = false;
    try { welcomeEmailAccepted = (await resend(env, String(body.email).trim(), 'Welcome to IELTS Kenya Center', `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">Welcome to IELTS Kenya Center</h2><p>Hello ${safeName(String(body.fullName).trim())},</p><p>Your learner account has been created. You can now begin your IELTS preparation journey with structured practice, mock tests and progress tracking.</p><p><strong>Prepare • Practice • Achieve</strong></p><p>If email verification is enabled for your account, please complete the verification step before signing in.</p><p style="font-size:13px;color:#666">Your Global Opportunities Start Here</p></div>`)).ok; } catch { welcomeEmailAccepted = false; }
    const result = json({ ok: true, user: (data as any)?.user || null, needsEmailVerification: !accessToken, welcomeEmailAccepted, message: accessToken ? 'Account created. Welcome email sent.' : 'Account created. Check your email to verify it before signing in.' });
    return accessToken ? withCookie(result, accessToken) : result;
  }

  if (method === 'POST' && path === '/api/auth/signin') {
    if (!body.email || !body.password) return error('Email and password are required.', 400);
    const { response, data } = await supabase(env, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: String(body.email).trim(), password: body.password }) });
    if (!response.ok) return error((data as any)?.error_description || (data as any)?.msg || 'Invalid email or password.', response.status === 400 ? 401 : response.status);
    return withCookie(json({ ok: true, user: (data as any)?.user || null }), (data as any).access_token);
  }
  if (method === 'POST' && path === '/api/auth/signout') return clearCookie();
  if (method === 'GET' && path === '/api/auth/me') {
    const token = sessionToken(request); if (!token) return json({ user: null });
    const { response, data } = await supabase(env, '/auth/v1/user', {}, token); if (!response.ok) return json({ user: null }); return json({ user: data });
  }

  const token = sessionToken(request);
  if (path === '/api/profile' || path === '/api/learning/dashboard' || path === '/api/learning/enroll') {
    if (!token) return error('Authentication required.', 401);
    const { response: userResponse, data: user } = await supabase(env, '/auth/v1/user', {}, token);
    if (!userResponse.ok) return error('Authentication required.', 401);
    const studentId = (user as any).id;
    if (method === 'GET' && path === '/api/learning/dashboard') {
      const [coursesResult, enrollmentsResult, progressResult] = await Promise.all([
        supabase(env, '/rest/v1/courses?is_published=eq.true&select=id,slug,title,description,level,ielts_type,sort_order&order=sort_order.asc', {}, token),
        supabase(env, `/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=id,course_id,status,enrolled_at,completed_at`, {}, token),
        supabase(env, `/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=lesson_id,status,percent,last_position_seconds,completed_at,updated_at`, {}, token),
      ]);
      if (!coursesResult.response.ok) return error('Unable to load courses.', coursesResult.response.status);
      if (!enrollmentsResult.response.ok) return error('Unable to load enrollments.', enrollmentsResult.response.status);
      if (!progressResult.response.ok) return error('Unable to load lesson progress.', progressResult.response.status);
      return json({ courses: coursesResult.data, enrollments: enrollmentsResult.data, progress: progressResult.data });
    }
    if (method === 'POST' && path === '/api/learning/enroll') {
      if (!body.courseId) return error('Course is required.', 400);
      const { response: courseResponse, data: courses } = await supabase(env, `/rest/v1/courses?id=eq.${encodeURIComponent(body.courseId)}&is_published=eq.true&select=id`, {}, token);
      if (!courseResponse.ok || !Array.isArray(courses) || !courses.length) return error('Course is not available.', 404);
      const { response, data } = await supabase(env, '/rest/v1/enrollments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ student_id: studentId, course_id: body.courseId, status: 'active' }) }, token);
      if (!response.ok) return error(response.status === 409 ? 'You are already enrolled in this course.' : 'Unable to enroll in this course.', response.status);
      return json({ enrollment: Array.isArray(data) ? data[0] || null : null });
    }
    if (method === 'GET' && path === '/api/profile') {
      const { response: profileResponse, data: profiles } = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}&select=*`, {}, token);
      if (!profileResponse.ok) return error('Unable to load your profile.', profileResponse.status);
      return json({ profile: Array.isArray(profiles) ? profiles[0] || null : null });
    }
    if (method === 'PUT' && path === '/api/profile') {
      const allowed = ['full_name','phone_number','country','county_town','target_ielts_type','target_band','current_estimated_band','planned_exam_date','preferred_study_schedule','study_goal','destination_country','preferred_tutor_id'];
      const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
      const { response: profileResponse, data: profiles } = await supabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(studentId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) }, token);
      if (!profileResponse.ok) return error('Unable to save your profile.', profileResponse.status);
      return json({ profile: Array.isArray(profiles) ? profiles[0] || null : null });
    }
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
