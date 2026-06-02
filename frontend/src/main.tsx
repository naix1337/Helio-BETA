// helio-app/frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/dashboard.css';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
