import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Menu, Search, X } from 'lucide-react';
import { api } from './api';

const shell: CSSProperties = { minHeight: '100vh', background: '#f7f5ef', color: '#18221f', padding: '24px 18px 48px' };
const card: CSSProperties = { background: '#fff', border: '1px solid #e7e3d9', borderRadius: 18, padding: 22, boxShadow: '0 10px 30px rgba(24,34,31,.05)' };
const button: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 9, padding: '10px 14px', fontWeight: 750, cursor: 'pointer' };
const muted: CSSProperties = { color: '#68706d' };

function Nav({ kind, onSignOut }: { kind: 'admin'|'staff'; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <nav className="ops-nav">
    <div className="ops-nav-main">
      <strong>{kind === 'admin' ? 'IELTS Kenya Center • Admin' : 'IELTS Kenya Center • Staff'}</strong>
      <button className="ops-menu" aria-label="Open navigation" onClick={() => setOpen(v => !v)}><Menu size={20}/></button>
    </div>
    <div className={`ops-links ${open ? 'open' : ''}`}>
      <a href={kind === 'admin' ? '/admin/dashboard' : '/staff/dashboard'} onClick={() => setOpen(false)}>Dashboard</a>
      <button onClick={() => { setOpen(false); window.history.back(); }}><ArrowLeft size={15}/> Back</button>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  </nav>;
}

function RoleGate({ kind, children }: { kind:'admin'|'staff'; children:(identity:any)=>React.ReactNode }) {
  const [identity, setIdentity] = useState<any>(null);
  const [status, setStatus] = useState<'loading'|'ready'|'denied'>('loading');
  const [error, setError] = useState('');
  useEffect(() => { (async () => { try { const me = await api.get('/api/auth/me'); if (!me.data?.user) throw new Error('Please sign in to continue.'); const endpoint = kind === 'admin' ? '/api/admin/dashboard' : '/api/staff/dashboard'; const result = await api.get(endpoint); setIdentity({ ...result.data, me: me.data }); setStatus('ready'); } catch (e:any) { setError(e?.response?.data?.message || 'You are not authorized to access this area.'); setStatus('denied'); } })(); }, [kind]);
  if (status === 'loading') return <main style={shell}><section style={{ ...card, maxWidth: 900, margin:'0 auto' }}>Checking your authorization…</section></main>;
  if (status === 'denied') return <main style={shell}><section style={{ ...card, maxWidth: 620, margin:'0 auto' }}><h1>Access denied</h1><p>{error}</p><a href="/">Return home</a></section></main>;
  return <>{children(identity)}</>;
}

function AdminDashboard({ identity }: { identity:any }) {
  const [section, setSection] = useState<'overview'|'students'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = async () => { setError(''); try { const r = await api.get('/api/admin/overview'); setOverview(r.data.counts); } catch (e:any) { setError(e?.response?.data?.message || 'Unable to load overview.'); } };
  const loadStudents = async (query = '') => { setBusy(true); setError(''); try { const r = await api.get(`/api/admin/students?search=${encodeURIComponent(query)}`); setStudents(r.data.students || []); } catch (e:any) { setError(e?.response?.data?.message || 'Unable to load students.'); } finally { setBusy(false); } };
  useEffect(() => { loadOverview(); loadStudents(); }, []);
  useEffect(() => { const t = window.setTimeout(() => { if (section === 'students') loadStudents(search); }, 250); return () => window.clearTimeout(t); }, [search, section]);

  const openStudent = async (id:string) => { setBusy(true); setError(''); try { const r=await api.get(`/api/admin/students/${encodeURIComponent(id)}`); setSelected(r.data); } catch(e:any) { setError(e?.response?.data?.message || 'Unable to load student details.'); } finally { setBusy(false); } };
  const completed = useMemo(() => selected?.progress?.filter((p:any)=>p.status==='completed') || [], [selected]);

  const signOut = async () => { await api.post('/api/auth/signout'); window.location.replace('/'); };
  const stats = overview ? [
    ['Students', overview.students], ['Active enrollments', overview.activeEnrollments], ['Published courses', overview.publishedCourses],
    ['Modules', overview.modules], ['Lessons', overview.lessons], ['Completed lessons', overview.completedLessons],
    ['Progress records', overview.progressRecords], ['Staff accounts', overview.staffAccounts], ['Role assignments', overview.roleAssignments],
  ] : [];

  return <main style={shell}>
    <Nav kind="admin" onSignOut={signOut}/>
    <div className="ops-wrap">
      <header className="ops-header"><div><span className="ops-kicker">ADMINISTRATION</span><h1>Admin Dashboard</h1><p style={muted}>Operational view of students, learning activity and staff access using the existing production schema.</p></div><div><strong>{(identity?.roles || []).join(', ')}</strong></div></header>
      <div className="ops-tabs"><button className={section==='overview'?'active':''} onClick={()=>setSection('overview')}>Dashboard</button><button className={section==='students'?'active':''} onClick={()=>setSection('students')}>Students</button></div>
      {error && <div className="ops-error" role="alert">{error}</div>}
      {section==='overview' && <section><div className="ops-grid">{stats.map(([label,value])=><article style={card} key={label}><span style={muted}>{label}</span><strong className="ops-stat">{value ?? '—'}</strong></article>)}</div><div className="ops-two"><section style={card}><h2>Current data footprint</h2><p style={muted}>No duplicate tables or role system were introduced. Counts are read from the existing public schema.</p><ul><li>{overview?.publishedCourses ?? '—'} published courses</li><li>{overview?.modules ?? '—'} course modules</li><li>{overview?.lessons ?? '—'} lessons</li><li>{overview?.completedLessons ?? '—'} completed lesson-progress records</li></ul></section><section style={card}><h2>Staff access</h2><p style={muted}>{overview?.staffAccounts ?? '—'} staff account(s) currently have a staff role assignment.</p><p style={muted}>{overview?.roleAssignments ?? '—'} total profile-role assignment(s) exist across the existing role system.</p><p>Role changes are intentionally not exposed in Phase 1 until the server-authorized staff-management section is implemented.</p></section></div></section>}
      {section==='students' && <section><div className="ops-student-toolbar"><div><h2>Students</h2><p style={muted}>Search registered learner accounts. Passwords, tokens and auth secrets are never returned.</p></div><div className="ops-search"><Search size={18}/><input aria-label="Search students" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email"/></div></div><div className="ops-students">{students.map(s=><button key={s.id} className="ops-student-row" onClick={()=>openStudent(s.id)}><span><strong>{s.full_name || 'Unnamed student'}</strong><small>{s.email}</small></span><span>{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'} <ArrowRight size={16}/></span></button>)}{!busy && !students.length && <div style={card}>No students matched this search.</div>}</div>{selected && <div className="ops-detail"><section style={card}><button className="ops-close" aria-label="Close student details" onClick={()=>setSelected(null)}><X/></button><span className="ops-kicker">STUDENT PROFILE</span><h2>{selected.student.full_name || 'Unnamed student'}</h2><p>{selected.student.email}</p><p style={muted}>Registered {selected.student.created_at ? new Date(selected.student.created_at).toLocaleString() : '—'}</p><h3>Enrollments</h3>{selected.enrollments.length ? selected.enrollments.map((e:any)=><div className="ops-detail-row" key={e.id}><span><strong>{e.course?.title || 'Course'}</strong><small>{e.status} • enrolled {new Date(e.enrolled_at).toLocaleDateString()}</small></span><span>{e.completed_at ? `Completed ${new Date(e.completed_at).toLocaleDateString()}` : ''}</span></div>) : <p style={muted}>No enrollments.</p>}<h3>Lesson progress</h3>{selected.progress.length ? selected.progress.map((p:any)=><div className="ops-detail-row" key={p.id}><span><strong>{p.lesson?.title || 'Lesson'}</strong><small>{p.lesson?.module?.course?.title || 'Course'} • {p.status}</small></span><span>{p.percent}%{p.status==='completed' && <CheckCircle2 size={16}/>}</span></div>) : <p style={muted}>No lesson progress records.</p>}<p style={{...muted,marginTop:18}}>Completed lessons: {completed.length} • In progress: {selected.progress.filter((p:any)=>p.status==='in_progress').length}</p></section></div>}</section>}
    </div>
  </main>;
}

function StaffDashboard({ identity }: { identity:any }) {
  const roles: string[] = identity?.roles || [];
  const capabilities = [
    ['academic_director','Academic / course oversight'], ['ielts_tutor','Student and progress tools'], ['student_support','Student-support information'],
    ['content_editor','Learning-content management'], ['exam_manager','Exam functionality (future phase unless corresponding data exists)'],
    ['finance','Finance functionality (future phase unless corresponding data exists)'], ['read_only_auditor','Read-only operational views'],
  ].filter(([role])=>roles.includes(role));
  const signOut = async () => { await api.post('/api/auth/signout'); window.location.replace('/'); };
  return <main style={shell}><Nav kind="staff" onSignOut={signOut}/><div className="ops-wrap"><header className="ops-header"><div><span className="ops-kicker">STAFF AREA</span><h1>Staff Dashboard</h1><p style={muted}>Your view is limited to the roles assigned to your account.</p></div></header><section style={card}><h2>Available operations</h2>{capabilities.length ? capabilities.map(([role,label])=><div className="ops-detail-row" key={role}><span><strong>{label}</strong><small>{role}</small></span><span>{role==='read_only_auditor'?'Read only':'Role-aware'}</span></div>) : <p style={muted}>No operational role is assigned.</p>}<p style={{...muted,marginTop:18}}>Unsupported exam and finance areas remain future phases until corresponding data exists.</p></section></div></main>;
}

export function AdminDashboardPage() { return <RoleGate kind="admin">{identity => <AdminDashboard identity={identity}/>}</RoleGate>; }
export function StaffDashboardPage() { return <RoleGate kind="staff">{identity => <StaffDashboard identity={identity}/>}</RoleGate>; }
