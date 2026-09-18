import { requireRoles, type RoleAuthEnv, type AuthorizedIdentity } from './authorization';

interface StaffEnv extends RoleAuthEnv {
  SUPABASE_SECRET_KEY: string;
  RESEND_API_KEY?: string;
}

const ADMIN_ROLES = ['platform_owner', 'super_admin', 'admin'];
const STAFF_ROLES = ['academic_director', 'ielts_tutor', 'student_support', 'content_editor', 'marketing', 'exam_manager', 'finance', 'read_only_auditor'];
const MANAGED_ROLES = [...STAFF_ROLES, 'admin', 'super_admin', 'platform_owner'];
const rank: Record<string, number> = { read_only_auditor: 10, finance: 10, exam_manager: 10, marketing: 10, content_editor: 10, student_support: 10, ielts_tutor: 10, academic_director: 10, admin: 80, super_admin: 90, platform_owner: 100 };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const error = (message: string, status = 400) => json({ message }, status);

async function adminSupabase(env: StaffEnv, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SECRET_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

function actorCanManage(actorRoles: string[], targetRoles: string[], newRole?: string) {
  const actor = Math.max(...actorRoles.map(r => rank[r] || -1));
  const target = Math.max(...targetRoles.map(r => rank[r] || 0), 0);
  if (actorRoles.includes('platform_owner')) return true;
  if (actorRoles.includes('super_admin')) return target < rank.super_admin && (!newRole || rank[newRole] < rank.super_admin);
  if (actorRoles.includes('admin')) return target < rank.admin && (!newRole || rank[newRole] < rank.admin);
  return false;
}

async function roleRows(env: StaffEnv, userId: string) {
  const r = await adminSupabase(env, `/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(userId)}&select=role_id,roles(id,name)`);
  if (!r.response.ok) throw new Error('roles');
  return Array.isArray(r.data) ? r.data : [];
}

async function safeUser(env: StaffEnv, id: string) {
  const r = await adminSupabase(env, `/auth/v1/admin/users/${encodeURIComponent(id)}`);
  return r.response.ok ? r.data : null;
}

async function audit(env: StaffEnv, actor: string, target: string, action: string, previous: unknown, next: unknown) {
  await adminSupabase(env, '/rest/v1/staff_audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor_user_id: actor, target_user_id: target, action, previous_value: previous, new_value: next }) });
}

async function getRoleId(env: StaffEnv, roleName: string) {
  const r = await adminSupabase(env, `/rest/v1/roles?name=eq.${encodeURIComponent(roleName)}&select=id,name`);
  if (!r.response.ok || !Array.isArray(r.data) || !r.data[0]) return null;
  return r.data[0].id as string;
}

async function getStaffRows(env: StaffEnv, search: string) {
  const users = await adminSupabase(env, '/auth/v1/admin/users?page=1&per_page=1000');
  if (!users.response.ok) throw new Error('users');
  const all = Array.isArray(users.data?.users) ? users.data.users : [];
  const profiles = await adminSupabase(env, '/rest/v1/profiles?select=id,full_name,profile_photo_url,phone_number,job_title,staff_active,employment_start_date,created_at,updated_at');
  if (!profiles.response.ok) throw new Error('profiles');
  const pmap = new Map((Array.isArray(profiles.data) ? profiles.data : []).map((p:any) => [p.id, p]));
  const rows: any[] = [];
  for (const u of all) {
    const rr = await roleRows(env, u.id);
    const roles = rr.map((x:any) => x?.roles?.name).filter((x:any) => MANAGED_ROLES.includes(x));
    if (!roles.length) continue;
    const p = pmap.get(u.id) || {};
    rows.push({ id:u.id, email:u.email||'', full_name:p.full_name||u.user_metadata?.full_name||'', phone_number:p.phone_number||'', profile_photo_url:p.profile_photo_url||'', job_title:p.job_title||'', staff_active:p.staff_active !== false, employment_start_date:p.employment_start_date||null, created_at:p.created_at||u.created_at||null, last_sign_in_at:u.last_sign_in_at||null, roles });
  }
  const q = search.toLowerCase();
  return q ? rows.filter(r => [r.email,r.full_name,r.phone_number,r.job_title,...r.roles].join(' ').toLowerCase().includes(q)) : rows;
}

export async function handleStaffAdmin(request: Request, env: StaffEnv, path: string, method: string, body: any): Promise<Response | null> {
  if (!path.startsWith('/api/admin/staff')) return null;
  const auth = await requireRoles(env, request, ADMIN_ROLES);
  if (auth.response) return auth.response;
  const identity = auth.identity as AuthorizedIdentity;
  const actorId = identity.user.id;

  try {
    if (method === 'GET' && path === '/api/admin/staff') {
      const search = new URL(request.url).searchParams.get('search')?.trim() || '';
      return json({ ok:true, staff: await getStaffRows(env, search) });
    }

    const match = path.match(/^\/api\/admin\/staff\/([^/]+)$/);
    const inviteMatch = path.match(/^\/api\/admin\/staff\/([^/]+)\/invite$/);
    const avatarMatch = path.match(/^\/api\/admin\/staff\/([^/]+)\/avatar$/);
    if (method === 'GET' && match) {
      const targetId = decodeURIComponent(match[1]);
      const [u, p, rr, logs] = await Promise.all([
        safeUser(env, targetId),
        adminSupabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=id,full_name,profile_photo_url,phone_number,job_title,staff_active,employment_start_date,created_at,updated_at`),
        roleRows(env, targetId),
        adminSupabase(env, `/rest/v1/staff_audit_log?target_user_id=eq.${encodeURIComponent(targetId)}&select=id,actor_user_id,action,previous_value,new_value,created_at&order=created_at.desc&limit=50`)
      ]);
      if (!u) return error('Staff account not found.', 404);
      const roles = rr.map((x:any)=>x?.roles?.name).filter(Boolean);
      const profile = Array.isArray(p.data) ? p.data[0] || null : null;
      return json({ ok:true, staff:{ id:targetId,email:u.email||'',full_name:profile?.full_name||u.user_metadata?.full_name||'',phone_number:profile?.phone_number||'',profile_photo_url:profile?.profile_photo_url||'',job_title:profile?.job_title||'',staff_active:profile?.staff_active!==false,employment_start_date:profile?.employment_start_date||null,created_at:profile?.created_at||u.created_at||null,last_sign_in_at:u.last_sign_in_at||null,roles}, audit:Array.isArray(logs.data)?logs.data:[] });
    }

    if (method === 'POST' && path === '/api/admin/staff') {
      const email = String(body.email||'').trim().toLowerCase();
      const fullName = String(body.fullName||'').trim();
      const role = String(body.role||'').trim();
      if (!email || !fullName || !MANAGED_ROLES.includes(role)) return error('Email, full name and a valid staff role are required.', 400);
      if (!actorCanManage(identity.roles, [], role)) return error('You cannot assign this role.', 403);
      const existingUsers = await adminSupabase(env, '/auth/v1/admin/users?page=1&per_page=1000');
      if (!existingUsers.response.ok) return error('Unable to check existing accounts.', 502);
      const existing = (existingUsers.data?.users||[]).find((u:any)=>String(u.email||'').toLowerCase()===email);
      let targetId = existing?.id;
      let invitationSent = false;
      if (!targetId) {
        const invited = await adminSupabase(env, '/auth/v1/invite', { method:'POST', body:JSON.stringify({ email, data:{ full_name:fullName } }) });
        if (!invited.response.ok || !invited.data?.user?.id) return error('Unable to send the staff invitation.', 502);
        targetId = invited.data.user.id;
        invitationSent = true;
      }
      const existingRoles = (await roleRows(env, targetId)).map((x:any)=>x?.roles?.name).filter(Boolean);
      if (existingRoles.some((r:string)=>rank[r] >= rank.admin) && !identity.roles.includes('platform_owner')) return error('Only the platform owner can manage an administrator account.', 403);
      if (!actorCanManage(identity.roles, existingRoles, role) || targetId === actorId) return error('You cannot manage this account or assign this role.', 403);
      const roleId = await getRoleId(env, role);
      if (!roleId) return error('Role not found.', 400);
      const profile = await adminSupabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`);
      const previous = { roles: existingRoles, staff_active: profile.data?.[0]?.staff_active ?? null };
      if (existingRoles.length) await adminSupabase(env, `/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}`, { method:'DELETE' });
      const assigned = await adminSupabase(env, '/rest/v1/profile_roles', { method:'POST', body:JSON.stringify({ profile_id:targetId, role_id:roleId }) });
      if (!assigned.response.ok) return error('Unable to assign staff role.', 502);
      const profilePatch = { full_name:fullName, phone_number:body.phoneNumber?String(body.phoneNumber).trim():null, job_title:body.jobTitle?String(body.jobTitle).trim():null, employment_start_date:body.employmentStartDate||null, staff_active:true, updated_at:new Date().toISOString() };
      await adminSupabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, { method:'PATCH', body:JSON.stringify(profilePatch) });
      if (invitationSent) await adminSupabase(env, '/rest/v1/staff_invitations', { method:'POST', body:JSON.stringify({target_user_id:targetId,invited_email:email,role_id:roleId,invited_by_user_id:actorId,expires_at:new Date(Date.now()+7*86400000).toISOString()}) });
      await audit(env, actorId, targetId, 'staff_created', previous, { roles:[role], staff_active:true });
      return json({ ok:true, staffId:targetId, invitationSent }, 201);
    }

    if (method === 'PATCH' && match) {
      const targetId = decodeURIComponent(match[1]);
      if (targetId === actorId) return error('Self-management is not permitted for staff role administration.', 403);
      const targetRoles = (await roleRows(env,targetId)).map((x:any)=>x?.roles?.name).filter(Boolean);
      if (!targetRoles.length) return error('Staff account not found.',404);
      const newRole = body.role !== undefined ? String(body.role).trim() : undefined;
      if (newRole && !MANAGED_ROLES.includes(newRole)) return error('Invalid staff role.',400);
      if (!actorCanManage(identity.roles,targetRoles,newRole)) return error('You cannot modify this account or assign this role.',403);
      const currentHighest = Math.max(...targetRoles.map(r=>rank[r]||0));
      if (targetRoles.includes('platform_owner') && (body.staffActive === false || newRole && newRole !== 'platform_owner')) return error('The platform owner cannot be deactivated or demoted.',403);
      if (targetRoles.includes('platform_owner') && newRole === undefined && body.staffActive === false) return error('The platform owner cannot be deactivated.',403);
      const before = { roles:targetRoles, staff_active:undefined };
      const profileBefore = await adminSupabase(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=full_name,phone_number,job_title,staff_active,employment_start_date,profile_photo_url`);
      const bp = Array.isArray(profileBefore.data)?profileBefore.data[0]||{}:{};
      before.staff_active = bp.staff_active;
      if (newRole) {
        const roleId=await getRoleId(env,newRole); if(!roleId)return error('Role not found.',400);
        await adminSupabase(env,`/rest/v1/profile_roles?profile_id=eq.${encodeURIComponent(targetId)}`,{method:'DELETE'});
        const a=await adminSupabase(env,'/rest/v1/profile_roles',{method:'POST',body:JSON.stringify({profile_id:targetId,role_id:roleId})});
        if(!a.response.ok)return error('Unable to update staff role.',502);
      }
      const patch:any={updated_at:new Date().toISOString()};
      for(const [k,v] of [['full_name',body.fullName],['phone_number',body.phoneNumber],['job_title',body.jobTitle],['employment_start_date',body.employmentStartDate]] as any[]) if(v!==undefined) patch[k]=v===null?'':String(v).trim();
      if(body.staffActive!==undefined) patch.staff_active=Boolean(body.staffActive);
      if(Object.keys(patch).length>1) await adminSupabase(env,`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`,{method:'PATCH',body:JSON.stringify(patch)});
      if(body.staffActive===false && currentHighest===100) return error('The last platform owner cannot be deactivated.',403);
      await audit(env,actorId,targetId,'staff_updated',before,{roles:newRole?[newRole]:targetRoles,staff_active:body.staffActive!==undefined?Boolean(body.staffActive):bp.staff_active,profile:patch});
      return json({ok:true});
    }

    if (method === 'POST' && inviteMatch) {
      const targetId=decodeURIComponent(inviteMatch[1]);
      const targetRoles=(await roleRows(env,targetId)).map((x:any)=>x?.roles?.name).filter(Boolean);
      if(!targetRoles.length||!actorCanManage(identity.roles,targetRoles))return error('You cannot invite this account.',403);
      const u=await safeUser(env,targetId); if(!u?.email)return error('Staff account not found.',404);
      const sent=await adminSupabase(env,`/auth/v1/admin/users/${encodeURIComponent(targetId)}`,{method:'PUT',body:JSON.stringify({email_confirm:false})});
      if(!sent.response.ok) return error('Unable to prepare the invitation.',502);
      const invite=await adminSupabase(env,'/auth/v1/invite',{method:'POST',body:JSON.stringify({email:u.email,data:{full_name:u.user_metadata?.full_name||''}})});
      if(!invite.response.ok)return error('Unable to send the invitation.',502);
      const roleId=await getRoleId(env,targetRoles[0]); if(!roleId)return error('Role not found.',400);
      await adminSupabase(env,'/rest/v1/staff_invitations',{method:'POST',body:JSON.stringify({target_user_id:targetId,invited_email:u.email,role_id:roleId,invited_by_user_id:actorId,expires_at:new Date(Date.now()+7*86400000).toISOString()})});
      await audit(env,actorId,targetId,'staff_invited',null,{email:u.email,role:targetRoles[0]});
      return json({ok:true});
    }

    if (method === 'POST' && avatarMatch) {
      const targetId=decodeURIComponent(avatarMatch[1]);
      const targetRoles=(await roleRows(env,targetId)).map((x:any)=>x?.roles?.name).filter(Boolean);
      if(!targetRoles.length||!actorCanManage(identity.roles,targetRoles))return error('You cannot update this account.',403);
      const mime=String(body.mimeType||'');
      const b64=String(body.base64||'');
      if(!/^image\/(png|jpeg|webp)$/.test(mime)||!b64)return error('Avatar must be PNG, JPEG or WebP.',400);
      const raw=atob(b64.replace(/^data:[^;]+;base64,/,''));
      if(raw.length>2*1024*1024)return error('Avatar must be 2 MB or smaller.',400);
      const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
      const bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      const upload=await adminSupabase(env,`/storage/v1/object/staff-avatars/${encodeURIComponent(targetId)}.${ext}`,{method:'PUT',headers:{'Content-Type':mime,'x-upsert':'true'},body:bytes});
      if(!upload.response.ok)return error('Unable to upload avatar.',502);
      const url=`${env.SUPABASE_URL}/storage/v1/object/public/staff-avatars/${targetId}.${ext}`;
      const old=await adminSupabase(env,`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=profile_photo_url`);
      await adminSupabase(env,`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`,{method:'PATCH',body:JSON.stringify({profile_photo_url:url,updated_at:new Date().toISOString()})});
      await audit(env,actorId,targetId,'staff_avatar_updated',{profile_photo_url:old.data?.[0]?.profile_photo_url||null},{profile_photo_url:url});
      return json({ok:true,profilePhotoUrl:url});
    }

    return error('Unknown staff administration route.',404);
  } catch (e) {
    return error('Unable to complete the staff administration request.',502);
  }
}
