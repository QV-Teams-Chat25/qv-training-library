import React from 'react';
import ReactDOM from 'react-dom/client';
import MainRoutes from './routes';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <MainRoutes />
  </React.StrictMode>
);
