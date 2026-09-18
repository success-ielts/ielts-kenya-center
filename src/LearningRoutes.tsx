import { FormEvent, useEffect, useMemo, useState, type CSSProperties, type ComponentType } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, PlayCircle } from 'lucide-react';
import { api } from './api';

const shellStyle: CSSProperties = { minHeight: '100vh', background: '#f7f5ef', padding: '32px 20px', color: '#18221f' };
const cardStyle: CSSProperties = { maxWidth: 980, margin: '0 auto', background: '#fff', border: '1px solid #e7e3d9', borderRadius: 20, padding: 28, boxShadow: '0 12px 35px rgba(24,34,31,.06)' };
const buttonStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 10, padding: '12px 16px', fontWeight: 700, cursor: 'pointer' };
function ErrorNotice({ message }: { message: string }) { return message ? <div role="alert" style={{ margin: '16px 0', padding: 14, borderRadius: 10, background: '#fff1f0', color: '#9b2c2c' }}>{message}</div> : null; }

export function AuthCallbackPage() {
  const [message, setMessage] = useState('Completing your secure sign-in…'); const [failed, setFailed] = useState(false);
  useEffect(() => { (async () => { const hash = new URLSearchParams(window.location.hash.replace(/^#/, '')); const accessToken = hash.get('access_token'); const errorDescription = hash.get('error_description'); if (errorDescription) { setMessage(decodeURIComponent(errorDescription)); setFailed(true); return; } if (!accessToken) { setMessage('This authentication link is missing its session. It may have expired or already been used.'); setFailed(true); return; } try { await api.post('/api/auth/exchange', { accessToken }); window.history.replaceState({}, document.title, '/dashboard'); window.location.replace('/dashboard'); } catch (err: any) { setMessage(err?.response?.data?.message || 'This authentication link is invalid or has expired. Please request a new link.'); setFailed(true); } })(); }, []);
  return <main style={shellStyle}><section style={{ ...cardStyle, maxWidth: 560, textAlign: 'center' }}><CheckCircle2 size={42}/><h1>{failed ? 'Authentication link issue' : 'One moment…'}</h1><p>{message}</p>{failed && <a href="/" style={{ ...buttonStyle, textDecoration: 'none' }}>Return home</a>}</section></main>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
      const codeVerifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const challengeBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      sessionStorage.setItem('ikc_recovery_verifier', codeVerifier);
      const { data } = await api.post('/api/auth/recover', { email, codeChallenge, codeChallengeMethod: 'S256' });
      setMessage(data.message);
    } catch (err: any) {
      sessionStorage.removeItem('ikc_recovery_verifier');
      setMessage(err?.response?.data?.message || 'We could not send the recovery email. Please try again.');
    } finally { setBusy(false); }
  };
  return <main style={shellStyle}><section style={{ ...cardStyle, maxWidth: 560 }}><a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}><ArrowLeft size={17}/> Back to IELTS Kenya Center</a><LockKeyhole size={34}/><h1>Forgot your password?</h1><p>Enter your account email and Supabase Auth will send a secure password recovery link.</p><form onSubmit={submit} style={{ display: 'grid', gap: 14 }}><label>Email address<input aria-label="Email address" required type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7, padding: 13, borderRadius: 9, border: '1px solid #d8d3c8' }}/></label><button disabled={busy} style={{ ...buttonStyle, justifyContent: 'center' }}>{busy ? 'Sending…' : 'Send recovery link'}</button></form>{message && <p role="status">{message}</p>}</section></main>;
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(true); const [ready, setReady] = useState(false); const [message, setMessage] = useState('Checking your recovery link…'); const [saved, setSaved] = useState(false);
  useEffect(() => { (async () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const params = new URLSearchParams(window.location.search);
    const accessToken = hash.get('access_token');
    const code = params.get('code');
    const errorDescription = hash.get('error_description') || params.get('error_description');
    if (errorDescription) { setMessage(decodeURIComponent(errorDescription)); setBusy(false); return; }
    try {
      if (accessToken) {
        await api.post('/api/auth/exchange', { accessToken });
      } else if (code) {
        const codeVerifier = sessionStorage.getItem('ikc_recovery_verifier');
        if (!codeVerifier) throw new Error('Missing recovery session.');
        await api.post('/api/auth/exchange', { code, codeVerifier });
        sessionStorage.removeItem('ikc_recovery_verifier');
      } else {
        throw new Error('Missing recovery session.');
      }
      window.history.replaceState({}, document.title, '/reset-password');
      setReady(true); setMessage('Choose a new password.');
    } catch {
      sessionStorage.removeItem('ikc_recovery_verifier');
      setMessage('This recovery link is invalid or has expired. Request a new password reset email.');
    } finally { setBusy(false); }
  })(); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(''); if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return; } if (password !== confirm) { setMessage('Passwords do not match.'); return; } setBusy(true); try { await api.put('/api/auth/password', { password }); setSaved(true); setMessage('Password updated successfully.'); await api.post('/api/auth/signout'); } catch (err: any) { setMessage(err?.response?.data?.message || 'Unable to update your password. The recovery link may have expired.'); } finally { setBusy(false); } };
  return <main style={shellStyle}><section style={{ ...cardStyle, maxWidth: 560 }}><LockKeyhole size={34}/><h1>Set a new password</h1><p>{message}</p>{ready && !saved && <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}><label>New password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7, padding: 13, borderRadius: 9, border: '1px solid #d8d3c8' }}/></label><label>Confirm new password<input required minLength={8} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 7, padding: 13, borderRadius: 9, border: '1px solid #d8d3c8' }}/></label><button disabled={busy} style={{ ...buttonStyle, justifyContent: 'center' }}>{busy ? 'Saving…' : 'Update password'}</button></form>}{saved && <div><p role="status">Your password has been changed. Sign in with the new password.</p><a href="/" style={{ ...buttonStyle, textDecoration: 'none' }}>Return to sign in <ArrowRight size={17}/></a></div>}</section></main>;
}

