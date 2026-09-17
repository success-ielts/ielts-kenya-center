import { ComponentType } from 'react';
import { AuthCallbackPage, ResetPasswordPage, RouteApp } from './LearningRoutes';

export function AuthHashRouter({ App }: { App: ComponentType }) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const type = hash.get('type');
  if (window.location.pathname === '/' && accessToken && type === 'recovery') return <ResetPasswordPage />;
  if (window.location.pathname === '/' && accessToken) return <AuthCallbackPage />;
  return <RouteApp App={App} />;
}
