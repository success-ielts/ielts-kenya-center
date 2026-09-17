import { ComponentType } from 'react';
import { LoginPage, RegisterPage } from './AuthPages';
import { AuthCallbackPage, ResetPasswordPage, RouteApp } from './LearningRoutes';

export function AuthHashRouter({ App }: { App: ComponentType }) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const type = hash.get('type');
  if (window.location.pathname === '/' && accessToken && type === 'recovery') return <ResetPasswordPage />;
  if (window.location.pathname === '/' && accessToken) return <AuthCallbackPage />;
  if (window.location.pathname === '/login') return <LoginPage />;
  if (window.location.pathname === '/register') return <RegisterPage />;
  return <RouteApp App={App} />;
}
