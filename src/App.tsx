import { FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { seoContentByKey } from './seoContent';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

const productionOrigin = 'https://ielts-kenyacenter.or.ke';

type User = {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
} | null;
const sections = [
  { label: 'Preparation', href: '/page/ielts-preparation-kenya' },
  { label: 'Courses', href: '/page/ielts-courses' },
  { label: 'Practice', href: '/page/ielts-practice' },
  { label: 'Mock Tests', href: '#mock-tests' },
  { label: 'Tutors', href: '#tutors' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '/page/ielts-resources' },
];

function LearningIntelligence({ onStart }: { onStart: () => void }) {
  const [goal, setGoal] = useState<'study' | 'work' | 'migration' | 'improve'>('study');
  const [band, setBand] = useState('7.0');
  const plans = {
    study: ['Academic IELTS pathway', 'Reading + Writing depth', 'Weekly timed practice', 'Mock exam calibration'],
    work: ['General Training pathway', 'Practical communication', 'Workplace vocabulary', 'Speaking confidence'],
    migration: ['General Training pathway', 'Four-skill consistency', 'Timed exam routines', 'Readiness checkpoints'],
    improve: ['Skill diagnostic', 'Weak-area priority', 'Targeted practice', 'Progress review'],
  };
  const goalLabels = { study: 'Study abroad', work: 'International work', migration: 'Migration', improve: 'Improve my score' };
  return (
    <section className="ai-intelligence section" id="ai-learning">
      <div className="ai-intelligence-head">
        <div>
          <span className="kicker">IELTS INTELLIGENCE LAYER</span>
          <h2>A learning platform designed for the next generation.</h2>
          <p>Instead of giving every learner the same timetable, the platform is structured to adapt the learning journey around your goal, target band, performance and pace.</p>
        </div>
        <div className="ai-orbit" aria-label="Learning intelligence">
          <span>AI</span><small>LEARNING<br />ENGINE</small>
        </div>
      </div>
      <div className="ai-grid">
        <div className="ai-console">
          <div className="ai-console-top"><span>PERSONAL PATHWAY</span><strong>READY</strong></div>
          <label>Your goal<select value={goal} onChange={e => setGoal(e.target.value as typeof goal)}><option value="study">Study abroad</option><option value="work">International work</option><option value="migration">Migration</option><option value="improve">Improve my score</option></select></label>
          <label>Target band<select value={band} onChange={e => setBand(e.target.value)}>{['6.0','6.5','7.0','7.5','8.0','8.5','9.0'].map(v => <option key={v}>{v}</option>)}</select></label>
          <div className="ai-recommendation"><span className="status-dot" /><div><small>NEXT RECOMMENDATION</small><strong>{goalLabels[goal]} • Band {band}</strong><p>{plans[goal][0]}. Your pathway can prioritize the skills and practice history that need the most attention.</p></div></div>
          <div className="ai-path">{plans[goal].map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span><strong>{item}</strong>{i < plans[goal].length - 1 && <i />}</div>)}</div>
          <button className="primary-btn" onClick={onStart}>Build my learning profile <ArrowRight size={17} /></button>
        </div>
        <div className="ai-capabilities">
          {[
            ['Adaptive pathways', 'Adjust study priorities from learner goals, results and progress.'],
            ['Performance intelligence', 'Turn practice history into clear next-step recommendations.'],
            ['AI-ready feedback', 'Create a foundation for writing, speaking and tutor feedback workflows.'],
            ['Human + AI support', 'Keep tutors in control while technology handles routine learning signals.'],
          ].map(([title, description], i) => (
            <article key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{description}</p></div></article>
          ))}
        </div>
      </div>
      <p className="ai-note">Learning recommendations are guidance features, not official IELTS scoring or exam results. Official IELTS testing and results remain with the relevant official test services.</p>
    </section>
  );
}

