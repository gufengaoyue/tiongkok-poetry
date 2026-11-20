import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, getStoredTheme } from './theme';
import './styles.css';

applyTheme(getStoredTheme());

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE || undefined}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
