import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Menu, Search, X } from 'lucide-react';
import { api } from './api';

const shell: CSSProperties = { minHeight: '100vh', background: '#f7f5ef', color: '#18221f', padding: '24px 18px 48px' };
const card: CSSProperties = { background: '#fff', border: '1px solid #e7e3d9', borderRadius: 18, padding: 22, boxShadow: '0 10px 30px rgba(24,34,31,.05)' };
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

function RoleGate({ kind, children }: { kind:'admin'|'staff'; children:(identity:any)=>ReactNode }) {
  const [identity, setIdentity] = useState<any>(null);
  const [status, setStatus] = useState<'loading'|'ready'|'denied'>('loading');
  const [error, setError] = useState('');
  useEffect(() => { (async () => { try { const me = await api.get('/api/auth/me'); if (!me.data?.user) throw new Error('Please sign in to continue.'); const endpoint = kind === 'admin' ? '/api/admin/dashboard' : '/api/staff/dashboard'; const result = await api.get(endpoint); setIdentity({ ...result.data, me: me.data }); setStatus('ready'); } catch (e:any) { setError(e?.response?.data?.message || 'You are not authorized to access this area.'); setStatus('denied'); } })(); }, [kind]);
  if (status === 'loading') return <main style={shell}><section style={{ ...card, maxWidth: 900, margin:'0 auto' }}>Checking your authorization…</section></main>;
  if (status === 'denied') return <main style={shell}><section style={{ ...card, maxWidth: 620, margin:'0 auto' }}><h1>Access denied</h1><p>{error}</p><a href="/">Return home</a></section></main>;
  return <>{children(identity)}</>;
}