function SmartAssessment({ onStart }: { onStart: () => void }) {
  const [type, setType] = useState<'academic' | 'general'>('academic');
  const [currentBand, setCurrentBand] = useState('5.5');
  const [targetBand, setTargetBand] = useState('7.0');
  const [timeline, setTimeline] = useState('8');
  const [hours, setHours] = useState('6');
  const [saved, setSaved] = useState(false);

  const gap = Math.max(0, Number(targetBand) - Number(currentBand));
  const focus = gap >= 2 ? 'Build foundations first, then move into timed skill practice.' : gap >= 1 ? 'Prioritize weak skills, structured practice and weekly timed work.' : 'Focus on precision, exam technique and consistent mock performance.';
  const intensity = Number(hours) >= 8 ? 'High' : Number(hours) >= 5 ? 'Balanced' : 'Focused';
  const timelineLabel = timeline === '4' ? '4 weeks' : timeline === '8' ? '8 weeks' : timeline === '12' ? '12 weeks' : '16+ weeks';

  const buildPlan = () => {
    const profile = { ieltsType: type, currentBand, targetBand, timeline, weeklyHours: hours };
    try {
      sessionStorage.setItem('ielts_learning_profile', JSON.stringify(profile));
      setSaved(true);
    } catch {}
  };

  return (
    <section className="section smart-assessment" id="smart-assessment">
      <div className="section-heading">
        <div><span className="kicker">SMART START</span><h2>Turn your goal into a practical study plan.</h2></div>
        <p>Give the planning engine a few inputs. It creates a starting pathway now and can become more personalized as real practice data is collected.</p>
      </div>
      <div className="smart-assessment-grid">
        <div className="smart-form">
          <label>IELTS pathway<select value={type} onChange={e => setType(e.target.value as typeof type)}><option value="academic">Academic</option><option value="general">General Training</option></select></label>
          <label>Current estimated band<select value={currentBand} onChange={e => setCurrentBand(e.target.value)}>{['4.0','4.5','5.0','5.5','6.0','6.5','7.0','7.5','8.0'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Target band<select value={targetBand} onChange={e => setTargetBand(e.target.value)}>{['6.0','6.5','7.0','7.5','8.0','8.5','9.0'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Exam timeline<select value={timeline} onChange={e => setTimeline(e.target.value)}><option value="4">4 weeks</option><option value="8">8 weeks</option><option value="12">12 weeks</option><option value="16">16+ weeks</option></select></label>
          <label>Weekly study time<select value={hours} onChange={e => setHours(e.target.value)}><option value="3">3 hours</option><option value="6">6 hours</option><option value="8">8 hours</option><option value="12">12+ hours</option></select></label>
          <button className="primary-btn full" onClick={buildPlan}>{saved ? 'Plan saved for this session' : 'Build my starting plan'} <ArrowRight size={18} /></button>
        </div>
        <div className="smart-plan">
          <div className="smart-plan-top"><span>STARTING PLAN</span><strong>{intensity} LOAD</strong></div>
          <div className="smart-target"><span>{type === 'academic' ? 'ACADEMIC IELTS' : 'GENERAL TRAINING'}</span><strong>{currentBand} → {targetBand}</strong><small>{timelineLabel} • {hours}+ hours/week</small></div>
          <div className="smart-plan-list">
            <div><span>01</span><div><strong>Primary focus</strong><p>{focus}</p></div></div>
            <div><span>02</span><div><strong>Weekly rhythm</strong><p>Learn → practise → review → repeat, with one timed session each week.</p></div></div>
            <div><span>03</span><div><strong>Next checkpoint</strong><p>Use a diagnostic or mock to replace estimates with actual performance data.</p></div></div>
          </div>
          <button className="secondary-btn" onClick={onStart}>Continue to learner profile <ArrowRight size={17} /></button>
          <small className="smart-note">The current band is self-estimated, not an official IELTS score. Your choices are stored only in this browser session until connected to your learner profile.</small>
        </div>
      </div>
    </section>
  );
}

function PhotoStrip({ items }: { items: Array<{ src: string; alt: string }> }) {
  return (
    <div
      aria-label="IELTS learning photography"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginTop: 28,
      }}
    >
      {items.map(item => (
        <figure key={item.src} style={{ margin: 0, borderRadius: 16, overflow: 'hidden', background: '#eef1ee', border: '1px solid #e1e5e2' }}>
          <img
            src={item.src}
            alt={item.alt}
            loading="lazy"
            style={{ display: 'block', width: '100%', height: 190, objectFit: 'cover' }}
          />
        </figure>
      ))}
    </div>
  );
}

function LearningDashboard({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) { const [courses, setCourses] = useState<any[]>([]); const [enrollments, setEnrollments] = useState<any[]>([]); const [progress, setProgress] = useState<any[]>([]); const [busyCourse, setBusyCourse] = useState(''); const [message, setMessage] = useState(''); const load = async () => { const { data } = await api.get('/api/learning/dashboard'); setCourses(data.courses || []); setEnrollments(data.enrollments || []); setProgress(data.progress || []); }; useEffect(() => { load().catch(() => setMessage('We could not load your learning dashboard. Please try again.')); }, []); const enrolled = new Set(enrollments.map(item => item.course_id)); const enroll = async (courseId: string) => { setBusyCourse(courseId); setMessage(''); try { await api.post('/api/learning/enroll', { courseId }); await load(); setMessage('Course added to your learning plan.'); } catch (err: any) { setMessage(err?.response?.data?.message || err?.message || 'Unable to enroll right now.'); } finally { setBusyCourse(''); } }; const completion = progress.length ? Math.round(progress.reduce((sum, item) => sum + Number(item.percent || 0), 0) / progress.length) : 0; return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">STUDENT DASHBOARD</span><h1>Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}.</h1><p>Your preparation is organized in one place. Choose a course, continue learning and build measurable progress toward your target.</p></div><div className="learner-actions"><span>{user?.email}</span><button className="secondary-btn" onClick={onSignOut}>Sign out</button></div></section><section className="learner-stats"><article><strong>{enrollments.length}</strong><span>Courses enrolled</span></article><article><strong>{progress.filter(item => item.status === 'completed').length}</strong><span>Lessons completed</span></article><article><strong>{completion}%</strong><span>Learning progress</span></article></section>{message && <div className="dashboard-message" role="status">{message}</div>}<section className="learner-section"><div className="section-heading"><div><span className="kicker">MY LEARNING</span><h2>Continue your preparation.</h2></div><p>Start with a structured course and build from foundations into skill-specific practice.</p></div><div className="course-grid">{courses.map(course => <article className="course-card" key={course.id}><span className="course-type">{String(course.ielts_type || '').replaceAll('_', ' ').toUpperCase()}</span><h3>{course.title}</h3><p>{course.description}</p><div className="course-meta"><span>{course.level}</span><span>Prepare • Practice</span></div>{enrolled.has(course.id) ? <button className="primary-btn full" onClick={() => window.location.assign('/learn/course/'+encodeURIComponent(course.id))}>Continue course <ArrowRight size={17} /></button> : <button className="secondary-btn full" disabled={busyCourse === course.id} onClick={() => enroll(course.id)}>{busyCourse === course.id ? 'Adding…' : 'Add to my learning plan'} <ArrowRight size={17} /></button>}</article>)}</div></section><section className="learner-section learner-next"><div><span className="kicker">NEXT BUILD</span><h2>Lessons, practice and progress tracking.</h2><p>The learning core is connected to Supabase. Course modules and individual lessons are the next layer of the learning experience.</p></div><div className="next-card"><Target size={22} /><strong>Keep your target visible.</strong><span>Use your profile to shape the study plan around IELTS type, target band and exam timeline.</span></div></section></main>; }

function Seo({ title, description, canonical, type='website', jsonLd }: { title:string; description:string; canonical?:string; type?:string; jsonLd?:any }) {
  useEffect(()=>{
    const fullTitle=title.includes('IELTS Kenya Center')?title:`${title} | IELTS Kenya Center`;
    document.title=fullTitle;
    const setMeta=(name:string,content:string)=>{let el=document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement|null;if(!el){el=document.createElement('meta');el.name=name;document.head.appendChild(el)}el.content=content};
    const setProp=(property:string,content:string)=>{let el=document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement|null;if(!el){el=document.createElement('meta');el.setAttribute('property',property);document.head.appendChild(el)}el.content=content};
    setMeta('description',description); setMeta('robots','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    const url=canonical||window.location.href; let link=document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement|null;if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}link.href=url;
    setProp('og:title',fullTitle);setProp('og:description',description);setProp('og:url',url);setProp('og:type',type);setProp('og:site_name','IELTS Kenya Center');
    setMeta('twitter:card','summary_large_image');setMeta('twitter:title',fullTitle);setMeta('twitter:description',description);
    let ld=document.getElementById('seo-jsonld') as HTMLScriptElement|null;if(!ld){ld=document.createElement('script');ld.id='seo-jsonld';ld.type='application/ld+json';document.head.appendChild(ld)}ld.textContent=JSON.stringify(jsonLd||{});
  },[title,description,canonical,type,jsonLd]);
  return null;
}

function SeoGraph({ page, pageKey }: { page:any; pageKey:string }) {
  const seo=page?.body?.seo||{}; const description=String(seo.description||page?.body?.description||`IELTS preparation, practice and learning resources from IELTS Kenya Center for learners in Kenya and students preparing for international opportunities.`);
  const canonical=`${productionOrigin}/page/${encodeURIComponent(pageKey)}`;
  const graph:any[]=[{ '@type':'Organization',name:'IELTS Kenya Center',url:productionOrigin,logo:`${productionOrigin}/favicon.svg`},{'@type':'WebSite',name:'IELTS Kenya Center',url:productionOrigin},{'@type':'WebPage',name:page.title,description,url:canonical}];
  if(Array.isArray(seo.faqs)&&seo.faqs.length) graph.push({'@type':'FAQPage',mainEntity:seo.faqs.filter((f:any)=>f.question&&f.answer).map((f:any)=>({'@type':'Question',name:String(f.question),acceptedAnswer:{'@type':'Answer',text:String(f.answer)}}))});
  return <Seo title={String(seo.title||page.title)} description={description.slice(0,160)} canonical={canonical} jsonLd={{'@context':'https://schema.org','@graph':graph}}/>;
}

function ContentBlocks({ body }: { body:any }) {
  const blocks=Array.isArray(body?.blocks)?body.blocks:[];
  return <div className="page-content">{blocks.map((b:any,i:number)=>{
    const type=String(b?.type||'paragraph');
    if(type==='heading') return <h2 key={i}>{String(b.text||'')}</h2>;
    if(type==='subheading') return <h3 key={i}>{String(b.text||'')}</h3>;
    if(type==='bullets') return <ul key={i}>{(Array.isArray(b.items)?b.items:[]).map((x:any,j:number)=><li key={j}>{String(x)}</li>)}</ul>;
    if(type==='callout') return <div key={i} className="dashboard-message">{String(b.text||'')}</div>;
    if(type==='quote') return <blockquote key={i}>{String(b.text||'')}</blockquote>;
    return <p key={i}>{String(b.text||'')}</p>;
  })}</div>;
}

function PublicPage({ pageKey }: { pageKey:string }) {
  const [page,setPage]=useState<any>(null); const [error,setError]=useState('');
  const staticPage=seoContentByKey[pageKey];
  useEffect(()=>{ if(staticPage) return; api.get('/api/pages/'+encodeURIComponent(pageKey)).then(r=>setPage(r.data.page)).catch((e:any)=>setError(e?.response?.data?.message||'Page not found.')) },[pageKey,staticPage]);
  if(staticPage) return <main className="learner-shell">
    <Seo title={staticPage.title} description={staticPage.description} canonical={productionOrigin+'/page/'+encodeURIComponent(pageKey)} jsonLd={{'@context':'https://schema.org','@graph':[{'@type':'Organization',name:'IELTS Kenya Center',url:productionOrigin,logo:productionOrigin+'/favicon.svg'},{'@type':'WebSite',name:'IELTS Kenya Center',url:productionOrigin},{'@type':'WebPage',name:staticPage.title,description:staticPage.description,url:productionOrigin+'/page/'+encodeURIComponent(pageKey)},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:productionOrigin+'/'},{'@type':'ListItem',position:2,name:staticPage.title,item:productionOrigin+'/page/'+encodeURIComponent(pageKey)}]}]}} />
    <section className="learner-hero"><div><span className="kicker">IELTS KENYA CENTER</span><h1>{staticPage.title}</h1><p>{staticPage.intro}</p></div><a className="secondary-btn" href="/">Home</a></section>
    <section className="learner-section"><div className="page-content">{staticPage.sections.map((s,i)=><section key={i}><h2>{s.heading}</h2>{(s.paragraphs||[]).map((p,j)=><p key={j}>{p}</p>)}{s.bullets&&<ul>{s.bullets.map((b,j)=><li key={j}>{b}</li>)}</ul>}</section>)}<section><h2>Related IELTS resources</h2><div style={{display:'grid',gap:10}}>{staticPage.links.map((l,i)=><a key={i} className="ops-detail-row" href={l.href} style={{display:'flex',textDecoration:'none',color:'inherit'}}><span><strong>{l.label}</strong><small>Continue your IELTS preparation</small></span><ArrowRight size={16}/></a>)}</div></section></div></section>
  </main>;
  if(error)return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">PAGE</span><h1>Page unavailable</h1><p>{error}</p><a className="secondary-btn" href="/">Return home</a></div></section></main>;
  if(!page)return <main className="learner-shell"><section style={{padding:40}}>Loading page…</section></main>;
  return <main className="learner-shell"><SeoGraph page={page} pageKey={pageKey}/><section className="learner-hero"><div><span className="kicker">IELTS KENYA CENTER</span><h1>{page.title}</h1><p>Published content from the IELTS Kenya Center learning platform.</p></div><a className="secondary-btn" href="/">Home</a></section><section className="learner-section"><ContentBlocks body={page.body}/></section></main>;
}

type PublicCourse = { id:string; slug:string; title:string; description:string; level:string; ielts_type:string; modules:{id:string;title:string;description?:string|null;sort_order:number;lesson_count:number}[]; total_lessons:number };

function PublicCoursePage({ slug }: { slug:string }) {
  const [data,setData]=useState<PublicCourse|null>(null); const [error,setError]=useState('');
  useEffect(()=>{api.get('/api/public/courses/'+encodeURIComponent(slug)).then(r=>setData(r.data.course)).catch((e:any)=>setError(e?.response?.data?.message||'Course not found.'));},[slug]);
  if(error) return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">COURSE</span><h1>Course unavailable</h1><p>{error}</p><a className="secondary-btn" href="/page/ielts-courses">Explore IELTS courses</a></div></section></main>;
  if(!data) return <main className="learner-shell"><section style={{padding:40}}>Loading course…</section></main>;
  const type=String(data.ielts_type||'IELTS').replaceAll('_',' ');
  const canonical=productionOrigin+'/course/'+encodeURIComponent(data.slug);
  const outcomes = data.slug==='ielts-foundations'
    ? ['Understand the IELTS test structure and core task types.','Build practical study habits across all four skills.','Develop a foundation for focused IELTS practice.']
    : data.slug==='academic-band-7'
    ? ['Strengthen Academic IELTS strategy across all four skills.','Use timed practice to improve accuracy and pacing.','Build a structured route toward Band 7-level preparation.']
    : data.slug==='general-training-success'
    ? ['Prepare for General Training Reading and Writing contexts.','Maintain balanced Listening and Speaking practice.','Develop a repeatable timed-practice and review routine.']
    : ['Develop Speaking and Writing task structure.','Improve language development, organisation and review habits.','Use feedback routines to target recurring issues.'];
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'Organization',name:'IELTS Kenya Center',url:productionOrigin,logo:productionOrigin+'/favicon.svg'},
    {'@type':'WebSite',name:'IELTS Kenya Center',url:productionOrigin},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:productionOrigin+'/'},{'@type':'ListItem',position:2,name:'IELTS Courses',item:productionOrigin+'/page/ielts-courses'},{'@type':'ListItem',position:3,name:data.title,item:canonical}]},
    {'@type':'Course',name:data.title,description:data.description,url:canonical,provider:{'@type':'Organization',name:'IELTS Kenya Center',url:productionOrigin},educationalLevel:data.level,courseCode:data.slug,about:type,hasCourseInstance:{'@type':'CourseInstance',courseMode:'online',url:canonical}}
  ]};
  return <main className="learner-shell">
    <Seo title={data.title} description={data.description} canonical={canonical} jsonLd={graph}/>
    <section className="learner-hero"><div><span className="kicker">{type.toUpperCase()} • {data.level}</span><h1>{data.title}</h1><p>{data.description}</p><div className="hero-actions"><button className="primary-btn" onClick={()=>{window.location.href='/?signup=1'}}>Start this course <ArrowRight size={18}/></button><a className="secondary-btn" href="/page/ielts-courses">All IELTS courses</a></div></div></section>
    <section className="learner-stats"><article><strong>{data.modules.length}</strong><span>Modules</span></article><article><strong>{data.total_lessons}</strong><span>Lessons</span></article><article><strong>{type}</strong><span>IELTS pathway</span></article></section>
    <section className="learner-section"><div className="section-heading"><div><span className="kicker">COURSE OVERVIEW</span><h2>What you will work through</h2></div><p>This public overview describes the curriculum structure. Individual lessons remain inside the learner area.</p></div>
      <div className="journey-grid">{data.modules.map((m,i)=><article className="journey-card" key={m.id}><span>{String(i+1).padStart(2,'0')}</span><h3>{m.title}</h3><p>{m.description||'Structured IELTS preparation module.'}</p><small>{m.lesson_count} published lesson{m.lesson_count===1?'':'s'}</small></article>)}</div>
    </section>
    <section className="section"><div className="section-heading"><div><span className="kicker">LEARNING OUTCOMES</span><h2>Build practical IELTS preparation skills.</h2></div></div><ul className="check-list">{outcomes.map(o=><li key={o}><CheckCircle2 size={18}/>{o}</li>)}</ul></section>
    <section className="assessment section"><div className="assessment-card"><div><span className="kicker">READY TO LEARN?</span><h2>Create your learner account.</h2><p>Sign in or create an account to access enrolled course lessons, practice content and progress tracking.</p></div><button className="primary-btn" onClick={()=>{window.location.href='/?signup=1'}}>Create account <ArrowRight size={18}/></button></div></section>
  </main>;
}

