import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck, UserRound, Camera } from 'lucide-react';
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
  return <AuthShell><div className="auth-card"><div className="auth-card-icon"><GraduationCap size={24} /></div><span className="kicker">IELTS KENYA CENTER</span><h2>Welcome back</h2><p className="auth-subtitle">Sign in to continue your preparation journey.</p><form onSubmit={submit} noValidate><label className="auth-field"><span>Email</span><div className="auth-input-wrap"><Mail size={17} /><input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label><PasswordField value={password} onChange={setPassword} /><div className="auth-row"><span>Can’t access your account?</span><a href="/forgot-password">Forgot password?</a></div>{message && <div className="auth-error" role="alert">{message}</div>}<button className="auth-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={18} /></button></form>{googleConfigured && <><div className="auth-divider"><span>or</span></div><button type="button" className="google-btn" disabled={googleBusy} onClick={google}><span className="google-g">G</span>{googleBusy ? 'Connecting…' : 'Continue with Google'}</button></>}<p className="auth-switch">New to the platform? <a href="/register">Create an account</a></p></div></AuthShell>;
}

const studyReasons = [
  ['study', 'Study / University'],
  ['work', 'Work / Employment'],
  ['migration', 'Immigration / Migration'],
  ['professional', 'Professional registration'],
  ['improve', 'Improve my English skills'],
  ['other', 'Other'],
] as const;

export function RegisterPage() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [reason, setReason] = useState(''); const [otherReason, setOtherReason] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [photo, setPhoto] = useState<File | null>(null); const [photoPreview, setPhotoPreview] = useState(''); const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [created, setCreated] = useState(false);
  const passwordChecks = useMemo(() => ({ length: password.length >= 8, upper: /[A-Z]/.test(password), number: /\d/.test(password) }), [password]);
  const strongEnough = passwordChecks.length && passwordChecks.upper && passwordChecks.number;
  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('Please choose a valid image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setMessage('Profile photos must be 2 MB or smaller.'); return; }
    setMessage(''); setPhoto(file); setPhotoPreview(URL.createObjectURL(file));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!name.trim() || !email.trim() || !reason || !password || !confirmPassword) { setMessage('Please complete all required fields.'); return; }
    if (reason === 'other' && !otherReason.trim()) { setMessage('Please tell us your reason for studying IELTS.'); return; }
    if (!strongEnough) { setMessage('Use at least 8 characters, including one uppercase letter and one number.'); return; }
    if (password !== confirmPassword) { setMessage('Your passwords do not match.'); return; }
    if (!accepted) { setMessage('Please accept the learner terms to create your account.'); return; }
    setBusy(true);
    const studyGoal = reason === 'other' ? otherReason.trim() : studyReasons.find(([key]) => key === reason)?.[1] || reason;
    try {
      const { data } = await api.post('/api/auth/signup', { fullName: name.trim(), email: email.trim(), password, phone: phone.trim(), studyGoal, profilePhotoName: photo?.name || '' });
      try { localStorage.setItem('pending_learner_profile', JSON.stringify({ phone: phone.trim(), studyGoal })); } catch {}
      if (data?.user && !data?.needsEmailVerification) {
        try { await api.put('/api/profile', { full_name: name.trim(), phone_number: phone.trim(), study_goal: studyGoal }); } catch {}
        window.location.replace(`${productionOrigin}/dashboard`); return;
      }
      setCreated(true); setMessage(data?.message || 'Account created. Check your email to verify your address before signing in.');
    } catch (err: any) { setMessage(err?.response?.data?.message || err?.message || 'We could not create your account. Please try again.'); }
    finally { setBusy(false); }
  };
  if (created) return <AuthShell><div className="auth-card auth-success-card"><div className="auth-success-icon"><CheckCircle2 size={28} /></div><span className="kicker">ACCOUNT CREATED</span><h2>Check your email</h2><p className="auth-subtitle">Your learner account is ready. We’ve sent a verification message to <strong>{email}</strong>. Verify your email, then sign in to continue.</p><div className="auth-success-note"><Mail size={18} /><span>Check your inbox and spam folder if you do not see the message shortly.</span></div><a className="auth-primary auth-link-button" href="/login">Continue to sign in <ArrowRight size={18} /></a></div></AuthShell>;
  return <AuthShell><div className="auth-card register-card"><div className="auth-card-icon"><GraduationCap size={24} /></div><span className="kicker">STUDENT REGISTRATION</span><h2>Create your learner account</h2><p className="auth-subtitle">Join IELTS Kenya Center to access courses, lessons, practice and measurable learning progress.</p><div className="auth-benefits"><span><Check size={15} /> Personal learner profile</span><span><Check size={15} /> Courses & lessons</span><span><Check size={15} /> Progress tracking</span></div><form onSubmit={submit} noValidate>
    <div className="profile-photo-picker"><div className="profile-photo-preview">{photoPreview ? <img src={photoPreview} alt="Profile preview" /> : <UserRound size={34} />}</div><div><strong>Profile photo</strong><p>Optional • JPG, PNG or WebP • maximum 2 MB</p><label className="photo-upload-btn" htmlFor="profilePhoto"><Camera size={16} /> {photo ? 'Change photo' : 'Upload photo'}</label><input id="profilePhoto" name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e => handlePhoto(e.target.files?.[0])} hidden /></div></div>
    <label className="auth-field"><span>Full name <em>Required</em></span><div className="auth-input-wrap"><UserRound size={17} /><input name="fullName" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="e.g. Jane Wanjiku" required /></div></label>
    <label className="auth-field"><span>Email address <em>Required</em></span><div className="auth-input-wrap"><Mail size={17} /><input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
    <label className="auth-field"><span>Phone number</span><div className="auth-input-wrap"><UserRound size={17} /><input name="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. +254 7XX XXX XXX" /></div></label>
    <label className="auth-field"><span>Why are you studying IELTS? <em>Required</em></span><div className="auth-input-wrap"><GraduationCap size={17} /><select name="studyReason" value={reason} onChange={e => setReason(e.target.value)} required><option value="">Select your main goal</option>{studyReasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></label>
    {reason === 'other' && <label className="auth-field"><span>Please tell us more <em>Required</em></span><div className="auth-input-wrap"><UserRound size={17} /><input name="otherReason" value={otherReason} onChange={e => setOtherReason(e.target.value)} placeholder="Tell us your IELTS goal" required /></div></label>}
    <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label="Create password" /><div className="password-requirements" aria-live="polite"><span className={passwordChecks.length ? 'met' : ''}><Check size={13} /> 8+ characters</span><span className={passwordChecks.upper ? 'met' : ''}><Check size={13} /> Uppercase letter</span><span className={passwordChecks.number ? 'met' : ''}><Check size={13} /> Number</span></div><label className="auth-field"><span>Confirm password <em>Required</em></span><div className="auth-input-wrap"><LockKeyhole size={17} /><input name="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Re-enter your password" required /></div></label>{confirmPassword && <div className={`password-match ${password === confirmPassword ? 'match' : 'mismatch'}`}>{password === confirmPassword ? 'Passwords match.' : 'Passwords do not match yet.'}</div>}<label className="auth-consent"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I agree to the learner terms and understand that I will need to verify my email before accessing my account.</span></label>{message && <div className="auth-error" role="alert">{message}</div>}<button className="auth-primary" disabled={busy}>{busy ? 'Creating your account…' : 'Create learner account'} <ArrowRight size={18} /></button></form><p className="auth-switch">Already have an account? <a href="/login">Sign in</a></p></div></AuthShell>;
}
