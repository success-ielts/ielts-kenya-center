import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, LogOut, Menu, Target, UserRound, X } from 'lucide-react';
import { api } from './api';

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f7f5ef', color: '#18221f' };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase() || 'ST';

export default function StudentDashboardPro() {
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true); setError('');
    try {
      const [dashboard, profileResult, meResult] = await Promise.all([
        api.get('/api/learning/dashboard'),
        api.get('/api/profile'),
        api.get('/api/auth/me'),
      ]);
      setData(dashboard.data); setProfile(profileResult.data?.profile || null); setMe(meResult.data?.user || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Please sign in to open your student dashboard.');
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const courses = data?.courses || [];
  const enrollments = data?.enrollments || [];
  const progress = data?.progress || [];
  const enrolledIds = useMemo(() => new Set(enrollments.map((e: any) => e.course_id)), [enrollments]);
  const completed = progress.filter((p: any) => p.status === 'completed').length;
  const totalProgress = progress.length ? Math.round(progress.reduce((sum: number, p: any) => sum + Number(p.percent || 0), 0) / progress.length) : 0;
  const name = profile?.full_name || me?.user_metadata?.full_name || me?.email?.split('@')[0] || 'Student';
  const photo = profile?.photo_url || profile?.avatar_url || profile?.profile_photo_url || profile?.profile_picture_url || '';
  const targetBand = profile?.target_band || '—';
  const pathway = profile?.target_ielts_type ? String(profile.target_ielts_type).replace(/_/g, ' ') : 'IELTS preparation';

  const signOut = async () => { await api.post('/api/auth/signout'); window.location.replace('/'); };
  const go = (path: string) => { window.location.href = path; };

  if (busy) return <main style={{ ...shell, padding: 24 }}><section style={{ maxWidth: 1100, margin: '0 auto', padding: 30, background: '#fff', borderRadius: 24 }}>Loading your dashboard…</section></main>;
  if (error && !data) return <main style={{ ...shell, padding: 24 }}><section style={{ maxWidth: 600, margin: '40px auto', padding: 30, background: '#fff', borderRadius: 24 }}><h1>Student Dashboard</h1><p>{error}</p><button onClick={() => go('/login')} style={{ padding: '12px 18px', border: 0, borderRadius: 10, background: '#d71920', color: '#fff', fontWeight: 800 }}>Sign in</button></section></main>;

  return <main style={shell}>
    <header style={{ background: '#fff', borderBottom: '1px solid #e7e3d9', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center' }}><img src="/logo.svg" alt="IELTS Kenya Center" style={{ width: 180, height: 54, objectFit: 'contain' }} /></a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'none' }} />
          <button onClick={() => setMenu(v => !v)} aria-label="Open student menu" style={{ border: 0, background: '#f3f1ea', borderRadius: 12, padding: 10 }}><Menu size={21} /></button>
        </div>
      </div>
      {menu && <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => go('/mock-tests')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, fontWeight: 700 }}>Mock Tests</button><button onClick={() => go('/dashboard')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, fontWeight: 700 }}>Dashboard</button><button onClick={() => go('/')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, fontWeight: 700 }}>Home</button><button onClick={signOut} style={{ padding: '10px 14px', border: 0, borderRadius: 10, fontWeight: 700, color: '#b31b22' }}>Sign out</button><button onClick={() => setMenu(false)} style={{ marginLeft: 'auto', border: 0, background: 'transparent' }}><X size={18}/></button></div>}
    </header>

    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 20px 60px' }}>
      <section style={{ background: 'linear-gradient(135deg,#0f5f49,#1f7b5d)', color: '#fff', borderRadius: 28, padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {photo ? <img src={photo} alt={name} style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,.8)' }} /> : <div style={{ width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#fff', color: '#176a52', fontSize: 24, fontWeight: 900 }}>{initials(name)}</div>}
          <div><div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 900, opacity: .8 }}>STUDENT DASHBOARD</div><h1 style={{ margin: '5px 0', fontSize: 'clamp(28px,5vw,44px)' }}>Welcome, {name.split(' ')[0]}.</h1><p style={{ margin: 0, opacity: .88 }}>Your IELTS preparation journey, progress and practice in one place.</p></div>
        </div>
        <button onClick={() => go('/mock-tests')} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 18px', border: 0, borderRadius: 12, background: '#fff', color: '#18221f', fontWeight: 900 }}>Start a Mock Test <ArrowRight size={18}/></button>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 18 }}>
        {[[BookOpen, 'Courses', String(enrollments.length), 'Enrolled'], [CheckCircle2, 'Completed', String(completed), 'Lessons'], [Target, 'Target band', String(targetBand), pathway], [Clock3, 'Progress', `${totalProgress}%`, 'Across practice']].map(([Icon, label, value, sub]: any) => <article key={label} style={{ background: '#fff', border: '1px solid #e7e3d9', borderRadius: 18, padding: 20 }}><Icon size={21}/><div style={{ marginTop: 14, fontSize: 30, fontWeight: 900 }}>{value}</div><strong>{label}</strong><div style={{ color: '#68706d', marginTop: 3, fontSize: 13 }}>{sub}</div></article>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,.8fr)', gap: 18, marginTop: 18 }}>
        <section style={{ background: '#fff', border: '1px solid #e7e3d9', borderRadius: 22, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div><span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 900 }}>MY LEARNING</span><h2 style={{ margin: '5px 0' }}>Continue learning</h2></div><button onClick={() => go('/page/ielts-courses')} style={{ border: 0, background: 'transparent', fontWeight: 800 }}>View courses →</button></div>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>{courses.filter((c: any) => enrolledIds.has(c.id)).map((course: any) => <article key={course.id} style={{ border: '1px solid #e5e0d6', borderRadius: 16, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}><div><div style={{ fontSize: 12, color: '#1e6b55', fontWeight: 900 }}>ENROLLED COURSE</div><h3 style={{ margin: '5px 0' }}>{course.title}</h3><p style={{ margin: 0, color: '#68706d' }}>{course.description}</p></div><button onClick={() => go(`/courses/${course.id}`)} style={{ flexShrink: 0, border: 0, borderRadius: 11, padding: '11px 14px', background: '#d71920', color: '#fff', fontWeight: 800 }}>Open <ArrowRight size={16}/></button></article>)}{courses.filter((c: any) => enrolledIds.has(c.id)).length === 0 && <div style={{ padding: 24, background: '#f7f5ef', borderRadius: 16 }}><h3>Choose your IELTS pathway</h3><p>Start with Foundations or select an Academic or General Training course.</p><button onClick={() => go('/page/ielts-courses')} style={{ border: 0, borderRadius: 11, padding: '11px 15px', background: '#d71920', color: '#fff', fontWeight: 800 }}>Explore courses <ArrowRight size={16}/></button></div>}</div>
        </section>

        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section style={{ background: '#fff', border: '1px solid #e7e3d9', borderRadius: 22, padding: 22 }}><span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 900 }}>QUICK PRACTICE</span><h2 style={{ margin: '6px 0' }}>Build exam confidence</h2><p style={{ color: '#68706d' }}>Practise a skill or take a timed mock when you are ready.</p><button onClick={() => go('/mock-tests')} style={{ width: '100%', border: 0, borderRadius: 11, padding: 13, background: '#d71920', color: '#fff', fontWeight: 900 }}>Open Mock Tests</button></section>
          <section style={{ background: '#fff', border: '1px solid #e7e3d9', borderRadius: 22, padding: 22 }}><UserRound size={21}/><h3 style={{ margin: '7px 0' }}>Your profile</h3><p style={{ color: '#68706d', marginTop: 0 }}>{me?.email || 'Account email'}</p><p style={{ color: '#68706d', marginBottom: 0 }}>Keep your study goal, target band and learner details up to date.</p></section>
          <button onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 11, border: '1px solid #ddd8cd', background: '#fff', fontWeight: 800 }}><LogOut size={17}/> Sign out</button>
        </aside>
      </div>
    </div>
  </main>;
}
