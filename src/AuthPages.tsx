import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { api } from './api';
import './auth.css';

const productionOrigin = 'https://ielts-kenyacenter.or.ke';

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-page-grid"><section className="auth-brand-panel"><a className="auth-brand" href="/"><span className="brand-mark"><GraduationCap size={22} /></span><span><strong>IELTS™</strong><small>KENYA CENTER</small></span></a><div className="auth-brand-copy"><span className="kicker">PREPARE • PRACTICE • ACHIEVE</span><h1>Your global opportunities start here.</h1><p>Secure access to your IELTS preparation, courses, lessons and progress.</p></div><div className="auth-trust"><ShieldCheck size={18} /> Secure account access</div></section><section className="auth-form-panel">{children}</section></div></main>;
}

function PasswordField({ name = 'password', value, onChange, autoComplete = 'current-password', label = 'Password', required = true }: { name?: string; value: string; onChange: (v: string) => void; autoComplete?: string; label?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return <label className="auth-field"><span>{label}</span><div className="auth-input-wrap"><LockKeyhole size={17} /><input name={name} value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'} autoComplete={autoComplete} minLength={name === 'password' ? 8 : undefined} required={required} /><button type="button" className="password-toggle" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>;
}

function mapAuthError(err: any) {
  const raw = String(err?.response?.data?.message || err?.message || '').toLowerCase();
  if (raw.includes('email not confirmed') || raw.includes('email not verified') || raw.includes('confirm your email')) return 'Your email is not verified yet. Please check your inbox for the Supabase verification email and verify your address before signing in.';
  if (raw.includes('invalid login credentials') || raw.includes('invalid email or password') || raw.includes('incorrect password')) return 'Incorrect password. Check your password and try again.';
  if (raw.includes('user not found') || raw.includes('account not found') || raw.includes('no user')) return 'Account not found. Check the email address or create a new account.';
  return err?.response?.data?.message || err?.message || 'We could not sign you in. Please try again.';
}

function destinationFor(user: any) {
  const roles = [...(Array.isArray(user?.roles) ? user.roles : []), user?.role, user?.user_metadata?.role, user?.app_metadata?.role].filter(Boolean).map((v: any) => String(v).toLowerCase());
  if (roles.some(r => ['admin', 'super_admin'].includes(r))) return '/admin/dashboard';
  if (roles.some(r => ['staff', 'tutor', 'instructor'].includes(r))) return '/staff/dashboard';
  return '/dashboard';
}

export function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [googleBusy, setGoogleBusy] = useState(false); const [googleConfigured, setGoogleConfigured] = useState(false);
  useEffect(() => { api.get('/api/config-status').then(r => setGoogleConfigured(Boolean(r.data?.googleOAuthConfigured))).catch(() => setGoogleConfigured(false)); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(''); if (!email.trim() || !password) { setMessage('Email and password are required.'); return; } setBusy(true); try { const { data } = await api.post('/api/auth/signin', { email: email.trim(), password }); window.location.replace(`${productionOrigin}${destinationFor(data?.user)}`); } catch (err: any) { setMessage(mapAuthError(err)); } finally { setBusy(false); } };
  const google = () => { setMessage(''); setGoogleBusy(true); window.location.assign(`${productionOrigin}/api/auth/google`); };
  return <AuthShell><div className="auth-card"><div className="auth-card-icon"><GraduationCap size={24} /></div><span className="kicker">IELTS KENYA CENTER</span><h2>Welcome back</h2><p className="auth-subtitle">Sign in to continue your preparation journey.</p><form onSubmit={submit} noValidate><label className="auth-field"><span>Email</span><div className="auth-input-wrap"><Mail size={17} /><input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label><PasswordField value={password} onChange={setPassword} /><div className="auth-row"><a href="/forgot-password">Forgot password?</a></div>{message && <div className="auth-error" role="alert">{message}</div>}<button className="auth-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={18} /></button></form>{googleConfigured && <><div className="auth-divider"><span>or</span></div><button type="button" className="google-btn" disabled={googleBusy} onClick={google}><span className="google-g">G</span>{googleBusy ? 'Connecting…' : 'Continue with Google'}</button></>}<p className="auth-switch">New to the platform? <a href="/register">Create an account</a></p></div></AuthShell>;
}

export function RegisterPage() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(''); if (!name.trim() || !email.trim() || !password) { setMessage('Full name, email and password are required.'); return; } if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return; } setBusy(true); try { const { data } = await api.post('/api/auth/signup', { fullName: name.trim(), email: email.trim(), password }); if (data?.user && !data?.needsEmailVerification) window.location.replace(`${productionOrigin}/dashboard`); else setMessage(data?.message || 'Account created. Check your email to verify your address before signing in.'); } catch (err: any) { setMessage(err?.response?.data?.message || err?.message || 'We could not create your account.'); } finally { setBusy(false); } };
  return <AuthShell><div className="auth-card"><div className="auth-card-icon"><GraduationCap size={24} /></div><span className="kicker">CREATE YOUR ACCOUNT</span><h2>Start learning</h2><p className="auth-subtitle">Create your learner account and begin your IELTS preparation.</p><form onSubmit={submit} noValidate><label className="auth-field"><span>Full name</span><div className="auth-input-wrap"><input name="fullName" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your full name" required /></div></label><label className="auth-field"><span>Email</span><div className="auth-input-wrap"><Mail size={17} /><input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" label="Password" />{message && <div className="auth-error" role="alert">{message}</div>}<button className="auth-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={18} /></button></form><p className="auth-switch">Already have an account? <a href="/login">Sign in</a></p></div></AuthShell>;
}
