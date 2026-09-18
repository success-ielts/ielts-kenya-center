import { FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

type User = {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
} | null;
const sections = [
  'Preparation',
  'Courses',
  'Practice',
  'Mock Tests',
  'Tutors',
  'Pricing',
  'Resources',
];

function LearningDashboard({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) { const [courses, setCourses] = useState<any[]>([]); const [enrollments, setEnrollments] = useState<any[]>([]); const [progress, setProgress] = useState<any[]>([]); const [busyCourse, setBusyCourse] = useState(''); const [message, setMessage] = useState(''); const load = async () => { const { data } = await api.get('/api/learning/dashboard'); setCourses(data.courses || []); setEnrollments(data.enrollments || []); setProgress(data.progress || []); }; useEffect(() => { load().catch(() => setMessage('We could not load your learning dashboard. Please try again.')); }, []); const enrolled = new Set(enrollments.map(item => item.course_id)); const enroll = async (courseId: string) => { setBusyCourse(courseId); setMessage(''); try { await api.post('/api/learning/enroll', { courseId }); await load(); setMessage('Course added to your learning plan.'); } catch (err: any) { setMessage(err?.response?.data?.message || err?.message || 'Unable to enroll right now.'); } finally { setBusyCourse(''); } }; const completion = progress.length ? Math.round(progress.reduce((sum, item) => sum + Number(item.percent || 0), 0) / progress.length) : 0; return <main className="learner-shell"><section className="learner-hero"><div><span className="kicker">STUDENT DASHBOARD</span><h1>Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}.</h1><p>Your preparation is organized in one place. Choose a course, continue learning and build measurable progress toward your target.</p></div><div className="learner-actions"><span>{user?.email}</span><button className="secondary-btn" onClick={onSignOut}>Sign out</button></div></section><section className="learner-stats"><article><strong>{enrollments.length}</strong><span>Courses enrolled</span></article><article><strong>{progress.filter(item => item.status === 'completed').length}</strong><span>Lessons completed</span></article><article><strong>{completion}%</strong><span>Learning progress</span></article></section>{message && <div className="dashboard-message" role="status">{message}</div>}<section className="learner-section"><div className="section-heading"><div><span className="kicker">MY LEARNING</span><h2>Continue your preparation.</h2></div><p>Start with a structured course and build from foundations into skill-specific practice.</p></div><div className="course-grid">{courses.map(course => <article className="course-card" key={course.id}><span className="course-type">{String(course.ielts_type || '').replaceAll('_', ' ').toUpperCase()}</span><h3>{course.title}</h3><p>{course.description}</p><div className="course-meta"><span>{course.level}</span><span>Prepare • Practice</span></div>{enrolled.has(course.id) ? <button className="primary-btn full" onClick={() => setMessage('Course lessons are ready for the next learning step.')}>Continue course <ArrowRight size={17} /></button> : <button className="secondary-btn full" disabled={busyCourse === course.id} onClick={() => enroll(course.id)}>{busyCourse === course.id ? 'Adding…' : 'Add to my learning plan'} <ArrowRight size={17} /></button>}</article>)}</div></section><section className="learner-section learner-next"><div><span className="kicker">NEXT BUILD</span><h2>Lessons, practice and progress tracking.</h2><p>The learning core is connected to Supabase. Course modules and individual lessons are the next layer of the learning experience.</p></div><div className="next-card"><Target size={22} /><strong>Keep your target visible.</strong><span>Use your profile to shape the study plan around IELTS type, target band and exam timeline.</span></div></section></main>; }

function App() {
  const [user, setUser] = useState<User>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .get('/api/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setMessage('');
    setAuthOpen(true);
    setMobileNav(false);
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

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="IELTS Kenya Center home">
          <img className="brand-logo" src="/logo.svg" alt="IELTS Kenya Center" />
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {sections.map(item => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`}>
              {item}
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
              key={item}
              href={`#${item.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => setMobileNav(false)}
            >
              {item}
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
          <div className="hero-panel">
            <img className="hero-brand-logo" src="/logo.svg" alt="IELTS Kenya Center — Prepare, Practice, Achieve" />
            <div className="panel-card">
              <span className="status-dot" /> Your preparation, organized
              <br />
              <strong>One practical next step at a time.</strong>
            </div>
            <div className="panel-card small">
              <CheckCircle2 size={18} /> Four skills • Practice • Mocks •
              Feedback
            </div>
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
        </section>
        <section className="dark-section" id="courses">
          <div className="section-heading light">
            <div><span className="kicker">FOUR SKILLS</span><h2>Practice with purpose.</h2></div>
            <p>Foundation architecture supports skill-specific learning now and expands into full testing workflows as the platform grows.</p>
          </div>
          <div className="skill-grid">
            {[
              ['Listening','Train comprehension, note completion, matching and exam timing.'],
              ['Reading','Build passage strategies, question-type accuracy and pacing.'],
              ['Writing','Develop task response, coherence, vocabulary and grammar.'],
              ['Speaking','Practice Parts 1–3 with timed prompts, recording and feedback.'],
            ].map(([t, d], i) => (
              <article className="skill-card" key={t}>
                <div className="icon-box">{i === 0 ? '◉' : i === 1 ? '▤' : i === 2 ? '✎' : '◌'}</div>
                <h3>{t}</h3><p>{d}</p><a href="#practice">Explore {t} <ArrowRight size={16} /></a>
              </article>
            ))}
          </div>
        </section>
        <section className="assessment section" id="assessment">
          <div className="assessment-card">
            <div><span className="kicker">START WITH CLARITY</span><h2>Free assessment pathway</h2><p>The platform is designed to assess your needs where feasible, identify strengths and weak areas, and recommend a practical preparation route. Any practice estimate is clearly labelled as non-official.</p></div>
            <button className="primary-btn" onClick={() => openAuth('signup')}>Create my learning profile <ArrowRight size={18} /></button>
          </div>
        </section>
        <section className="section feature-row" id="mock-tests">
          <div className="feature-visual"><div className="mock-screen"><div className="mock-top"><span>MOCK EXAM</span><b>02:14:36</b></div><div className="mock-lines"><i /><i /><i /><i /><i /></div><div className="mock-progress"><span style={{ width: '68%' }} /></div></div></div>
          <div><span className="kicker">MOCK TESTS</span><h2>Practice the pressure before exam day.</h2><p>Phase 1 establishes the foundation for timed Listening, Reading and Writing sequences, Speaking practice, autosave and performance review.</p><ul className="check-list"><li><ShieldCheck size={18} /> Autosave-ready architecture</li><li><ShieldCheck size={18} /> Skill and target-band aware</li><li><ShieldCheck size={18} /> Historical scoring configurations</li></ul></div>
        </section>
        <section className="section" id="tutors"><div className="callout"><div><span className="kicker">TUTOR SUPPORT</span><h2>Human guidance where it matters.</h2><p>The platform foundation supports assigned tutors, writing and speaking feedback, homework, notes, sessions and student communication with role-based access.</p></div><button className="secondary-btn" onClick={() => openAuth('signup')}>Join as a learner <ArrowRight size={18} /></button></div></section>
        <section className="section" id="pricing">
          <div className="section-heading"><div><span className="kicker">FLEXIBLE ACCESS</span><h2>Plans can grow with your preparation.</h2></div><p>Payment and subscription architecture is designed for free entry points, courses, skills, mocks and tutor-supported services without locking the platform to one provider.</p></div>
          <div className="price-grid">
            <article><span>FREE</span><h3>Start</h3><p>Explore the platform and begin building your learning profile.</p><button onClick={() => openAuth('signup')}>Create account <ArrowRight size={16} /></button></article>
            <article className="featured"><span>LEARNING</span><h3>Preparation</h3><p>Structured courses, practice and progress features as they are released.</p><button onClick={() => openAuth('signup')}>Start learning <ArrowRight size={16} /></button></article>
            <article><span>SUPPORT</span><h3>Tutor-guided</h3><p>Designed for deeper feedback and personalized support as tutor services launch.</p><button onClick={() => openAuth('signup')}>Register interest <ArrowRight size={16} /></button></article>
          </div>
        </section>
        <section className="resource-band" id="resources"><div><BookOpen size={28} /><div><strong>Resources for better preparation</strong><span>Guides, vocabulary, grammar, writing and speaking resources will live in one searchable library.</span></div></div><a href="#contact">Explore the platform <ArrowRight size={17} /></a></section>
        <section className="section about" id="about"><div><span className="kicker">ABOUT IELTS KENYA CENTER</span><h2>A Kenyan-focused learning platform for global goals.</h2></div><div><p>IELTS Kenya Center is being built as an education technology platform for learners who want structured IELTS preparation, realistic practice and measurable progress.</p><p>It is not presented as an official IELTS examination owner, test centre or authorized partner unless documentary authorization exists.</p></div></section>
      </main>}
      <footer id="contact"><div className="footer-main"><div className="brand footer-brand"><img className="brand-logo" src="/logo.svg" alt="IELTS Kenya Center" /></div><div><strong>Platform</strong><a href="#courses">Courses</a><a href="#practice">Practice</a><a href="#mock-tests">Mock Tests</a></div><div><strong>Support</strong><a href="#resources">Resources</a><a href="#contact">Contact</a><a href="#about">About Us</a></div><div><strong>Account</strong><button onClick={() => openAuth('signin')}>Student Login</button><button onClick={() => openAuth('signup')}>Create Account</button></div></div><div className="footer-bottom"><span>© 2026 IELTS Kenya Center. Prepare • Practice • Achieve.</span><span>Privacy • Terms • Cookies</span></div></footer>
      {!loading && user && <div className="session-bar"><span>Signed in as <strong>{user.email}</strong></span><button onClick={signOut}>Sign out</button></div>}
      {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="auth-modal"><button className="modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}><X /></button><div className="auth-icon"><GraduationCap /></div><span className="kicker">IELTS KENYA CENTER</span><h2 id="auth-title">{authMode === 'signup' ? 'Create your learning account' : 'Welcome back'}</h2><p>{authMode === 'signup' ? 'Start your learner profile and preparation journey.' : 'Continue your preparation journey.'}</p><form onSubmit={submitAuth}>{authMode === 'signup' && <label>Full name<input name="fullName" autoComplete="name" required /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength={8} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required /></label>{message && <div className="form-message" role="alert">{message}</div>}<button className="primary-btn full" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></button></form><button className="switch-auth" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setMessage(''); }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New to the platform? Create an account'}</button></div></div>}
    </div>
  );
}
export default App;
