import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthHashRouter } from './AuthHashRouter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthHashRouter App={App} />
  </StrictMode>
);
