import { router, json, error } from '@appdeploy/sdk';
import { secrets } from '@appdeploy/sdk';

const cookieName = 'ikc_session';
const getSecrets = async () => ({
  url: await secrets.readSecret('SUPABASE_URL'),
  key: await secrets.readSecret('SUPABASE_PUBLISHABLE_KEY'),
});
const parseCookies = (header = '') =>
  Object.fromEntries(
    header.split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2)
  );
const sessionToken = (event: any) => parseCookies(event?.headers?.cookie || event?.headers?.Cookie || '')[cookieName];
const supabase = async (path: string, init: RequestInit = {}, token?: string) => {
  const { url, key } = await getSecrets();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  return { response, data };
};
const withCookie = (response: ReturnType<typeof json>, token: string) => {
  response.headers['Set-Cookie'] = `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;
  return response;
};
const cloudflareZone = 'ielts-kenyacenter.or.ke';
const appdeployProxyIp = '18.232.7.146';
const resendFrom = 'IELTS Kenya Center <admin@ielts-kenyacenter.or.ke>';
const resendRequest = async (to: string, subject: string, html: string) => {
  const apiKey = await secrets.readSecret('RESEND_API_KEY');
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: resendFrom, to: [to], subject, html }) });
};
const sendWelcomeEmail = async (to: string, fullName: string) => {
  const safeName = fullName.replace(/[<>&\"']/g, '');
  const response = await resendRequest(to, 'Welcome to IELTS Kenya Center', `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:auto"><h2 style="margin-bottom:8px">Welcome to IELTS Kenya Center</h2><p>Hello ${safeName},</p><p>Your learner account has been created. You can now begin your IELTS preparation journey with structured practice, mock tests and progress tracking.</p><p><strong>Prepare • Practice • Achieve</strong></p><p>If email verification is enabled for your account, please complete the verification step before signing in.</p><p style="font-size:13px;color:#666">Your Global Opportunities Start Here</p></div>`);
  return response.ok;
};
const cloudflareRequest = async (path: string, token: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${token}`); headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers });
  const text = await response.text(); let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { success: false, errors: [{ message: text || 'Cloudflare returned an unreadable response.' }] }; }
  return { response, data };
};

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ ok: true, service: 'ielts-kenya-center' })],
  'POST /api/email/status': [async () => { try { const names = await secrets.listSecretNames(); return json({ configured: names.includes('RESEND_API_KEY'), from: resendFrom }); } catch { return json({ configured: false, from: resendFrom }); } }],
  'POST /api/email/test': [async ({ body }) => {
    const input = body as { setupKey?: string; to?: string };
    if (!input.setupKey) return error('Setup key is required.', 400);
    if (!input.to) return error('Test recipient is required.', 400);
    let expectedKey = '';
    try { expectedKey = await secrets.readSecret('CLOUDFLARE_SETUP_KEY'); } catch { return error('Email test is not configured on the server.', 503); }
    if (input.setupKey !== expectedKey) return error('Invalid setup key.', 403);
    try { const response = await resendRequest(input.to, 'IELTS Kenya Center email test', '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>IELTS Kenya Center</h2><p>This is a successful test of the Resend email connection.</p><p>From: admin@ielts-kenyacenter.or.ke</p></div>'); if (!response.ok) return error('Resend rejected the test email.', 502); return json({ ok: true, message: 'Test email accepted by Resend.' }); } catch { return error('Unable to reach Resend.', 502); }
  }],
  'POST /api/cloudflare/setup': [async ({ body }) => {
    const input = body as { setupKey?: string };
    if (!input.setupKey) return error('Setup key is required.', 400);
    let expectedKey = ''; let token = '';
    try { expectedKey = await secrets.readSecret('CLOUDFLARE_SETUP_KEY'); token = await secrets.readSecret('CLOUDFLARE_API_TOKEN'); } catch { return error('Cloudflare setup is not configured on the server.', 503); }
    if (input.setupKey !== expectedKey) return error('Invalid setup key.', 403);
    const zones = await cloudflareRequest(`/zones?name=${encodeURIComponent(cloudflareZone)}&status=active`, token);
    if (!zones.response.ok || !zones.data?.success || !zones.data?.result?.length) return error('The Cloudflare zone could not be found or accessed.', 502);
    const zoneId = zones.data.result[0].id;
    const records = await cloudflareRequest(`/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(cloudflareZone)}&per_page=100`, token);
    if (!records.response.ok || !records.data?.success) return error('Unable to inspect the existing Cloudflare DNS records.', 502);
    const existing = records.data.result as Array<{ id: string; type: string; name: string; content: string; proxied?: boolean }>;
    const apexA = existing.find(record => record.type === 'A');
    const conflicting = existing.filter(record => record.type === 'AAAA' || record.type === 'CNAME');
    if (!apexA && conflicting.length) return error('A root CNAME or AAAA record already exists. Remove that conflict in Cloudflare before creating the AppDeploy A record.', 409);
    const payload = { type: 'A', name: cloudflareZone, content: appdeployProxyIp, ttl: 1, proxied: false };
    const result = apexA ? await cloudflareRequest(`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(apexA.id)}`, token, { method: 'PUT', body: JSON.stringify(payload) }) : await cloudflareRequest(`/zones/${encodeURIComponent(zoneId)}/dns_records`, token, { method: 'POST', body: JSON.stringify(payload) });
    if (!result.response.ok || !result.data?.success) return error('Cloudflare rejected the DNS change.', 502);
    return json({ ok: true, action: apexA ? 'updated' : 'created', hostname: cloudflareZone, target: appdeployProxyIp, proxied: false });
  }],
  'GET /api/config-status': [async () => { try { const names = await secrets.listSecretNames(); return json({ supabaseConfigured: names.includes('SUPABASE_URL') && names.includes('SUPABASE_PUBLISHABLE_KEY') }); } catch { return json({ supabaseConfigured: false }); } }],
  'POST /api/auth/signup': [async ({ body }) => {
    const input = body as { email?: string; password?: string; fullName?: string };
    if (!input.email || !input.password || !input.fullName) return error('Full name, email and password are required.', 400);
    if (input.password.length < 8) return error('Password must be at least 8 characters.', 400);
    const { response, data } = await supabase('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: input.email.trim(), password: input.password, data: { full_name: input.fullName.trim() } }) });
    if (!response.ok) return error((data as any)?.msg || (data as any)?.message || 'We could not create your account.', response.status);
    const accessToken = (data as any)?.access_token; let welcomeEmailAccepted = false;
    try { welcomeEmailAccepted = await sendWelcomeEmail(input.email.trim(), input.fullName.trim()); } catch { welcomeEmailAccepted = false; }
    const result = json({ ok: true, user: (data as any)?.user || null, needsEmailVerification: !accessToken, welcomeEmailAccepted, message: accessToken ? 'Account created. Welcome email sent.' : 'Account created. Check your email to verify it before signing in.' });
    return accessToken ? withCookie(result, accessToken) : result;
  }],
  'POST /api/auth/signin': [async ({ body }) => {
    const input = body as { email?: string; password?: string };
    if (!input.email || !input.password) return error('Email and password are required.', 400);
    const { response, data } = await supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: input.email.trim(), password: input.password }) });
    if (!response.ok) return error((data as any)?.error_description || (data as any)?.msg || 'Invalid email or password.', response.status === 400 ? 401 : response.status);
    const result = json({ ok: true, user: (data as any)?.user || null }); return withCookie(result, (data as any).access_token);
  }],
  'POST /api/auth/signout': [async () => { const result = json({ ok: true }); result.headers['Set-Cookie'] = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; return result; }],
  'GET /api/auth/me': [async ({ event }) => { const token = sessionToken(event); if (!token) return json({ user: null }); const { response, data } = await supabase('/auth/v1/user', {}, token); if (!response.ok) return json({ user: null }); return json({ user: data }); }],
  'GET /api/learning/dashboard': [async ({ event }) => { const token = sessionToken(event); if (!token) return error('Authentication required.', 401); const { response: userResponse, data: user } = await supabase('/auth/v1/user', {}, token); if (!userResponse.ok) return error('Authentication required.', 401); const studentId = (user as any).id; const [coursesResult, enrollmentsResult, progressResult] = await Promise.all([supabase('/rest/v1/courses?is_published=eq.true&select=id,slug,title,description,level,ielts_type,sort_order&order=sort_order.asc', {}, token), supabase(`/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=id,course_id,status,enrolled_at,completed_at`, {}, token), supabase(`/rest/v1/lesson_progress?student_id=eq.${encodeURIComponent(studentId)}&select=lesson_id,status,percent,last_position_seconds,completed_at,updated_at`, {}, token)]); if (!coursesResult.response.ok) return error('Unable to load courses.', coursesResult.response.status); if (!enrollmentsResult.response.ok) return error('Unable to load enrollments.', enrollmentsResult.response.status); if (!progressResult.response.ok) return error('Unable to load lesson progress.', progressResult.response.status); return json({ courses: coursesResult.data, enrollments: enrollmentsResult.data, progress: progressResult.data }); }],
  'POST /api/learning/enroll': [async ({ event, body }) => { const token = sessionToken(event); if (!token) return error('Authentication required.', 401); const { response: userResponse, data: user } = await supabase('/auth/v1/user', {}, token); if (!userResponse.ok) return error('Authentication required.', 401); const input = body as { courseId?: string }; if (!input.courseId) return error('Course is required.', 400); const { response: courseResponse, data: courses } = await supabase(`/rest/v1/courses?id=eq.${encodeURIComponent(input.courseId)}&is_published=eq.true&select=id`, {}, token); if (!courseResponse.ok || !Array.isArray(courses) || !courses.length) return error('Course is not available.', 404); const { response, data } = await supabase('/rest/v1/enrollments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ student_id: (user as any).id, course_id: input.courseId, status: 'active' }) }, token); if (!response.ok) return error(response.status === 409 ? 'You are already enrolled in this course.' : 'Unable to enroll in this course.', response.status); return json({ enrollment: Array.isArray(data) ? data[0] || null : null }); }],
  'GET /api/profile': [async ({ event }) => { const token = sessionToken(event); if (!token) return error('Authentication required.', 401); const { response, data: user } = await supabase('/auth/v1/user', {}, token); if (!response.ok) return error('Authentication required.', 401); const { response: profileResponse, data: profiles } = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent((user as any).id)}&select=*`, {}, token); if (!profileResponse.ok) return error('Unable to load your profile.', profileResponse.status); return json({ profile: Array.isArray(profiles) ? profiles[0] || null : null }); }],
  'PUT /api/profile': [async ({ event, body }) => { const token = sessionToken(event); if (!token) return error('Authentication required.', 401); const { response, data: user } = await supabase('/auth/v1/user', {}, token); if (!response.ok) return error('Authentication required.', 401); const input = body as Record<string, unknown>; const allowed = ['full_name','phone_number','country','county_town','target_ielts_type','target_band','current_estimated_band','planned_exam_date','preferred_study_schedule','study_goal','destination_country','preferred_tutor_id']; const patch = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key))); const { response: profileResponse, data: profiles } = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent((user as any).id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) }, token); if (!profileResponse.ok) return error('Unable to save your profile.', profileResponse.status); return json({ profile: Array.isArray(profiles) ? profiles[0] || null : null }); }],
});
