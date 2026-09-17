import baseWorker from './index';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CLOUDFLARE_API_TOKEN?: string;
  OPS_SETUP_KEY?: string;
}

const origin = 'https://ielts-kenyacenter.or.ke';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const safe = (value: string) => value.replace(/[<>&\"']/g, '');

async function adminGenerateLink(env: Env, payload: Record<string, unknown>) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

async function sendAuthEmail(env: Env, to: string, subject: string, title: string, intro: string, actionLink: string, actionText: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'IELTS Kenya Center <admin@ielts-kenyacenter.or.ke>',
      to: [to],
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:auto;color:#18221f"><h2>${title}</h2><p>${intro}</p><p><a href="${actionLink}" style="display:inline-block;background:#1e6b55;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${actionText}</a></p><p style="font-size:13px;color:#666">If the button does not work, open the link directly from this email. This link is single-use and expires according to your Supabase Auth settings.</p><p style="font-size:13px;color:#666">IELTS Kenya Center • Prepare • Practice • Achieve</p></div>`,
    }),
  });
  return response.ok;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
      let body: any = {};
      try { body = await request.json(); } catch { return json({ message: 'Invalid request body.' }, 400); }
      if (!body.email || !body.password || !body.fullName) return json({ message: 'Full name, email and password are required.' }, 400);
      if (String(body.password).length < 8) return json({ message: 'Password must be at least 8 characters.' }, 400);
      const email = String(body.email).trim();
      const fullName = String(body.fullName).trim();
      const generated = await adminGenerateLink(env, { type: 'signup', email, password: String(body.password), data: { full_name: fullName }, redirect_to: `${origin}/auth/callback` });
      if (!generated.response.ok) return json({ message: generated.data?.msg || generated.data?.message || 'We could not create your account.' }, generated.response.status);
      const actionLink = generated.data?.properties?.action_link || generated.data?.action_link;
      const user = generated.data?.user || null;
      if (!actionLink || !user) return json({ message: 'Account was not created because a verification link could not be generated.' }, 502);
      const sent = await sendAuthEmail(env, email, 'Verify your IELTS Kenya Center account', `Welcome to IELTS Kenya Center, ${safe(fullName)}`, 'Your learner account is ready. Please verify your email address to activate sign-in and access your learning dashboard.', actionLink, 'Verify email address');
      if (!sent) return json({ message: 'Your account was created, but we could not deliver the verification email. Please contact IELTS Kenya Center support.' }, 502);
      return json({ ok: true, user, needsEmailVerification: true, welcomeEmailAccepted: true, message: 'Account created. Check your email to verify your account before signing in.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/recover') {
      let body: any = {};
      try { body = await request.json(); } catch { return json({ message: 'Invalid request body.' }, 400); }
      if (!body.email) return json({ message: 'Email address is required.' }, 400);
      const email = String(body.email).trim();
      const generated = await adminGenerateLink(env, { type: 'recovery', email, redirect_to: `${origin}/reset-password` });
      if (!generated.response.ok) return json({ ok: true, message: 'If an account exists for that email, a password recovery link has been sent.' });
      const actionLink = generated.data?.properties?.action_link || generated.data?.action_link;
      if (actionLink) {
        ctx.waitUntil(sendAuthEmail(env, email, 'Reset your IELTS Kenya Center password', 'Reset your IELTS Kenya Center password', 'We received a request to change the password for your learner account. Use the secure link below to choose a new password.', actionLink, 'Choose a new password'));
      }
      return json({ ok: true, message: 'If an account exists for that email, a password recovery link has been sent.' });
    }

    return baseWorker.fetch(request, env);
  },
};