function CourseView({ courseId }: { courseId:string }) {
  const [data,setData]=useState<any>(null); const [error,setError]=useState('');
  useEffect(()=>{api.get('/api/learning/courses/'+encodeURIComponent(courseId)).then(r=>setData(r.data)).catch((e:any)=>setError(e?.response?.data?.message||'Unable to load this course.'))},[courseId]);
  if(error)return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">COURSE</span><h1>Access unavailable</h1><p>{error}</p><a className="secondary-btn" href="/">Return to dashboard</a></div></section></main>;
  if(!data)return <main className="learner-shell"><section style={{padding:40}}>Loading course…</section></main>;
  const progressMap=new Map<string, any>(); (data.progress||[]).forEach((p:any)=>progressMap.set(p.lesson_id,p));
  return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">{String(data.course?.ielts_type||'IELTS').replaceAll('_',' ').toUpperCase()}</span><h1>{data.course?.title}</h1><p>{data.course?.description}</p></div><div className="learner-actions"><strong>{data.courseProgress}% complete</strong><a className="secondary-btn" href="/dashboard">Dashboard</a></div></section><section className="learner-section"><div className="section-heading"><div><span className="kicker">COURSE STRUCTURE</span><h2>Work through the modules in order.</h2></div><p>Open a published lesson to study and save your progress.</p></div>{(data.modules||[]).map((m:any)=><article style={{background:'#fff',border:'1px solid #e7e3d9',borderRadius:18,padding:22,marginBottom:14}} key={m.id}><span className="kicker">MODULE {m.sort_order+1}</span><h3>{m.title}</h3><p>{m.description}</p><div>{(data.lessons||[]).filter((l:any)=>l.module_id===m.id).map((l:any)=><a key={l.id} href={'/learn/lesson/'+encodeURIComponent(l.id)} className="ops-detail-row" style={{display:'flex',textDecoration:'none',color:'inherit',marginTop:8}}><span><strong>{l.title}</strong><small>{l.lesson_type} • {l.duration_minutes||'—'} min</small></span><span>{progressMap.get(l.id)?.status==='completed'?'✓ Completed':'Open'} <ArrowRight size={16}/></span></a>)}</div></article>)}</section></main>;
}