export function DashboardPage() {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  useEffect(() => { api.get('/api/learning/dashboard').then(r => setData(r.data)).catch((e: any) => setError(e?.response?.data?.message || 'Please sign in to open your dashboard.')).finally(() => setBusy(false)); }, []);
  const enrolled = useMemo(() => new Set((data?.enrollments || []).map((e: any) => e.course_id)), [data]);
  const enroll = async (courseId: string) => { try { await api.post('/api/learning/enroll', { courseId }); const r = await api.get('/api/learning/dashboard'); setData(r.data); } catch (e: any) { setError(e?.response?.data?.message || 'Unable to enroll right now.'); } };
  if (busy) return <main style={shellStyle}><section style={cardStyle}>Loading your dashboard…</section></main>;
  if (error && !data) return <main style={shellStyle}><section style={{ ...cardStyle, maxWidth: 620 }}><ErrorNotice message={error}/><a href="/" style={buttonStyle}>Sign in</a></section></main>;
  return <main style={shellStyle}><section style={cardStyle}><a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={17}/> Home</a><header style={{ margin: '22px 0' }}><span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>STUDENT DASHBOARD</span><h1>My learning</h1><p>Choose an enrolled course to view modules, lessons and saved progress.</p></header>{error && <ErrorNotice message={error}/>}<div style={{ display: 'grid', gap: 16 }}>{(data?.courses || []).map((course: any) => <article key={course.id} style={{ border: '1px solid #e5e0d6', borderRadius: 14, padding: 20 }}><h2>{course.title}</h2><p>{course.description}</p>{enrolled.has(course.id) ? <a href={`/courses/${course.id}`} style={{ ...buttonStyle, textDecoration: 'none' }}>Open course <ArrowRight size={17}/></a> : <button onClick={() => enroll(course.id)} style={buttonStyle}>Enroll in course <ArrowRight size={17}/></button>}</article>)}</div><div style={{ marginTop: 26 }}><a href="/forgot-password">Forgot password?</a></div></section></main>;
}

