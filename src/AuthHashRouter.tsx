import { ComponentType } from 'react';
import { LoginPage, RegisterPage } from './AuthPages';
import { ForgotPasswordPage } from './LearningRoutes';
import { AuthCallbackPage, ResetPasswordPage, RouteApp } from './LearningRoutes';
import { AdminDashboardPage, StaffDashboardPage } from './RoleDashboards';

export function AuthHashRouter({ App }: { App: ComponentType }) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const type = hash.get('type');
  const path = window.location.pathname;

  // Supabase recovery links arrive at the site root with a recovery token.
  if (path === '/' && accessToken && type === 'recovery') return <ResetPasswordPage />;
  if (path === '/' && accessToken) return <AuthCallbackPage />;
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/admin/dashboard') return <AdminDashboardPage />;
  if (path === '/staff/dashboard') return <StaffDashboardPage />;

  // The completed recovery screen currently links to '/', so make that action
  // land directly on the branded sign-in page instead of the public homepage.
  if (path === '/' && document.referrer.includes('/reset-password')) {
    window.location.replace('/login');
    return null;
  }

  return <RouteApp App={App} />;
}
