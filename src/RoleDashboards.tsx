import { useEffect, useState, type CSSProperties } from 'react';
import { api } from './api';

const shell: CSSProperties = { minHeight: '100vh', background: '#f7f5ef', padding: '32px 20px', color: '#18221f' };
const card: CSSProperties = { maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e7e3d9', borderRadius: 20, padding: 28, boxShadow: '0 12px 35px rgba(24,34,31,.06)' };

function RoleDashboard({ kind }: { kind: 'admin' | 'staff' }) {
  const [identity, setIdentity] = useState<any>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied'>('loading');

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('/api/auth/me');
        if (!me.data?.user) { setStatus('denied'); setError('Please sign in to continue.'); return; }
        const endpoint = kind === 'admin' ? '/api/admin/dashboard' : '/api/staff/dashboard';
        const result = await api.get(endpoint);
        setIdentity(result.data);
        setStatus('ready');
      } catch (err: any) {
        setStatus('denied');
        setError(err?.response?.data?.message || 'You are not authorized to access this area.');
      }
    })();
  }, [kind]);

  if (status === 'loading') return <main style={shell}><section style={card}>Checking your authorization…</section></main>;
  if (status === 'denied') return <main style={shell}><section style={card}><h1>Access denied</h1><p>{error}</p><a href="/">Return home</a></section></main>;

  const title = kind === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard';
  return <main style={shell}><section style={card}>
    <p style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>{kind === 'admin' ? 'ADMINISTRATION' : 'STAFF AREA'}</p>
    <h1>{title}</h1>
    <p>Secure role-authorized application shell. Operational modules will be added in later phases.</p>
    <div style={{ marginTop: 24, padding: 18, borderRadius: 12, background: '#f4f1e9' }}>
      <strong>Authorized roles</strong>
      <p style={{ marginBottom: 0 }}>{(identity?.roles || []).join(', ') || 'none'}</p>
    </div>
    <p style={{ marginTop: 24 }}><a href="/">Return home</a></p>
  </section></main>;
}

export function AdminDashboardPage() { return <RoleDashboard kind="admin" />; }
export function StaffDashboardPage() { return <RoleDashboard kind="staff" />; }