function LessonView({ lessonId }: { lessonId:string }) {
  const [data,setData]=useState<any>(null); const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  useEffect(()=>{api.get('/api/learning/lessons/'+encodeURIComponent(lessonId)).then(r=>setData(r.data)).catch((e:any)=>setError(e?.response?.data?.message||'Unable to load this lesson.'))},[lessonId]);
  if(error)return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">LESSON</span><h1>Access unavailable</h1><p>{error}</p><a className="secondary-btn" href="/dashboard">Return to dashboard</a></div></section></main>;
  if(!data)return <main className="learner-shell"><section style={{padding:40}}>Loading lesson…</section></main>;
  const complete=async()=>{setSaving(true);try{await api.put('/api/learning/progress',{lessonId,status:'completed',percent:100});setData((v:any)=>({...v,progress:{...(v.progress||{}),status:'completed',percent:100}}))}catch(e:any){setError(e?.response?.data?.message||'Unable to save progress.')}finally{setSaving(false)}};
  return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">{data.module?.title}</span><h1>{data.lesson?.title}</h1><p>{data.lesson?.lesson_type} • {data.lesson?.duration_minutes||'—'} minutes</p></div><a className="secondary-btn" href={'/learn/course/'+encodeURIComponent(data.module.course_id)}>Back to course</a></section><section className="learner-section"><ContentBlocks body={data.lesson?.content}/><div style={{marginTop:28,display:'flex',gap:10,alignItems:'center'}}><button className="primary-btn" disabled={saving||data.progress?.status==='completed'} onClick={complete}>{data.progress?.status==='completed'?'Lesson completed':'Mark lesson complete'} <CheckCircle2 size={18}/></button>{data.progress?.status==='completed'&&<span>Progress saved.</span>}</div></section></main>;
}