function AdminDashboard({ identity }: { identity:any }) {
  const [section,setSection]=useState<'overview'|'students'|'courses'|'enrollments'|'staff'>('overview');
  const [overview,setOverview]=useState<any>(null),[students,setStudents]=useState<any[]>([]),[courses,setCourses]=useState<any[]>([]),[enrollments,setEnrollments]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null),[search,setSearch]=useState(''),[courseSearch,setCourseSearch]=useState(''),[enrollmentSearch,setEnrollmentSearch]=useState('');
  const [staff,setStaff]=useState<any[]>([]),[staffSearch,setStaffSearch]=useState(''),[staffRole,setStaffRole]=useState(''),[selectedStaff,setSelectedStaff]=useState<any>(null),[staffRoles,setStaffRoles]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[courseForm,setCourseForm]=useState<any>(null);
  const [enrollmentForm,setEnrollmentForm]=useState({studentId:'',courseId:''});
  const loadOverview=async()=>{try{const r=await api.get('/api/admin/overview');setOverview(r.data.counts)}catch(e:any){setError(e?.response?.data?.message||'Unable to load overview.')}};
  const loadStudents=async(q='')=>{try{const r=await api.get('/api/admin/students?search='+encodeURIComponent(q));setStudents(r.data.students||[])}catch(e:any){setError(e?.response?.data?.message||'Unable to load students.')}};
  const loadCourses=async(q='')=>{try{const r=await api.get('/api/admin/courses?search='+encodeURIComponent(q));setCourses(r.data.courses||[])}catch(e:any){setError(e?.response?.data?.message||'Unable to load courses.')}};
  const loadEnrollments=async(q='')=>{try{const r=await api.get('/api/admin/enrollments?search='+encodeURIComponent(q));setEnrollments(r.data.enrollments||[])}catch(e:any){setError(e?.response?.data?.message||'Unable to load enrollments.')}};
  const loadStaff=async(q='',role='')=>{try{const params=new URLSearchParams();if(q)params.set('search',q);if(role)params.set('role',role);const r=await api.get('/api/admin/staff?'+params.toString());setStaff(r.data.staff||[]);setStaffRoles(r.data.roles||[])}catch(e:any){setError(e?.response?.data?.message||'Unable to load staff.')}};
  const openStaff=async(id:string)=>{setBusy(true);try{const r=await api.get('/api/admin/staff/'+encodeURIComponent(id));setSelectedStaff(r.data.staff)}catch(e:any){setError(e?.response?.data?.message||'Unable to load staff details.')}finally{setBusy(false)}};
  const changeStaffRole=async(action:'assign'|'remove',roleName:string)=>{if(!selectedStaff)return;setBusy(true);setError('');try{await api.post('/api/admin/staff/'+encodeURIComponent(selectedStaff.id)+'/roles',{action,roleName});await openStaff(selectedStaff.id);await loadStaff(staffSearch,staffRole);await loadOverview()}catch(e:any){setError(e?.response?.data?.message||'Unable to change staff role.')}finally{setBusy(false)}};
  const changeStaffStatus=async(active:boolean)=>{if(!selectedStaff)return;setBusy(true);setError('');try{await api.patch('/api/admin/staff/'+encodeURIComponent(selectedStaff.id)+'/status',{active});await openStaff(selectedStaff.id);await loadStaff(staffSearch,staffRole)}catch(e:any){setError(e?.response?.data?.message||'Unable to change staff status.')}finally{setBusy(false)}};
  useEffect(()=>{loadOverview();loadStudents();loadCourses();loadEnrollments();loadStaff()},[]);
  useEffect(()=>{const t=window.setTimeout(()=>{if(section==='students')loadStudents(search);if(section==='courses')loadCourses(courseSearch);if(section==='enrollments')loadEnrollments(enrollmentSearch);if(section==='staff')loadStaff(staffSearch,staffRole)},250);return()=>window.clearTimeout(t)},[search,courseSearch,enrollmentSearch,staffSearch,staffRole,section]);
  const signOut=async()=>{await api.post('/api/auth/signout');window.location.replace('/')};
  const openStudent=async(id:string)=>{setBusy(true);try{const r=await api.get('/api/admin/students/'+encodeURIComponent(id));setSelected(r.data)}catch(e:any){setError(e?.response?.data?.message||'Unable to load student details.')}finally{setBusy(false)}};
  const saveCourse=async(e:any)=>{e.preventDefault();setBusy(true);try{const p={...courseForm,ieltsType:courseForm.ielts_type,thumbnailUrl:courseForm.thumbnail_url,isPublished:courseForm.is_published,sortOrder:courseForm.sort_order};if(courseForm.id)await api.patch('/api/admin/courses/'+courseForm.id,p);else await api.post('/api/admin/courses',p);setCourseForm(null);await loadCourses(courseSearch);await loadOverview()}catch(err:any){setError(err?.response?.data?.message||'Unable to save course.')}finally{setBusy(false)}};
  const setEnrollmentStatus=async(id:string,status:string)=>{setBusy(true);try{await api.patch('/api/admin/enrollments/'+id,{status});await loadEnrollments(enrollmentSearch);await loadOverview()}catch(e:any){setError(e?.response?.data?.message||'Unable to update enrollment.')}finally{setBusy(false)}};
  const createEnrollment=async(e:any)=>{e.preventDefault();setBusy(true);try{await api.post('/api/admin/enrollments',enrollmentForm);setEnrollmentForm({studentId:'',courseId:''});await loadEnrollments(enrollmentSearch);await loadOverview()}catch(err:any){setError(err?.response?.data?.message||'Unable to create enrollment.')}finally{setBusy(false)}};
  const stats=overview?[['Students',overview.students],['Active enrollments',overview.activeEnrollments],['Published courses',overview.publishedCourses],['Modules',overview.modules],['Lessons',overview.lessons],['Completed lessons',overview.completedLessons],['Staff accounts',overview.staffAccounts],['Role assignments',overview.roleAssignments]]:[];
  return <main style={shell}><Nav kind="admin" onSignOut={signOut}/><div className="ops-wrap">
    <header className="ops-header"><div><span className="ops-kicker">ADMINISTRATION</span><h1>Admin Dashboard</h1><p style={muted}>Operational management of students, courses and enrollments using the existing production schema.</p></div><div><strong>{(identity?.roles||[]).join(', ')}</strong></div></header>
    <div className="ops-tabs">{[['overview','Dashboard'],['students','Students'],['courses','Courses'],['enrollments','Enrollments'],['staff','Staff']].map(([key,label])=><button key={key} className={section===key?'active':''} onClick={()=>setSection(key as any)}>{label}</button>)}</div>
    {error&&<div className="ops-error" role="alert">{error}</div>}
    {section==='overview'&&<section><div className="ops-grid">{stats.map(([label,value])=><article style={card} key={label as string}><span style={muted}>{label}</span><strong className="ops-stat">{value??'—'}</strong></article>)}</div><div className="ops-two"><section style={card}><h2>Learning footprint</h2><p style={muted}>Existing courses, modules, lessons and progress data are used directly; no duplicate schema was introduced.</p><ul><li>{overview?.publishedCourses??'—'} published courses</li><li>{overview?.modules??'—'} modules</li><li>{overview?.lessons??'—'} lessons</li><li>{overview?.activeEnrollments??'—'} active enrollments</li></ul></section><section style={card}><h2>Operations</h2><p style={muted}>Course and enrollment changes are performed only through protected admin Worker APIs.</p><p>Learning-content editing beyond course records remains a separate future workstream.</p></section></div></section>}
    {section==='students'&&<section><div className="ops-student-toolbar"><div><h2>Students</h2><p style={muted}>Search registered learner accounts. Passwords, tokens and auth secrets are never returned.</p></div><div className="ops-search"><Search size={18}/><input aria-label="Search students" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email"/></div></div><div className="ops-students">{students.map(s=><button key={s.id} className="ops-student-row" onClick={()=>openStudent(s.id)}><span><strong>{s.full_name||'Unnamed student'}</strong><small>{s.email}</small></span><span>{s.created_at?new Date(s.created_at).toLocaleDateString():'—'} <ArrowRight size={16}/></span></button>)}{!busy&&!students.length&&<div style={card}>No students matched this search.</div>}</div>{selected&&<div className="ops-detail"><section style={card}><button className="ops-close" aria-label="Close student details" onClick={()=>setSelected(null)}><X/></button><span className="ops-kicker">STUDENT PROFILE</span><h2>{selected.student.full_name||'Unnamed student'}</h2><p>{selected.student.email}</p><p style={muted}>Registered {selected.student.created_at?new Date(selected.student.created_at).toLocaleString():'—'}</p><h3>Enrollments</h3>{selected.enrollments.length?selected.enrollments.map((e:any)=><div className="ops-detail-row" key={e.id}><span><strong>{e.course?.title||'Course'}</strong><small>{e.status} • enrolled {new Date(e.enrolled_at).toLocaleDateString()}</small></span><span>{e.completed_at?'Completed '+new Date(e.completed_at).toLocaleDateString():''}</span></div>):<p style={muted}>No enrollments.</p>}<h3>Lesson progress</h3>{selected.progress.length?selected.progress.map((p:any)=><div className="ops-detail-row" key={p.id}><span><strong>{p.lesson?.title||'Lesson'}</strong><small>{p.lesson?.module?.course?.title||'Course'} • {p.status}</small></span><span>{p.percent}%{p.status==='completed'&&<CheckCircle2 size={16}/>}</span></div>):<p style={muted}>No lesson progress records.</p>}</section></div>}</section>}
    {section==='courses'&&<section><div className="ops-student-toolbar"><div><h2>Courses</h2><p style={muted}>Create, edit and publish course records. Modules and lessons remain intact.</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><div className="ops-search"><Search size={18}/><input aria-label="Search courses" value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} placeholder="Search courses"/></div><button className="primary-btn compact" onClick={()=>setCourseForm({title:'',slug:'',description:'',level:'',ielts_type:'',thumbnail_url:'',is_published:false,sort_order:0})}>New course</button></div></div><div className="ops-students">{courses.map(c=><div key={c.id} className="ops-student-row"><span><strong>{c.title}</strong><small>{c.slug} • {c.level||'Level not set'} • {c.ielts_type||'IELTS type not set'}</small><small>{c.module_count} modules • {c.lesson_count} lessons • {c.is_published?'Published':'Draft'}</small></span><button className="secondary-btn compact" onClick={()=>setCourseForm(c)}>Edit</button></div>)}{!courses.length&&<div style={card}>No courses found.</div>}</div></section>}
    {section==='staff'&&<section>
      <div className="ops-student-toolbar">
        <div><h2>Staff Management</h2><p style={muted}>Manage existing staff and administrator role assignments. All changes are enforced by the protected Worker API.</p></div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div className="ops-search"><Search size={18}/><input aria-label="Search staff" value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="Search staff"/></div>
          <select aria-label="Filter staff by role" value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="">All roles</option>{staffRoles.map(r=><option key={r} value={r}>{r}</option>)}</select>
        </div>
      </div>
      <div className="ops-students">
        {staff.map(s=><button key={s.id} className="ops-student-row" onClick={()=>openStaff(s.id)}>
          <span><strong>{s.full_name||'Unnamed staff'}</strong><small>{s.email}{s.job_title?' • '+s.job_title:''}</small><small>{s.roles.map((r:any)=>r.name).join(' • ')}{s.staff_active===false?' • Inactive':''}</small></span>
          <span>{s.employment_start_date||'—'} <ArrowRight size={16}/></span>
        </button>)}
        {!busy&&!staff.length&&<div style={card}>No staff accounts matched this filter.</div>}
      </div>
      {selectedStaff&&<div className="ops-detail"><section style={card}>
        <button className="ops-close" aria-label="Close staff details" onClick={()=>setSelectedStaff(null)}><X/></button>
        <span className="ops-kicker">STAFF PROFILE</span><h2>{selectedStaff.full_name||'Unnamed staff'}</h2><p>{selectedStaff.email}</p>
        <div className="ops-detail-row"><span><strong>Account status</strong><small>{selectedStaff.staff_active===false?'Inactive':'Active'}</small></span><span><button className="secondary-btn compact" disabled={busy || selectedStaff.roles.some((r:any)=>r.name==='platform_owner')} onClick={()=>changeStaffStatus(selectedStaff.staff_active===false)}>{selectedStaff.staff_active===false?'Activate':'Deactivate'}</button></span></div>
        <div className="ops-detail-row"><span><strong>Job title</strong><small>{selectedStaff.job_title||'Not set'}</small></span><span>{selectedStaff.staff_active===false?'Inactive':'Active'}</span></div>
        <div className="ops-detail-row"><span><strong>Employment start</strong><small>{selectedStaff.employment_start_date||'Not set'}</small></span><span>{selectedStaff.last_sign_in_at?'Last sign-in '+new Date(selectedStaff.last_sign_in_at).toLocaleString():''}</span></div>
        <h3>Current roles</h3>
        {selectedStaff.roles.map((r:any)=><div className="ops-detail-row" key={r.id}><span><strong>{r.name}</strong><small>{r.description||'Assigned role'}</small></span><button className="secondary-btn compact" disabled={busy} onClick={()=>changeStaffRole('remove',r.name)}>Remove</button></div>)}
        <h3>Assign role</h3>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{staffRoles.filter(r=>!selectedStaff.roles.some((x:any)=>x.name===r)).map(r=><button className="secondary-btn compact" disabled={busy} key={r} onClick={()=>changeStaffRole('assign',r)}>{r}</button>)}</div>
        <p style={{...muted,marginTop:18,fontSize:12}}>Administrator-role changes require a super administrator. Your own roles cannot be changed, and the final authorized administrator cannot be removed or downgraded.</p>
      </section></div>}
    </section>}
    {section==='enrollments'&&<section><div className="ops-student-toolbar"><div><h2>Enrollments</h2><p style={muted}>Assign existing students to courses and update enrollment status.</p></div><div className="ops-search"><Search size={18}/><input aria-label="Search enrollments" value={enrollmentSearch} onChange={e=>setEnrollmentSearch(e.target.value)} placeholder="Search student or course"/></div></div><section style={{...card,marginBottom:16}}><h3>Assign student to course</h3><form className="ops-form-grid" onSubmit={createEnrollment}><label>Student<select required value={enrollmentForm.studentId} onChange={e=>setEnrollmentForm(v=>({...v,studentId:e.target.value}))}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name||s.email} — {s.email}</option>)}</select></label><label>Course<select required value={enrollmentForm.courseId} onChange={e=>setEnrollmentForm(v=>({...v,courseId:e.target.value}))}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button className="primary-btn compact" disabled={busy}>Assign</button></form></section><div className="ops-students">{enrollments.map(e=><div key={e.id} className="ops-student-row"><span><strong>{e.student.full_name||e.student.email}</strong><small>{e.student.email} • {e.course?.title||'Course'}</small><small>{e.status} • enrolled {new Date(e.enrolled_at).toLocaleDateString()}</small></span><select value={e.status} onChange={ev=>setEnrollmentStatus(e.id,ev.target.value)}><option value="active">Active</option><option value="completed">Completed</option><option value="paused">Paused</option></select></div>)}{!enrollments.length&&<div style={card}>No enrollments found.</div>}</div></section>}
    {courseForm&&<div className="ops-detail"><section style={card}><button className="ops-close" onClick={()=>setCourseForm(null)}><X/></button><h2>{courseForm.id?'Edit course':'New course'}</h2><form className="ops-form" onSubmit={saveCourse}><label>Title<input required value={courseForm.title||''} onChange={e=>setCourseForm((v:any)=>({...v,title:e.target.value}))}/></label><label>Slug<input required value={courseForm.slug||''} onChange={e=>setCourseForm((v:any)=>({...v,slug:e.target.value}))}/></label><label>Description<textarea value={courseForm.description||''} onChange={e=>setCourseForm((v:any)=>({...v,description:e.target.value}))}/></label><div className="ops-form-grid"><label>Level<input value={courseForm.level||''} onChange={e=>setCourseForm((v:any)=>({...v,level:e.target.value}))}/></label><label>IELTS type<input value={courseForm.ielts_type||''} onChange={e=>setCourseForm((v:any)=>({...v,ielts_type:e.target.value}))}/></label><label>Thumbnail URL<input value={courseForm.thumbnail_url||''} onChange={e=>setCourseForm((v:any)=>({...v,thumbnail_url:e.target.value}))}/></label><label>Sort order<input type="number" value={courseForm.sort_order||0} onChange={e=>setCourseForm((v:any)=>({...v,sort_order:Number(e.target.value)}))}/></label></div><label><input type="checkbox" checked={Boolean(courseForm.is_published)} onChange={e=>setCourseForm((v:any)=>({...v,is_published:e.target.checked}))}/> Published</label><div style={{display:'flex',gap:8}}><button className="primary-btn compact" disabled={busy}>{busy?'Saving…':'Save course'}</button><button type="button" className="secondary-btn compact" onClick={()=>setCourseForm(null)}>Cancel</button></div></form></section></div>}
  </div></main>;
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
