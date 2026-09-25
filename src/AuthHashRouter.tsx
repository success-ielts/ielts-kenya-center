import { ComponentType } from 'react';
import { LoginPage, RegisterPage } from './AuthPages';
import { ForgotPasswordPage } from './LearningRoutes';
import { AuthCallbackPage, ResetPasswordPage, RouteApp } from './LearningRoutes';
import { AdminDashboardPage, StaffDashboardPage } from './RoleDashboards';

export function AuthHashRouter({ App }: { App: ComponentType }) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const params = new URLSearchParams(window.location.search);
  const accessToken = hash.get('access_token');
  const type = hash.get('type') || params.get('type');
  const code = params.get('code');
  const path = window.location.pathname;

  // Supabase recovery links can arrive at the site root using either the
  // legacy hash-token flow or the PKCE code flow. Both must open the
  // password-reset screen rather than silently authenticating the learner.
  if (path === '/' && ((accessToken && type === 'recovery') || (code && type === 'recovery'))) return <ResetPasswordPage />;
  if (path === '/' && accessToken) return <AuthCallbackPage />;
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/admin/dashboard') return <AdminDashboardPage />;
  if (path === '/staff/dashboard') return <StaffDashboardPage />;

  // The completed recovery screen links to the branded sign-in page.
  if (path === '/' && document.referrer.includes('/reset-password')) {
    window.location.replace('/login');
    return null;
  }

  return <RouteApp App={App} />;
}