function App() {
  const [user, setUser] = useState<User>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('signup') === '1') { setAuthMode('signup'); setAuthOpen(true); }
   api
      .get('/api/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        const roles: string[] = data.roles || [];
        if (data.user) {
          if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('platform_owner')) {
            window.location.replace('/admin/dashboard');
            return;
          }
          if (roles.some(role => ['academic_director', 'ielts_tutor', 'student_support', 'content_editor', 'marketing', 'exam_manager', 'finance', 'read_only_auditor'].includes(role))) {
            window.location.replace('/staff/dashboard');
            return;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const openAuth = (mode: 'signin' | 'signup') => {
    setMobileNav(false);
    window.location.assign(mode === 'signin' ? '/login' : '/register');
  };
  const signOut = async () => {
    await api.post('/api/auth/signout');
    setUser(null);
  };
  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const payload =
      authMode === 'signup'
        ? {
            fullName: String(form.get('fullName') || ''),
            email: String(form.get('email') || ''),
            password: String(form.get('password') || ''),
          }
        : {
            email: String(form.get('email') || ''),
            password: String(form.get('password') || ''),
          };
    try {
      const { data } = await api.post(
        authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin',
        payload
      );
      if (data.user) setUser(data.user);
      setMessage(data.message || 'Signed in successfully.');
      if (authMode === 'signin' || data.user)
        setTimeout(() => setAuthOpen(false), 500);
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const currentPath=window.location.pathname;
  const courseRoute=currentPath.match(/^\/learn\/course\/([^/]+)$/);
  const publicCourseRoute=currentPath.match(/^\/course\/([^/]+)$/);
  const lessonRoute=currentPath.match(/^\/learn\/lesson\/([^/]+)$/);
  const pageRoute=currentPath.match(/^\/page\/([^/]+)$/);
  if (!loading && pageRoute) return <PublicPage pageKey={decodeURIComponent(pageRoute[1])}/>;
  if (!loading && publicCourseRoute) return <PublicCoursePage slug={decodeURIComponent(publicCourseRoute[1])}/>;
  if (!loading && lessonRoute && user) return <LessonView lessonId={decodeURIComponent(lessonRoute[1])}/>;
  if (!loading && courseRoute && user) return <CourseView courseId={decodeURIComponent(courseRoute[1])}/>;

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="IELTS Kenya Center home">
          <img className="brand-logo" src="/logo.svg" alt="IELTS Kenya Center" />
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {sections.map(item => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
          <a href="#about">About Us</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="nav-actions">
          <button className="text-btn" onClick={() => openAuth('signin')}>
            Student Login
          </button>
          <button
            className="primary-btn compact"
            onClick={() => openAuth('signup')}
          >
            Create Account
          </button>
        </div>
        <button
          className="menu-btn"
          aria-label={mobileNav ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileNav(v => !v)}
        >
          {mobileNav ? <X /> : <Menu />}
        </button>
      </header>
      {mobileNav && (
        <nav className="mobile-nav">
          {sections.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileNav(false)}
            >
              {item.label}
            </a>
          ))}
          <a href="#about" onClick={() => setMobileNav(false)}>
            About Us
          </a>
          <a href="#contact" onClick={() => setMobileNav(false)}>
            Contact
          </a>
          <button onClick={() => openAuth('signin')}>Student Login</button>
          <button className="primary-btn" onClick={() => openAuth('signup')}>
            Create Account
          </button>
        </nav>
      )}
      {user ? <LearningDashboard user={user} onSignOut={signOut} /> : <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={16} /> PREPARE • PRACTICE • ACHIEVE
            </div>
            <h1>
              Build the English skills for your <em>global opportunities.</em>
            </h1>
            <p>
              Structured IELTS preparation for Academic and General Training
              learners, with guided study, realistic practice and a clear path
              from your current level toward your target band.
            </p>
            <div className="hero-actions">
              <button
                className="primary-btn"
                onClick={() => openAuth('signup')}
              >
                Start Learning <ArrowRight size={18} />
              </button>
              <a className="secondary-btn" href="#assessment">
                Free Assessment <Target size={18} />
              </a>
            </div>
            <p className="fine-print">
              Independent IELTS preparation platform. We do not claim to be an
              official IELTS test centre or exam owner.
            </p>
          </div>
          <div className="hero-panel hero-photo-panel">
            <img
              className="hero-student-photo"
              src="/resources/ielts/pexels-abubakar-mamuda-2150975575-32815203.jpg"
              alt="University students studying together with books and laptops"
              loading="eager"
              fetchPriority="high"
            />
            <div className="photo-overlay" aria-hidden="true" />
            <div className="panel-card photo-panel-card">
              <span className="status-dot" /> Your preparation, organized
              <br />
              <strong>One practical next step at a time.</strong>
            </div>
            <div className="panel-card small photo-panel-badge">
              <CheckCircle2 size={18} /> Four skills • Practice • Mocks • Feedback
            </div>
          </div>
        </section>
        <LearningIntelligence onStart={() => openAuth('signup')} />
        <section className="global-pathways section" id="pathways">
          <div className="section-heading">
            <div><span className="kicker">YOUR GOAL. YOUR PATH.</span><h2>One platform for the journey after IELTS, too.</h2></div>
            <p>Start with preparation, then connect your learning to the academic, professional and international opportunities you are working toward.</p>
          </div>
          <div className="pathway-grid">
            {[
              ['01','Study abroad','Academic IELTS preparation, university-focused English and structured readiness.','/page/academic-ielts'],
              ['02','International work','General Training preparation and practical communication for workplace goals.','/page/general-training-ielts'],
              ['03','Migration','A structured four-skill preparation route with checkpoints and practice history.','/page/general-training-ielts'],
              ['04','Personal growth','Build English ability beyond a single exam through continuous practice and feedback.','/page/ielts-preparation-kenya'],
            ].map(([n,title,description,href]) => (
              <a href={href} className="pathway-card" key={n}>
                <span>{n}</span><h3>{title}</h3><p>{description}</p><strong>Explore pathway <ArrowRight size={16}/></strong>
              </a>
            ))}
          </div>
        </section>
        <section className="trust-strip">
          <div>
            <strong>Academic & General Training</strong>
            <span>Different goals, structured preparation</span>
          </div>
          <div>
            <strong>Listening • Reading • Writing • Speaking</strong>
            <span>Build balanced performance</span>
          </div>
          <div>
            <strong>Practice-first learning</strong>
            <span>Learn, apply, review, improve</span>
          </div>
        </section>
        <section className="section" id="preparation">
          <div className="section-heading">
            <div>
              <span className="kicker">THE LEARNING JOURNEY</span>
              <h2>A preparation system built around progress.</h2>
            </div>
            <p>
              Move from assessment to study plan, lessons, practice, mock exams
              and feedback without losing sight of your target.
            </p>
          </div>
          <div className="journey-grid">
            {[
              ['01','Assess','Understand your starting point and identify priority skills.'],
              ['02','Plan','Set a target band, timeline and realistic weekly study rhythm.'],
              ['03','Learn','Work through structured lessons, examples and guided exercises.'],
              ['04','Practice','Train with IELTS-style tasks and review what needs improvement.'],
              ['05','Test','Use timed mocks to build accuracy, pacing and exam confidence.'],
              ['06','Improve','Use performance insights and tutor feedback to decide what comes next.'],
            ].map(([n, t, d]) => (
              <article className="journey-card" key={n}>
                <span>{n}</span><h3>{t}</h3><p>{d}</p>
              </article>
            ))}
          </div>
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-polina-tankilevitch-6929187.jpg', alt: 'Student preparing with study materials' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-thirdman-5649416.jpg', alt: 'Learners working through an English study session' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-mikhail-nilov-9158715.jpg', alt: 'Student focused on academic preparation' },
            ]}
          />
        </section>
        <section className="dark-section" id="courses">
          <div className="section-heading light">
            <div><span className="kicker">FOUR SKILLS</span><h2>Practice with purpose.</h2></div>
            <p>Foundation architecture supports skill-specific learning now and expands into full testing workflows as the platform grows.</p>
          </div>
          <div className="skill-grid">
            {[
              ['Listening','Train comprehension, note completion, matching and exam timing.','https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-tosin-olowoleni-2148141635-34162710.jpg','Student practising IELTS listening with focused study materials.'],
              ['Reading','Build passage strategies, question-type accuracy and pacing.','https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/markus-winkler-_bpu1M6OFy8-unsplash.jpg','Student reading and preparing for an academic English assessment.'],
              ['Writing','Develop task response, coherence, vocabulary and grammar.','https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/annie-spratt-fvaB1MK6NxM-unsplash.jpg','Handwriting notes while preparing an academic writing task.'],
              ['Speaking','Practice Parts 1–3 with timed prompts, recording and feedback.','https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-fajar-herlambang-studio-TmdrCRVDOnQ-unsplash.jpg','Student speaking during a guided academic session.'],
            ].map(([t, d, image, alt]) => (
              <article className="skill-card skill-photo-card" key={t}>
                <img className="skill-photo" src={image} alt={alt} loading="lazy" />
                <div className="skill-photo-body">
                  <h3>{t}</h3><p>{d}</p><a href={t === 'Listening' ? '/page/ielts-listening' : t === 'Reading' ? '/page/ielts-reading' : t === 'Writing' ? '/page/ielts-writing' : '/page/ielts-speaking'}>Explore {t} <ArrowRight size={16} /></a>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="section" id="practice">
          <div className="section-heading">
            <div><span className="kicker">PRACTICE LIBRARY</span><h2>Turn every study session into useful practice.</h2></div>
            <p>Choose a skill, practise focused task types and use review to decide what to work on next.</p>
          </div>
          <div className="journey-grid">
            {[
              ['Listening', 'Focused listening sets, question-type practice and review.', '/page/ielts-listening'],
              ['Reading', 'Passage strategies, locating evidence and timed practice.', '/page/ielts-reading'],
              ['Writing', 'Task planning, organisation, language review and rewriting.', '/page/ielts-writing'],
              ['Speaking', 'Structured speaking prompts, fluency practice and feedback.', '/page/ielts-speaking'],
            ].map(([title, description, href]) => (
              <a key={title} href={href} className="journey-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span>SKILL</span><h3>{title}</h3><p>{description}</p><strong>Open {title} practice <ArrowRight size={16} /></strong>
              </a>
            ))}
          </div>
        </section>
        <section className="assessment section" id="assessment">
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-abdallah-mallya-489932967-16187414.jpg', alt: 'IELTS learner in an academic study setting' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-gabby-k-6281959.jpg', alt: 'Student completing preparation work' },
            ]}
          />
          <div className="assessment-card">
            <div><span className="kicker">START WITH CLARITY</span><h2>Free assessment pathway</h2><p>The platform is designed to assess your needs where feasible, identify strengths and weak areas, and recommend a practical preparation route. Any practice estimate is clearly labelled as non-official.</p></div>
            <button className="primary-btn" onClick={() => openAuth('signup')}>Create my learning profile <ArrowRight size={18} /></button>
          </div>
        </section>
        <section className="section feature-row" id="mock-tests">
          <div className="feature-visual feature-photo-visual">
            <img
              src="/resources/ielts/pexels-andy-barbour-6683580.jpg"
              alt="Students working together at a table with laptops and study materials"
              loading="lazy"
            />
            <div className="mock-screen mock-screen-overlay">
              <div className="mock-top"><span>MOCK EXAM</span><b>02:14:36</b></div>
              <div className="mock-lines"><i /><i /><i /><i /><i /></div>
              <div className="mock-progress"><span style={{ width: '68%' }} /></div>
            </div>
          </div>
          <div><span className="kicker">MOCK TESTS</span><h2>Practice the pressure before exam day.</h2><p>Phase 1 establishes the foundation for timed Listening, Reading and Writing sequences, Speaking practice, autosave and performance review.</p><ul className="check-list"><li><ShieldCheck size={18} /> Autosave-ready architecture</li><li><ShieldCheck size={18} /> Skill and target-band aware</li><li><ShieldCheck size={18} /> Historical scoring configurations</li></ul></div>
        </section>
        <section className="section student-story">
          <div className="student-story-photo">
            <img
              src="/resources/ielts/pexels-ivan-s-5676737.jpg"
              alt="Student studying online with a laptop and notes"
              loading="lazy"
            />
          </div>
          <div>
            <span className="kicker">BUILT FOR REAL LEARNERS</span>
            <h2>Study for IELTS alongside your academic and career goals.</h2>
            <p>Use structured preparation whether you are balancing university, work, applications or plans to study and work internationally.</p>
            <div className="story-points">
              <span><strong>Flexible study</strong> Learn around your schedule.</span>
              <span><strong>Focused practice</strong> Work on the skills that need attention.</span>
              <span><strong>Clear progress</strong> Keep your target and next step visible.</span>
            </div>
          </div>
        </section>
        <section className="section" id="tutors">
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-faisal-qureshi-2wICPGTLHIg-unsplash.jpg', alt: 'Learners receiving guided academic support' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-william-fortunato-6140610.jpg', alt: 'Students learning together' },
            ]}
          />
          <div className="callout"><div><span className="kicker">TUTOR SUPPORT</span><h2>Human guidance where it matters.</h2><p>The platform foundation supports assigned tutors, writing and speaking feedback, homework, notes, sessions and student communication with role-based access.</p></div><button className="secondary-btn" onClick={() => openAuth('signup')}>Join as a learner <ArrowRight size={18} /></button></div></section>
        <section className="section" id="pricing">
          <div className="section-heading"><div><span className="kicker">FLEXIBLE ACCESS</span><h2>Plans can grow with your preparation.</h2></div><p>Payment and subscription architecture is designed for free entry points, courses, skills, mocks and tutor-supported services without locking the platform to one provider.</p></div>
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-keira-burton-6146971.jpg', alt: 'Student studying with a laptop' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-polina-tankilevitch-6929276.jpg', alt: 'Academic preparation workspace' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-md-photography-2150970498-32668041.jpg', alt: 'Learners collaborating during study' },
            ]}
          />
          <div className="price-grid">
            <article><span>FREE</span><h3>Start</h3><p>Explore the platform and begin building your learning profile.</p><button onClick={() => openAuth('signup')}>Create account <ArrowRight size={16} /></button></article>
            <article className="featured"><span>LEARNING</span><h3>Preparation</h3><p>Structured courses, practice and progress features as they are released.</p><button onClick={() => openAuth('signup')}>Start learning <ArrowRight size={16} /></button></article>
            <article><span>SUPPORT</span><h3>Tutor-guided</h3><p>Designed for deeper feedback and personalized support as tutor services launch.</p><button onClick={() => openAuth('signup')}>Register interest <ArrowRight size={16} /></button></article>
          </div>
        </section>
        <section className="section" style={{ paddingTop: 0, paddingBottom: 70 }}>
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-cottonbro-6890210.jpg', alt: 'Study materials for IELTS preparation' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-this-and-no-internet-25-288559-29242204.jpg', alt: 'Student using a laptop for study' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-proudlyswazi-33905986.jpg', alt: 'Graduate celebrating an academic achievement' },
            ]}
          />
        </section>
        <section className="resource-band" id="resources"><div><BookOpen size={28} /><div><strong>Resources for better preparation</strong><span>Guides, vocabulary, grammar, writing and speaking resources will live in one searchable library.</span></div></div><a href="/page/ielts-resources">Explore resources <ArrowRight size={17} /></a></section>
        <section className="section" style={{ paddingTop: 20 }}>
          <PhotoStrip
            items={[
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-speakmediauganda-35305047.jpg', alt: 'International learners studying together' },
              { src: 'https://raw.githubusercontent.com/success-ielts/ielts-kenya-center/main/public/resources/ielts/pexels-shutter-rwanda-2157056879-37898351.jpg', alt: 'Students preparing for international opportunities' },
            ]}
          />
        </section>
        <section className="section" id="faq">
          <div className="section-heading">
            <div><span className="kicker">COMMON QUESTIONS</span><h2>Everything you need to get started.</h2></div>
            <p>Clear answers before you create your learning profile.</p>
          </div>
          <div className="faq-list">
            {[
              ['Is IELTS Kenya Center the official IELTS test centre?', 'IELTS Kenya Center provides IELTS preparation and coaching. Official IELTS testing, administration and results remain with the relevant official IELTS test services.'],
              ['Can I prepare for Academic and General Training IELTS?', 'Yes. The learning architecture supports both pathways, with shared Listening and Speaking preparation and pathway-specific Reading and Writing preparation.'],
              ['Can the platform adapt to my target band?', 'The Home experience is designed around a target band and learner goal. As performance data accumulates, the platform can use those signals to shape future study recommendations.'],
              ['Will my progress be saved?', 'The learner platform is connected to the learning backend for course enrolments and lesson progress.'],
              ['Can I study with a tutor?', 'The platform architecture supports tutor assignment, feedback, homework, notes, sessions and learner communication as those services are activated.'],
              ['How do I start?', 'Create your learner account, choose your pathway and begin with the available preparation and practice resources.'],
            ].map(([question, answer]) => (
              <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
        <section className="section about" id="about"><div><span className="kicker">ABOUT IELTS KENYA CENTER</span><h2>A Kenyan-focused learning platform for global goals.</h2></div><div><p>IELTS Kenya Center is an IDP-authorized IELTS coaching and preparation provider for candidates, including job seekers pursuing international employment opportunities. We provide structured preparation, realistic practice and measurable progress support.</p><p>We provide coaching and preparation; IELTS testing, test administration and official results remain the responsibility of the official IELTS test services.</p></div></section>
      </main>}
        <section className="section home-contact" id="contact">
          <div className="contact-card">
            <div>
              <span className="kicker">YOUR NEXT STEP</span>
              <h2>Build your preparation around where you want to go.</h2>
              <p>Start with a learner profile today. Your future pathway can connect goals, target band, practice, courses, progress and human support in one place.</p>
            </div>
            <div className="contact-actions">
              <a className="primary-btn" href="/register">Create learner account <ArrowRight size={18} /></a>
              <a className="secondary-btn" href="mailto:info@ielts-kenyacenter.or.ke">Contact IELTS Kenya Center</a>
            </div>
          </div>
        </section>
      <footer id="contact"><div className="footer-main"><div className="brand footer-brand"><img className="brand-logo" src="/logo.svg" alt="IELTS Kenya Center" /></div><div><strong>Platform</strong><a href="/page/ielts-courses">Courses</a><a href="/page/ielts-practice">Practice</a><a href="#mock-tests">Mock Tests</a><a href="/page/ielts-preparation-kenya">Preparation</a></div><div><strong>Skills</strong><a href="/page/ielts-listening">Listening</a><a href="/page/ielts-reading">Reading</a><a href="/page/ielts-writing">Writing</a><a href="/page/ielts-speaking">Speaking</a></div><div><strong>Support</strong><a href="/page/ielts-resources">Resources</a><a href="#contact">Contact</a><a href="#about">About Us</a></div><div><strong>Account</strong><button onClick={() => openAuth('signin')}>Student Login</button><button onClick={() => openAuth('signup')}>Create Account</button></div></div><div className="footer-bottom"><span>© 2026 IELTS Kenya Center. Prepare • Practice • Achieve.</span><span>Privacy • Terms • Cookies</span></div></footer>
      {!loading && user && <div className="session-bar"><span>Signed in as <strong>{user.email}</strong></span><button onClick={signOut}>Sign out</button></div>}
      {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="auth-modal"><button className="modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}><X /></button><div className="auth-icon"><GraduationCap /></div><span className="kicker">IELTS KENYA CENTER</span><h2 id="auth-title">{authMode === 'signup' ? 'Create your learning account' : 'Welcome back'}</h2><p>{authMode === 'signup' ? 'Start your learner profile and preparation journey.' : 'Continue your preparation journey.'}</p><form onSubmit={submitAuth}>{authMode === 'signup' && <label>Full name<input name="fullName" autoComplete="name" required /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength={8} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required /></label>{message && <div className="form-message" role="alert">{message}</div>}<button className="primary-btn full" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></button></form><button className="switch-auth" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setMessage(''); }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New to the platform? Create an account'}</button></div></div>}
    </div>
  );
}
export default App;
