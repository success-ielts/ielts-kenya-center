import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, BarChart3, BookOpen, Camera, CheckCircle2, LogOut, Menu, Target, UserRound, X } from 'lucide-react';
import { api } from './api';

const shell: CSSProperties = { minHeight: '100vh', background: '#f7f5ef', color: '#17231f' };
const card: CSSProperties = { background: '#fff', border: '1px solid #e5e1d7', borderRadius: 22, boxShadow: '0 10px 30px rgba(23,35,31,.045)' };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase() || 'ST';

export default function StudentDashboardPro() {
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const [localPhoto, setLocalPhoto] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setBusy(true); setError('');
    try {
      const [dashboard, profileResult, meResult] = await Promise.all([
        api.get('/api/learning/dashboard'),
        api.get('/api/profile'),
        api.get('/api/auth/me'),
      ]);
      setData(dashboard.data); setProfile(profileResult.data?.profile || null); setMe(meResult.data?.user || null);
    } catch (e: any) { setError(e?.response?.data?.message || 'Please sign in to open your student dashboard.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); try { setLocalPhoto(localStorage.getItem('ielts_profile_photo') || ''); } catch {} }, []);

  const courses = data?.courses || [];
  const enrollments = data?.enrollments || [];
  const progress = data?.progress || [];
  const enrolledIds = useMemo(() => new Set(enrollments.map((e: any) => e.course_id)), [enrollments]);
  const completed = progress.filter((p: any) => p.status === 'completed').length;
  const totalProgress = progress.length ? Math.round(progress.reduce((sum: number, p: any) => sum + Number(p.percent || 0), 0) / progress.length) : 0;
  const name = profile?.full_name || me?.user_metadata?.full_name || me?.email?.split('@')[0] || 'Student';
  const photo = localPhoto || profile?.photo_url || profile?.avatar_url || profile?.profile_photo_url || profile?.profile_picture_url || me?.user_metadata?.avatar_url || me?.user_metadata?.picture || me?.user_metadata?.photo_url || '';
  const targetBand = profile?.target_band || me?.user_metadata?.target_band || '—';
  const pathway = profile?.target_ielts_type ? String(profile.target_ielts_type).replace(/_/g, ' ') : 'IELTS preparation';
  const signOut = async () => { await api.post('/api/auth/signout'); window.location.replace('/'); };
  const go = (path: string) => { window.location.href = path; };
  const onPhoto = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result || ''); setLocalPhoto(value); try { localStorage.setItem('ielts_profile_photo', value); } catch {} };
    reader.readAsDataURL(file);
  };

  if (busy) return <main style={{ ...shell, padding: 24 }}><section style={{ ...card, maxWidth: 1100, margin: '0 auto', padding: 30 }}>Loading your dashboard…</section></main>;
  if (error && !data) return <main style={{ ...shell, padding: 24 }}><section style={{ ...card, maxWidth: 600, margin: '40px auto', padding: 30 }}><h1>Student Dashboard</h1><p>{error}</p><button onClick={() => go('/login')} style={{ padding: '12px 18px', border: 0, borderRadius: 10, background: '#d71920', color: '#fff', fontWeight: 800 }}>Sign in</button></section></main>;

  const statItems = [[BookOpen, 'Courses', String(enrollments.length), 'Enrolled'], [CheckCircle2, 'Completed', String(completed), 'Lessons'], [Target, 'Target band', String(targetBand), pathway], [BarChart3, 'Progress', `${totalProgress}%`, 'Across practice']];

  return <main style={shell}>
    <header style={{ background: '#fff', borderBottom: '1px solid #e7e3d9', position: 'sticky', top: 0, zIndex: 20 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center' }}><img src="/logo.svg" alt="IELTS Kenya Center" style={{ width: 180, height: 54, objectFit: 'contain' }} /></a>
        <button onClick={() => setMenu(v => !v)} aria-label="Open student menu" style={{ border: 0, background: '#f3f1ea', borderRadius: 14, padding: 12, cursor: 'pointer' }}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {menu && <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {['/dashboard', '/mock-tests', '/page/ielts-courses'].map((path, i) => <button key={path} onClick={() => go(path)} style={{ padding: '10px 14px', border: '1px solid #e5e1d7', borderRadius: 10, background: '#fff', fontWeight: 800 }}>{['Dashboard', 'Mock Tests', 'Courses'][i]}</button>)}
        <button onClick={() => go('/')} style={{ padding: '10px 14px', border: '1px solid #e5e1d7', borderRadius: 10, background: '#fff', fontWeight: 800 }}>Home</button>
        <button onClick={signOut} style={{ padding: '10px 14px', border: 0, borderRadius: 10, background: '#fff0f0', color: '#b31b22', fontWeight: 800 }}>Sign out</button>
      </div>}
    </header>

    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 64px' }}>
      <section style={{ background: 'linear-gradient(135deg,#0d6049 0%,#1d8061 100%)', color: '#fff', borderRadius: 28, padding: '30px clamp(22px,4vw,44px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.06)', right: -80, top: -100 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {photo ? <img src={photo} alt={name} style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,.9)', display: 'block' }} /> : <div style={{ width: 92, height: 92, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#fff', color: '#176b4f', fontSize: 27, fontWeight: 900, border: '4px solid rgba(255,255,255,.9)' }}>{initials(name)}</div>}
            <button onClick={() => fileRef.current?.click()} aria-label="Change profile photo" title="Change profile photo" style={{ position: 'absolute', right: -3, bottom: -3, width: 34, height: 34, borderRadius: '50%', border: '3px solid #176b4f', background: '#fff', color: '#176b4f', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Camera size={16} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onPhoto(e.target.files?.[0])} />
          </div>
          <div><div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 900, opacity: .8 }}>STUDENT DASHBOARD</div><h1 style={{ margin: '5px 0 7px', fontSize: 'clamp(30px,5vw,46px)', lineHeight: 1.05 }}>Welcome back, {name.split(' ')[0]}.</h1><p style={{ margin: 0, maxWidth: 620, opacity: .9, lineHeight: 1.55 }}>Your IELTS preparation journey, progress and practice — organized in one place.</p></div>
        </div>
        <button onClick={() => go('/mock-tests')} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 19px', border: 0, borderRadius: 13, background: '#fff', color: '#17231f', fontWeight: 900, cursor: 'pointer', position: 'relative', zIndex: 1 }}>Start a Mock Test <ArrowRight size={18} /></button>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, marginTop: 18 }}>
        {statItems.map(([Icon, label, value, sub]: any) => <article key={label} style={{ ...card, padding: 20 }}><Icon size={21} color="#176b4f" /><div style={{ marginTop: 13, fontSize: 29, fontWeight: 900 }}>{value}</div><strong>{label}</strong><div style={{ color: '#68706d', marginTop: 3, fontSize: 13, textTransform: 'capitalize' }}>{sub}</div></article>)}
      </div>

      <section style={{ ...card, marginTop: 18, padding: '22px 24px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}><div><span style={{ fontSize: 12, letterSpacing: 1.6, fontWeight: 900, color: '#176b4f' }}>OVERALL PROGRESS</span><h2 style={{ margin: '4px 0 0' }}>Keep your preparation moving.</h2></div><strong style={{ fontSize: 22 }}>{totalProgress}%</strong></div><div style={{ height: 10, background: '#e7e9e5', borderRadius: 999, marginTop: 16, overflow: 'hidden' }}><div style={{ width: `${totalProgress}%`, height: '100%', background: '#176b4f', borderRadius: 999 }} /></div><p style={{ margin: '9px 0 0', color: '#68706d', fontSize: 14 }}>Across your enrolled learning and practice activity.</p></section>

      <div className="student-dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(300px,.8fr)', gap: 18, marginTop: 18 }}>
        <section style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><div><span style={{ fontSize: 12, letterSpacing: 1.6, fontWeight: 900, color: '#176b4f' }}>CONTINUE LEARNING</span><h2 style={{ margin: '5px 0' }}>Your courses</h2></div><button onClick={() => go('/page/ielts-courses')} style={{ border: 0, background: 'transparent', fontWeight: 900, color: '#176b4f', cursor: 'pointer' }}>View all <ArrowRight size={15} /></button></div>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {courses.filter((c: any) => enrolledIds.has(c.id)).map((course: any) => <article key={course.id} style={{ border: '1px solid #e5e1d7', borderRadius: 17, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 11, color: '#1e6b55', fontWeight: 900, letterSpacing: 1.2 }}>ENROLLED COURSE</div><h3 style={{ margin: '5px 0', fontSize: 20 }}>{course.title}</h3><p style={{ margin: 0, color: '#68706d', lineHeight: 1.5 }}>{course.description}</p></div><button onClick={() => go(`/courses/${course.id}`)} style={{ flexShrink: 0, border: 0, borderRadius: 11, padding: '11px 15px', background: '#d71920', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Open <ArrowRight size={16} /></button></article>)}
            {courses.filter((c: any) => enrolledIds.has(c.id)).length === 0 && <div style={{ padding: 24, background: '#f7f5ef', borderRadius: 16 }}><h3 style={{ marginTop: 0 }}>Choose your IELTS pathway</h3><p>Start with Foundations or select an Academic or General Training course.</p><button onClick={() => go('/page/ielts-courses')} style={{ border: 0, borderRadius: 11, padding: '11px 15px', background: '#d71920', color: '#fff', fontWeight: 800 }}>Explore courses <ArrowRight size={16} /></button></div>}
          </div>
        </section>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section style={{ ...card, padding: 22 }}><span style={{ fontSize: 12, letterSpacing: 1.6, fontWeight: 900, color: '#176b4f' }}>QUICK PRACTICE</span><h2 style={{ margin: '6px 0' }}>Build exam confidence</h2><p style={{ color: '#68706d', lineHeight: 1.55 }}>Practise a skill or take a timed mock when you are ready.</p><button onClick={() => go('/mock-tests')} style={{ width: '100%', border: 0, borderRadius: 12, padding: 14, background: '#176b4f', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Open Mock Tests <ArrowRight size={17} /></button></section>
          <section style={{ ...card, padding: 22 }}><UserRound size={22} color="#176b4f" /><h3 style={{ margin: '8px 0 5px' }}>Your profile</h3><p style={{ color: '#68706d', margin: 0 }}>{me?.email || 'Account email'}</p><button onClick={() => fileRef.current?.click()} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #d9d5cb', borderRadius: 10, padding: '9px 12px', background: '#fff', fontWeight: 800, cursor: 'pointer' }}><Camera size={16} /> {photo ? 'Change photo' : 'Add profile photo'}</button></section>
          <section style={{ ...card, padding: 22, background: '#eef7f2' }}><Target size={22} color="#176b4f" /><h3 style={{ margin: '8px 0 5px' }}>Practice with purpose</h3><p style={{ color: '#52615b', lineHeight: 1.55, margin: 0 }}>Take regular mock tests, review your mistakes and focus on weak areas.</p></section>
          <button onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 11, border: '1px solid #ddd8cd', background: '#fff', fontWeight: 800, cursor: 'pointer' }}><LogOut size={17} /> Sign out</button>
        </aside>
      </div>
    </div>
    <style>{`@media(max-width:900px){.student-dashboard-main-grid{grid-template-columns:1fr!important}}@media(max-width:650px){main>div{padding-left:14px!important;padding-right:14px!important}.student-dashboard-main-grid{grid-template-columns:1fr!important}header img{width:150px!important}}`}</style>
  </main>;
}
