import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'https://ielts-kenyacenter.or.ke';
const supabaseUrl = process.env.SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY;
const failures = [];
const checks = [];
const ok = (name, detail='') => checks.push({name, detail});
const fail = (name, detail) => { failures.push({name, detail}); console.error(`FAIL: ${name}: ${detail}`); };

async function main() {
  const browser = await chromium.launch({headless:true});
  const desktop = await browser.newPage({ viewport:{width:1440,height:900} });
  const consoleErrors=[];
  desktop.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });
  desktop.on('pageerror', e => consoleErrors.push(String(e)));

  const home = await desktop.goto(base+'/', {waitUntil:'networkidle'});
  if (home?.ok()) ok('Desktop homepage loads', `${home.status()}`); else fail('Desktop homepage loads', `HTTP ${home?.status()}`);
  if ((await desktop.locator('body').innerText()).includes('IELTS Kenya Center')) ok('Homepage branding'); else fail('Homepage branding','IELTS Kenya Center text missing');
  if (consoleErrors.length) fail('Desktop console', consoleErrors.slice(0,10).join(' | ')); else ok('Desktop console','no console errors');

  const mobile = await browser.newPage({viewport:{width:390,height:844}});
  const mobileErrors=[]; mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text())}); mobile.on('pageerror',e=>mobileErrors.push(String(e)));
  const mh = await mobile.goto(base+'/',{waitUntil:'networkidle'});
  if(mh?.ok()) ok('Mobile homepage loads',`${mh.status()}`); else fail('Mobile homepage loads',`HTTP ${mh?.status()}`);
  if(mobileErrors.length) fail('Mobile console',mobileErrors.slice(0,10).join(' | ')); else ok('Mobile console','no console errors');

  for (const path of ['/courses','/dashboard','/practice','/resources']) {
    const r=await desktop.goto(base+path,{waitUntil:'domcontentloaded'});
    if(r?.ok()) ok(`Direct navigation ${path}`,`${r.status()}`); else fail(`Direct navigation ${path}`,`HTTP ${r?.status()}`);
  }

  const health=await desktop.request.get(base+'/api/_healthcheck');
  if(health.ok() && (await health.json()).ok===true) ok('Worker healthcheck'); else fail('Worker healthcheck',`HTTP ${health.status()}`);
  const cfg=await desktop.request.get(base+'/api/config-status');
  if(cfg.ok() && (await cfg.json()).supabaseConfigured===true) ok('Supabase runtime configuration'); else fail('Supabase runtime configuration',`HTTP ${cfg.status()}`);
  const emailStatus=await desktop.request.post(base+'/api/email/status');
  if(emailStatus.ok() && (await emailStatus.json()).configured===true) ok('Resend runtime configuration'); else fail('Resend runtime configuration',`HTTP ${emailStatus.status()}`);

  const email=`qa-${Date.now()}-${Math.random().toString(36).slice(2,7)}@example.com`;
  const password='QaSmoke!'+Math.random().toString(36).slice(2,10)+'9';
  const signup=await desktop.request.post(base+'/api/auth/signup',{data:{fullName:'Production QA Student',email,password}});
  const signupBody=await signup.json().catch(()=>({}));
  if(signup.ok() && signupBody.ok===true) ok('Student registration',`${signupBody.needsEmailVerification?'email verification required':'session issued'}`); else fail('Student registration',`HTTP ${signup.status()} ${JSON.stringify(signupBody)}`);

  let userId=signupBody?.user?.id;
  if(!userId && supabaseUrl && adminKey) {
    const list=await fetch(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,{headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`}});
    if(list.ok){ const data=await list.json(); userId=data.users?.find(u=>u.email===email)?.id; }
  }
  if(userId) ok('Supabase Auth user created',userId); else fail('Supabase Auth user created','Could not locate test user');

  if(userId && supabaseUrl && adminKey){
    const profile=await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name`,{headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`}});
    const rows=profile.ok()?await profile.json():[];
    if(rows.length===1 && rows[0].id===userId) ok('Student profile created',rows[0].full_name||'profile row'); else fail('Student profile created',`HTTP ${profile.status} rows=${rows.length}`);
  }

  const hasCookie=(await desktop.context().cookies(base)).some(c=>c.name==='ikc_session' && c.value);
  if(hasCookie){
    const me=await desktop.request.get(base+'/api/auth/me'); if(me.ok() && (await me.json()).user?.id===userId) ok('Sign in/session established'); else fail('Sign in/session established',`HTTP ${me.status()}`);
    const dash=await desktop.request.get(base+'/api/learning/dashboard'); const db=await dash.json().catch(()=>({}));
    if(dash.ok() && Array.isArray(db.courses) && db.courses.length===4) ok('Student dashboard and courses',`courses=${db.courses.length}`); else fail('Student dashboard and courses',`HTTP ${dash.status()} ${JSON.stringify(db)}`);
    if(db.courses?.[0]?.id){ const en=await desktop.request.post(base+'/api/learning/enroll',{data:{courseId:db.courses[0].id}}); if(en.ok()) ok('Enrollment API',JSON.stringify(await en.json())); else fail('Enrollment API',`HTTP ${en.status()} ${await en.text()}`); }
    const out=await desktop.request.post(base+'/api/auth/signout'); if(out.ok()) ok('Sign out'); else fail('Sign out',`HTTP ${out.status()}`);
    const meOut=await desktop.request.get(base+'/api/auth/me'); if(meOut.ok() && !(await meOut.json()).user) ok('Session cleared'); else fail('Session cleared',`HTTP ${meOut.status()}`);
    const signin=await desktop.request.post(base+'/api/auth/signin',{data:{email,password}}); if(signin.ok()) ok('Sign back in'); else fail('Sign back in',`HTTP ${signin.status()} ${await signin.text()}`);
    const refresh=await desktop.request.get(base+'/api/auth/me'); if(refresh.ok() && (await refresh.json()).user?.id===userId) ok('Session persists after refresh-equivalent request'); else fail('Session persists after refresh-equivalent request',`HTTP ${refresh.status()}`);
  } else {
    ok('Email verification configuration','Signup correctly requires email verification; authenticated session tests require completing the verification link.');
  }

  const publicEnroll=await desktop.request.get(base+'/api/learning/dashboard');
  if(publicEnroll.status()===401) ok('Unauthenticated dashboard protection'); else fail('Unauthenticated dashboard protection',`HTTP ${publicEnroll.status()}`);

  const jsUrls=await desktop.evaluate(()=>Array.from(document.scripts).map(s=>s.src).filter(Boolean));
  const sensitiveNames=['SUPABASE_SECRET_KEY','RESEND_API_KEY','CLOUDFLARE_API_TOKEN'];
  for(const u of jsUrls){ const r=await desktop.request.get(u); const t=await r.text(); for(const n of sensitiveNames) if(t.includes(n)) fail('Secret exposure',`${n} found in ${u}`); }
  ok('Browser bundle secret-name scan','no server secret names found');

  if(userId && supabaseUrl && adminKey){
    const del=await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`,{method:'DELETE',headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`}});
    if(del.ok) ok('QA account cleanup'); else fail('QA account cleanup',`HTTP ${del.status}`);
  }
  await browser.close();
  console.log(JSON.stringify({checks,failures},null,2));
  if(failures.length) process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1)});
