import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './lib/auth';
import { NATIVE_APP } from './lib/platform';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (NATIVE_APP) document.documentElement.classList.add('native-app');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </AuthProvider>
  </StrictMode>
);
