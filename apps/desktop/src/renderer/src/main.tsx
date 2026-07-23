import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installBrowserShim } from './lib/browser-shim';
import './index.css';

// Electron dışında (tarayıcıda) çalışıyorsa köprüyü taklit et — yalnızca dev.
installBrowserShim();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
