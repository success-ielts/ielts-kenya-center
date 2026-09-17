import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'https://ielts-kenyacenter.or.ke';
const supabaseUrl = process.env.SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY;
const failures = [];
const checks = [];
const ok = (name, detail='') => checks.push({name, detail});
const fail = (name, detail) => { failures.push({name, detail}); console.error(`FAIL: ${name}: ${detail}`); };
const adminHeaders = () => ({ apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' });

async function adminCreateConfirmedUser(email, password) {
  if (!supabaseUrl || !adminKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { method:'POST', headers:adminHeaders(), body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:'Production QA Student'}}) });
  const body = await response.json().catch(()=>({}));
  return response.ok ? body : null;
}
async function adminDeleteUser(id) {
  if (!id || !supabaseUrl || !adminKey) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method:'DELETE', headers:adminHeaders() });
  return response.ok;
}

async function main() {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const desktop = await context.newPage();
  const consoleErrors=[]; const pageErrors=[]; const requestFailures=[];
  desktop.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });
  desktop.on('pageerror', e => pageErrors.push(String(e)));
  desktop.on('requestfailed', r => requestFailures.push(`${r.method()} ${r.url()} ${r.failure()?.errorText || ''}`));

  const home = await desktop.goto(base+'/', {waitUntil:'networkidle'});
  if (home?.ok()) ok('Desktop homepage loads', `${home.status()}`); else fail('Desktop homepage loads', `HTTP ${home?.status()}`);
  if ((await desktop.locator('body').innerText()).includes('IELTS Kenya Center')) ok('Homepage branding'); else fail('Homepage branding','IELTS Kenya Center text missing');

  const mobile = await context.newPage({viewport:{width:390,height:844}});
  const mobileErrors=[]; mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text())}); mobile.on('pageerror',e=>mobileErrors.push(String(e)));
  const mh = await mobile.goto(base+'/',{waitUntil:'networkidle'});
  if(mh?.ok()) ok('Mobile homepage loads',`${mh.status()}`); else fail('Mobile homepage loads',`HTTP ${mh?.status()}`);
  if(mobileErrors.length) fail('Mobile console',mobileErrors.slice(0,10).join(' | ')); else ok('Mobile console','no console errors');

  for (const path of ['/courses','/dashboard','/practice','/resources','/forgot-password','/reset-password']) {
    const r=await desktop.goto(base+path,{waitUntil:'domcontentloaded'});
    if(r?.ok()) ok(`Direct route refresh ${path}`,`${r.status()}`); else fail(`Direct route refresh ${path}`,`HTTP ${r?.status()}`);
  }
  if ((await desktop.locator('body').innerText()).includes('Forgot your password?')) ok('Forgot Password page'); else fail('Forgot Password page','page text missing');

  const health=await desktop.request.get(base+'/api/_healthcheck');
  if(health.ok() && (await health.json()).ok===true) ok('Worker healthcheck'); else fail('Worker healthcheck',`HTTP ${health.status()}`);
  const cfg=await desktop.request.get(base+'/api/config-status');
  if(cfg.ok() && (await cfg.json()).supabaseConfigured===true) ok('Supabase runtime configuration'); else fail('Supabase runtime configuration',`HTTP ${cfg.status()}`);
  const emailStatus=await desktop.request.post(base+'/api/email/status');
  if(emailStatus.ok() && (await emailStatus.json()).configured===true) ok('Resend runtime configuration'); else fail('Resend runtime configuration',`HTTP ${emailStatus.status()}`);

  const email=`qa-${Date.now()}-${Math.random().toString(36).slice(2,7)}@example.com`;
  const password='QaSmoke!'+Math.random().toString(36).slice(2,10)+'9';
  await desktop.goto(base+'/',{waitUntil:'domcontentloaded'});
  const signup=await desktop.request.post(base+'/api/auth/signup',{data:{fullName:'Production QA Student',email,password}});
  const signupBody=await signup.json().catch(()=>({}));
  if(signup.ok() && signupBody.ok===true) ok('Student registration',`${signupBody.needsEmailVerification?'verification required':'session issued'}`); else fail('Student registration',`HTTP ${signup.status()} ${JSON.stringify(signupBody)}`);
  let userId=signupBody?.user?.id;
  if(!userId && supabaseUrl && adminKey){
    const list=await fetch(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,{headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`}});
    if(list.ok){ const data=await list.json(); userId=data.users?.find(u=>u.email===email)?.id; }
  }
  if(userId) ok('Supabase Auth user created'); else fail('Supabase Auth user created','Could not locate test user');
  if(userId && supabaseUrl && adminKey){
    const profile=await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name`,{headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`} });
    const rows=profile.ok?await profile.json():[];
    if(rows.length===1 && rows[0].id===userId) ok('Student profile created'); else fail('Student profile created',`HTTP ${profile.status} rows=${rows.length}`);
  }

  let authenticated = (await context.cookies(base)).some(c=>c.name==='ikc_session' && c.value);
  let courseId=''; let lessonId=''; let enrolled=false;
  if (!authenticated && userId && supabaseUrl && adminKey) {
    if(signupBody.needsEmailVerification) ok('Email verification required state','Signup did not create a session before verification; no fake email-verification pass was recorded.');
    const confirm = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`,{method:'PUT',headers:adminHeaders(),body:JSON.stringify({email_confirm:true})});
    if(confirm.ok) ok('QA verification bypass for downstream tests','Admin-only test account confirmation; real email link remains separately unverified.'); else fail('QA verification bypass for downstream tests',`HTTP ${confirm.status}`);
    const signin=await desktop.request.post(base+'/api/auth/signin',{data:{email,password}});
    if(signin.ok()) { authenticated=true; ok('Sign in'); } else fail('Sign in',`HTTP ${signin.status()} ${await signin.text()}`);
  } else if(authenticated) ok('Sign in/session established');

  if(authenticated){
    const me=await desktop.request.get(base+'/api/auth/me'); if(me.ok() && (await me.json()).user?.id===userId) ok('Session identity'); else fail('Session identity',`HTTP ${me.status()}`);
    await desktop.goto(base+'/dashboard',{waitUntil:'networkidle'});
    if((await desktop.locator('body').innerText()).includes('Student Dashboard')) ok('Dashboard UI'); else fail('Dashboard UI','dashboard content missing');
    const dash=await desktop.request.get(base+'/api/learning/dashboard'); const db=await dash.json().catch(()=>({}));
    if(dash.ok() && Array.isArray(db.courses) && db.courses.length===4) ok('Course loading',`courses=${db.courses.length}`); else fail('Course loading',`HTTP ${dash.status()} ${JSON.stringify(db)}`);
    courseId=db.courses?.[0]?.id || '';
    if(courseId){
      const en=await desktop.request.post(base+'/api/learning/enroll',{data:{courseId}}); const eb=await en.json().catch(()=>({}));
      if(en.ok()) { enrolled=true; ok('Enrollment',`course=${courseId}`); } else fail('Enrollment',`HTTP ${en.status()} ${JSON.stringify(eb)}`);
    }
    if(enrolled){
      const course=await desktop.request.get(base+`/api/learning/courses/${courseId}`); const cb=await course.json().catch(()=>({}));
      if(course.ok() && Array.isArray(cb.modules) && Array.isArray(cb.lessons) && cb.modules.length>0 && cb.lessons.length>0){ ok('Module loading',`modules=${cb.modules.length}`); ok('Lesson list loading',`lessons=${cb.lessons.length}`); lessonId=cb.lessons[0].id; } else fail('Module/lesson loading',`HTTP ${course.status()} ${JSON.stringify(cb)}`);
      if(lessonId){
        await desktop.goto(base+`/lesson/${lessonId}`,{waitUntil:'networkidle'});
        if((await desktop.locator('body').innerText()).length>50) ok('Lesson UI and direct refresh'); else fail('Lesson UI and direct refresh','lesson page empty');
        const lesson=await desktop.request.get(base+`/api/learning/lessons/${lessonId}`); if(lesson.ok() && (await lesson.json()).lesson?.id===lessonId) ok('Lesson content loading'); else fail('Lesson content loading',`HTTP ${lesson.status()}`);
        const save=await desktop.request.put(base+'/api/learning/progress',{data:{lessonId,percent:100,status:'completed'}}); const sb=await save.json().catch(()=>({}));
        if(save.ok() && sb.progress?.status==='completed') ok('Lesson progress save'); else fail('Lesson progress save',`HTTP ${save.status()} ${JSON.stringify(sb)}`);
        const lessonAgain=await desktop.request.get(base+`/api/learning/lessons/${lessonId}`); const lb=await lessonAgain.json().catch(()=>({}));
        if(lessonAgain.ok() && lb.progress?.status==='completed') ok('Lesson progress persistence'); else fail('Lesson progress persistence',`HTTP ${lessonAgain.status()} ${JSON.stringify(lb)}`);
      }
      const courseUi=await desktop.goto(base+`/courses/${courseId}`,{waitUntil:'networkidle'}); if(courseUi?.ok()) ok('Course UI direct refresh'); else fail('Course UI direct refresh',`HTTP ${courseUi?.status()}`);
    }

    await desktop.request.post(base+'/api/auth/signout');
    const meOut=await desktop.request.get(base+'/api/auth/me'); if(meOut.ok() && !(await meOut.json()).user) ok('Logout'); else fail('Logout',`HTTP ${meOut.status()}`);
    const signin=await desktop.request.post(base+'/api/auth/signin',{data:{email,password}}); if(signin.ok()) ok('Sign back in'); else fail('Sign back in',`HTTP ${signin.status()}`);
    const refresh=await desktop.reload({waitUntil:'networkidle'}); if(refresh?.ok()) ok('Session persistence after refresh'); else fail('Session persistence after refresh',`HTTP ${refresh?.status()}`);
  }

  const protectedDashboard=await desktop.request.get(base+'/api/learning/dashboard');
  if(protectedDashboard.status()===401) ok('Unauthenticated dashboard protection'); else fail('Unauthenticated dashboard protection',`HTTP ${protectedDashboard.status()}`);

  if(userId && supabaseUrl && adminKey && courseId){
    const secondEmail=`qa-isolation-${Date.now()}@example.com`; const secondPassword='QaIso!'+Math.random().toString(36).slice(2,10)+'9';
    const second=await adminCreateConfirmedUser(secondEmail,secondPassword); const secondId=second?.user?.id;
    if(secondId){
      const signin2=await desktop.request.post(base+'/api/auth/signin',{data:{email:secondEmail,password:secondPassword}});
      if(signin2.ok()){
        const denied=await desktop.request.get(base+`/api/learning/courses/${courseId}`); if(denied.status()===403) ok('RLS/student isolation path','Second student cannot access first student course without enrollment.'); else fail('RLS/student isolation path',`HTTP ${denied.status()}`);
      } else fail('RLS/student isolation path','Second QA user could not sign in');
      await adminDeleteUser(secondId);
    } else fail('RLS/student isolation path','Could not create second QA user');
  }

  const secretNames=['SUPABASE_SECRET_KEY','RESEND_API_KEY','CLOUDFLARE_API_TOKEN'];
  const scripts=await desktop.evaluate(()=>Array.from(document.scripts).map(s=>s.src).filter(Boolean));
  for(const u of scripts){ const r=await desktop.request.get(u); const t=await r.text(); for(const n of secretNames) if(t.includes(n)) fail('Browser secret exposure',`${n} found in ${u}`); }
  ok('Browser bundle secret scan','no server secret names found');
  if(consoleErrors.length) fail('Desktop console',consoleErrors.slice(0,10).join(' | ')); else ok('Desktop console','no console errors');
  if(pageErrors.length) fail('Browser page errors',pageErrors.slice(0,10).join(' | ')); else ok('Browser page errors','none');
  if(requestFailures.length) fail('Browser network failures',requestFailures.slice(0,10).join(' | ')); else ok('Browser network failures','none');

  if(userId && await adminDeleteUser(userId)) ok('QA account cleanup');
  await browser.close();
  console.log(JSON.stringify({checks,failures},null,2));
  if(failures.length) process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1)});