export function CoursePage({ courseId }: { courseId: string }) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  useEffect(() => { api.get(`/api/learning/courses/${encodeURIComponent(courseId)}`).then(r => setData(r.data)).catch((e: any) => setError(e?.response?.data?.message || 'Unable to load this course.')).finally(() => setBusy(false)); }, [courseId]);
  const progressByLesson = useMemo(() => new Map((data?.progress || []).map((p: any) => [p.lesson_id, p])), [data]);
  if (busy) return <main style={shellStyle}><section style={cardStyle}>Loading course…</section></main>;
  if (error) return <main style={shellStyle}><section style={cardStyle}><ErrorNotice message={error}/><a href="/dashboard" style={buttonStyle}>Back to dashboard</a></section></main>;
  return <main style={shellStyle}><section style={cardStyle}><a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={17}/> Dashboard</a><div style={{ marginTop: 22 }}><span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>MY COURSE</span><h1>{data.course?.title}</h1><p>{data.course?.description}</p><strong>{data.courseProgress}% complete</strong></div><div style={{ height: 10, background: '#ece8de', borderRadius: 20, margin: '14px 0 26px' }}><div style={{ width: `${data.courseProgress}%`, height: '100%', borderRadius: 20, background: '#1e6b55' }}/></div>{(data.modules || []).map((module: any) => <article key={module.id} style={{ borderTop: '1px solid #ebe7de', padding: '22px 0' }}><h2>{module.title}</h2><p>{module.description}</p><div style={{ display: 'grid', gap: 10 }}>{(data.lessons || []).filter((l: any) => l.module_id === module.id).map((lesson: any) => { const p: any = progressByLesson.get(lesson.id); return <a key={lesson.id} href={`/lesson/${lesson.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 15, border: '1px solid #e5e0d6', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}><span><strong>{lesson.title}</strong><small style={{ display: 'block', marginTop: 4 }}>{lesson.lesson_type} {lesson.duration_minutes ? `• ${lesson.duration_minutes} min` : ''}</small></span>{p?.status === 'completed' ? <CheckCircle2 size={21}/> : <ArrowRight size={20}/>}</a>; })}</div></article>)}</section></main>;
}

export function LessonPage({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(true); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  useEffect(() => { api.get(`/api/learning/lessons/${encodeURIComponent(lessonId)}`).then(r => setData(r.data)).catch((e: any) => setError(e?.response?.data?.message || 'Unable to load this lesson.')).finally(() => setBusy(false)); }, [lessonId]);
  const markComplete = async () => { setSaving(true); setSaved(false); try { await api.put('/api/learning/progress', { lessonId, percent: 100, status: 'completed' }); setSaved(true); setData((v: any) => ({ ...v, progress: { ...(v.progress || {}), percent: 100, status: 'completed' } })); } catch (e: any) { setError(e?.response?.data?.message || 'Unable to save progress.'); } finally { setSaving(false); } };
  if (busy) return <main style={shellStyle}><section style={cardStyle}>Loading lesson…</section></main>;
  if (error) return <main style={shellStyle}><section style={cardStyle}><ErrorNotice message={error}/><a href="/dashboard" style={buttonStyle}>Back to dashboard</a></section></main>;
  const content = data.lesson?.content || {};
  return <main style={shellStyle}><section style={cardStyle}><a href={`/courses/${data.module?.course_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={17}/> Back to course</a><header style={{ margin: '22px 0' }}><span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>{String(data.lesson.lesson_type || 'lesson').toUpperCase()}</span><h1>{data.lesson.title}</h1><p>{data.module?.title} {data.lesson.duration_minutes ? `• ${data.lesson.duration_minutes} minutes` : ''}</p></header><article style={{ fontSize: 17, lineHeight: 1.75 }}>{content.title && <h2>{content.title}</h2>}{content.video_url && <div style={{ margin: '20px 0', padding: 22, background: '#f0eee7', borderRadius: 14 }}><PlayCircle size={30}/><p><a href={content.video_url} target="_blank" rel="noreferrer">Open lesson video</a></p></div>}{content.body && <div>{typeof content.body === 'string' ? <p>{content.body}</p> : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{JSON.stringify(content.body, null, 2)}</pre>}</div>}{Array.isArray(content.sections) && content.sections.map((s: any, i: number) => <section key={i} style={{ margin: '22px 0' }}><h2>{s.heading || `Section ${i + 1}`}</h2><p>{s.text || s.body}</p></section>)}{!content.title && !content.body && !content.video_url && !content.sections && <p>This lesson is ready for study. Content has not yet been expanded beyond the published lesson record.</p>}</article><div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #ebe7de', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}><button onClick={markComplete} disabled={saving || data.progress?.status === 'completed'} style={buttonStyle}>{saving ? 'Saving…' : data.progress?.status === 'completed' ? 'Lesson completed' : 'Mark lesson complete'} <CheckCircle2 size={17}/></button>{saved && <span role="status">Progress saved.</span>}<a href={`/courses/${data.module?.course_id}`} style={{ ...buttonStyle, background: '#eeeae0', textDecoration: 'none' }}>Return to course</a></div></section></main>;
}

export function RouteApp({ App }: { App: ComponentType }) {
  const path = window.location.pathname;
  if (path === '/auth/callback') return <AuthCallbackPage/>;
  if (path === '/forgot-password') return <ForgotPasswordPage/>;
  if (path === '/reset-password') return <ResetPasswordPage/>;
  if (path === '/dashboard') return <DashboardPage/>;
  const course = path.match(/^\/courses\/([^/]+)$/); if (course) return <CoursePage courseId={decodeURIComponent(course[1])}/>;
  const lesson = path.match(/^\/lesson\/([^/]+)$/); if (lesson) return <LessonPage lessonId={decodeURIComponent(lesson[1])}/>;
  return <><App/><a href="/forgot-password" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 50, background: '#fff', border: '1px solid #ddd7ca', borderRadius: 999, padding: '9px 13px', textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 5px 18px rgba(0,0,0,.08)' }}>Forgot password?</a></>;
}
